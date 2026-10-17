import { DatabaseSync } from "node:sqlite";
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import mysql from "mysql2/promise";
export function mysqlConfiguration(env) {
  const unresolved = (value) =>
    typeof value === "string" && value.includes("${{");
  const url = env.MYSQL_URL;
  if (url) {
    if (unresolved(url))
      throw new Error(
        "MYSQL_URL Railway referansı henüz çözülmemiş. Uygulama servisine çözülmüş bağlantı değerlerini verin.",
      );
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("MYSQL_URL geçersiz. Bağlantı biçimini kontrol edin.");
    }
    if (parsed.protocol !== "mysql:")
      throw new Error("MYSQL_URL mysql:// biçiminde olmalı.");
    return {
      host: parsed.hostname,
      port: Number(parsed.port || 3306),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: decodeURIComponent(parsed.pathname.slice(1)),
    };
  }
  const config = {
    host: env.MYSQLHOST,
    port: Number(env.MYSQLPORT || 3306),
    user: env.MYSQLUSER,
    password: env.MYSQLPASSWORD,
    database: env.MYSQLDATABASE || env.MYSQL_DATABASE,
  };
  if (Object.values(config).some(unresolved))
    throw new Error("MySQL Railway referansları henüz çözülmemiş.");
  if (config.user === "root" && !config.password)
    config.password = env.MYSQL_ROOT_PASSWORD;
  if (
    !config.host ||
    !config.user ||
    !config.database ||
    !Number.isInteger(config.port) ||
    config.port < 1 ||
    config.port > 65535
  )
    throw new Error(
      "MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD ve MYSQLDATABASE alanlarını kontrol edin.",
    );
  return config;
}
export function mysqlSql(sql) {
  if (sql.startsWith("PRAGMA table_info(")) {
    const table = sql.match(/\((\w+)\)/)?.[1];
    return `SELECT COLUMN_NAME AS name FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='${table}'`;
  }
  return sql
    .replace(/INSERT OR IGNORE/gi, "INSERT IGNORE")
    .replace(/ON CONFLICT\([^)]*\) DO UPDATE SET/gi, "ON DUPLICATE KEY UPDATE")
    .replace(/excluded\.(\w+)/g, "VALUES($1)");
}
function mysqlDDL(sql) {
  return sql
    .replace(
      /\b([A-Za-z_]\w*)\s+TEXT\b/g,
      (_m, name) =>
        `${name} ${name === "permalink" ? "VARCHAR(500)" : name === "email" ? "VARCHAR(254)" : /^(id|token|token_hash|subject|provider|reference|referral_code|status|kind|source|purpose|dedupe_key|channel|event|key|owner|vehicle_model|method|external_reference)$|_id$/.test(name) ? "VARCHAR(191)" : "LONGTEXT"}`,
    )
    .replace(/\bINTEGER\b/g, "BIGINT");
}
export async function connectDatabase({
  path,
  env = process.env,
  driver,
} = {}) {
  const dialect =
      driver ||
      env.DATABASE_DRIVER ||
      (path === ":memory:"
        ? "sqlite"
        : env.MYSQL_URL || env.MYSQLHOST
          ? "mysql"
          : "sqlite"),
    scope = new AsyncLocalStorage();
  let native,
    pool,
    tail = Promise.resolve();
  const locked = async (fn) => {
    const previous = tail;
    let release;
    tail = new Promise((r) => (release = r));
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  };
  if (dialect === "mysql") {
    pool = mysql.createPool({
      ...mysqlConfiguration(env),
      waitForConnections: true,
      connectionLimit: 8,
      charset: "utf8mb4",
      supportBigNumbers: true,
      bigNumberStrings: false,
      ...(env.MYSQL_SSL === "true" ? { ssl: {} } : {}),
    });
    await pool.query(
      "CREATE TABLE IF NOT EXISTS app_mutex(id BIGINT PRIMARY KEY) ENGINE=InnoDB",
    );
    await pool.query("INSERT IGNORE INTO app_mutex VALUES(1)");
  } else if (dialect === "sqlite") {
    path = path || env.DATABASE_PATH || "./data/rota-kars.sqlite";
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    native = new DatabaseSync(path);
    native.exec(
      "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
    );
  } else throw new Error("DATABASE_DRIVER mysql veya sqlite olmalı.");
  async function access(fn) {
    if (scope.getStore()) return fn(scope.getStore());
    return dialect === "sqlite" ? locked(() => fn(native)) : fn(pool);
  }
  const db = {
    dialect,
    prepare(sql) {
      return {
        async all(...params) {
          return access(async (conn) => {
            if (dialect === "sqlite") return conn.prepare(sql).all(...params);
            const [rows] = await conn.execute(mysqlSql(sql), params);
            return rows;
          });
        },
        async get(...params) {
          return (await this.all(...params))[0];
        },
        async run(...params) {
          return access(async (conn) => {
            if (dialect === "sqlite") return conn.prepare(sql).run(...params);
            const [result] = await conn.execute(mysqlSql(sql), params);
            return {
              changes: result.affectedRows,
              lastInsertRowid: result.insertId,
            };
          });
        },
      };
    },
    async exec(sql) {
      if (dialect === "mysql") {
        if (sql.startsWith("PRAGMA ")) return;
        for (const statement of sql
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean))
          await access((conn) => conn.query(mysqlSql(mysqlDDL(statement))));
      } else await access((conn) => conn.exec(sql));
    },
    async transaction(fn) {
      if (scope.getStore()) return fn();
      if (dialect === "sqlite")
        return locked(async () => {
          native.exec("BEGIN IMMEDIATE");
          try {
            const value = await scope.run(native, fn);
            native.exec("COMMIT");
            return value;
          } catch (e) {
            native.exec("ROLLBACK");
            throw e;
          }
        });
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query("SELECT id FROM app_mutex WHERE id=1 FOR UPDATE");
        const value = await scope.run(conn, fn);
        await conn.commit();
        return value;
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    },
    async close() {
      if (pool) await pool.end();
      else await locked(() => native.close());
    },
  };
  return db;
}
