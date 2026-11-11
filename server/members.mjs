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
import { pickSector } from "./campaigns.mjs";
// Misafirin çevirdiği hediye bu süre içinde üyelikle sahiplenilebilir.
const WHEEL_PRIZE_DAYS = 7;
// Aynı IP'den 24 saatte en çok bu kadar misafir çevirmesi.
const WHEEL_SPINS_PER_IP = 3;
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
  // prize: yüzde (sayı ya da { kind: "percent", value }) veya { kind: "amount", value: kuruş }.
  const coupon = async (memberId, prize, source) => {
    const policy = await campaigns.get();
    const p = typeof prize === "number" ? { kind: "percent", value: prize } : prize,
      amount = p.kind === "amount";
    const id = randomBytes(16).toString("hex");
    await db.insert("member_coupons", id, {
      id,
      member_id: memberId,
      kind: amount ? "amount" : "percent",
      percent: amount ? 0 : p.value,
      amount: amount ? p.value : 0,
      source,
      created_at: clock(),
      expires_at: clock() + policy.validDays * 86400000,
      used_reservation: null,
      // TL kuponu yalnız amountMinTotal ve üzerindeki turlarda geçer.
      policy_json: {
        minTotal: amount ? Math.max(policy.minTotal, policy.amountMinTotal) : policy.minTotal,
        tourIds: policy.tourIds,
      },
    });
    return db.one("member_coupons", { _id: id });
  };
  // Çark hediyesi kupona dönüşür: e-posta doğrulaması gerekiyorsa doğrulanınca.
  // Hediye çark çevrildiğinde değil, aktifleştiği anda kupon olur; süresi o an başlar.
  const activatePending = async (memberId) => {
    const spin = await db.one("member_spins", { _id: memberId, coupon_id: null });
    if (!spin) return null;
    const campaign = await campaigns.get();
    if (campaign.requireVerified && !(await db.one("members", { _id: memberId }))?.email_verified)
      return null;
    const prize = fromJson(spin.prize_json, null);
    if (!prize) return null;
    const c = await coupon(memberId, prize, "wheel");
    const updated = await db.update(
      "member_spins",
      { _id: memberId, coupon_id: null },
      { coupon_id: c.id, activated_at: clock() },
    );
    // Eşzamanlı iki istekte yalnız biri kupon bağlar; fazlası silinir.
    if (!updated) await db.remove("member_coupons", { _id: c.id });
    return updated ? c : null;
  };
  const ipHash = (ip) => digest("rota-wheel:" + String(ip || ""));
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
    social({ provider, subject, email, name, referralCode, linkMemberId, emailVerified = true }) {
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
        if (!emailVerified) return member;
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
        coupons: await activatePending(memberId).then(() =>
          db.find(
            "member_coupons",
            { member_id: memberId },
            { sort: { created_at: -1, id: 1 } },
          ),
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
        const index = pickSector(campaign.sectors),
          sector = campaign.sectors[index],
          prize = await coupon(memberId, sector, "wheel");
        await db.insert("member_spins", memberId, {
          member_id: memberId,
          coupon_id: prize.id,
          prize_index: index,
          prize_json: sector,
          sectors_json: campaign.sectors,
          activated_at: clock(),
        });
        return {
          coupon: prize,
          index,
          prize: sector,
          sectors: campaign.sectors,
        };
      });
    },
    // Üye olmadan, davet penceresinde çevrilen çark. Sonuç sunucuda seçilir ve
    // tarayıcıya yalnız bir jeton (çerez) verilir; hediye üyelikle sahiplenilir.
    // Jetonu hâlâ geçerli olan misafir yeniden çeviremez, aynı sonucu görür.
    guestSpin({ token = null, ip = "" } = {}) {
      return tx(async () => {
        const campaign = await campaigns.get();
        if (!campaign.active)
          throw new AppError(409, "Şans çarkı kampanyası şu anda kapalı.");
        if (token) {
          const existing = await db.one("wheel_prizes", {
            token_hash: digest(token),
            member_id: null,
            expires_at: { $gt: clock() },
          });
          if (existing)
            return {
              token,
              index: existing.prize_index,
              prize: fromJson(existing.prize_json, null),
              sectors: fromJson(existing.sectors_json, campaign.sectors),
              expiresAt: existing.expires_at,
              repeated: true,
            };
        }
        const recent = await db.count("wheel_prizes", {
          ip_hash: ipHash(ip),
          created_at: { $gt: clock() - 86400000 },
        });
        if (recent >= WHEEL_SPINS_PER_IP)
          throw new AppError(429, "Bugünlük çark hakkı doldu. Yarın yeniden deneyebilirsiniz.");
        const index = pickSector(campaign.sectors),
          fresh = randomBytes(24).toString("hex"),
          id = randomBytes(16).toString("hex"),
          expiresAt = clock() + WHEEL_PRIZE_DAYS * 86400000;
        await db.insert("wheel_prizes", id, {
          id,
          token_hash: digest(fresh),
          ip_hash: ipHash(ip),
          prize_index: index,
          prize_json: campaign.sectors[index],
          sectors_json: campaign.sectors,
          member_id: null,
          created_at: clock(),
          expires_at: expiresAt,
        });
        return {
          token: fresh,
          index,
          prize: campaign.sectors[index],
          sectors: campaign.sectors,
          expiresAt,
          repeated: false,
        };
      });
    },
    // Misafir hediyesini üyeye bağlar (kayıt, giriş, sosyal giriş). Üyenin çark
    // hakkı zaten kullanılmışsa hediye bağlanmaz. Bağlanan hediye e-posta
    // doğrulanınca kupona dönüşür (activatePending).
    claimWheel(memberId, token) {
      if (!token) return Promise.resolve(null);
      return tx(async () => {
        const prize = await db.one("wheel_prizes", {
          token_hash: digest(token),
          member_id: null,
          expires_at: { $gt: clock() },
        });
        if (!prize) return null;
        if (await db.one("member_spins", { _id: memberId })) return null;
        const taken = await db.update(
          "wheel_prizes",
          { _id: prize.id, member_id: null },
          { member_id: memberId, claimed_at: clock() },
        );
        if (!taken) return null;
        await db.insert("member_spins", memberId, {
          member_id: memberId,
          coupon_id: null,
          prize_index: prize.prize_index,
          prize_json: fromJson(prize.prize_json, null),
          sectors_json: fromJson(prize.sectors_json, null),
          source: "guest",
        });
        return activatePending(memberId);
      });
    },
    activatePending,
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
      // TL kuponu toplamı aşamaz; yüzde kupon toplamın yüzdesi kadardır.
      const discount =
        c.kind === "amount"
          ? Math.min(Number(c.amount) || 0, subtotal)
          : Math.round((subtotal * c.percent) / 100);
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
