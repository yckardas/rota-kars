// MongoDB veri katmanı. Her eski SQL tablosu bir koleksiyondur; `_id` birincil
// anahtardır, diğer alan adları korunur. Belgeler okunurken `_id` çıkarılır.
//
// Tutarlılık: rezervasyon, kupon ve ödeme işlemleri tek bir transaction içinde
// çalışır. Her transaction önce ortak `app_mutex` belgesine yazar; böylece eşzamanlı
// transaction'lar sıraya girer (çakışan yazımda sürücü otomatik yeniden dener).
// Transaction için Mongo'nun replica set olarak çalışması gerekir.
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
// verir; adreste replica set ve yetki veritabanı yoksa güvenli varsayılanlar eklenir.
export function mongoConfiguration(env = process.env) {
  let autoReplicaSet = null;
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
    const replicaSet = env.MONGODB_REPLICA_SET ?? "rs0";
    if (replicaSet && !parsed.searchParams.has("replicaSet") && !parsed.searchParams.has("directConnection")) {
      parsed.searchParams.set("replicaSet", replicaSet);
      autoReplicaSet = replicaSet;
    }
    if (parsed.username && !parsed.searchParams.has("authSource"))
      parsed.searchParams.set("authSource", "admin");
    if (parsed.pathname === "") parsed.pathname = "/";
    uri = parsed.toString();
  }
  return { uri, dbName: env.MONGODB_DB || "", autoReplicaSet };
}

let memoryServer = null,
  memoryUsers = 0,
  memoryStopTimer = null;
// Testler ve hızlı denemeler için süreç başına tek, bellek içi replica set.
// Son bağlantı kapanınca kısa bir süre sonra durdurulur; böylece test süreci kapanabilir.
async function memoryUri() {
  clearTimeout(memoryStopTimer);
  memoryUsers++;
  if (!memoryServer) {
    const { MongoMemoryReplSet } = await import("mongodb-memory-server");
    memoryServer = MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
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
  let { uri, dbName, autoReplicaSet } = mongoConfiguration(env);
  const memory = path === ":memory:";
  if (memory) {
    uri = await memoryUri();
    dbName = "test_" + randomBytes(6).toString("hex");
  }
  if (!uri)
    throw new Error(
      "MONGODB_URI tanımlı değil. Yerelde `docker compose up -d mongo` çalıştırıp .env içine MONGODB_URI=mongodb://127.0.0.1:27017/rota-kars?replicaSet=rs0&directConnection=true yazın.",
    );
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 15000,
    retryWrites: true,
  });
  try {
    await client.connect();
  } catch (e) {
    await client.close().catch(() => {});
    // replicaSet adı eklenmiş ama sunucu replica set değilse sürücü yalnız zaman aşımı verir.
    if (autoReplicaSet && e?.name === "MongoServerSelectionError")
      throw new Error(
        `MongoDB'ye "${autoReplicaSet}" replica set'i olarak bağlanılamadı. Mongo servisi --replSet ${autoReplicaSet} ile başlatılıp rs.initiate() yapılmamış olabilir (docs/RAILWAY-AND-OPERATIONS.md). Adres ve parola doğruysa önce bunu kontrol edin.`,
      );
    throw new Error(
      "MongoDB'ye bağlanılamadı: " + String(e?.message || e).replace(/\/\/[^@/]*@/g, "//***@").slice(0, 200),
    );
  }
  // Transaction yalnız replica set (veya sharded) Mongo'da çalışır; tek düğümlü
  // sunucuda ilk rezervasyonda hata almak yerine açılışta net uyarı verilir.
  const hello = await client.db("admin").command({ hello: 1 });
  if (!hello.setName && hello.msg !== "isdbgrid") {
    await client.close();
    throw new Error(
      "MongoDB replica set olarak çalışmıyor. Rezervasyon transaction'ları için mongod --replSet rs0 ile başlatın ve rs.initiate() çalıştırın (docs/RAILWAY-AND-OPERATIONS.md).",
    );
  }
  const database = client.db(dbName || undefined);
  const scope = new AsyncLocalStorage();
  const session = () => scope.getStore();
  const opts = (extra = {}) => {
    const s = session();
    return s ? { ...extra, session: s } : extra;
  };
  const col = (name) => database.collection(name);
  await col("app_mutex").updateOne(
    { _id: "global" },
    { $setOnInsert: { n: 0 } },
    { upsert: true },
  );

  const db = {
    dialect: "mongodb",
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
    // Aynı _id varsa hata verir (transaction içinde de hata transaction'ı iptal eder).
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
    async transaction(fn) {
      if (session()) return fn();
      const s = client.startSession();
      try {
        let result;
        await s.withTransaction(
          async () => {
            await col("app_mutex").updateOne(
              { _id: "global" },
              { $inc: { n: 1 } },
              { session: s },
            );
            result = await scope.run(s, fn);
          },
          {
            readConcern: { level: "snapshot" },
            writeConcern: { w: "majority" },
          },
        );
        return result;
      } finally {
        await s.endSession();
      }
    },
    async close() {
      await client.close();
      if (memory) releaseMemory();
    },
  };
  return db;
}
