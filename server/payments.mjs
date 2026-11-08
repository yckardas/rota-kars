import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { AppError } from "./store.mjs";
// Online kapora / tam ödeme. Sağlayıcıdan bağımsızdır: PAYMENT_PROVIDER ile seçilir.
// - "disabled" (varsayılan): online ödeme kapalı, ön rezervasyon acenteye düşer.
// - "test": gerçek para çekmeyen deneme sağlayıcısı (yalnız yerel/deneme ortamı).
// Gerçek bir sağlayıcı (iyzico, PayTR...) eklenirken aynı sözleşme uygulanır:
//   start({ session, amount, reservation, returnUrl, callbackUrl }) -> { redirectUrl }
//   verify(req) -> { sessionId, paid, amount, externalReference }  (imza doğrulanmış)
// Tarayıcı yönlendirmesi ödemeyi asla onaylamaz; yalnız doğrulanmış sunucu
// bildirimi (callback) tahsilatı kaydeder.
export const DEPOSIT_PERCENT = 30;
// Kapora tutarı tek yerden hesaplanır (kuruş, yuvarlanmış).
export const depositFor = (total) =>
  Math.round((total * DEPOSIT_PERCENT) / 100);
const SESSION_MS = 30 * 60 * 1000;
export function paymentConfig(env = process.env) {
  const wanted = env.PAYMENT_PROVIDER || "disabled",
    production = env.NODE_ENV === "production",
    provider =
      wanted === "test" && production && env.PAYMENT_ALLOW_TEST !== "1"
        ? "disabled"
        : wanted === "test"
          ? "test"
          : "disabled";
  return {
    enabled: provider !== "disabled",
    provider: provider === "disabled" ? null : provider,
    test: provider === "test",
    currency: "TRY",
    modes: ["deposit", "full"],
    depositPercent: DEPOSIT_PERCENT,
    message:
      provider === "disabled"
        ? "Online ödeme henüz aktif değil. Ön rezervasyon talebiniz acente tarafından değerlendirilecektir."
        : "Kaporanızı kartla ödeyin; rezervasyonunuz anında onaylansın.",
  };
}
// Deneme sağlayıcısı: kendi sayfamızda "ödendi / reddedildi" seçimi yapılır;
// sonuç, gerçek sağlayıcının sunucu bildirimi gibi HMAC imzasıyla gelir.
function testProvider(secret) {
  const sign = (sessionId, result) =>
    createHmac("sha256", secret).update(sessionId + ":" + result).digest("hex");
  return {
    name: "test",
    start({ session }) {
      return { redirectUrl: "/odeme/deneme/" + session.id };
    },
    sign,
    verify(body) {
      const { sessionId, result, signature } = body || {};
      const expected = Buffer.from(sign(String(sessionId), String(result))),
        given = Buffer.from(String(signature || ""));
      if (expected.length !== given.length || !timingSafeEqual(expected, given))
        throw new AppError(400, "Ödeme bildirimi doğrulanamadı.");
      return {
        sessionId,
        paid: result === "paid",
        externalReference: "TEST-" + sessionId.slice(0, 12),
      };
    },
  };
}
export function createPayments(db, { clock, workflow, env = process.env }) {
  const config = paymentConfig(env),
    secret = env.PAYMENT_TEST_SECRET || randomBytes(32).toString("hex"),
    provider = config.test ? testProvider(secret) : null;
  const getSession = async (id) => {
    const s = await db.one("payment_sessions", { _id: id });
    if (!s) throw new AppError(404, "Ödeme oturumu bulunamadı.");
    return s;
  };
  return {
    config,
    provider,
    // Müşteri ödeme başlatır: referans + e-posta eşleşmeli, kalan kapora/tutar alınır.
    async start(reference, email) {
      if (!provider) throw new AppError(503, config.message);
      const r = await workflow.get(reference);
      if (r.email !== String(email).trim().toLowerCase())
        throw new AppError(404, "Bu referans ve e-posta ile bir rezervasyon bulunamadı.");
      if (r.status !== "pending_agency")
        throw new AppError(409, "Bu rezervasyon için online ödeme alınamaz.");
      const amount = Math.max(0, r.deposit - r.net_paid);
      if (!amount) throw new AppError(409, "Bu rezervasyonun ödemesi zaten alınmış.");
      const id = randomBytes(24).toString("hex"),
        session = {
          id,
          reference: r.reference,
          amount,
          provider: provider.name,
          status: "pending",
          created_at: clock(),
          expires_at: clock() + SESSION_MS,
        };
      await db.insert("payment_sessions", id, session);
      return { ...provider.start({ session, reservation: r }), amount };
    },
    async session(id) {
      const s = await getSession(id),
        r = await workflow.get(s.reference);
      return {
        id: s.id,
        reference: s.reference,
        amount: s.amount,
        status: s.status,
        expired: s.status === "pending" && s.expires_at < clock(),
        reservationStatus: r.status,
      };
    },
    // Sağlayıcı bildirimi: imza doğrulanır, tutar oturumdan alınır, tahsilat
    // kaydedilir ve kapora karşılandıysa rezervasyon otomatik onaylanır.
    async complete(body) {
      if (!provider) throw new AppError(503, config.message);
      const result = provider.verify(body),
        s = await getSession(result.sessionId);
      if (s.status !== "pending") return { status: s.status, reference: s.reference };
      if (!result.paid || s.expires_at < clock()) {
        await db.update("payment_sessions", { _id: s.id }, { status: "failed", finished_at: clock() });
        return { status: "failed", reference: s.reference };
      }
      await workflow.payment(s.reference, {
        amount: s.amount,
        method: "online:" + provider.name,
        externalReference: result.externalReference,
      });
      const r = await workflow.get(s.reference);
      if (r.status === "pending_agency" && r.net_paid >= r.deposit)
        await workflow.confirm(s.reference);
      await db.update("payment_sessions", { _id: s.id }, { status: "paid", finished_at: clock() });
      return { status: "paid", reference: s.reference };
    },
  };
}
