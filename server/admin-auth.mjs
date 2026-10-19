// Kişiye özel yönetici hesapları, roller, iki adımlı doğrulama ve denetim kaydı.
//
// Roller:
//   owner      – her şey; kullanıcı yönetimi, kampanya, KVKK araçları, denetim kaydı
//   operations – rezervasyon, sefer, tahsilat, talepler, içerik, yolcu listesi
//   guide      – yalnız günlük rapor, sefer listesi ve check-in
//
// Paylaşılan ADMIN_PASSWORD yalnız henüz hiç hesap yokken çalışır (ilk kurulum);
// ilk sahip hesabı oluşturulunca parolayla giriş kapanır.
import { randomBytes, createHash, timingSafeEqual, randomUUID } from "node:crypto";
import { AppError } from "./store.mjs";
import { hashPassword, checkPassword } from "./members.mjs";
import { newTotpSecret, verifyTotp, otpauthUrl, totpStep } from "./totp.mjs";

export const ROLES = ["owner", "operations", "guide"];
export const ROLE_LABELS = { owner: "Sahip", operations: "Operasyon", guide: "Rehber" };
const SESSION_MS = 8 * 3600 * 1000,
  LOCK_AFTER = 5,
  LOCK_MS = 15 * 60 * 1000;
const digest = (s) => createHash("sha256").update(s).digest("hex");
const GENERIC_LOGIN_ERROR =
  "E-posta veya parola hatalı. Çok sayıda hatalı denemeden sonra giriş 15 dakika kapanır.";
const sameSecret = (a, b) =>
  timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

// Rehberin erişebildiği yönetim uçları (yöntem + yol).
const GUIDE_ALLOWED = [
  ["GET", /^\/api\/admin\/session$/],
  ["GET", /^\/api\/admin\/me$/],
  ["GET", /^\/api\/admin\/reports$/],
  ["GET", /^\/api\/admin\/departures$/],
  ["GET", /^\/api\/admin\/departures\/[^/]+\/passengers$/],
  ["POST", /^\/api\/admin\/tickets\/[^/]+\/check-in$/],
];
// Yalnız sahibin erişebildiği uçlar.
const OWNER_ONLY = [
  [/^(POST|PUT|PATCH|DELETE|GET)$/, /^\/api\/admin\/users(\/|$)/],
  [/^(GET)$/, /^\/api\/admin\/audit$/],
  [/^(GET|POST)$/, /^\/api\/admin\/kvkk(\/|$)/],
  [/^(POST)$/, /^\/api\/admin\/campaigns$/],
  [/^(POST)$/, /^\/api\/admin\/content\/business$/],
];
// Kendi hesap güvenliği uçları: 2FA zorunluyken de açık kalır.
const SELF_SERVICE = /^\/api\/admin\/(session|me|me\/.*|logout)$/;

export function roleAllows(role, method, rawPath) {
  if (role === "owner") return true;
  // Express büyük/küçük harf ve sondaki "/" farkını yok sayar; kontrol de aynı
  // biçime göre yapılır (aksi halde /api/admin/USERS sahibe özel uçları açardı).
  const path = String(rawPath || "").toLowerCase().replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
  method = String(method || "").toUpperCase();
  if (OWNER_ONLY.some(([m, p]) => m.test(method) && p.test(path))) return false;
  if (role === "guide")
    return SELF_SERVICE.test(path) || GUIDE_ALLOWED.some(([m, p]) => m === method && p.test(path));
  return role === "operations";
}

export async function createAdminAuth(db, { clock = Date.now, env = process.env }) {
  await Promise.all([
    db.index("admin_users", { email: 1 }, { unique: true }),
    db.index("admin_sessions", { admin_id: 1 }),
    db.index("admin_audit", { at: -1 }),
  ]);
  const require2fa =
    env.ADMIN_REQUIRE_2FA === "1" ||
    (env.ADMIN_REQUIRE_2FA !== "0" && env.NODE_ENV === "production");
  const publicUser = (u) =>
    u && {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      roleLabel: ROLE_LABELS[u.role],
      totpEnabled: Boolean(u.totp_enabled),
      disabled: Boolean(u.disabled),
      createdAt: u.created_at,
      lastLoginAt: u.last_login_at || null,
    };
  const hasUsers = async () => (await db.count("admin_users")) > 0;
  const validPassword = (password) => {
    if (typeof password !== "string" || password.length < 12)
      throw new AppError(400, "Yönetici parolası en az 12 karakter olmalı.");
  };
  const newSession = async (user) => {
    const sid = randomBytes(32).toString("hex");
    await db.remove("admin_sessions", { expires_at: { $lt: clock() } });
    await db.insert("admin_sessions", digest(sid), {
      token_hash: digest(sid),
      admin_id: user.id,
      role: user.role,
      created_at: clock(),
      expires_at: clock() + SESSION_MS,
    });
    return sid;
  };
  const api = {
    require2fa,
    hasUsers,
    publicUser,
    async audit(admin, action, details = {}, ip = "") {
      const id = randomUUID();
      await db.insert("admin_audit", id, {
        id,
        admin_id: admin?.id || null,
        admin_email: admin?.email || null,
        action,
        details,
        // IP tam saklanmaz; olay incelemesine yetecek kadar özet tutulur.
        ip_hash: ip ? digest("rota-admin:" + ip).slice(0, 16) : null,
        at: clock(),
      });
    },
    async listAudit({ limit = 300 } = {}) {
      return db.find("admin_audit", {}, { sort: { at: -1 }, limit });
    },
    // Paylaşılan parola: yalnız hiç hesap yokken, ilk sahip hesabını açmak için.
    async bootstrapLogin(password, expected = env.ADMIN_PASSWORD) {
      if (await hasUsers())
        throw new AppError(
          401,
          "Paylaşılan parola kapatıldı. E-posta adresiniz ve kendi parolanızla giriş yapın.",
        );
      if (!expected)
        throw new AppError(
          503,
          "İlk kurulum için sunucuda ADMIN_PASSWORD tanımlayın.",
        );
      if (!sameSecret(String(password || ""), expected))
        throw new AppError(401, "Parola doğru değil.");
      const sid = randomBytes(32).toString("hex");
      await db.insert("admin_sessions", digest(sid), {
        token_hash: digest(sid),
        admin_id: "bootstrap",
        role: "owner",
        bootstrap: true,
        created_at: clock(),
        expires_at: clock() + SESSION_MS,
      });
      return { sid, bootstrap: true };
    },
    async login({ email, password, code }) {
      const user = await db.one("admin_users", { email: String(email).trim().toLowerCase() });
      // Kilitli hesap için de genel mesaj: hangi e-postanın yönetici olduğu anlaşılmaz.
      if (user?.locked_until > clock())
        throw new AppError(401, GENERIC_LOGIN_ERROR);
      const ok = await checkPassword(String(password || ""), user?.password_hash);
      if (!user || !ok || user.disabled) {
        if (user && !user.disabled) {
          const failed = (user.failed_logins || 0) + 1;
          await db.update(
            "admin_users",
            { _id: user.id },
            {
              failed_logins: failed >= LOCK_AFTER ? 0 : failed,
              locked_until: failed >= LOCK_AFTER ? clock() + LOCK_MS : 0,
            },
          );
          if (failed >= LOCK_AFTER) await api.audit(user, "login_locked");
        }
        throw new AppError(401, GENERIC_LOGIN_ERROR);
      }
      if (user.totp_enabled) {
        if (!code) return { needsCode: true };
        const step = verifyTotp(user.totp_secret, code, {
          now: clock(),
          lastStep: user.totp_last_step ?? -1,
        });
        if (step === null) {
          // Yanlış iki adımlı kodlar da kilide sayılır (parolası ele geçmiş hesapta kod denemesi).
          const failed = (user.failed_logins || 0) + 1;
          await db.update(
            "admin_users",
            { _id: user.id },
            {
              failed_logins: failed >= LOCK_AFTER ? 0 : failed,
              locked_until: failed >= LOCK_AFTER ? clock() + LOCK_MS : 0,
            },
          );
          if (failed >= LOCK_AFTER) await api.audit(user, "login_locked", { reason: "totp" });
          throw new AppError(401, "Doğrulama kodu hatalı veya süresi geçmiş.");
        }
        await db.update("admin_users", { _id: user.id }, { totp_last_step: step });
      }
      await db.update(
        "admin_users",
        { _id: user.id },
        { failed_logins: 0, locked_until: 0, last_login_at: clock() },
      );
      await api.audit(user, "login");
      return { sid: await newSession(user), user: publicUser(user) };
    },
    // Oturumdan yönetici: { user, session, bootstrap, needs2faSetup }
    async fromSession(sid) {
      if (!sid || !/^[a-f0-9]{64}$/.test(sid)) return null;
      const session = await db.one("admin_sessions", { _id: digest(sid) });
      if (!session || session.expires_at < clock()) return null;
      if (session.bootstrap) {
        if (await hasUsers()) return null; // ilk hesap açılınca kurulum oturumları düşer
        return {
          user: { id: "bootstrap", email: null, name: "İlk kurulum", role: "owner" },
          bootstrap: true,
          needs2faSetup: false,
        };
      }
      const user = await db.one("admin_users", { _id: session.admin_id });
      if (!user || user.disabled) return null;
      return {
        user: publicUser(user),
        bootstrap: false,
        needs2faSetup: require2fa && !user.totp_enabled,
      };
    },
    async logout(sid) {
      if (sid) await db.remove("admin_sessions", { _id: digest(sid) });
    },
    async listUsers() {
      return (await db.find("admin_users", {}, { sort: { created_at: 1 } })).map(publicUser);
    },
    async createUser(actor, input) {
      validPassword(input.password);
      const passwordHash = await hashPassword(input.password);
      // İlk hesabın sahip olması ve kurulum oturumlarının kapanması tek işlemde yapılır.
      return db.transaction(() => api._createUser(actor, input, passwordHash));
    },
    async _createUser(actor, { email, name, role }, passwordHash) {
      if (!ROLES.includes(role)) throw new AppError(400, "Geçersiz rol.");
      if (actor?.id === "bootstrap" && (await hasUsers()))
        throw new AppError(409, "İlk sahip hesabı zaten oluşturuldu. Kendi hesabınızla giriş yapın.");
      const normalized = String(email).trim().toLowerCase();
      if (await db.one("admin_users", { email: normalized }))
        throw new AppError(409, "Bu e-posta ile bir yönetici hesabı var.");
      // İlk hesap her zaman sahip olur.
      const first = !(await hasUsers());
      const id = randomUUID();
      await db.insert("admin_users", id, {
        id,
        email: normalized,
        name: String(name).trim().slice(0, 80),
        role: first ? "owner" : role,
        password_hash: passwordHash,
        totp_enabled: false,
        totp_secret: null,
        disabled: false,
        failed_logins: 0,
        locked_until: 0,
        created_at: clock(),
        created_by: actor?.id || null,
      });
      if (first) await db.remove("admin_sessions", { bootstrap: true });
      const user = publicUser(await db.one("admin_users", { _id: id }));
      await api.audit(first ? user : actor, first ? "owner_created" : "user_created", {
        target: normalized,
        role: user.role,
      });
      return user;
    },
    async updateUser(actor, id, { role, disabled, name }) {
      const user = await db.one("admin_users", { _id: id });
      if (!user) throw new AppError(404, "Yönetici bulunamadı.");
      const owners = await db.count("admin_users", { role: "owner", disabled: false });
      const losesOwner =
        user.role === "owner" && !user.disabled && ((role && role !== "owner") || disabled === true);
      if (losesOwner && owners <= 1)
        throw new AppError(409, "En az bir etkin sahip hesabı kalmalı.");
      if (role && !ROLES.includes(role)) throw new AppError(400, "Geçersiz rol.");
      const set = {};
      if (role) set.role = role;
      if (typeof disabled === "boolean") set.disabled = disabled;
      if (name) set.name = String(name).trim().slice(0, 80);
      await db.update("admin_users", { _id: id }, set);
      // Rol veya erişim değişince açık oturumlar kapanır.
      if (role || disabled) await db.remove("admin_sessions", { admin_id: id });
      await api.audit(actor, "user_updated", { target: user.email, ...set });
      return publicUser(await db.one("admin_users", { _id: id }));
    },
    async resetUser(actor, id, { password, resetTotp }) {
      const user = await db.one("admin_users", { _id: id });
      if (!user) throw new AppError(404, "Yönetici bulunamadı.");
      const set = { failed_logins: 0, locked_until: 0 };
      if (password) {
        validPassword(password);
        set.password_hash = await hashPassword(password);
      }
      if (resetTotp) Object.assign(set, { totp_enabled: false, totp_secret: null, totp_pending: null });
      await db.update("admin_users", { _id: id }, set);
      await db.remove("admin_sessions", { admin_id: id });
      await api.audit(actor, "user_reset", {
        target: user.email,
        password: Boolean(password),
        totp: Boolean(resetTotp),
      });
      return publicUser(await db.one("admin_users", { _id: id }));
    },
    async changePassword(actor, { current, next }) {
      const user = await db.one("admin_users", { _id: actor.id });
      if (!(await checkPassword(String(current || ""), user?.password_hash)))
        throw new AppError(401, "Mevcut parola doğru değil.");
      validPassword(next);
      await db.update("admin_users", { _id: actor.id }, { password_hash: await hashPassword(next) });
      await db.remove("admin_sessions", { admin_id: actor.id });
      await api.audit(actor, "password_changed");
    },
    async beginTotp(actor) {
      const secret = newTotpSecret();
      await db.update("admin_users", { _id: actor.id }, { totp_pending: secret });
      return { secret, otpauthUrl: otpauthUrl(secret, actor.email) };
    },
    async enableTotp(actor, code) {
      const user = await db.one("admin_users", { _id: actor.id });
      if (!user?.totp_pending) throw new AppError(400, "Önce kurulumu başlatın.");
      const step = verifyTotp(user.totp_pending, code, { now: clock() });
      if (step === null) throw new AppError(400, "Kod doğrulanamadı. Uygulamadaki güncel kodu girin.");
      await db.update(
        "admin_users",
        { _id: actor.id },
        { totp_secret: user.totp_pending, totp_pending: null, totp_enabled: true, totp_last_step: step },
      );
      await api.audit(actor, "totp_enabled");
    },
    async disableTotp(actor, { password, code }) {
      if (require2fa) throw new AppError(409, "Bu sunucuda iki adımlı doğrulama zorunlu.");
      const user = await db.one("admin_users", { _id: actor.id });
      if (!(await checkPassword(String(password || ""), user?.password_hash)))
        throw new AppError(401, "Parola doğru değil.");
      if (verifyTotp(user.totp_secret, code, { now: clock(), lastStep: user.totp_last_step ?? -1 }) === null)
        throw new AppError(401, "Doğrulama kodu hatalı.");
      await db.update("admin_users", { _id: actor.id }, { totp_enabled: false, totp_secret: null });
      await api.audit(actor, "totp_disabled");
    },
    totpStep,
  };
  return api;
}
