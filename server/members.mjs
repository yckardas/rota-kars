import {
  randomBytes,
  randomInt,
  createHash,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { AppError } from "./store.mjs";
const derive = promisify(scrypt),
  digest = (s) => createHash("sha256").update(s).digest("hex");
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + (await derive(password, salt, 64)).toString("hex");
}
export async function checkPassword(password, stored) {
  const [salt, hash] = (
    stored || "00000000000000000000000000000000:" + "0".repeat(128)
  ).split(":");
  const actual = await derive(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return (
    actual.length === expected.length &&
    timingSafeEqual(actual, expected) &&
    Boolean(stored)
  );
}
export const wheelPrizes = [5, 10, 5, 15, 10, 5];
export async function createMembers(db, { clock, tx, campaigns }) {
  await db.exec(`CREATE TABLE IF NOT EXISTS members(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password_hash TEXT,referral_code TEXT NOT NULL UNIQUE,created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS member_sessions(token_hash TEXT PRIMARY KEY,member_id TEXT NOT NULL REFERENCES members(id),expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS social_accounts(provider TEXT NOT NULL,subject TEXT NOT NULL,member_id TEXT NOT NULL REFERENCES members(id),PRIMARY KEY(provider,subject));
 CREATE TABLE IF NOT EXISTS member_coupons(id TEXT PRIMARY KEY,member_id TEXT NOT NULL REFERENCES members(id),percent INTEGER NOT NULL CHECK(percent IN(5,10,15)),source TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,used_reservation TEXT);
 CREATE TABLE IF NOT EXISTS member_spins(member_id TEXT PRIMARY KEY REFERENCES members(id),coupon_id TEXT NOT NULL,prize_index INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS referrals(friend_id TEXT PRIMARY KEY REFERENCES members(id),inviter_id TEXT NOT NULL REFERENCES members(id),rewarded_at INTEGER);`);
  const publicMember = (m) =>
    m
      ? {
          id: m.id,
          name: m.name,
          email: m.email,
          referralCode: m.referral_code,
          emailVerified: Boolean(m.email_verified),
          phone: m.phone || "",
        }
      : null;
  const couponColumns = (
    await db.prepare("PRAGMA table_info(member_coupons)").all()
  ).map((c) => c.name);
  if (!couponColumns.includes("policy_json"))
    await db.exec("ALTER TABLE member_coupons ADD COLUMN policy_json TEXT");
  const spinColumns = (
    await db.prepare("PRAGMA table_info(member_spins)").all()
  ).map((c) => c.name);
  if (!spinColumns.includes("sectors_json"))
    await db.exec("ALTER TABLE member_spins ADD COLUMN sectors_json TEXT");
  const coupon = async (memberId, percent, source) => {
    const policy = await campaigns.get();
    const id = randomBytes(16).toString("hex");
    await db
      .prepare(
        "INSERT INTO member_coupons(id,member_id,percent,source,created_at,expires_at,policy_json) VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        id,
        memberId,
        percent,
        source,
        clock(),
        clock() + policy.validDays * 86400000,
        JSON.stringify({ minTotal: policy.minTotal, tourIds: policy.tourIds }),
      );
    return await db.prepare("SELECT * FROM member_coupons WHERE id=?").get(id);
  };
  const insert = async ({ name, email, passwordHash = null, referralCode }) => {
    const normalized = email.trim().toLowerCase();
    if (await db.prepare("SELECT 1 FROM members WHERE email=?").get(normalized))
      throw new AppError(409, "Bu e-posta ile bir hesap var. Giriş yapın.");
    let inviter = null;
    if (referralCode) {
      inviter = await db
        .prepare("SELECT id FROM members WHERE referral_code=?")
        .get(referralCode.toUpperCase());
      if (!inviter)
        throw new AppError(400, "Davet kodu bulunamadı. Kodu kontrol edin.");
    }
    const id = randomBytes(16).toString("hex");
    await db
      .prepare(
        "INSERT INTO members(id,name,email,password_hash,referral_code,created_at) VALUES(?,?,?,?,?,?)",
      )
      .run(
        id,
        name,
        normalized,
        passwordHash,
        randomBytes(5).toString("hex").toUpperCase(),
        clock(),
      );
    if (inviter)
      await db
        .prepare("INSERT INTO referrals VALUES(?,?,NULL)")
        .run(id, inviter.id);
    return publicMember(
      await db.prepare("SELECT * FROM members WHERE id=?").get(id),
    );
  };
  return {
    async register(input) {
      const passwordHash = await hashPassword(input.password);
      return tx(
        async () =>
          await insert({
            ...input,
            passwordHash,
          }),
      );
    },
    async login(email, password) {
      const row = await db
        .prepare("SELECT * FROM members WHERE email=?")
        .get(email.trim().toLowerCase());
      if (!(await checkPassword(password, row?.password_hash)))
        throw new AppError(401, "E-posta veya parola hatalı.");
      return publicMember(row);
    },
    social({ provider, subject, email, name, referralCode, linkMemberId }) {
      return tx(async () => {
        const linked = await db
          .prepare(
            "SELECT m.* FROM social_accounts s JOIN members m ON m.id=s.member_id WHERE s.provider=? AND s.subject=?",
          )
          .get(provider, subject);
        if (linked) {
          if (linkMemberId && linked.id !== linkMemberId)
            throw new AppError(409, "Bu sosyal hesap başka bir üyeye bağlı.");
          return publicMember(linked);
        }
        let member;
        if (linkMemberId) {
          const existing = await db
            .prepare("SELECT * FROM members WHERE id=?")
            .get(linkMemberId);
          if (!existing || existing.email !== email.toLowerCase())
            throw new AppError(
              409,
              "Sosyal hesabın e-posta adresi üyeliğinizle eşleşmiyor.",
            );
          member = publicMember(existing);
        } else
          member = await insert({
            name,
            email,
            referralCode,
          });
        await db
          .prepare("INSERT INTO social_accounts VALUES(?,?,?)")
          .run(provider, subject, member.id);
        await db
          .prepare("UPDATE members SET email_verified=1 WHERE id=?")
          .run(member.id);
        return { ...member, emailVerified: true };
      });
    },
    async session(memberId) {
      const token = randomBytes(32).toString("hex");
      await db
        .prepare("DELETE FROM member_sessions WHERE expires_at<=?")
        .run(clock());
      await db
        .prepare("INSERT INTO member_sessions VALUES(?,?,?)")
        .run(digest(token), memberId, clock() + 7 * 86400000);
      return token;
    },
    async fromSession(token) {
      if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
      return publicMember(
        await db
          .prepare(
            "SELECT m.* FROM member_sessions s JOIN members m ON m.id=s.member_id WHERE s.token_hash=? AND s.expires_at>?",
          )
          .get(digest(token), clock()),
      );
    },
    async logout(token) {
      if (token)
        await db
          .prepare("DELETE FROM member_sessions WHERE token_hash=?")
          .run(digest(token));
    },
    async dashboard(memberId) {
      const row = await db
        .prepare("SELECT * FROM members WHERE id=?")
        .get(memberId);
      if (!row) throw new AppError(401, "Üye girişi gerekli.");
      return {
        member: publicMember(row),
        coupons: await db
          .prepare(
            "SELECT * FROM member_coupons WHERE member_id=? ORDER BY created_at DESC,id",
          )
          .all(memberId),
        spin:
          (await db
            .prepare("SELECT * FROM member_spins WHERE member_id=?")
            .get(memberId)) || null,
        referrals: await db
          .prepare(
            "SELECT count(*) total,COALESCE(sum(rewarded_at IS NOT NULL),0) rewarded FROM referrals WHERE inviter_id=?",
          )
          .get(memberId),
        reservations: await db
          .prepare(
            "SELECT r.reference,r.total,r.status,r.created_at,d.date,d.tour_id AS tourId FROM reservations r JOIN departures d ON d.id=r.departure_id WHERE r.member_id=? ORDER BY r.created_at DESC LIMIT 50",
          )
          .all(memberId),
      };
    },
    spin(memberId) {
      return tx(async () => {
        const previous = await db
          .prepare("SELECT * FROM member_spins WHERE member_id=?")
          .get(memberId);
        if (previous)
          throw new AppError(
            409,
            "Bu üyelik için çark hakkı kullanıldı. Kuponunuz hesabınızda.",
          );
        const campaign = await campaigns.get();
        if (!campaign.active)
          throw new AppError(409, "Şans çarkı kampanyası şu anda kapalı.");
        if (
          campaign.requireVerified &&
          !(
            await db
              .prepare("SELECT email_verified FROM members WHERE id=?")
              .get(memberId)
          )?.email_verified
        )
          throw new AppError(403, "Önce e-posta adresinizi doğrulayın.");
        const index = randomInt(campaign.sectors.length),
          prize = await coupon(memberId, campaign.sectors[index], "wheel");
        await db
          .prepare(
            "INSERT INTO member_spins(member_id,coupon_id,prize_index,sectors_json) VALUES(?,?,?,?)",
          )
          .run(memberId, prize.id, index, JSON.stringify(campaign.sectors));
        return {
          coupon: prize,
          index,
          sectors: campaign.sectors,
        };
      });
    },
    async priceCoupon(memberId, couponId, subtotal, tourId = null) {
      if (!couponId)
        return {
          discount: 0,
          total: subtotal,
          coupon: null,
        };
      if (!memberId)
        throw new AppError(401, "Kupon kullanmak için üye girişi yapın.");
      const c = await db
        .prepare(
          "SELECT * FROM member_coupons WHERE id=? AND member_id=? AND expires_at>? AND used_reservation IS NULL",
        )
        .get(couponId, memberId, clock());
      if (!c)
        throw new AppError(
          409,
          "Kupon geçersiz, süresi dolmuş veya kullanılmış.",
        );
      const settings = await campaigns.get(),
        policy = c.policy_json
          ? JSON.parse(c.policy_json)
          : { minTotal: 0, tourIds: [] };
      if (
        settings.requireVerified &&
        !(
          await db
            .prepare("SELECT email_verified FROM members WHERE id=?")
            .get(memberId)
        )?.email_verified
      )
        throw new AppError(403, "Kupon kullanmak için e-postanızı doğrulayın.");
      if (subtotal < policy.minTotal)
        throw new AppError(
          400,
          "Bu kupon için minimum tur bedeli sağlanmıyor.",
        );
      if (policy.tourIds?.length && !policy.tourIds.includes(tourId))
        throw new AppError(400, "Bu kupon seçilen turda geçerli değil.");
      const discount = Math.round((subtotal * c.percent) / 100);
      return {
        discount,
        total: subtotal - discount,
        coupon: c,
      };
    },
    async consumeCoupon(couponId, reservationId) {
      if (couponId) {
        const updated = await db
          .prepare(
            "UPDATE member_coupons SET used_reservation=? WHERE id=? AND used_reservation IS NULL",
          )
          .run(reservationId, couponId);
        if (!updated.changes)
          throw new AppError(409, "Kupon az önce kullanıldı.");
      }
    },
    async releaseCoupons() {
      await db
        .prepare(
          "UPDATE member_coupons SET used_reservation=NULL WHERE used_reservation IN (SELECT id FROM reservations WHERE status IN ('cancelled','expired'))",
        )
        .run();
    },
    async rewardReferral(memberId, event) {
      if (!memberId) return;
      const settings = await campaigns.get();
      if (!settings.active || settings.referralTrigger !== event) return;
      const relation = await db
        .prepare(
          "SELECT * FROM referrals WHERE friend_id=? AND rewarded_at IS NULL",
        )
        .get(memberId);
      if (!relation) return;
      await db
        .prepare(
          "UPDATE referrals SET rewarded_at=? WHERE friend_id=? AND rewarded_at IS NULL",
        )
        .run(clock(), memberId);
      await coupon(memberId, 10, "referral-friend");
      await coupon(relation.inviter_id, 10, "referral-inviter");
    },
  };
}
