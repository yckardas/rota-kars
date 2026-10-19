// Yönetici uygulamasına anlık bildirim (Firebase Cloud Messaging HTTP v1).
// FIREBASE_SERVICE_ACCOUNT: Firebase konsolundan indirilen hizmet hesabı JSON'u
// (düz veya base64). Ayarlı değilse bildirimler sessizce atlanır.
// Bildirimler yalnız sahip ve operasyon rolündeki, aktif yöneticilerin
// cihazlarına gider; rehberler müşteri bilgisi içeren bildirim almaz.
import { createHash, createSign } from "node:crypto";

const RECIPIENT_ROLES = ["owner", "operations"];
const tokenId = (token) => createHash("sha256").update(String(token)).digest("hex");

function readServiceAccount(raw) {
  if (!raw) return null;
  try {
    const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const account = JSON.parse(text);
    if (!account.project_id || !account.client_email || !account.private_key) return null;
    return { ...account, private_key: account.private_key.replaceAll("\\n", "\n") };
  } catch {
    return null;
  }
}

export function createPush(db, { env = process.env, fetchImpl = fetch, clock = Date.now } = {}) {
  const account = readServiceAccount(env.FIREBASE_SERVICE_ACCOUNT);
  let accessToken = null,
    tokenExpires = 0;
  const log = (level, message, extra = {}) =>
    console[level === "error" ? "error" : "log"](JSON.stringify({ level, job: "push", message, ...extra }));

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
    if (!res.ok || !data.access_token) throw new Error(`Firebase yetkilendirmesi başarısız (${res.status})`);
    accessToken = data.access_token;
    tokenExpires = clock() + ((data.expires_in || 3600) - 120) * 1000;
    return accessToken;
  }

  async function sendTo(device, { title, body, url, kind }) {
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
    const error = await res.json().catch(() => ({}));
    const code = error?.error?.details?.find((d) => d.errorCode)?.errorCode || error?.error?.status;
    // Uygulama kaldırılmış veya token yenilenmiş: cihaz kaydı silinir.
    if (res.status === 404 || code === "UNREGISTERED" || code === "INVALID_ARGUMENT") {
      await db.remove("push_devices", { _id: device.id });
      return "removed";
    }
    throw new Error(`FCM ${res.status} ${code || ""}`.trim());
  }

  const api = {
    enabled: Boolean(account),
    async register(adminId, { token, platform = "android", label = "" }) {
      const id = tokenId(token);
      // Aynı telefon başka bir yöneticiyle giriş yaparsa kayıt yeni yöneticiye geçer.
      await db.upsert("push_devices", id, {
        id,
        admin_id: adminId,
        token,
        platform,
        label: String(label).slice(0, 60),
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
      if (!account) return { sent: 0, skipped: true };
      const admins = await db.find("admin_users", {
        role: { $in: RECIPIENT_ROLES },
        disabled: { $ne: true },
        ...(adminIds ? { _id: { $in: adminIds } } : {}),
      });
      if (!admins.length) return { sent: 0 };
      const devices = await db.find("push_devices", { admin_id: { $in: admins.map((a) => a.id) } });
      let sent = 0;
      for (const device of devices)
        try {
          if ((await sendTo(device, message)) === "sent") sent++;
        } catch (error) {
          log("error", String(error?.message || error), { kind: message.kind });
        }
      return { sent };
    },
  };
  return api;
}
