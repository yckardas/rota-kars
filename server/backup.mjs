// Gece yedeği: veritabanının tamamı her gece şifrelenip ayrı bir S3 uyumlu
// depoya (Cloudflare R2) yazılır. Railway'in kendi yedeği ücretli planda olduğu
// için bu, verinin Railway dışında da bir kopyasının bulunmasını sağlar.
//
// Biçim: ilk satır başlık ({format, v, db, created_at, collections}), sonra her
// belge için bir satır ({"c": koleksiyon, "d": belge}). Belgeler EJSON (canonical)
// yazılır; ObjectId, Date ve ikili alanlar türüyle geri yüklenir.
// Satırlar gzip ile sıkıştırılır, sonra AES-256-GCM ile şifrelenir:
//   "RKB1" (4 bayt) + iv (12) + şifreli veri + doğrulama etiketi (16)
//
// Değişkenler (hepsi tanımlı değilse yedek sessizce kapalı kalır):
//   BACKUP_ENDPOINT, BACKUP_ACCESS_KEY_ID, BACKUP_SECRET_ACCESS_KEY, BACKUP_BUCKET,
//   BACKUP_ENCRYPTION_KEY (32 bayt, base64: openssl rand -base64 32),
//   BACKUP_REGION (varsayılan auto), BACKUP_PREFIX (varsayılan rota-kars/).
// Şifreleme anahtarı yalnız Railway'de durursa Railway hesabıyla birlikte kaybolabilir:
// bir kopyası parola yöneticisinde de saklanmalı. Anahtar olmadan yedek açılamaz.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { BSON } from "mongodb";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

const MAGIC = Buffer.from("RKB1");
const FORMAT = "rota-kars-backup";
const STATE_ID = "backup";
const HOUR = 3600000;
// Yedeğe girmeyen koleksiyonlar: süreç içi kilit; geri yüklemede yeniden kurulur.
const SKIP = new Set(["app_mutex"]);
// Türkiye 2016'dan beri yaz saati uygulamıyor: UTC+3 sabit.
const TR_OFFSET = 3 * HOUR;
export const BACKUP_HOUR = 3;
export const RETENTION = { daily: 7, weekly: 4, monthly: 12 };

export function backupConfiguration(env = process.env) {
  const config = {
    endpoint: env.BACKUP_ENDPOINT || "",
    region: env.BACKUP_REGION || "auto",
    accessKeyId: env.BACKUP_ACCESS_KEY_ID || "",
    secretAccessKey: env.BACKUP_SECRET_ACCESS_KEY || "",
    bucket: env.BACKUP_BUCKET || "",
    prefix: (env.BACKUP_PREFIX ?? "rota-kars/").replace(/^\/+/, ""),
    keyText: env.BACKUP_ENCRYPTION_KEY || "",
  };
  const required = {
    endpoint: "BACKUP_ENDPOINT",
    accessKeyId: "BACKUP_ACCESS_KEY_ID",
    secretAccessKey: "BACKUP_SECRET_ACCESS_KEY",
    bucket: "BACKUP_BUCKET",
    keyText: "BACKUP_ENCRYPTION_KEY",
  };
  config.missing = Object.entries(required)
    .filter(([k]) => !config[k])
    .map(([, name]) => name);
  config.configured = config.missing.length === 0;
  // Biri girilip diğerleri unutulduysa bunu sessizce geçmek yerine söyleriz.
  config.partial = !config.configured && config.missing.length < Object.keys(required).length;
  // Yanlış girilmiş bir değer siteyi açılışta düşürmez; yedek kapalı kalır ve
  // yönetim panelinde hata olarak görünür.
  config.error = null;
  if (Object.values(config).some((v) => typeof v === "string" && v.includes("${{")))
    config.error = "BACKUP_* değişkenlerinden biri Railway referansı olarak çözülmemiş.";
  else if (config.keyText) {
    const key = Buffer.from(config.keyText, "base64");
    if (key.length !== 32)
      config.error = "BACKUP_ENCRYPTION_KEY 32 baytlık base64 bir anahtar olmalı (openssl rand -base64 32).";
    else config.key = key;
  }
  if (config.error) {
    config.configured = false;
    config.partial = true;
  }
  delete config.keyText;
  return config;
}

export function sealBackup(plain, key) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv),
    body = Buffer.concat([cipher.update(gzipSync(plain, { level: 9 })), cipher.final()]);
  return Buffer.concat([MAGIC, iv, body, cipher.getAuthTag()]);
}

export function openBackup(sealed, key) {
  if (sealed.length < 32 || !sealed.subarray(0, 4).equals(MAGIC))
    throw new Error("Bu dosya bir Rota Kars yedeği değil.");
  const iv = sealed.subarray(4, 16),
    tag = sealed.subarray(sealed.length - 16),
    decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  let zipped;
  try {
    zipped = Buffer.concat([decipher.update(sealed.subarray(16, sealed.length - 16)), decipher.final()]);
  } catch {
    throw new Error("Yedek açılamadı: anahtar yanlış ya da dosya bozulmuş.");
  }
  return gunzipSync(zipped);
}

// Tüm koleksiyonları satır satır dışa aktarır.
export async function dumpDatabase(database, { clock = Date.now } = {}) {
  const names = (await database.listCollections({}, { nameOnly: true }).toArray())
    .map((c) => c.name)
    .filter((n) => !SKIP.has(n) && !n.startsWith("system."))
    .sort();
  const lines = [],
    collections = {};
  for (const name of names) {
    let n = 0;
    for await (const doc of database.collection(name).find({})) {
      lines.push(JSON.stringify({ c: name, d: BSON.EJSON.serialize(doc, { relaxed: false }) }));
      n++;
    }
    collections[name] = n;
  }
  const header = { format: FORMAT, v: 1, db: database.databaseName, created_at: clock(), collections };
  return { header, plain: Buffer.from([JSON.stringify(header), ...lines].join("\n") + "\n", "utf8") };
}

// Açılmış yedeği okur. Başlıktaki sayılar satırlarla tutmazsa dosya eksik demektir.
export function parseBackup(plain) {
  const text = plain.toString("utf8").split("\n").filter(Boolean),
    header = JSON.parse(text[0] || "{}");
  if (header.format !== FORMAT) throw new Error("Yedek başlığı tanınmadı.");
  const docs = {};
  for (const line of text.slice(1)) {
    const { c, d } = JSON.parse(line);
    (docs[c] ||= []).push(BSON.EJSON.deserialize(d, { relaxed: false }));
  }
  for (const [name, count] of Object.entries(header.collections))
    if ((docs[name]?.length || 0) !== count)
      throw new Error(`Yedek eksik: ${name} koleksiyonunda ${count} yerine ${docs[name]?.length || 0} belge var.`);
  return { header, docs };
}

// Hedef veritabanına yükler. Dolu bir koleksiyonun üzerine ancak replace ile yazar.
export async function restoreDatabase(database, { header, docs }, { replace = false } = {}) {
  const existing = new Set((await database.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  if (!replace)
    for (const name of Object.keys(header.collections))
      if (existing.has(name) && (await database.collection(name).estimatedDocumentCount()) > 0)
        throw new Error(`${name} koleksiyonu dolu. Üzerine yazmak için --replace kullanın.`);
  const restored = {};
  for (const name of Object.keys(header.collections)) {
    const col = database.collection(name);
    if (replace) await col.deleteMany({});
    const list = docs[name] || [];
    for (let i = 0; i < list.length; i += 500) await col.insertMany(list.slice(i, i + 500), { ordered: true });
    restored[name] = list.length;
  }
  return restored;
}

// Türkiye saatine göre gün (YYYY-MM-DD) ve saat.
export const trDay = (ms) => new Date(ms + TR_OFFSET).toISOString().slice(0, 10);
const trHour = (ms) => new Date(ms + TR_OFFSET).getUTCHours();
const keyDay = (key) => key.match(/(\d{4}-\d{2}-\d{2})\.rkb$/)?.[1] || null;
// ISO hafta (pazartesi başlar): yılın Perşembesine göre hesaplanır.
function isoWeek(day) {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3); // haftanın perşembesi
  const jan1 = Date.UTC(d.getUTCFullYear(), 0, 1);
  return `${d.getUTCFullYear()}-W${1 + Math.floor((d - jan1) / (7 * 86400000))}`;
}

// Hangi yedekler kalır: son 7 gün, son 4 haftanın her birinden en yenisi,
// son 12 ayın her birinden en yenisi. Tanınmayan dosyalara dokunulmaz.
export function selectExpired(keys, retention = RETENTION) {
  const dated = keys
    .map((key) => ({ key, day: keyDay(key) }))
    .filter((k) => k.day)
    .sort((a, b) => b.day.localeCompare(a.day));
  const keep = new Set();
  const pick = (bucketOf, limit) => {
    const seen = new Set();
    for (const k of dated) {
      const b = bucketOf(k.day);
      if (seen.has(b)) continue;
      if (seen.size >= limit) break;
      seen.add(b);
      keep.add(k.key);
    }
  };
  pick((d) => d, retention.daily);
  pick(isoWeek, retention.weekly);
  pick((d) => d.slice(0, 7), retention.monthly);
  return dated.filter((k) => !keep.has(k.key)).map((k) => k.key);
}

export function createBackup({ db, notifications = null, env = process.env, clock = Date.now, client = null } = {}) {
  const config = backupConfiguration(env);
  const s3 =
    client ||
    (config.configured
      ? new S3Client({
          endpoint: config.endpoint,
          region: config.region,
          forcePathStyle: true,
          credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
        })
      : null);
  const state = () => db.one("app_state", { _id: STATE_ID });
  const setState = (set) =>
    db.col("app_state").updateOne({ _id: STATE_ID }, { $set: set }, { upsert: true });
  async function listKeys() {
    const keys = [];
    let token;
    do {
      const page = await s3.send(
        new ListObjectsV2Command({ Bucket: config.bucket, Prefix: config.prefix, ContinuationToken: token }),
      );
      for (const o of page.Contents || []) keys.push({ key: o.Key, size: o.Size, at: o.LastModified });
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return keys;
  }
  async function readBody(key) {
    const r = await s3.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
    return Buffer.from(await r.Body.transformToByteArray());
  }
  // Yedek alınır, geri okunup açılarak doğrulanır, sonra eski yedekler budanır.
  async function run({ reason = "schedule" } = {}) {
    if (!s3) throw new Error("Gece yedeği yapılandırılmamış.");
    const started = clock();
    const { header, plain } = await dumpDatabase(db.database, { clock });
    const sealed = sealBackup(plain, config.key);
    const key = `${config.prefix}${trDay(started)}.rkb`;
    await s3.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: sealed,
        ContentType: "application/octet-stream",
        Metadata: { format: FORMAT, documents: String(Object.values(header.collections).reduce((a, b) => a + b, 0)) },
      }),
    );
    // Yazılan dosya gerçekten açılabiliyor mu? Açılamayan yedek, yedek değildir.
    const check = parseBackup(openBackup(await readBody(key), config.key));
    if (JSON.stringify(check.header.collections) !== JSON.stringify(header.collections))
      throw new Error("Yüklenen yedek doğrulanamadı.");
    const expired = selectExpired((await listKeys()).map((k) => k.key));
    if (expired.length)
      await s3.send(
        new DeleteObjectsCommand({ Bucket: config.bucket, Delete: { Objects: expired.map((Key) => ({ Key })) } }),
      );
    const result = {
      key,
      size: sealed.length,
      documents: Object.values(header.collections).reduce((a, b) => a + b, 0),
      collections: Object.keys(header.collections).length,
      pruned: expired.length,
      ms: clock() - started,
      reason,
    };
    await setState({
      last_success_at: clock(),
      last_success_day: trDay(started),
      last_key: key,
      last_size: result.size,
      last_documents: result.documents,
      last_error: null,
      failures: 0,
    });
    return result;
  }
  let busy = false;
  // Saatlik/10 dakikalık çağrılır: saat 03:00'ü geçmiş ve bugünün yedeği yoksa alır.
  // Hata olursa saatte bir yeniden dener; sahibine günde tek bildirim gider.
  async function tick() {
    if (!s3 || busy) return { skipped: true };
    const now = clock(),
      today = trDay(now);
    if (trHour(now) < BACKUP_HOUR) return { skipped: true };
    const s = await state();
    if (s?.last_success_day === today) return { skipped: true };
    if (s?.last_attempt_at && now - s.last_attempt_at < HOUR) return { skipped: true };
    busy = true;
    try {
      await setState({ last_attempt_at: now });
      return await run();
    } catch (e) {
      const message = String(e?.message || e).slice(0, 300);
      await setState({ last_error: message, last_error_at: clock(), failures: (s?.failures || 0) + 1 });
      await notifications
        ?.notifyAgency({
          subject: "Gece yedeği alınamadı",
          body: [
            "Veritabanının gece yedeği alınamadı. Saatte bir yeniden denenecek.",
            `Hata: ${message}`,
            s?.last_success_at
              ? `Son başarılı yedek: ${new Date(s.last_success_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}`
              : "Henüz başarılı bir yedek yok.",
          ].join("\n"),
          kind: "backup_failed",
          pushUrl: "/yonetim?sekme=integrations",
          dedupeKey: "backup-failed:" + today,
        })
        .catch(() => {});
      throw e;
    } finally {
      busy = false;
    }
  }
  async function status() {
    const s = (await state()) || {};
    return {
      configured: config.configured,
      partial: config.partial,
      missing: config.partial ? config.missing : [],
      configError: config.error,
      lastSuccessAt: s.last_success_at || null,
      lastSize: s.last_size || null,
      lastDocuments: s.last_documents || null,
      lastError: s.last_error || null,
      lastErrorAt: s.last_error_at || null,
      // 03:00'ten sonra ve bugünün yedeği yoksa, 30 saatten eski yedek "gecikmiş" sayılır.
      stale: config.configured && (!s.last_success_at || clock() - s.last_success_at > 30 * HOUR),
    };
  }
  return { configured: config.configured, partial: config.partial, run, tick, status, listKeys, readBody, config };
}
