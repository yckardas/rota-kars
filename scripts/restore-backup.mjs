// Gece yedeğini listeler, doğrular ya da bir veritabanına geri yükler.
//
//   node --env-file=.env.yedek scripts/restore-backup.mjs --list
//   node --env-file=.env.yedek scripts/restore-backup.mjs --from rota-kars/2026-11-12.rkb --check
//   node --env-file=.env.yedek scripts/restore-backup.mjs --from rota-kars/2026-11-12.rkb --to-db rota-kars-deneme
//
// --from: depodaki anahtar ya da yerel bir .rkb dosyası.
// --check: yalnız indirir, açar ve koleksiyon sayılarını yazar; veritabanına dokunmaz.
// --to-db: MONGODB_URI'deki sunucuda bu adlı veritabanına yükler. Dolu koleksiyonların
//   üzerine yazmaz; yazması için --replace gerekir. Canlı veritabanına (MONGODB_DB)
//   yüklemek için ayrıca --overwrite-live istenir: önce ayrı bir veritabanına yükleyip
//   kontrol etmek her zaman daha güvenlidir.
// Gerekenler: BACKUP_* değişkenleri (depo ve şifreleme anahtarı), yüklemek için MONGODB_URI.
// Not: yolcu kimlik numaraları ayrıca PII_ENCRYPTION_KEY ile şifrelidir; geri yüklenen
// verinin okunabilmesi için uygulamanın aynı PII anahtarıyla çalışması gerekir.
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { MongoClient } from "mongodb";
import { createBackup, openBackup, parseBackup, restoreDatabase, backupConfiguration } from "../server/backup.mjs";
import { mongoConfiguration } from "../server/database.mjs";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const config = backupConfiguration();
if (config.error) fail(config.error);
if (!config.key) fail("BACKUP_ENCRYPTION_KEY tanımlı değil.");
const backup = createBackup({ db: null });
const from = value("--from");

if (flag("--list")) {
  if (!backup.configured) fail("Depo değişkenleri eksik: " + config.missing.join(", "));
  const keys = (await backup.listKeys()).sort((a, b) => String(b.key).localeCompare(String(a.key)));
  for (const k of keys) console.log(`${k.key}\t${Math.round(k.size / 1024)} KB\t${new Date(k.at).toISOString()}`);
  console.log(`${keys.length} yedek.`);
  process.exit(0);
}
if (!from) fail("Kullanım: --list | --from <anahtar veya dosya> (--check | --to-db <ad> [--replace])");

let parsed;
try {
  let sealed;
  if (existsSync(from)) sealed = await readFile(from);
  else {
    if (!backup.configured) fail("Depo değişkenleri eksik: " + config.missing.join(", "));
    sealed = await backup.readBody(from);
  }
  parsed = parseBackup(openBackup(sealed, config.key));
} catch (e) {
  fail(e?.message || String(e));
}
const total = Object.values(parsed.header.collections).reduce((a, b) => a + b, 0);
console.log(
  `Yedek: ${parsed.header.db} · ${new Date(parsed.header.created_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })} · ${total} belge`,
);
for (const [name, n] of Object.entries(parsed.header.collections)) console.log(`  ${name}: ${n}`);
if (flag("--check")) {
  console.log("Yedek sağlam: açıldı ve tüm satırlar sayıldı.");
  process.exit(0);
}

const target = value("--to-db");
if (!target) fail("Hedef veritabanı için --to-db <ad> verin (ya da yalnız doğrulamak için --check).");
const { uri, dbName } = mongoConfiguration();
if (!uri) fail("MONGODB_URI tanımlı değil.");
if (target === (dbName || "test") && !flag("--overwrite-live"))
  fail(`${target} canlı veritabanı görünüyor. Önce ayrı bir veritabanına yükleyin; gerçekten canlıya yazmak için --overwrite-live ekleyin.`);
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
try {
  await client.connect();
  const restored = await restoreDatabase(client.db(target), parsed, { replace: flag("--replace") });
  console.log(`${target} veritabanına yüklendi: ${Object.values(restored).reduce((a, b) => a + b, 0)} belge.`);
} catch (e) {
  fail("Geri yükleme durdu: " + (e?.message || e));
} finally {
  await client.close();
}
