import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { AppError } from "./store.mjs";
import {
  cardBrand,
  createCardVault,
  createVakifbankGateway,
  maskPan,
  parseBankAmount,
  parseCard,
  vakifbankConfig,
} from "./vakifbank.mjs";
import { simulatorFetch } from "./bank-simulator.mjs";
// Online kapora / tam ödeme. PAYMENT_PROVIDER ile seçilir:
// - "disabled" (varsayılan): online ödeme kapalı, ön rezervasyon acenteye düşer.
// - "test": gerçek para çekmeyen deneme sağlayıcısı (yalnız yerel/deneme ortamı).
// - "vakifbank": Vakıfbank sanal POS (VPOS 724 + 3D Secure). VAKIFBANK_ENV ile
//   simulator (siteye gömülü banka) | test (bankanın test sunucusu) | production.
// Tarayıcı yönlendirmesi ödemeyi asla onaylamaz: deneme sağlayıcısında imzalı
// bildirim, Vakıfbank'ta bankayla sunucudan sunucuya satış onayı tahsilatı kaydeder.
export const DEPOSIT_PERCENT = 30;
// Kapora tutarı tek yerden hesaplanır (kuruş, yuvarlanmış).
export const depositFor = (total) =>
  Math.round((total * DEPOSIT_PERCENT) / 100);
const SESSION_MS = 30 * 60 * 1000;
// Kartı veren bankada (SMS adımı) geçen süre için oturum en az bu kadar açık kalır.
const BANK_STEP_MS = 15 * 60 * 1000;
const ATTEMPTS_PER_RESERVATION = 6;
// Tam doğrulanmış kart sahibi: Visa/Troy 05, Mastercard 02.
const FULL_AUTH_ECI = ["05", "02"];
export const ATTEMPT_ID = /^PY[0-9A-F]{24}$/;
export const VAKIFBANK_RETURN_PATH = "/api/payments/vakifbank/return";
const DISABLED_MESSAGE =
  "Online ödeme henüz aktif değil. Ön rezervasyon talebiniz acente tarafından değerlendirilecektir.";
// Ödemenin hangi sağlayıcıyla açık olduğunu belirler. Gerçek para çekmeyen
// seçenekler (deneme, simülatör, banka test sunucusu) üretimde yalnız
// PAYMENT_ALLOW_TEST=1 ile açılır; gerçek banka için üye işyeri bilgileri ve
// https PUBLIC_BASE_URL zorunludur.
function resolveProvider(env) {
  const wanted = env.PAYMENT_PROVIDER || "disabled",
    production = env.NODE_ENV === "production",
    allowTest = !production || env.PAYMENT_ALLOW_TEST === "1";
  if (wanted === "test") return allowTest ? { name: "test", test: true } : null;
  if (wanted !== "vakifbank") return null;
  const base = (env.PUBLIC_BASE_URL || "").replace(/\/$/, ""),
    bank = vakifbankConfig(env, base);
  if (bank.simulator)
    return allowTest ? { name: "vakifbank", test: true, bank, base } : null;
  if (!bank.merchantId || !bank.password || !bank.terminalNo) return null;
  if (!base.startsWith("https://") && production) return null;
  if (bank.mode === "test" && !allowTest) return null;
  return { name: "vakifbank", test: bank.mode !== "production", bank, base };
}
export function paymentConfig(env = process.env) {
  const p = resolveProvider(env);
  return {
    enabled: Boolean(p),
    provider: p?.name ?? null,
    // Gerçek para çekmeyen ortam (deneme, simülatör veya bankanın test sunucusu).
    test: Boolean(p?.test),
    // Kart bilgisi sitenin kendi formunda alınır, 3D Secure ile bankada doğrulanır.
    cardForm: p?.name === "vakifbank",
    simulator: Boolean(p?.bank?.simulator),
    currency: "TRY",
    modes: ["deposit", "full"],
    depositPercent: DEPOSIT_PERCENT,
    message: p
      ? "Kaporanızı kartla ödeyin; rezervasyonunuz anında onaylansın."
      : DISABLED_MESSAGE,
  };
}
// Deneme sağlayıcısı: kendi sayfamızda "ödendi / reddedildi" seçimi yapılır;
// sonuç, gerçek sağlayıcının sunucu bildirimi gibi HMAC imzasıyla gelir.
function testProvider(secret) {
  const sign = (sessionId, result) =>
    createHmac("sha256", secret)
      .update(sessionId + ":" + result)
      .digest("hex");
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
const esc = (v) =>
  String(v ?? "").replace(
    /[<>&'"]/g,
    (c) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&#39;", '"': "&quot;" })[
        c
      ],
  );
export function createPayments(
  db,
  {
    clock,
    workflow,
    notifications = null,
    env = process.env,
    bankFetch = null,
  },
) {
  const config = paymentConfig(env),
    resolved = resolveProvider(env),
    secret = env.PAYMENT_TEST_SECRET || randomBytes(32).toString("hex"),
    provider =
      resolved?.name === "test"
        ? testProvider(secret)
        : resolved?.name === "vakifbank"
          ? {
              name: "vakifbank",
              start: ({ session }) => ({
                redirectUrl: "/odeme/kart/" + session.id,
              }),
            }
          : null,
    bank = resolved?.bank ?? null,
    gateway = bank
      ? createVakifbankGateway(
          bank,
          bankFetch || (bank.simulator ? simulatorFetch : fetch),
        )
      : null,
    vault = createCardVault(BANK_STEP_MS),
    returnUrl = (resolved?.base || "") + VAKIFBANK_RETURN_PATH;
  const getSession = async (id) => {
    const s = await db.one("payment_sessions", { _id: id });
    if (!s) throw new AppError(404, "Ödeme oturumu bulunamadı.");
    return s;
  };
  const due = (r) => Math.max(0, r.deposit - r.net_paid);
  // Tahsilatı rezervasyona işler; kapora karşılandıysa rezervasyon otomatik onaylanır.
  const applyPayment = async (s, externalReference) => {
    await workflow.payment(s.reference, {
      amount: s.amount,
      method: "online:" + provider.name,
      externalReference,
    });
    const r = await workflow.get(s.reference);
    if (r.status === "pending_agency" && r.net_paid >= r.deposit)
      await workflow.confirm(s.reference);
    await db.update(
      "payment_sessions",
      { _id: s.id },
      { status: "paid", finished_at: clock() },
    );
  };
  const failAttempt = (id, reason, extra = {}) =>
    db.update(
      "payment_attempts",
      { _id: id },
      { status: "failed", reason, finished_at: clock(), ...extra },
    );
  // Sonuç bilinmiyor veya kart çekildiği halde rezervasyona işlenemedi: oturum askıya
  // alınır, acente banka panelinden kontrol edip elle sonuçlandırır.
  const unverified = async (attempt, reason) => {
    await db.update(
      "payment_attempts",
      { _id: attempt.id },
      { status: "unknown", reason, finished_at: clock() },
    );
    await db.update(
      "payment_sessions",
      { _id: attempt.session_id },
      { status: "unverified", finished_at: clock() },
    );
    await notifications
      ?.notifyAgency({
        subject: "Ödeme sonucu doğrulanamadı: " + attempt.reference,
        body: `${attempt.reference} rezervasyonunun kart ödemesi doğrulanamadı.\nKart: ${attempt.masked_pan}\nVakıfbank üye işyeri panelinden işlemi kontrol edin; çekildiyse tahsilatı yönetimden kaydedin, çekilmediyse müşteriyi arayın.`,
        kind: "payment_unverified",
        dedupeKey: "payment-unverified:" + attempt.id,
      })
      .catch(() => {});
    return {
      sessionId: attempt.session_id,
      ok: false,
      retry: false,
      lang: attempt.lang,
      message:
        "Ödemenizin sonucu doğrulanamadı. Kartınızdan çekim yapıldıysa rezervasyonunuz korunuyor; kontrol edip size döneceğiz.",
    };
  };
  return {
    config,
    provider,
    // Müşteri ödeme başlatır: referans + e-posta eşleşmeli, kalan kapora/tutar alınır.
    async start(reference, email, { lang = "tr" } = {}) {
      if (!provider) throw new AppError(503, config.message);
      const r = await workflow.get(reference);
      if (r.email !== String(email).trim().toLowerCase())
        throw new AppError(
          404,
          "Bu referans ve e-posta ile bir rezervasyon bulunamadı.",
        );
      if (r.status !== "pending_agency")
        throw new AppError(409, "Bu rezervasyon için online ödeme alınamaz.");
      const amount = due(r);
      if (!amount)
        throw new AppError(409, "Bu rezervasyonun ödemesi zaten alınmış.");
      const id = randomBytes(24).toString("hex"),
        session = {
          id,
          reference: r.reference,
          amount,
          provider: provider.name,
          status: "pending",
          lang: lang === "en" ? "en" : "tr",
          attempt_id: null,
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
        provider: s.provider,
        // Son kart denemesinin müşteriye gösterilecek sonucu (reddedildi vb.).
        message: s.last_error || null,
        card: s.masked_pan ? { masked: s.masked_pan, brand: s.brand } : null,
      };
    },
    // Deneme sağlayıcısı bildirimi: imza doğrulanır, tutar oturumdan alınır.
    async complete(body) {
      if (provider?.name !== "test") throw new AppError(503, config.message);
      const result = provider.verify(body),
        s = await getSession(result.sessionId);
      if (s.status !== "pending")
        return { status: s.status, reference: s.reference };
      if (!result.paid || s.expires_at < clock()) {
        await db.update(
          "payment_sessions",
          { _id: s.id },
          { status: "failed", finished_at: clock() },
        );
        return { status: "failed", reference: s.reference };
      }
      await applyPayment(s, result.externalReference);
      return { status: "paid", reference: s.reference };
    },
    // 1. adım (Vakıfbank): kart doğrulanır, deneme kaydı açılır, bankaya 3D Secure
    // kayıt sorgusu yapılır. Kart yalnız bellekte, şifreli ve kısa süre tutulur.
    async card(sessionId, input) {
      if (provider?.name !== "vakifbank")
        throw new AppError(503, config.message);
      const s = await getSession(sessionId);
      if (s.provider !== "vakifbank")
        throw new AppError(409, "Bu ödeme kartla alınamaz.");
      if (s.status === "paid")
        throw new AppError(409, "Bu ödeme zaten alındı.");
      if (s.status !== "pending" || s.expires_at < clock() + 30000)
        throw new AppError(
          409,
          "Ödeme süresi doldu. Rezervasyonum sayfasından yeniden başlatın.",
        );
      const r = await workflow.get(s.reference);
      if (r.status !== "pending_agency" || due(r) !== s.amount)
        throw new AppError(
          409,
          "Bu rezervasyonun ödeme durumu değişti. Rezervasyonum sayfasından yeniden başlatın.",
        );
      let card;
      try {
        card = parseCard(input);
      } catch (error) {
        throw new AppError(400, error.message);
      }
      const recent = await db.count("payment_attempts", {
        reference: s.reference,
        created_at: { $gt: clock() - 30 * 60000 },
      });
      if (recent >= ATTEMPTS_PER_RESERVATION)
        throw new AppError(
          429,
          "Çok fazla ödeme denemesi yapıldı. Bir süre sonra yeniden deneyin.",
        );
      if (
        s.attempt_id ||
        (await db.one("payment_attempts", {
          reference: s.reference,
          status: "authorizing",
        }))
      )
        throw new AppError(
          409,
          "Bu rezervasyon için bir ödeme şu anda bankada sonuçlanıyor. Birkaç dakika sonra sayfayı yenileyin.",
        );
      // Yeni deneme, bankada bekleyen eskisinin yerini alır: çift tıklama veya geri
      // dönüp tekrar deneme iki kez çekim yapamaz (eski 3D dönüşü artık eşleşmez).
      for (const old of await db.find("payment_attempts", {
        reference: s.reference,
        status: "3d",
      })) {
        vault.drop(old.id);
        await db.update(
          "payment_attempts",
          { _id: old.id, status: "3d" },
          { status: "superseded" },
        );
      }
      const id = "PY" + randomBytes(12).toString("hex").toUpperCase(),
        attempt = {
          id,
          session_id: s.id,
          reference: s.reference,
          amount: s.amount,
          lang: s.lang,
          status: "enrolling",
          brand: cardBrand(card.pan),
          masked_pan: maskPan(card.pan),
          created_at: clock(),
        };
      await db.insert("payment_attempts", id, attempt);
      if (s.expires_at < clock() + BANK_STEP_MS)
        await db.update(
          "payment_sessions",
          { _id: s.id },
          { expires_at: clock() + BANK_STEP_MS },
        );
      vault.put(id, card);
      let enrollment;
      try {
        enrollment = await gateway.enroll({
          id,
          card,
          amount: s.amount,
          successUrl: returnUrl,
          failureUrl: returnUrl,
        });
      } catch {
        vault.drop(id);
        await failAttempt(id, "enroll_unreachable");
        throw new AppError(
          502,
          "Bankaya şu anda ulaşılamıyor. Birkaç dakika sonra yeniden deneyin.",
        );
      }
      if (enrollment.status !== "Y" || !enrollment.acsUrl) {
        vault.drop(id);
        await failAttempt(id, "enroll_" + (enrollment.status || "E"));
        throw new AppError(
          402,
          enrollment.status === "N"
            ? "Kartınız 3D Secure (SMS onayı) ile kullanıma açık değil. Bankanızdan açtırın veya başka bir kart deneyin."
            : "Kartınız 3D Secure ile doğrulanamadı. Başka bir kart deneyin.",
        );
      }
      if (!/^https:\/\//.test(enrollment.acsUrl) && !bank.simulator) {
        vault.drop(id);
        await failAttempt(id, "enroll_bad_acs");
        throw new AppError(502, "Banka yanıtı geçersiz.");
      }
      await db.update(
        "payment_attempts",
        { _id: id, status: "enrolling" },
        {
          status: "3d",
          acs_url: enrollment.acsUrl,
          pareq: enrollment.paReq,
          term_url: enrollment.termUrl || returnUrl,
          md: enrollment.md,
        },
      );
      await db.update(
        "payment_sessions",
        { _id: s.id },
        {},
        { unset: { last_error: "" } },
      );
      return { redirect: "/odeme/3d/" + id };
    },
    // 2. adım: müşteriyi kartı veren bankanın 3D Secure sayfasına götüren form.
    async threeDsPage(id) {
      if (provider?.name !== "vakifbank" || !ATTEMPT_ID.test(id)) return null;
      const a = await db.one("payment_attempts", { _id: id, status: "3d" });
      if (!a) return null;
      const en = a.lang === "en",
        fields = { PaReq: a.pareq, TermUrl: a.term_url, MD: a.md };
      return `<!doctype html><html lang="${en ? "en" : "tr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="only light"><meta name="robots" content="noindex"><title>${en ? "Redirecting to your bank" : "Bankanıza yönlendiriliyorsunuz"}</title><style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f6f1e8;color:#1f2a24;text-align:center;padding:0 16px}h1{font-size:20px}button{margin-top:16px;padding:12px 22px;border:0;border-radius:10px;background:#7a2e1f;color:#fff;font-size:16px;font-weight:700;cursor:pointer}</style></head><body><form method="post" action="${esc(a.acs_url)}" data-autosubmit><h1>${en ? "Taking you to your bank’s secure payment page…" : "Bankanızın güvenli ödeme sayfasına yönlendiriliyorsunuz…"}</h1><p>${en ? "You will enter the SMS verification code on your bank’s page." : "SMS ile gelen doğrulama kodunu bankanızın sayfasında gireceksiniz."}</p>${Object.entries(
        fields,
      )
        .map(([k, v]) => `<input type="hidden" name="${k}" value="${esc(v)}">`)
        .join(
          "",
        )}<noscript><p>${en ? "Press the button to continue." : "Devam etmek için düğmeye basın."}</p></noscript><button type="submit">${en ? "Continue to bank" : "Bankaya devam et"}</button></form><script src="/payment-autosubmit.js"></script></body></html>`;
    },
    // 3. adım: bankanın 3D dönüşü. İmzasız tarayıcı formudur; tek başına asla
    // güvenilmez: alanlar denemeyle eşleşmeli, tam doğrulama gelmeli ve satış
    // bankanın VPOS servisinde sunucudan sunucuya onaylanmalıdır.
    async completeCard(params, clientIp) {
      const get = (k) => String(params?.[k] ?? ""),
        id = get("VerifyEnrollmentRequestId") || get("SessionInfo");
      const attempt =
        provider?.name === "vakifbank" && ATTEMPT_ID.test(id)
          ? await db.one("payment_attempts", { _id: id })
          : null;
      if (!attempt)
        return {
          sessionId: null,
          ok: false,
          retry: false,
          message: "Ödeme oturumu bulunamadı.",
        };
      // retry: müşteri kart formuna dönüp başka kartla yeniden deneyebilir.
      const done = async (ok, message = "", retry = !ok) => {
        if (!ok && message)
          await db.update(
            "payment_sessions",
            { _id: attempt.session_id, status: "pending" },
            { last_error: message },
          );
        return {
          sessionId: attempt.session_id,
          ok,
          retry,
          message,
          lang: attempt.lang,
        };
      };
      // Her deneme yalnız bir kez işlenir: aynı dönüş iki kez gelirse ikinci çekim olmaz.
      const claimed = await db.update(
        "payment_attempts",
        { _id: id, status: "3d" },
        { status: "authorizing", returned_at: clock() },
      );
      if (!claimed)
        return done(
          attempt.status === "succeeded",
          attempt.status === "succeeded"
            ? ""
            : "Bu ödeme denemesi zaten sonuçlandı.",
          false,
        );
      if (
        get("MerchantId") !== bank.merchantId ||
        get("VerifyEnrollmentRequestId") !== id ||
        parseBankAmount(get("PurchAmount")) !== attempt.amount
      ) {
        vault.drop(id);
        await failAttempt(id, "return_mismatch");
        return done(
          false,
          "Banka yanıtı ödemeyle eşleşmedi. Kartınızdan çekim yapılmadı.",
        );
      }
      // Yalnız tam doğrulanmış kart sahibi satışa geçer: "A" (yalnız denendi) veya
      // CAVV'siz dönüş SMS adımı olmadan çekim yapar, kabul edilmez.
      const status = get("Status"),
        eci = get("Eci"),
        cavv = get("Cavv");
      if (
        status !== "Y" ||
        !FULL_AUTH_ECI.includes(eci) ||
        !/^[A-Za-z0-9+/=]{20,64}$/.test(cavv)
      ) {
        vault.drop(id);
        await failAttempt(
          id,
          status === "Y"
            ? "3d_unauthenticated"
            : "3d_" + (status.slice(0, 2) || "none"),
          {
            bank_error: get("ErrorCode").slice(0, 20),
            eci: eci.slice(0, 4),
          },
        );
        return done(
          false,
          "3D Secure doğrulaması tamamlanmadı. Kartınızdan çekim yapılmadı; yeniden deneyebilirsiniz.",
        );
      }
      const card = vault.take(id);
      if (!card) {
        await failAttempt(id, "card_expired");
        return done(
          false,
          "Ödeme oturumunun süresi doldu. Kart bilgilerinizi yeniden girin.",
        );
      }
      // Yalnız hâlâ bu ödemeyi bekleyen rezervasyon çekilir; oturumu başka bir deneme
      // aldıysa veya tutar değiştiyse çekim yapılmaz.
      const r = await workflow.get(attempt.reference);
      const owned =
        r.status === "pending_agency" &&
        due(r) === attempt.amount &&
        (await db.update(
          "payment_sessions",
          { _id: attempt.session_id, status: "pending", attempt_id: null },
          { attempt_id: id },
        ));
      if (!owned) {
        await failAttempt(id, "not_payable");
        return done(
          false,
          "Bu rezervasyon artık bu ödemeyi beklemiyor (iptal edilmiş, süresi dolmuş veya başka bir ödemeyle tamamlanmış). Kartınızdan çekim yapılmadı.",
        );
      }
      let sale;
      try {
        sale = await gateway.sale({
          id,
          card,
          amount: attempt.amount,
          eci,
          cavv,
          clientIp,
        });
      } catch {
        return unverified(attempt, "sale_unreachable");
      }
      if (!sale.ok) {
        await failAttempt(id, "declined", {
          result_code: sale.resultCode.slice(0, 8),
        });
        await db.update(
          "payment_sessions",
          { _id: attempt.session_id, attempt_id: id },
          { attempt_id: null },
        );
        return done(
          false,
          "Ödeme bankanız tarafından onaylanmadı" +
            (sale.resultDetail ? ": " + sale.resultDetail.slice(0, 120) : "."),
        );
      }
      await db.update(
        "payment_sessions",
        { _id: attempt.session_id },
        {
          bank_transaction_id: sale.transactionId,
          auth_code: sale.authCode,
          rrn: sale.rrn,
          masked_pan: attempt.masked_pan,
          brand: attempt.brand,
          paid_at: clock(),
        },
      );
      try {
        await applyPayment(
          {
            id: attempt.session_id,
            reference: attempt.reference,
            amount: attempt.amount,
          },
          sale.transactionId || id,
        );
      } catch {
        // Banka kartı çekti ama rezervasyona işlenemedi: ödeme asla kaybolmaz.
        return unverified(attempt, "charged_not_applied");
      }
      await db.update(
        "payment_attempts",
        { _id: id },
        {
          status: "succeeded",
          transaction_id: sale.transactionId,
          finished_at: clock(),
        },
      );
      return done(true);
    },
  };
}
