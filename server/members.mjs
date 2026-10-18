import {
  randomBytes,
  randomInt,
  createHash,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { AppError } from "./store.mjs";
import { fromJson } from "./database.mjs";
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
  await Promise.all([
    db.index("members", { email: 1 }, { unique: true }),
    db.index("members", { referral_code: 1 }, { unique: true }),
    db.index("member_sessions", { expires_at: 1 }),
    db.index("social_accounts", { member_id: 1 }),
    db.index("member_coupons", { member_id: 1, created_at: -1 }),
    db.index("member_coupons", { used_reservation: 1 }),
    db.index("referrals", { inviter_id: 1 }),
  ]);
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
  const coupon = async (memberId, percent, source) => {
    const policy = await campaigns.get();
    const id = randomBytes(16).toString("hex");
    await db.insert("member_coupons", id, {
      id,
      member_id: memberId,
      percent,
      source,
      created_at: clock(),
      expires_at: clock() + policy.validDays * 86400000,
      used_reservation: null,
      policy_json: { minTotal: policy.minTotal, tourIds: policy.tourIds },
    });
    return db.one("member_coupons", { _id: id });
  };
  const insert = async ({ name, email, passwordHash = null, referralCode }) => {
    const normalized = email.trim().toLowerCase();
    if (await db.one("members", { email: normalized }))
      throw new AppError(409, "Bu e-posta ile bir hesap var. Giriş yapın.");
    let inviter = null;
    if (referralCode) {
      inviter = await db.one("members", {
        referral_code: referralCode.toUpperCase(),
      });
      if (!inviter)
        throw new AppError(400, "Davet kodu bulunamadı. Kodu kontrol edin.");
    }
    const id = randomBytes(16).toString("hex");
    await db.insert("members", id, {
      id,
      name,
      email: normalized,
      password_hash: passwordHash,
      referral_code: randomBytes(5).toString("hex").toUpperCase(),
      created_at: clock(),
    });
    if (inviter)
      await db.insert("referrals", id, {
        friend_id: id,
        inviter_id: inviter.id,
        rewarded_at: null,
      });
    return publicMember(await db.one("members", { _id: id }));
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
      const row = await db.one("members", { email: email.trim().toLowerCase() });
      if (!(await checkPassword(password, row?.password_hash)))
        throw new AppError(401, "E-posta veya parola hatalı.");
      return publicMember(row);
    },
    social({ provider, subject, email, name, referralCode, linkMemberId }) {
      return tx(async () => {
        const account = await db.one("social_accounts", {
            _id: `${provider}:${subject}`,
          }),
          linked =
            account && (await db.one("members", { _id: account.member_id }));
        if (linked) {
          if (linkMemberId && linked.id !== linkMemberId)
            throw new AppError(409, "Bu sosyal hesap başka bir üyeye bağlı.");
          return publicMember(linked);
        }
        let member;
        if (linkMemberId) {
          const existing = await db.one("members", { _id: linkMemberId });
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
        await db.insert("social_accounts", `${provider}:${subject}`, {
          provider,
          subject,
          member_id: member.id,
        });
        await db.update("members", { _id: member.id }, { email_verified: 1 });
        return { ...member, emailVerified: true };
      });
    },
    async session(memberId) {
      const token = randomBytes(32).toString("hex");
      await db.remove("member_sessions", { expires_at: { $lte: clock() } });
      await db.insert("member_sessions", digest(token), {
        token_hash: digest(token),
        member_id: memberId,
        expires_at: clock() + 7 * 86400000,
      });
      return token;
    },
    async fromSession(token) {
      if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
      const session = await db.one("member_sessions", {
        _id: digest(token),
        expires_at: { $gt: clock() },
      });
      return publicMember(
        session && (await db.one("members", { _id: session.member_id })),
      );
    },
    async logout(token) {
      if (token)
        await db.remove("member_sessions", { _id: digest(token) });
    },
    async dashboard(memberId) {
      const row = await db.one("members", { _id: memberId });
      if (!row) throw new AppError(401, "Üye girişi gerekli.");
      const reservations = await db.find(
        "reservations",
        { member_id: memberId },
        { sort: { created_at: -1 }, limit: 50 },
      );
      const departures = new Map(
        (
          await db.find("departures", {
            _id: { $in: [...new Set(reservations.map((r) => r.departure_id))] },
          })
        ).map((d) => [d.id, d]),
      );
      return {
        member: publicMember(row),
        coupons: await db.find(
          "member_coupons",
          { member_id: memberId },
          { sort: { created_at: -1, id: 1 } },
        ),
        spin: (await db.one("member_spins", { _id: memberId })) || null,
        referrals: {
          total: await db.count("referrals", { inviter_id: memberId }),
          rewarded: await db.count("referrals", {
            inviter_id: memberId,
            rewarded_at: { $ne: null },
          }),
        },
        reservations: reservations.map((r) => ({
          reference: r.reference,
          total: r.total,
          status: r.status,
          created_at: r.created_at,
          date: departures.get(r.departure_id)?.date,
          tourId: departures.get(r.departure_id)?.tour_id,
        })),
      };
    },
    spin(memberId) {
      return tx(async () => {
        const previous = await db.one("member_spins", { _id: memberId });
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
          !(await db.one("members", { _id: memberId }))?.email_verified
        )
          throw new AppError(403, "Önce e-posta adresinizi doğrulayın.");
        const index = randomInt(campaign.sectors.length),
          prize = await coupon(memberId, campaign.sectors[index], "wheel");
        await db.insert("member_spins", memberId, {
          member_id: memberId,
          coupon_id: prize.id,
          prize_index: index,
          sectors_json: campaign.sectors,
        });
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
      const c = await db.one("member_coupons", {
        _id: couponId,
        member_id: memberId,
        expires_at: { $gt: clock() },
        used_reservation: null,
      });
      if (!c)
        throw new AppError(
          409,
          "Kupon geçersiz, süresi dolmuş veya kullanılmış.",
        );
      const settings = await campaigns.get(),
        policy = fromJson(c.policy_json, null) || { minTotal: 0, tourIds: [] };
      if (
        settings.requireVerified &&
        !(await db.one("members", { _id: memberId }))?.email_verified
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
        const updated = await db.update(
          "member_coupons",
          { _id: couponId, used_reservation: null },
          { used_reservation: reservationId },
        );
        if (!updated)
          throw new AppError(409, "Kupon az önce kullanıldı.");
      }
    },
    async releaseCoupons() {
      // İptal edilen veya süresi dolan ön rezervasyondaki kupon yeniden kullanılabilir olur.
      const used = await db.find(
        "member_coupons",
        { used_reservation: { $ne: null } },
        { projection: { used_reservation: 1 } },
      );
      if (!used.length) return;
      const released = (
        await db.find(
          "reservations",
          {
            _id: { $in: used.map((c) => c.used_reservation) },
            status: { $in: ["cancelled", "expired"] },
          },
          { projection: { id: 1 } },
        )
      ).map((r) => r.id);
      if (released.length)
        await db.updateMany(
          "member_coupons",
          { used_reservation: { $in: released } },
          { used_reservation: null },
        );
    },
    async rewardReferral(memberId, event) {
      if (!memberId) return;
      const settings = await campaigns.get();
      if (!settings.active || settings.referralTrigger !== event) return;
      const relation = await db.one("referrals", {
        _id: memberId,
        rewarded_at: null,
      });
      if (!relation) return;
      await db.update(
        "referrals",
        { _id: memberId, rewarded_at: null },
        { rewarded_at: clock() },
      );
      await coupon(memberId, 10, "referral-friend");
      await coupon(relation.inviter_id, 10, "referral-inviter");
    },
  };
}
