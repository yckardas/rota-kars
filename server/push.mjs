// Yönetici uygulamasına anlık bildirim. İki yol:
// - Android uygulaması: Firebase Cloud Messaging HTTP v1. FIREBASE_SERVICE_ACCOUNT:
//   Firebase konsolundan indirilen hizmet hesabı JSON'u (düz veya base64). Ayarlı
//   değilse Android bildirimleri sessizce atlanır.
// - Tarayıcıdan yüklenen uygulama (PWA): standart Web Push (VAPID). Anahtar çifti ilk
//   kullanımda üretilip veritabanında saklanır; WEB_PUSH_PUBLIC_KEY/PRIVATE_KEY ile
//   sabitlenebilir. Ek ayar gerekmez.
// Bildirimler yalnız sahip ve operasyon rolündeki, aktif yöneticilerin
// cihazlarına gider; rehberler müşteri bilgisi içeren bildirim almaz.
import { createHash, createPrivateKey, createSign } from "node:crypto";
import webpush from "web-push";

const RECIPIENT_ROLES = ["owner", "operations"];
const tokenId = (token) => createHash("sha256").update(String(token)).digest("hex");

// Railway/.env biçimleri farklı olabilir: düz JSON, base64, satır sonları gerçek
// yeni satıra dönüşmüş JSON. Okunamazsa nedeni döner (ekranda ve log'da gösterilir).
export function readServiceAccount(raw) {
  if (!raw || !String(raw).trim()) return { account: null, status: "missing" };
  let text = String(raw).trim();
  if (!text.startsWith("{")) {
    try {
      text = Buffer.from(text, "base64").toString("utf8").trim();
    } catch {
      return { account: null, status: "invalid", reason: "base64 çözülemedi" };
    }
  }
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    // Anahtarın içindeki "\n" kaçışları gerçek satır sonuna dönüşmüşse JSON bozulur:
    // gerekli üç alan doğrudan metinden okunur.
    const field = (name) => text.match(new RegExp(`"${name}"\\s*:\\s*"([^"]+)"`))?.[1];
    const key = text.match(/-----BEGIN PRIVATE KEY-----[\s\S]+?-----END PRIVATE KEY-----/)?.[0];
    if (field("project_id") && field("client_email") && key)
      data = { project_id: field("project_id"), client_email: field("client_email"), private_key: key };
  }
  if (!data?.project_id || !data?.client_email || !data?.private_key)
    return { account: null, status: "invalid", reason: "project_id, client_email veya private_key bulunamadı" };
  // Anahtar gövdesi her biçimde düzgün PEM'e çevrilir.
  const body = data.private_key
    .replaceAll("\\n", "\n")
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "")
    .replace(/[^A-Za-z0-9+/=]/g, "");
  const pem = `-----BEGIN PRIVATE KEY-----\n${body.match(/.{1,64}/g)?.join("\n")}\n-----END PRIVATE KEY-----\n`;
  try {
    createPrivateKey(pem);
  } catch {
    return { account: null, status: "invalid", reason: "private_key geçerli bir anahtar değil" };
  }
  return { account: { project_id: data.project_id, client_email: data.client_email, private_key: pem }, status: "ok" };
}

// Firebase hata kodlarının Türkçe açıklaması (test bildiriminde ekranda gösterilir).
const FCM_HINTS = {
  SERVICE_DISABLED: "Google Cloud'da Firebase Cloud Messaging API kapalı. Firebase → Project settings → Cloud Messaging ekranından etkinleştirin.",
  PERMISSION_DENIED: "Hizmet hesabının bildirim gönderme yetkisi yok. Firebase'den yeni bir özel anahtar oluşturun.",
  SENDER_ID_MISMATCH: "Telefondaki uygulama başka bir Firebase projesine bağlı (google-services.json ile anahtar farklı projelerden).",
  UNREGISTERED: "Telefonun bildirim kaydı geçersiz; uygulamada bildirimleri yeniden açın.",
  FCM_NOT_CONFIGURED: "Android uygulaması için Railway'de FIREBASE_SERVICE_ACCOUNT ayarlı değil. Tarayıcıdan yüklenen uygulama bundan etkilenmez.",
  invalid_grant: "Firebase anahtarı reddedildi (silinmiş ya da hatalı). Yeni bir özel anahtar oluşturup Railway'e girin.",
};
export const fcmHint = (code) => FCM_HINTS[code] || null;

// Sunucu yalnız bilinen tarayıcı bildirim servislerine istek atar (Chrome/Edge/
// Firefox/Safari); kayıt sırasında verilen adres başka bir yere yönlendirilemez.
const WEB_PUSH_HOSTS =
  /^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)$/;
export function webPushEndpointOk(endpoint) {
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && !u.port && !u.username && WEB_PUSH_HOSTS.test(u.hostname);
  } catch {
    return false;
  }
}

export function createPush(db, { env = process.env, fetchImpl = fetch, clock = Date.now, webPush = webpush } = {}) {
  const config = readServiceAccount(env.FIREBASE_SERVICE_ACCOUNT),
    account = config.account;
  let accessToken = null,
    tokenExpires = 0,
    vapid = null;
  const log = (level, message, extra = {}) =>
    console[level === "error" ? "error" : "log"](JSON.stringify({ level, job: "push", message, ...extra }));
  if (config.status === "invalid") log("error", "FIREBASE_SERVICE_ACCOUNT okunamadı: " + config.reason);
  else if (config.status === "ok") log("info", "Bildirim servisi hazır (proje: " + account.project_id + ")");

  async function oauthToken() {
    if (accessToken && clock() < tokenExpires) return accessToken;
    const now = Math.floor(clock() / 1000);
    const part = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const unsigned =
      part({ alg: "RS256", typ: "JWT" }) +
      "." +
      part({
        iss: account.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      });
    const signature = createSign("RSA-SHA256").update(unsigned).sign(account.private_key, "base64url");
    const res = await fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: unsigned + "." + signature,
      }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      const error = new Error(`Firebase yetkilendirmesi başarısız (${res.status} ${data.error || ""})`.trim());
      error.code = data.error || "auth_failed";
      throw error;
    }
    accessToken = data.access_token;
    tokenExpires = clock() + ((data.expires_in || 3600) - 120) * 1000;
    return accessToken;
  }

  // Birden çok sunucu aynı anda başlarsa da tek anahtar çifti kalır (insertIfAbsent).
  function vapidKeys() {
    if (env.WEB_PUSH_PUBLIC_KEY && env.WEB_PUSH_PRIVATE_KEY)
      return Promise.resolve({ publicKey: env.WEB_PUSH_PUBLIC_KEY, privateKey: env.WEB_PUSH_PRIVATE_KEY });
    vapid ||= (async () => {
      await db.insertIfAbsent("integration_settings", "web_push_vapid", {
        id: "web_push_vapid",
        body: webPush.generateVAPIDKeys(),
        updated_at: clock(),
      });
      return (await db.one("integration_settings", { _id: "web_push_vapid" })).body;
    })().catch((error) => {
      vapid = null;
      throw error;
    });
    return vapid;
  }
  const vapidSubject = /^https:\/\//.test(env.PUBLIC_BASE_URL || "") ? env.PUBLIC_BASE_URL : "https://rotakarsturizm.com";

  async function sendWeb(device, { title, body, url, kind }) {
    const keys = await vapidKeys();
    try {
      await webPush.sendNotification(device.subscription, JSON.stringify({ title, body, url: url || "/yonetim", kind: kind || "general" }), {
        vapidDetails: { subject: vapidSubject, ...keys },
        TTL: 24 * 3600,
        urgency: "high",
        timeout: 10000,
      });
      return "sent";
    } catch (e) {
      // 404/410: tarayıcı aboneliği bitirdi (izin geri alındı, site verisi silindi).
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await db.remove("push_devices", { _id: device.id });
        return "removed";
      }
      const error = new Error(`Web Push ${e?.statusCode || ""} ${e?.body || e?.message || e}`.trim().slice(0, 300));
      error.code = e?.statusCode ? "WEB_PUSH_" + e.statusCode : "WEB_PUSH";
      throw error;
    }
  }

  async function sendTo(device, message) {
    if (device.platform === "web") return sendWeb(device, message);
    const { title, body, url, kind } = message;
    const res = await fetchImpl(
      `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/messages:send`,
      {
        method: "POST",
        headers: { Authorization: "Bearer " + (await oauthToken()), "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token: device.token,
            notification: { title, body },
            data: { url: url || "/yonetim", kind: kind || "general" },
            android: {
              priority: "high",
              notification: { channel_id: "rota-yonetim", sound: "default" },
            },
          },
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (res.ok) return "sent";
    const reply = await res.json().catch(() => ({}));
    const reason = reply?.error?.details?.find((d) => d.reason)?.reason;
    const code = reply?.error?.details?.find((d) => d.errorCode)?.errorCode || reason || reply?.error?.status;
    // Yalnız telefon kaydı gerçekten geçersizse silinir (uygulama kaldırıldı/token yenilendi).
    // Mesaj içeriği hatası da INVALID_ARGUMENT döndürdüğü için yalnız token mesajı sayılır.
    const badToken =
      code === "UNREGISTERED" ||
      (res.status === 404 && code !== "SERVICE_DISABLED") ||
      (code === "INVALID_ARGUMENT" && /registration token/i.test(reply?.error?.message || ""));
    if (badToken) {
      await db.remove("push_devices", { _id: device.id });
      return "removed";
    }
    const error = new Error(`FCM ${res.status} ${code || ""} ${reply?.error?.message || ""}`.trim().slice(0, 300));
    error.code = code;
    throw error;
  }

  const api = {
    // enabled: Android (Firebase) hazır mı. Web Push her zaman açıktır.
    enabled: Boolean(account),
    status: config.status,
    statusReason: config.reason || null,
    webPublicKey: async () => (await vapidKeys()).publicKey,
    async register(adminId, { token, platform = "android", label = "", subscription = null }) {
      if (platform === "web") token = subscription.endpoint;
      const id = tokenId(token);
      // Aynı telefon başka bir yöneticiyle giriş yaparsa kayıt yeni yöneticiye geçer.
      await db.upsert("push_devices", id, {
        id,
        admin_id: adminId,
        token,
        platform,
        label: String(label).slice(0, 60),
        subscription: platform === "web" ? { endpoint: subscription.endpoint, keys: subscription.keys } : null,
        created_at: (await db.one("push_devices", { _id: id }))?.created_at || clock(),
        last_seen: clock(),
      });
      return { id };
    },
    async unregister(adminId, token) {
      return db.remove("push_devices", { _id: tokenId(token), admin_id: adminId });
    },
    async devices(adminId) {
      return (await db.find("push_devices", { admin_id: adminId }, { sort: { last_seen: -1 } })).map(
        ({ id, platform, label, created_at, last_seen }) => ({ id, platform, label, createdAt: created_at, lastSeen: last_seen }),
      );
    },
    removeForAdmin: (adminId) => db.remove("push_devices", { admin_id: adminId }),
    // Hata fırlatmaz: bildirim gönderilemezse işlem (rezervasyon vb.) etkilenmez.
    async notifyAdmins(message, { adminIds = null } = {}) {
      const admins = await db.find("admin_users", {
        role: { $in: RECIPIENT_ROLES },
        disabled: { $ne: true },
        ...(adminIds ? { _id: { $in: adminIds } } : {}),
      });
      if (!admins.length) return { sent: 0, errors: [] };
      const devices = await db.find("push_devices", { admin_id: { $in: admins.map((a) => a.id) } });
      let sent = 0,
        removed = 0;
      const errors = [],
        results = [];
      for (const device of devices) {
        if (device.platform !== "web" && !account) {
          // Firebase ayarlı değil: Android telefon atlanır, yalnız sonuçta görünür.
          const e = { code: "FCM_NOT_CONFIGURED", message: "Android bildirimi için FIREBASE_SERVICE_ACCOUNT ayarlı değil." };
          errors.push(e);
          results.push({ adminId: device.admin_id, deviceId: device.id, label: device.label, outcome: "error", ...e });
          continue;
        }
        try {
          const result = await sendTo(device, message);
          if (result === "sent") sent++;
          else removed++;
          results.push({ adminId: device.admin_id, deviceId: device.id, label: device.label, outcome: result });
        } catch (error) {
          log("error", String(error?.message || error), { kind: message.kind, code: error?.code });
          const e = { code: error?.code || "error", message: String(error?.message || error).slice(0, 300) };
          errors.push(e);
          results.push({ adminId: device.admin_id, deviceId: device.id, label: device.label, outcome: "error", ...e });
        }
      }
      return { sent, removed, devices: devices.length, errors, results };
    },
    // Sahip için: bildirim alacak ekip üyeleri ve kayıtlı telefonları.
    async team() {
      const admins = await db.find("admin_users", { disabled: { $ne: true } }, { sort: { created_at: 1 } });
      const devices = await db.find("push_devices", { admin_id: { $in: admins.map((a) => a.id) } }, { sort: { last_seen: -1 } });
      return admins.map((a) => ({
        id: a.id,
        name: a.name,
        role: a.role,
        receives: RECIPIENT_ROLES.includes(a.role),
        devices: devices
          .filter((d) => d.admin_id === a.id)
          .map((d) => ({ id: d.id, platform: d.platform, label: d.label, createdAt: d.created_at, lastSeen: d.last_seen })),
      }));
    },
  };
  return api;
}
