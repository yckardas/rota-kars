import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
// Yolcu kimlik numaraları veritabanında AES-256-GCM ile şifreli tutulur.
// Anahtar PII_ENCRYPTION_KEY (32 bayt, base64) ortam değişkeninden gelir; üretimde
// zorunludur. Anahtar değişirse eski kayıtlar okunamaz: anahtarı yedekleyin.
const PREFIX = "enc:v1:";
export function piiCipher(env = process.env) {
  let key;
  if (env.PII_ENCRYPTION_KEY) {
    key = Buffer.from(env.PII_ENCRYPTION_KEY, "base64");
    if (key.length !== 32)
      throw new Error(
        "PII_ENCRYPTION_KEY 32 baytlık base64 bir anahtar olmalı.",
      );
  } else if (env.NODE_ENV === "production")
    throw new Error(
      "Üretimde PII_ENCRYPTION_KEY tanımlanmalı (openssl rand -base64 32).",
    );
  else key = createHash("sha256").update("rota-kars-yerel-pii").digest();
  return {
    seal(text) {
      if (!text || String(text).startsWith(PREFIX)) return text;
      const iv = randomBytes(12),
        cipher = createCipheriv("aes-256-gcm", key, iv),
        body = Buffer.concat([
          cipher.update(String(text), "utf8"),
          cipher.final(),
        ]);
      return (
        PREFIX +
        Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64")
      );
    },
    open(value) {
      if (!value || !String(value).startsWith(PREFIX)) return value || "";
      const raw = Buffer.from(String(value).slice(PREFIX.length), "base64"),
        decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
      decipher.setAuthTag(raw.subarray(12, 28));
      return Buffer.concat([
        decipher.update(raw.subarray(28)),
        decipher.final(),
      ]).toString("utf8");
    },
    sealDetails(details = []) {
      return details.map((p) => ({ ...p, idNumber: this.seal(p.idNumber) }));
    },
    openDetails(details = []) {
      return (details || []).map((p) => ({
        ...p,
        idNumber: this.open(p.idNumber),
      }));
    },
  };
}
