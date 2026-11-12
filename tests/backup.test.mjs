import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { ObjectId } from "mongodb";
import { openStore } from "../server/store.mjs";
import { createApp } from "../server/app.mjs";
import { roleAllows } from "../server/admin-auth.mjs";
import {
  backupConfiguration,
  createBackup,
  explainError,
  normalizeEndpoint,
  dumpDatabase,
  openBackup,
  parseBackup,
  restoreDatabase,
  sealBackup,
  selectExpired,
  trDay,
} from "../server/backup.mjs";

const KEY = randomBytes(32);
const ENV = {
  BACKUP_ENDPOINT: "https://example.r2.cloudflarestorage.com",
  BACKUP_ACCESS_KEY_ID: "test",
  BACKUP_SECRET_ACCESS_KEY: "test",
  BACKUP_BUCKET: "yedek",
  BACKUP_ENCRYPTION_KEY: KEY.toString("base64"),
};

// Bellek içi S3: yalnız yedeğin kullandığı komutlar.
function fakeS3() {
  const objects = new Map();
  const s3 = {
    objects,
    failPut: false,
    async send(command) {
      const name = command.constructor.name,
        input = command.input;
      if (name === "PutObjectCommand") {
        if (s3.failPut) throw new Error("R2 erişilemedi");
        objects.set(input.Key, Buffer.from(input.Body));
        return {};
      }
      if (name === "GetObjectCommand") {
        const body = objects.get(input.Key);
        if (!body) throw new Error("NoSuchKey");
        return { Body: { transformToByteArray: async () => new Uint8Array(body) } };
      }
      if (name === "ListObjectsV2Command")
        return {
          Contents: [...objects]
            .filter(([k]) => k.startsWith(input.Prefix || ""))
            .map(([Key, b]) => ({ Key, Size: b.length, LastModified: new Date() })),
        };
      if (name === "DeleteObjectsCommand") {
        for (const o of input.Delete.Objects) objects.delete(o.Key);
        return {};
      }
      throw new Error("Beklenmeyen komut: " + name);
    },
  };
  return s3;
}

async function setup(t, { now = Date.parse("2026-11-12T00:30:00Z") } = {}) {
  const clock = { now };
  const store = await openStore(":memory:", { clock: () => clock.now });
  t.after(() => store.db.close());
  const sent = [];
  const notifications = { notifyAgency: async (m) => sent.push(m) };
  const s3 = fakeS3();
  const backup = createBackup({ db: store.db, notifications, env: ENV, clock: () => clock.now, client: s3 });
  return { store, clock, sent, s3, backup };
}

test("yedek şifresi: doğru anahtarla açılır, yanlış anahtar ya da bozuk bayt reddedilir", () => {
  const plain = Buffer.from("merhaba\n".repeat(100));
  const sealed = sealBackup(plain, KEY);
  assert.equal(sealed.subarray(0, 4).toString(), "RKB1");
  assert.ok(!sealed.includes(Buffer.from("merhaba")), "şifreli dosyada düz metin kalmaz");
  assert.deepEqual(openBackup(sealed, KEY), plain);
  assert.throws(() => openBackup(sealed, randomBytes(32)), /anahtar yanlış/);
  const tampered = Buffer.from(sealed);
  tampered[40] ^= 1;
  assert.throws(() => openBackup(tampered, KEY), /bozulmuş/);
  assert.throws(() => openBackup(Buffer.from("PK".padEnd(64)), KEY), /yedeği değil/);
});

test("yapılandırma: eksik ya da hatalı değişken siteyi düşürmez, yedeği kapatır", () => {
  assert.equal(backupConfiguration({}).configured, false);
  assert.equal(backupConfiguration({}).partial, false);
  const partial = backupConfiguration({ BACKUP_BUCKET: "yedek" });
  assert.equal(partial.partial, true);
  assert.ok(partial.missing.includes("BACKUP_ENCRYPTION_KEY"));
  const badKey = backupConfiguration({ ...ENV, BACKUP_ENCRYPTION_KEY: "kisa" });
  assert.equal(badKey.configured, false);
  assert.match(badKey.error, /32 baytlık/);
  assert.equal(backupConfiguration(ENV).configured, true);
});

test("endpoint: sık yapılan yazım hataları düzeltilir, düzeltilemeyen açıkça söylenir", () => {
  const id = "0123456789abcdef0123456789abcdef",
    want = `https://${id}.r2.cloudflarestorage.com`;
  for (const raw of [
    want,
    `${id}.r2.cloudflarestorage.com`,
    `"${want}"`,
    ` ${want}/ `,
    `${want}/rota-kars-yedek`,
    id,
    id.toUpperCase(),
  ])
    assert.equal(normalizeEndpoint(raw), want, raw);
  assert.equal(normalizeEndpoint(""), "");
  for (const raw of ["rota-kars-yedek", "ftp://x.example.com", "https://", "abc def"])
    assert.equal(normalizeEndpoint(raw), null, raw);
  const bad = backupConfiguration({ ...ENV, BACKUP_ENDPOINT: "rota-kars-yedek" });
  assert.equal(bad.configured, false);
  assert.match(bad.error, /r2\.cloudflarestorage\.com biçiminde/);
  assert.deepEqual(bad.missing, []);
  const quoted = backupConfiguration({ ...ENV, BACKUP_BUCKET: ' "yedek" ', BACKUP_ACCESS_KEY_ID: "test\n" });
  assert.equal(quoted.bucket, "yedek");
  assert.equal(quoted.accessKeyId, "test");
});

test("depo hataları hangi değişkene bakılacağını söyler", () => {
  assert.match(explainError(new TypeError("Invalid URL")), /BACKUP_ENDPOINT/);
  assert.match(explainError({ name: "InvalidAccessKeyId", message: "x" }), /BACKUP_ACCESS_KEY_ID/);
  assert.match(explainError({ name: "SignatureDoesNotMatch", message: "x" }), /BACKUP_SECRET_ACCESS_KEY/);
  assert.match(explainError({ name: "NoSuchBucket", message: "x" }), /BACKUP_BUCKET/);
  assert.match(explainError({ name: "AccessDenied", message: "x" }), /Object Read & Write/);
  assert.match(explainError(new Error("getaddrinfo ENOTFOUND abc.r2")), /ulaşılamadı/);
});

test("elle yedek hatası da kaydedilir ve açıklanmış mesajla döner", async (t) => {
  const { s3, backup } = await setup(t);
  s3.failPut = true;
  s3.send = ((send) => async (c) => {
    if (c.constructor.name === "PutObjectCommand") throw Object.assign(new Error("denied"), { name: "AccessDenied" });
    return send(c);
  })(s3.send.bind(s3));
  await assert.rejects(backup.run({ reason: "manual" }), /Object Read & Write/);
  const status = await backup.status();
  assert.match(status.lastError, /Object Read & Write/);
  assert.ok(status.lastErrorAt);
});

test("saklama: son 7 gün, 4 hafta ve 12 ay kalır; tanınmayan dosyaya dokunulmaz", () => {
  const keys = [];
  for (let d = Date.parse("2025-06-01"); d <= Date.parse("2026-11-12"); d += 86400000)
    keys.push(`rota-kars/${new Date(d).toISOString().slice(0, 10)}.rkb`);
  keys.push("rota-kars/notlar.txt");
  const expired = new Set(selectExpired(keys));
  const kept = keys.filter((k) => !expired.has(k) && k.endsWith(".rkb"));
  assert.ok(!expired.has("rota-kars/notlar.txt"));
  for (const day of ["2026-11-12", "2026-11-06"]) assert.ok(kept.includes(`rota-kars/${day}.rkb`), day);
  assert.ok(kept.length >= 12 && kept.length <= 23, `kalan ${kept.length}`);
  const months = new Set(kept.map((k) => k.slice(10, 17)));
  assert.equal(months.size, 12, "son 12 ayın her birinden bir yedek");
  assert.ok(!kept.some((k) => k < "rota-kars/2025-12"), "12 aydan eski yedek kalmaz");
  // Tek yedek varken hiçbir şey silinmez.
  assert.deepEqual(selectExpired(["rota-kars/2026-11-12.rkb"]), []);
});

test("yedek alınır, geri okunarak doğrulanır ve ayrı veritabanına türleriyle geri yüklenir", async (t) => {
  const { store, s3, backup } = await setup(t);
  const id = new ObjectId(),
    at = new Date("2026-11-01T10:00:00Z");
  await store.db.col("restore_probe").insertOne({ _id: id, at, bytes: Buffer.from([1, 2, 3]), n: 7 });
  const reservations = await store.db.count("reservations");

  const r = await backup.run({ reason: "manual" });
  assert.equal(r.key, "rota-kars/2026-11-12.rkb");
  assert.ok(s3.objects.has(r.key));
  assert.ok(r.documents > 0);
  const status = await backup.status();
  assert.equal(status.configured, true);
  assert.equal(status.stale, false);
  assert.equal(status.lastSize, r.size);

  const parsed = parseBackup(openBackup(s3.objects.get(r.key), KEY));
  assert.ok(!("app_mutex" in parsed.header.collections), "süreç kilidi yedeğe girmez");
  const target = store.db.client.db(store.db.database.databaseName + "_geri");
  await restoreDatabase(target, parsed);
  const back = await target.collection("restore_probe").findOne({ _id: id });
  assert.ok(back._id instanceof ObjectId);
  assert.ok(back.at instanceof Date);
  assert.equal(back.at.getTime(), at.getTime());
  assert.deepEqual(Buffer.from(back.bytes.buffer), Buffer.from([1, 2, 3]));
  assert.equal(await target.collection("reservations").countDocuments(), reservations);
  // Dolu veritabanının üzerine izinsiz yazılmaz.
  await assert.rejects(restoreDatabase(target, parsed), /dolu/);
  await restoreDatabase(target, parsed, { replace: true });
  assert.equal(await target.collection("restore_probe").countDocuments(), 1);
  await target.dropDatabase();
});

test("eksik satırlı yedek reddedilir", async (t) => {
  const { store } = await setup(t);
  const { plain } = await dumpDatabase(store.db.database);
  const lines = plain.toString().trim().split("\n");
  assert.throws(() => parseBackup(Buffer.from(lines.slice(0, -1).join("\n"))), /Yedek eksik/);
});

test("zamanlama: 03:00'ten önce beklenir, günde bir yedek; hata saatte bir yeniden denenir ve tek bildirim gider", async (t) => {
  const { clock, sent, s3, backup } = await setup(t, { now: Date.parse("2026-11-11T23:30:00Z") });
  assert.equal(trDay(clock.now), "2026-11-12");
  assert.deepEqual(await backup.tick(), { skipped: true }, "Türkiye saatiyle 02:30");

  clock.now = Date.parse("2026-11-12T00:05:00Z"); // 03:05
  s3.failPut = true;
  await assert.rejects(backup.tick(), /R2 erişilemedi/);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].kind, "backup_failed");
  assert.equal(sent[0].dedupeKey, "backup-failed:2026-11-12");
  let status = await backup.status();
  assert.match(status.lastError, /R2/);
  assert.equal(status.stale, true);

  clock.now += 30 * 60000;
  assert.deepEqual(await backup.tick(), { skipped: true }, "bir saat dolmadan yeniden denenmez");

  s3.failPut = false;
  clock.now += 31 * 60000;
  const r = await backup.tick();
  assert.equal(r.key, "rota-kars/2026-11-12.rkb");
  status = await backup.status();
  assert.equal(status.lastError, null);
  assert.equal(status.stale, false);

  clock.now += 3 * 3600000;
  assert.deepEqual(await backup.tick(), { skipped: true }, "aynı gün ikinci yedek alınmaz");
  clock.now = Date.parse("2026-11-13T00:10:00Z");
  assert.equal((await backup.tick()).key, "rota-kars/2026-11-13.rkb");
});

test("yönetim: durum yöneticiye açık, elle yedek yalnız sahibe", async (t) => {
  assert.equal(roleAllows("operations", "GET", "/api/admin/backup"), true);
  assert.equal(roleAllows("operations", "POST", "/api/admin/backup"), false);
  assert.equal(roleAllows("guide", "GET", "/api/admin/backup"), false);
  const store = await openStore(":memory:");
  const server = createApp(store, { env: { ADMIN_PASSWORD: randomBytes(32).toString("hex") } }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await store.db.close();
  });
  const base = "http://127.0.0.1:" + server.address().port;
  const res = await fetch(base + "/api/admin/backup", { headers: { "X-Rota-Client": "web" } });
  assert.equal(res.status, 401);
});
