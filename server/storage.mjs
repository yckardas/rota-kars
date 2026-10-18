// Görsel ve video dosyaları için S3 uyumlu depolama (Railway Storage Bucket).
// Railway bucket'ları özeldir; dosyalar /media/<id>.<uzantı> adresinden kısa
// ömürlü imzalı (presigned) bağlantıya yönlendirilerek sunulur.
import { randomUUID } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AppError } from "./store.mjs";

// Railway: ENDPOINT, REGION, ACCESS_KEY_ID, SECRET_ACCESS_KEY, BUCKET.
// Diğer sağlayıcılar için AWS_* / S3_* adları da kabul edilir.
export function storageConfiguration(env = process.env) {
  const pick = (...names) => names.map((n) => env[n]).find(Boolean) || "";
  const config = {
    endpoint: pick("ENDPOINT", "S3_ENDPOINT", "AWS_ENDPOINT_URL_S3", "AWS_ENDPOINT_URL"),
    region: pick("REGION", "S3_REGION", "AWS_REGION", "AWS_DEFAULT_REGION") || "auto",
    accessKeyId: pick("ACCESS_KEY_ID", "S3_ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID"),
    secretAccessKey: pick("SECRET_ACCESS_KEY", "S3_SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY"),
    bucket: pick("BUCKET", "S3_BUCKET", "AWS_S3_BUCKET_NAME"),
    forcePathStyle: pick("S3_FORCE_PATH_STYLE") === "true",
  };
  if (Object.values(config).some((v) => typeof v === "string" && v.includes("${{")))
    throw new Error(
      "Bucket değişkenlerinden biri Railway referansı olarak çözülmemiş. Uygulama servisine bucket değişkenlerini referansla verin.",
    );
  config.configured = Boolean(
    config.endpoint && config.accessKeyId && config.secretAccessKey && config.bucket,
  );
  return config;
}

// Dosya türü uzantıya veya istemcinin söylediğine değil, ilk baytlara bakılarak belirlenir.
export function sniffMedia(buffer) {
  const b = buffer;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return { kind: "image", ext: "jpg", type: "image/jpeg" };
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { kind: "image", ext: "png", type: "image/png" };
  if (b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP")
    return { kind: "image", ext: "webp", type: "image/webp" };
  if (b.length >= 12 && b.toString("ascii", 4, 8) === "ftyp") {
    const brand = b.toString("ascii", 8, 12);
    if (/^(avif|avis)$/.test(brand)) return { kind: "image", ext: "avif", type: "image/avif" };
    if (!/^(heic|heix|mif1|qt  )$/.test(brand))
      return { kind: "video", ext: "mp4", type: "video/mp4" };
  }
  if (b.length >= 4 && b.readUInt32BE(0) === 0x1a45dfa3)
    return { kind: "video", ext: "webm", type: "video/webm" };
  return null;
}

export const MEDIA_LIMITS = { image: 8 * 1024 * 1024, video: 150 * 1024 * 1024 };
export const MEDIA_PATH = /^\/media\/([a-f0-9-]{36})\.(jpg|png|webp|avif|mp4|webm)$/;

export function createStorage({ env = process.env, db, clock = Date.now, client = null } = {}) {
  const config = storageConfiguration(env);
  const s3 =
    client ||
    (config.configured
      ? new S3Client({
          endpoint: config.endpoint,
          region: config.region,
          forcePathStyle: config.forcePathStyle,
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
        })
      : null);
  const signer = client?.sign || ((command, options) => getSignedUrl(s3, command, options));
  const ready = () => {
    if (!s3)
      throw new AppError(
        503,
        "Dosya depolama bağlı değil. Railway bucket değişkenlerini (ENDPOINT, ACCESS_KEY_ID, SECRET_ACCESS_KEY, BUCKET) tanımlayın.",
      );
  };
  return {
    configured: Boolean(s3),
    async upload(buffer, { name = "" } = {}) {
      ready();
      if (!Buffer.isBuffer(buffer) || !buffer.length)
        throw new AppError(400, "Dosya boş.");
      const media = sniffMedia(buffer);
      if (!media)
        throw new AppError(
          415,
          "Yalnız JPG, PNG, WebP, AVIF görsel veya MP4, WebM video yükleyebilirsiniz.",
        );
      if (buffer.length > MEDIA_LIMITS[media.kind])
        throw new AppError(
          413,
          `Dosya çok büyük. Görseller en fazla 8 MB, videolar en fazla 150 MB olabilir.`,
        );
      const id = randomUUID(),
        now = new Date(clock()),
        key = `uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${id}.${media.ext}`;
      await s3.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: buffer,
          ContentType: media.type,
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
      const doc = {
        id,
        key,
        kind: media.kind,
        type: media.type,
        ext: media.ext,
        size: buffer.length,
        name: String(name).replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 120),
        created_at: clock(),
      };
      await db.insert("media", id, doc);
      return { ...doc, url: `/media/${id}.${media.ext}` };
    },
    async list() {
      return (await db.find("media", {}, { sort: { created_at: -1 }, limit: 500 })).map(
        (m) => ({ ...m, url: `/media/${m.id}.${m.ext}` }),
      );
    },
    async remove(id) {
      ready();
      const m = await db.one("media", { _id: id });
      if (!m) throw new AppError(404, "Dosya bulunamadı.");
      await s3.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: m.key }));
      await db.remove("media", { _id: id });
    },
    // /media/<id>.<ext> → kısa ömürlü imzalı adres (video için Range istekleri desteklenir).
    async signedUrl(path) {
      ready();
      const match = MEDIA_PATH.exec(path);
      if (!match) throw new AppError(404, "Dosya bulunamadı.");
      const m = await db.one("media", { _id: match[1] });
      if (!m || m.ext !== match[2]) throw new AppError(404, "Dosya bulunamadı.");
      return signer(new GetObjectCommand({ Bucket: config.bucket, Key: m.key }), {
        expiresIn: 3600,
      });
    },
  };
}
