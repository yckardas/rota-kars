// MongoDB veri katmanı. Her eski SQL tablosu bir koleksiyondur; `_id` birincil
// anahtardır, diğer alan adları korunur. Belgeler okunurken `_id` çıkarılır.
//
// Tutarlılık: rezervasyon, kupon ve ödeme işlemleri db.transaction() içinde çalışır.
// - Tek düğümlü Mongo (Railway varsayılanı): işlemler uygulama içinde sıraya girer.
// - Replica set: gerçek Mongo transaction'ı; her biri önce `app_mutex` belgesine
//   yazdığı için eşzamanlı transaction'lar yine sıraya girer.
import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";
import { MongoClient } from "mongodb";

// Eski kayıtlarda metin olarak saklanmış JSON değerlerini de kabul eder.
export const fromJson = (value, fallback = null) => {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

// Railway Mongo şablonu MONGO_URL (veya MONGOHOST/MONGOPORT/MONGOUSER/MONGOPASSWORD)
// verir. Tek düğümlü Mongo ile de çalışır; replicaSet parametresi yalnız açıkça
// verilirse (adreste veya MONGODB_REPLICA_SET ile) kullanılır.
export function mongoConfiguration(env = process.env) {
  let uri = env.MONGODB_URI || env.MONGO_URL || env.DATABASE_URL || "";
  if (!uri && env.MONGOHOST) {
    const auth = env.MONGOUSER
      ? `${encodeURIComponent(env.MONGOUSER)}:${encodeURIComponent(env.MONGOPASSWORD || "")}@`
      : "";
    uri = `mongodb://${auth}${env.MONGOHOST}:${env.MONGOPORT || 27017}/`;
  }
  if (uri.includes("${{"))
    throw new Error(
      "MONGODB_URI Railway referansı çözülmemiş. Uygulama servisine Mongo servisinin bağlantı değişkenini referans olarak verin.",
    );
  if (uri && !/^mongodb(\+srv)?:\/\//.test(uri))
    throw new Error("MONGODB_URI mongodb:// veya mongodb+srv:// ile başlamalı.");
  if (uri && !uri.startsWith("mongodb+srv://")) {
    let parsed;
    try {
      parsed = new URL(uri);
    } catch {
      throw new Error("MONGODB_URI geçersiz. Bağlantı biçimini kontrol edin.");
    }
    if (env.MONGODB_REPLICA_SET && !parsed.searchParams.has("replicaSet"))
      parsed.searchParams.set("replicaSet", env.MONGODB_REPLICA_SET);
    if (parsed.username && !parsed.searchParams.has("authSource"))
      parsed.searchParams.set("authSource", "admin");
    if (parsed.pathname === "") parsed.pathname = "/";
    uri = parsed.toString();
  }
  return { uri, dbName: env.MONGODB_DB || "" };
}

const hideCredentials = (text) =>
  String(text || "").replace(/\/\/[^@/]*@/g, "//***@").slice(0, 300);

let memoryServer = null,
  memoryUsers = 0,
  memoryStopTimer = null;
// Testler ve hızlı denemeler için süreç başına tek, bellek içi Mongo. Varsayılan
// olarak replica set (transaction modu); MONGODB_TEST_STANDALONE=1 ile Railway'deki
// gibi tek düğüm (sıralı işlem modu). Son bağlantı kapanınca kısa süre sonra durur.
async function memoryUri() {
  clearTimeout(memoryStopTimer);
  memoryUsers++;
  if (!memoryServer) {
    const { MongoMemoryReplSet, MongoMemoryServer } = await import("mongodb-memory-server");
    memoryServer =
      process.env.MONGODB_TEST_STANDALONE === "1"
        ? MongoMemoryServer.create()
        : MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  }
  return (await memoryServer).getUri();
}
function releaseMemory() {
  if (--memoryUsers > 0 || !memoryServer) return;
  memoryStopTimer = setTimeout(async () => {
    const server = memoryServer;
    memoryServer = null;
    await (await server).stop({ doCleanup: true, force: true }).catch(() => {});
  }, 300);
}

const strip = (doc) => {
  if (!doc) return doc ?? null;
  const { _id, ...rest } = doc;
  return rest;
};

export async function connectDatabase({ path, env = process.env } = {}) {
  let { uri, dbName } = mongoConfiguration(env);
  const memory = path === ":memory:";
  if (memory) {
    uri = await memoryUri();
    dbName = "test_" + randomBytes(6).toString("hex");
  }
  if (!uri)
    throw new Error(
      "MONGODB_URI tanımlı değil. Yerelde `docker compose up -d mongo` çalıştırıp .env içine MONGODB_URI=mongodb://127.0.0.1:27017/ yazın. Railway'de MONGO_URL değişkenini Mongo servisine referansla verin.",
    );
  if (!memory) {
    // Teşhis: hangi sunucuya bağlanıldığı (kullanıcı adı/parola yazılmaz).
    let target = "mongodb+srv";
    try {
      const u = new URL(uri);
      target = `${u.hostname}:${u.port || 27017}`;
    } catch {}
    const source = env.MONGODB_URI ? "MONGODB_URI" : env.MONGO_URL ? "MONGO_URL" : env.DATABASE_URL ? "DATABASE_URL" : "MONGOHOST";
    console.log(`MongoDB'ye bağlanılıyor: ${target} (veritabanı: ${dbName || "varsayılan"}, kaynak: ${source})`);
    // Railway: servis adı olmadan yazılan ${{RAILWAY_PRIVATE_DOMAIN}} uygulamanın KENDİ
    // adresine çözülür; Mongo yerine kendine bağlanmaya çalışır (ECONNREFUSED).
    if (env.RAILWAY_PRIVATE_DOMAIN && target.split(":")[0] === env.RAILWAY_PRIVATE_DOMAIN)
      throw new Error(
        `${source} uygulamanın kendi adresini (${env.RAILWAY_PRIVATE_DOMAIN}) gösteriyor, Mongo servisini değil. Railway'de uygulama servisinin Variables sekmesinde ${source} değişkenini silip "Add Reference" ile Mongo servisinin MONGO_URL değişkenine referans verin (örn. \${{MongoDB.MONGO_URL}}).`,
      );
  }
  // Mongo servisi uygulamayla aynı anda (re)start olabilir: hazır olana kadar
  // MONGODB_CONNECT_TIMEOUT_SECONDS (varsayılan 90) boyunca yeniden denenir.
  const deadline =
    Date.now() + (memory ? 0 : Number(env.MONGODB_CONNECT_TIMEOUT_SECONDS || 90) * 1000);
  let client;
  for (let attempt = 1; ; attempt++) {
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000, retryWrites: true });
    try {
      await client.connect();
      break;
    } catch (e) {
      await client.close().catch(() => {});
      const detail = hideCredentials(e?.message || e);
      if (Date.now() >= deadline) {
        const hint = /ECONNREFUSED/.test(detail)
          ? " Mongo servisinin adresine ulaşıldı ama portta dinleyen yok: Mongo servisi çalışıyor mu, ve tüm adresleri dinliyor mu (mongod --ipv6 --bind_ip ::,0.0.0.0)?"
          : /Authentication failed/i.test(detail)
            ? " Kullanıcı adı/parola hatalı: MONGO_URL'i Mongo servisinin değişkenine referansla verin."
            : "";
        throw new Error("MongoDB'ye bağlanılamadı: " + detail + hint);
      }
      console.error(`MongoDB bekleniyor (deneme ${attempt}): ${detail.slice(0, 120)}`);
      await new Promise((r) => setTimeout(r, Math.min(10000, 2000 * attempt)));
    }
  }
  // Replica set (veya sharded) ise gerçek transaction; tek düğümde ise uygulama içi sıra.
  const hello = await client.db("admin").command({ hello: 1 });
  const mode =
    env.MONGODB_TRANSACTIONS === "off" || (!hello.setName && hello.msg !== "isdbgrid")
      ? "serialized"
      : "transactions";
  const database = client.db(dbName || undefined);
  // scope: işlem içinde miyiz? Transaction modunda Mongo oturumunu taşır.
  const scope = new AsyncLocalStorage();
  const session = () => scope.getStore()?.session;
  const opts = (extra = {}) => {
    const s = session();
    return s ? { ...extra, session: s } : extra;
  };
  // Tek düğüm modu: işlemler süreç içinde sırayla çalışır (aynı anda tek işlem).
  // Uygulama tek kopya çalıştığı sürece koltuk/kupon/ödeme yarışlarını engeller.
  let tail = Promise.resolve();
  const serialize = (fn) => {
    const store = { serialized: true, after: [] };
    const run = tail.then(() => scope.run(store, fn));
    tail = run.catch(() => {});
    return run.then(async (value) => {
      await runAfter(store.after);
      return value;
    });
  };
  // İşlem başarıyla bittikten sonra çalışacak işler (ör. bildirim kuyruğu). Hataları
  // işlemi geri almaz; kayda yazılır.
  const runAfter = async (hooks) => {
    for (const hook of hooks)
      try {
        await hook();
      } catch (e) {
        console.error(
          JSON.stringify({ level: "error", job: "after-commit", error: e?.name, message: String(e?.message || "").slice(0, 200) }),
        );
      }
  };
  const col = (name) => database.collection(name);
  await col("app_mutex").updateOne(
    { _id: "global" },
    { $setOnInsert: { n: 0 } },
    { upsert: true },
  );

  const db = {
    dialect: "mongodb",
    mode,
    client,
    database,
    col,
    session,
    opts,
    async find(name, filter = {}, { sort, limit, projection } = {}) {
      let cursor = col(name).find(filter, opts(projection ? { projection } : {}));
      if (sort) cursor = cursor.sort(sort);
      if (limit) cursor = cursor.limit(limit);
      return (await cursor.toArray()).map(strip);
    },
    async one(name, filter = {}, { sort } = {}) {
      return strip(await col(name).findOne(filter, opts(sort ? { sort } : {})));
    },
    async count(name, filter = {}) {
      return col(name).countDocuments(filter, opts());
    },
    // Aynı _id varsa hata verir. İşlemlerde yazmadan önce kontroller yapılır; böylece
    // tek düğüm modunda (geri alma olmadığı için) yarım kayıt kalmaz.
    async insert(name, _id, doc) {
      await col(name).insertOne({ _id, ...doc }, opts());
      return _id;
    },
    // "INSERT OR IGNORE": belge yoksa ekler, varsa dokunmaz. Hata üretmez.
    async insertIfAbsent(name, _id, doc) {
      const r = await col(name).updateOne(
        { _id },
        { $setOnInsert: doc },
        opts({ upsert: true }),
      );
      return Boolean(r.upsertedCount);
    },
    // "INSERT … ON CONFLICT DO UPDATE": belgeyi tümüyle yazar.
    async upsert(name, _id, doc) {
      await col(name).replaceOne({ _id }, doc, opts({ upsert: true }));
      return _id;
    },
    async update(name, filter, set, { unset } = {}) {
      const update = {};
      if (set && Object.keys(set).length) update.$set = set;
      if (unset) update.$unset = unset;
      const r = await col(name).updateOne(filter, update, opts());
      return r.matchedCount;
    },
    async updateMany(name, filter, set) {
      const r = await col(name).updateMany(filter, { $set: set }, opts());
      return r.modifiedCount;
    },
    async remove(name, filter) {
      return (await col(name).deleteMany(filter, opts())).deletedCount;
    },
    async index(name, keys, options = {}) {
      // Bellek içi test veritabanında yalnız davranışı etkileyen benzersiz
      // indeksler kurulur; performans indeksleri her testte zaman kaybettirir.
      if (memory && !options.unique) return;
      await col(name).createIndex(keys, options);
    },
    async ping() {
      await database.command({ ping: 1 });
    },
    inTransaction: () => Boolean(scope.getStore()),
    async afterCommit(fn) {
      const store = scope.getStore();
      if (store) store.after.push(fn);
      else await fn();
    },
    async transaction(fn) {
      if (scope.getStore()) return fn();
      if (mode === "serialized") return serialize(fn);
      const s = client.startSession();
      let after = [];
      try {
        let result;
        await s.withTransaction(
          async () => {
            await col("app_mutex").updateOne(
              { _id: "global" },
              { $inc: { n: 1 } },
              { session: s },
            );
            // Yeniden denemede önceki denemenin bekleyen işleri atılır.
            const store = { session: s, after: [] };
            result = await scope.run(store, fn);
            after = store.after;
          },
          {
            readConcern: { level: "snapshot" },
            writeConcern: { w: "majority" },
          },
        );
        await s.endSession();
        await runAfter(after);
        return result;
      } catch (e) {
        await s.endSession().catch(() => {});
        throw e;
      }
    },
    async close() {
      await client.close();
      if (memory) releaseMemory();
    },
  };
  return db;
}
