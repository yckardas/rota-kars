import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { openStore } from "../server/store.mjs";
import { createApp } from "../server/app.mjs";
import { paymentConfig } from "../server/payments.mjs";
import { luhn, parseBankAmount, parseCard } from "../server/vakifbank.mjs";
import { simulatorFetch } from "../server/bank-simulator.mjs";

const GOOD_CARD = "4111111111111111";
// Satışta reddedilen simülatör kartı: Luhn'a uygun ve 0002 ile biten bir Visa.
const DECLINED_CARD = (() => {
  for (let d = 0; d < 10; d++) {
    const pan = "41111111111" + d + "0002";
    if (luhn(pan)) return pan;
  }
})();
const NOT_ENROLLED = "4000000000000101";
const SIM_ENV = { PAYMENT_PROVIDER: "vakifbank", VAKIFBANK_ENV: "simulator" };

async function fixture(t, env = SIM_ENV, options = {}) {
  const { clock, ...appOptions } = options;
  const store = await openStore(":memory:", { env, ...(clock ? { clock } : {}) });
  const server = createApp(store, { env, ...appOptions }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await store.db.close();
  });
  const origin = "http://127.0.0.1:" + server.address().port;
  const api = (path, body) =>
    fetch(origin + "/api" + path, {
      ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
      headers: { "Content-Type": "application/json", "X-Rota-Client": "web" },
    });
  // Tarayıcının form gönderimi: yönlendirmeyi izlemez, başka siteden gelir.
  const form = (path, fields, headers = {}) =>
    fetch(origin + path, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...headers,
      },
      body: new URLSearchParams(fields),
    });
  const d = (await store.listDepartures("ani-cildir"))[0];
  const h = await store.hold(d.id, [2]);
  const r = await store.reserve({
    holdToken: h.token,
    name: "Ayşe Yılmaz",
    email: "ayse@example.com",
    phone: "05551112233",
    passengers: ["Ayşe Yılmaz"],
    paymentMode: "deposit",
  });
  const start = async (lang) => {
    const res = await api("/payments/start", {
      reference: r.reference,
      email: "ayse@example.com",
      ...(lang ? { lang } : {}),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.match(body.redirectUrl, /^\/odeme\/kart\/[a-f0-9]{48}$/);
    return body.redirectUrl.split("/").pop();
  };
  const ALL = { terms: true };
  const consent = (sessionId, body = ALL) =>
    api("/payments/consent/" + sessionId, body);
  // Müşteri ödeme ekranında önce onay kutularını işaretler, sonra kartı girer.
  const card = async (sessionId, pan = GOOD_CARD, extra = {}) => {
    await consent(sessionId);
    return rawCard(sessionId, pan, extra);
  };
  const rawCard = (sessionId, pan = GOOD_CARD, extra = {}) =>
    api("/payments/card/" + sessionId, {
      holder: "Ayşe Yılmaz",
      pan,
      expiry:
        "12/" + String((new Date().getFullYear() + 3) % 100).padStart(2, "0"),
      cvv: "123",
      ...extra,
    });
  const hidden = (html) =>
    Object.fromEntries(
      [...html.matchAll(/name="(\w+)" value="([^"]*)"/g)].map(([, k, v]) => [
        k,
        v
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&"),
      ]),
    );
  // Kartı girip 3D Secure sayfasını geçer; bankanın dönüş alanlarını verir.
  const throughBank = async (sessionId, pan = GOOD_CARD, decision = "Y") => {
    const res = await card(sessionId, pan);
    assert.equal(res.status, 200, await res.clone().text());
    const { redirect } = await res.json();
    assert.match(redirect, /^\/odeme\/3d\/PY[0-9A-F]{24}$/);
    const page = await (await fetch(origin + redirect)).text();
    assert.match(page, /action="\/__bank\/vakifbank\/acs"/);
    const acs = await form("/__bank/vakifbank/acs/complete", {
      ...hidden(page),
      decision,
    });
    const back = hidden(await acs.text());
    return back;
  };
  return { store, api, form, r, start, card, rawCard, consent, throughBank, origin };
}
const sessionOf = async (api, id) =>
  (await api("/payments/sessions/" + id)).json();

test("Vakıfbank ayarları: simülatör ve test sunucusu üretimde kendiliğinden açılmaz", () => {
  assert.equal(paymentConfig(SIM_ENV).enabled, true);
  assert.equal(paymentConfig(SIM_ENV).simulator, true);
  assert.equal(paymentConfig(SIM_ENV).cardForm, true);
  assert.equal(
    paymentConfig({ ...SIM_ENV, NODE_ENV: "production" }).enabled,
    false,
  );
  assert.equal(
    paymentConfig({
      ...SIM_ENV,
      NODE_ENV: "production",
      PAYMENT_ALLOW_TEST: "1",
    }).enabled,
    true,
  );
  const real = {
    PAYMENT_PROVIDER: "vakifbank",
    VAKIFBANK_ENV: "production",
    NODE_ENV: "production",
    PUBLIC_BASE_URL: "https://rotakarsturizm.com",
  };
  // Üye işyeri bilgileri eksikse açılmaz.
  assert.equal(paymentConfig(real).enabled, false);
  const creds = {
    VAKIFBANK_MERCHANT_ID: "000100000013506",
    VAKIFBANK_MERCHANT_PASSWORD: "x",
    VAKIFBANK_TERMINAL_NO: "VP000579",
  };
  assert.equal(paymentConfig({ ...real, ...creds }).enabled, true);
  assert.equal(paymentConfig({ ...real, ...creds }).test, false);
  // Gerçek bankada https adres zorunlu; banka test sunucusu üretimde izin ister.
  assert.equal(
    paymentConfig({
      ...real,
      ...creds,
      PUBLIC_BASE_URL: "http://rotakarsturizm.com",
    }).enabled,
    false,
  );
  assert.equal(
    paymentConfig({ ...real, ...creds, VAKIFBANK_ENV: "test" }).enabled,
    false,
  );
  // İstemciye giden ayarlarda üye işyeri bilgisi bulunmaz.
  assert.doesNotMatch(
    JSON.stringify(paymentConfig({ ...real, ...creds })),
    /000100000013506|VP000579/,
  );
});

test("kart doğrulaması ve banka tutar biçimleri", () => {
  const now = new Date(2026, 10, 11);
  assert.deepEqual(
    parseCard(
      {
        holder: "Ali Veli",
        pan: "4111 1111 1111 1111",
        expiry: "12/28",
        cvv: "123",
      },
      now,
    ),
    {
      holder: "Ali Veli",
      pan: GOOD_CARD,
      month: "12",
      year: "2028",
      cvv: "123",
    },
  );
  assert.throws(
    () =>
      parseCard(
        {
          holder: "Ali Veli",
          pan: "4111111111111112",
          expiry: "12/28",
          cvv: "123",
        },
        now,
      ),
    /geçerli değil/,
  );
  assert.throws(
    () =>
      parseCard(
        { holder: "Ali Veli", pan: GOOD_CARD, expiry: "10/26", cvv: "123" },
        now,
      ),
    /geçmiş/,
  );
  assert.throws(
    () =>
      parseCard(
        { holder: "Ali Veli", pan: GOOD_CARD, expiry: "13/28", cvv: "123" },
        now,
      ),
    /ayı/,
  );
  assert.throws(
    () =>
      parseCard(
        { holder: "Ali Veli", pan: GOOD_CARD, expiry: "12/28", cvv: "12" },
        now,
      ),
    /CVV/,
  );
  assert.throws(
    () =>
      parseCard(
        { holder: "A", pan: GOOD_CARD, expiry: "12/28", cvv: "123" },
        now,
      ),
    /ismi/,
  );
  assert.equal(parseBankAmount("1250.50"), 125050);
  assert.equal(parseBankAmount("125050"), 125050);
  assert.ok(Number.isNaN(parseBankAmount("1250,50")));
});

test("simülatörle kart ödemesi: 3D Secure sonrası tahsilat ve otomatik onay, kart saklanmaz", async (t) => {
  const { store, api, form, r, start, throughBank } = await fixture(t);
  const id = await start();
  const back = await throughBank(id);
  assert.equal(back.Status, "Y");
  // Banka dönüşü başka siteden gelen formdur (Origin bankanın adresi, özel başlık yok).
  const res = await form("/api/payments/vakifbank/return", back, {
    Origin: "https://3dsecure.example",
  });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get("location"), "/odeme/sonuc/" + id);
  const after = await store.workflow.get(r.reference);
  assert.equal(after.status, "confirmed");
  assert.equal(after.net_paid, r.deposit);
  const s = await sessionOf(api, id);
  assert.equal(s.status, "paid");
  assert.equal(s.card.masked, "411111******1111");
  // Aynı dönüş ikinci kez gelirse çift tahsilat olmaz.
  const again = await form("/api/payments/vakifbank/return", back);
  assert.equal(again.status, 303);
  assert.equal((await store.workflow.get(r.reference)).net_paid, r.deposit);
  // Kart numarası hiçbir kayıtta bulunmaz.
  for (const name of [
    "payment_sessions",
    "payment_attempts",
    "payment_ledger",
    "reservations",
    "notification_outbox",
  ])
    assert.doesNotMatch(
      JSON.stringify(await store.db.find(name)),
      new RegExp(GOOD_CARD),
      name,
    );
  // Ödendikten sonra yeni ödeme başlatılamaz.
  assert.equal(
    (
      await api("/payments/start", {
        reference: r.reference,
        email: "ayse@example.com",
      })
    ).status,
    409,
  );
});

test("reddedilen kart: çekim yok, müşteri kart formuna döner ve başka kartla öder", async (t) => {
  const { store, api, form, r, start, throughBank } = await fixture(t);
  const id = await start("en");
  const declined = await form(
    "/api/payments/vakifbank/return",
    await throughBank(id, DECLINED_CARD),
  );
  assert.equal(declined.headers.get("location"), "/en/odeme/kart/" + id);
  let s = await sessionOf(api, id);
  assert.equal(s.status, "pending");
  assert.match(s.message, /onaylanmadı/);
  assert.equal(
    (await store.workflow.get(r.reference)).status,
    "pending_agency",
  );
  // SMS adımında iptal: yine çekim yok.
  const cancelled = await form(
    "/api/payments/vakifbank/return",
    await throughBank(id, GOOD_CARD, "N"),
  );
  assert.equal(cancelled.headers.get("location"), "/en/odeme/kart/" + id);
  assert.match((await sessionOf(api, id)).message, /3D Secure/);
  const paid = await form(
    "/api/payments/vakifbank/return",
    await throughBank(id),
  );
  assert.equal(paid.headers.get("location"), "/en/odeme/sonuc/" + id);
  s = await sessionOf(api, id);
  assert.equal(s.status, "paid");
  assert.equal(s.message, null);
  assert.equal((await store.workflow.get(r.reference)).status, "confirmed");
});

test("3D Secure'a kayıtlı olmayan ve geçersiz kart bankaya gitmez", async (t) => {
  const { start, card } = await fixture(t);
  const id = await start();
  const res = await card(id, NOT_ENROLLED);
  assert.equal(res.status, 402);
  assert.match((await res.json()).message, /3D Secure/);
  assert.equal((await card(id, "4111111111111112")).status, 400);
  assert.equal((await card(id, GOOD_CARD, { expiry: "01/20" })).status, 400);
});

test("bankanın dönüşü kurcalanırsa veya tam doğrulama yoksa çekim yapılmaz", async (t) => {
  const { store, form, r, start, throughBank } = await fixture(t);
  const id = await start();
  // Tutar değiştirilmiş dönüş.
  const tampered = await throughBank(id);
  await form("/api/payments/vakifbank/return", {
    ...tampered,
    PurchAmount: "1.00",
  });
  assert.equal((await store.workflow.get(r.reference)).net_paid, 0);
  // Yalnız "denendi" (A) veya CAVV'siz dönüş.
  const attempted = await throughBank(id);
  await form("/api/payments/vakifbank/return", { ...attempted, Status: "A" });
  const noCavv = await throughBank(id);
  await form("/api/payments/vakifbank/return", { ...noCavv, Cavv: "" });
  // Başka üye işyeri.
  const otherMerchant = await throughBank(id);
  await form("/api/payments/vakifbank/return", {
    ...otherMerchant,
    MerchantId: "999",
  });
  assert.equal((await store.workflow.get(r.reference)).net_paid, 0);
  assert.equal(
    (await store.workflow.get(r.reference)).status,
    "pending_agency",
  );
  // Yeni deneme eskisinin yerini alır: eski 3D dönüşü artık çekim yapamaz.
  const stale = await throughBank(id);
  await throughBank(id);
  await form("/api/payments/vakifbank/return", stale);
  assert.equal((await store.workflow.get(r.reference)).net_paid, 0);
});

test("bankadan satış yanıtı alınamazsa ödeme askıya alınır ve acenteye bildirilir", async (t) => {
  const { store, api, form, r, start, throughBank } = await fixture(
    t,
    { ...SIM_ENV, AGENCY_EMAIL: "acente@example.com" },
    {
      bankFetch: (url, init) =>
        String(url).includes("/vpos")
          ? Promise.reject(new Error("timeout"))
          : simulatorFetch(url, init),
    },
  );
  const id = await start();
  const res = await form(
    "/api/payments/vakifbank/return",
    await throughBank(id),
  );
  assert.equal(res.headers.get("location"), "/odeme/sonuc/" + id);
  assert.equal((await sessionOf(api, id)).status, "unverified");
  assert.equal((await store.workflow.get(r.reference)).net_paid, 0);
  const outbox = await store.db.find("notification_outbox");
  assert.ok(outbox.some((n) => /doğrulanamadı/.test(n.subject || "")));
  // Askıdaki ödeme için yeni kart denemesi açılmaz.
  assert.equal(
    (
      await api("/payments/card/" + id, {
        holder: "Ayşe Yılmaz",
        pan: GOOD_CARD,
        expiry: "12/40",
        cvv: "123",
      })
    ).status,
    409,
  );
});

test("ödeme kapalıyken veya deneme sağlayıcısında kart uçları çalışmaz", async (t) => {
  const { form, origin } = await fixture(t, { PAYMENT_PROVIDER: "test" });
  const res = await form("/api/payments/vakifbank/return", {
    VerifyEnrollmentRequestId: "PY" + "A".repeat(24),
  });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get("location"), "/");
  // Banka simülatörü yalnız VAKIFBANK_ENV=simulator iken vardır.
  const sim = await form("/__bank/vakifbank/acs", { PaReq: "x" });
  assert.doesNotMatch(await sim.text(), /SİMÜLASYON|Geçersiz istek/);
  const page = await fetch(origin + "/odeme/3d/PY" + "A".repeat(24), {
    redirect: "manual",
  });
  assert.equal(page.status, 303);
});

test("yayında 3D sayfası bankanın https adresine form gönderebilir, diğer sayfalar gönderemez", async (t) => {
  const { origin, start, card } = await fixture(t, {
    ...SIM_ENV,
    NODE_ENV: "production",
    PAYMENT_ALLOW_TEST: "1",
    SEED_DEMO: "1",
    PII_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
  });
  const { redirect } = await (await card(await start())).json();
  const page = await fetch(origin + redirect);
  assert.equal(page.status, 200);
  assert.match(
    page.headers.get("content-security-policy"),
    /form-action 'self' https:;/,
  );
  assert.equal(page.headers.get("cache-control"), "no-store");
  const home = await fetch(origin + "/api/payment/status");
  assert.match(
    home.headers.get("content-security-policy"),
    /form-action 'self' https:\/\/appleid\.apple\.com;/,
  );
});

test("önizleme modu: kart ekranı açılır ama kart işlenmez, rezervasyon beklemede kalır", async (t) => {
  assert.equal(paymentConfig({ PAYMENT_PREVIEW: "1" }).preview, true);
  assert.equal(paymentConfig({ PAYMENT_PREVIEW: "1" }).enabled, false);
  assert.equal(
    paymentConfig({ PAYMENT_PREVIEW: "1", NODE_ENV: "production" }).preview,
    true,
  );
  // Gerçek sağlayıcı açıksa önizleme devre dışıdır.
  assert.equal(
    paymentConfig({ ...SIM_ENV, PAYMENT_PREVIEW: "1" }).preview,
    false,
  );
  const { store, api, r, start, card } = await fixture(t, {
    PAYMENT_PREVIEW: "1",
  });
  const id = await start();
  assert.equal((await sessionOf(api, id)).provider, "preview");
  const res = await card(id);
  assert.equal(res.status, 503);
  assert.match((await res.json()).message, /banka onayının ardından/);
  assert.equal(
    (await store.workflow.get(r.reference)).status,
    "pending_agency",
  );
  assert.equal((await store.db.find("payment_attempts")).length, 0);
});

test("ödeme ekranı: onay kutuları işaretlenmeden kart alınmaz, onaylar kaydedilir", async (t) => {
  const { store, api, r, start, rawCard, consent } = await fixture(t);
  const id = await start();
  // Oturum, ödeme ekranında gösterilecek özeti ve bu rezervasyonun metinlerini verir.
  const s = await sessionOf(api, id);
  assert.equal(s.consented, false);
  assert.equal(s.summary.tourName, "Ani, Çıldır ve Kars");
  assert.equal(s.summary.count, 1);
  assert.match(s.documents.preInfo, new RegExp(r.reference));
  assert.match(s.documents.contract, /TUR HİZMET SÖZLEŞMESİ/);
  assert.ok(s.documents.cancellation.length > 3);
  // Onaysız kart denemesi bankaya gitmez.
  const without = await rawCard(id);
  assert.equal(without.status, 409);
  assert.match((await without.json()).message, /onay kutusunu/);
  assert.equal((await store.db.find("payment_attempts")).length, 0);
  // İşaretlenmemiş onay reddedilir.
  assert.equal((await consent(id, {})).status, 400);
  assert.equal((await consent(id, { terms: false })).status, 400);
  assert.equal((await sessionOf(api, id)).consented, false);
  // Birleşik onay üç metin için oturuma ve rıza kayıtlarına yazılır.
  assert.equal((await consent(id)).status, 200);
  const saved = await store.db.one("payment_sessions", { _id: id });
  assert.ok(saved.consents_at);
  assert.deepEqual(
    Object.keys(saved.consents).filter((k) => typeof saved.consents[k] === "number").sort(),
    ["cancellation_terms", "pre_info", "service_contract"],
  );
  const ledger = (await store.db.find("consents", { source: "payment" })).map((c) => c.type).sort();
  assert.deepEqual(ledger, ["cancellation_terms", "pre_info", "service_contract"]);
  assert.equal((await sessionOf(api, id)).consented, true);
  assert.equal((await rawCard(id)).status, 200);
});

test("önizleme modu: ödeme ekranının onayları da kaydedilir", async (t) => {
  const { store, api, start, consent } = await fixture(t, { PAYMENT_PREVIEW: "1" });
  const id = await start();
  const s = await sessionOf(api, id);
  assert.equal(s.provider, "preview");
  assert.ok(s.documents.preInfo);
  assert.equal((await consent(id)).status, 200);
  assert.ok((await store.db.one("payment_sessions", { _id: id })).consents_at);
});
test("ödeme ekranında kapora ↔ tam ödeme değişir; tutar, kapora ve form güncellenir, onay yeniden istenir", async (t) => {
  const { store, api, form, r, start, consent, throughBank } = await fixture(t);
  const id = await start();
  assert.equal((await sessionOf(api, id)).amount, r.deposit);
  assert.equal((await consent(id)).status, 200);
  assert.equal((await api("/payments/mode/" + id, { mode: "yarim" })).status, 400);
  const full = await api("/payments/mode/" + id, { mode: "full" });
  assert.equal(full.status, 200);
  assert.deepEqual(await full.json(), { amount: r.total, paymentMode: "full" });
  const s = await sessionOf(api, id);
  assert.equal(s.amount, r.total);
  assert.equal(s.summary.paymentMode, "full");
  // Tutar değişti: ödeme ekranındaki onay yeniden verilmeli.
  assert.equal(s.consented, false);
  const saved = await store.workflow.get(r.reference);
  assert.equal(saved.deposit, r.total);
  assert.equal(saved.payment_mode, "full");
  // Tam ödemeyle 3D Secure'dan geçince tutarın tamamı tahsil edilir.
  const back = await throughBank(id);
  await form("/api/payments/vakifbank/return", back, { Origin: "https://3dsecure.example" });
  const paid = await store.workflow.get(r.reference);
  assert.equal(paid.net_paid, r.total);
  assert.equal(paid.status, "confirmed");
  // Ödeme alındıktan sonra plan değişmez.
  assert.equal((await api("/payments/mode/" + id, { mode: "deposit" })).status, 409);
});

test("ödeme planı değişince kayıttaki ön bilgilendirme formu yeni planla yazılır", async (t) => {
  const { store, api } = await fixture(t);
  const d = (await store.listDepartures("ani-cildir"))[0];
  const h = await store.hold(d.id, [7]);
  const r = await store.reserve({
    holdToken: h.token,
    name: "Can Demir",
    email: "can@example.com",
    phone: "05551112244",
    passengers: ["Can Demir"],
    paymentMode: "full",
    legal: { onlinePayment: true, depositPercent: 30 },
  });
  assert.doesNotMatch(r.pre_info_text, /%30 kapora/);
  const start = await (await api("/payments/start", { reference: r.reference, email: "can@example.com" })).json();
  const id = start.redirectUrl.split("/").pop();
  assert.equal((await api("/payments/mode/" + id, { mode: "deposit" })).status, 200);
  const after = await store.workflow.get(r.reference);
  assert.equal(after.deposit, Math.round(r.total * 0.3));
  assert.match(after.pre_info_text, /%30 kapora/);
  assert.equal((await sessionOf(api, id)).amount, after.deposit);
});

test("aynı rezervasyonun iki ödeme oturumu aynı anda sonuçlansa da bankaya tek çekim gider", async (t) => {
  const { store, form, r, start, throughBank } = await fixture(t);
  const s1 = await start(),
    s2 = await start();
  const backA = await throughBank(s1);
  // Yarış durumu: iki sekme kartı aynı anda girmiş, ikinci deneme birincinin yerini alamamış.
  const [a] = await store.db.find("payment_attempts", { session_id: s1 });
  await store.db.update("payment_attempts", { _id: a.id }, { status: "paused" });
  const backB = await throughBank(s2);
  await store.db.update("payment_attempts", { _id: a.id }, { status: "3d" });
  await Promise.all([
    form("/api/payments/vakifbank/return", backA),
    form("/api/payments/vakifbank/return", backB),
  ]);
  const succeeded = await store.db.find("payment_attempts", { reference: r.reference, status: "succeeded" });
  assert.equal(succeeded.length, 1, "yalnız bir satış");
  const after = await store.workflow.get(r.reference);
  assert.equal(after.net_paid, r.deposit);
  assert.equal(await store.db.count("payment_locks", {}), 0, "kilit başarılı çekimden sonra kalkar");
});

// ---- Karta iade / iptal (yönetim) ----
const ADMIN_ENV = {
  ...SIM_ENV,
  ADMIN_PASSWORD: "ilk-kurulum-parolasi",
  AGENCY_EMAIL: "acente@example.com",
};
const prmstr = (init) =>
  new URLSearchParams(String(init?.body ?? "")).get("prmstr") || "";
const bankXml = (code, detail) =>
  new Response(
    `<VposResponse><ResultCode>${code}</ResultCode><ResultDetail>${detail}</ResultDetail></VposResponse>`,
    { headers: { "Content-Type": "application/xml" } },
  );
// Kartla kapora ödenmiş rezervasyon + sahip ve operasyon yöneticisi oturumları.
// bank: iptal/iade isteklerini (Cancel/Refund) yakalayıp yanıtı değiştirmeye yarar.
async function paidByCard(t, { bank } = {}) {
  let now = Date.now();
  const sent = [];
  const f = await fixture(t, ADMIN_ENV, {
    clock: () => now,
    bankFetch: async (url, init) => {
      const xml = prmstr(init);
      if (/<TransactionType>(Cancel|Refund)</.test(xml)) {
        sent.push(xml);
        if (bank) {
          const answer = await bank(xml, sent.length);
          if (answer) return answer;
        }
      }
      return simulatorFetch(url, init);
    },
  });
  const id = await f.start();
  const res = await f.form("/api/payments/vakifbank/return", await f.throughBank(id));
  assert.equal(res.status, 303);
  const paid = await f.store.workflow.get(f.r.reference);
  assert.equal(paid.net_paid, f.r.deposit);
  const call = async (path, { body, cookie } = {}) => {
    const r = await fetch(f.origin + "/api" + path, {
      method: body ? "POST" : "GET",
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        "Content-Type": "application/json",
        "X-Rota-Client": "web",
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });
    return {
      status: r.status,
      json: await r.json().catch(() => null),
      cookie: r.headers.get("set-cookie")?.split(";")[0],
    };
  };
  const boot = (await call("/admin/login", { body: { password: ADMIN_ENV.ADMIN_PASSWORD } })).cookie;
  let owner = (
    await call("/admin/users", {
      body: { email: "sahip@rotakars.test", name: "Sahip", password: "sahip-parolasi-2026", role: "owner" },
      cookie: boot,
    })
  ).cookie;
  await call("/admin/users", {
    body: { email: "ops@rotakars.test", name: "Operasyon", password: "operasyon-parolasi-2026", role: "operations" },
    cookie: owner,
  });
  const ops = (
    await call("/admin/login", { body: { email: "ops@rotakars.test", password: "operasyon-parolasi-2026" } })
  ).cookie;
  const ref = f.r.reference;
  const cardPayments = (cookie = owner) => call(`/admin/reservations/${ref}/card-payments`, { cookie });
  const refund = (paymentId, amount, cookie = owner) =>
    call(`/admin/reservations/${ref}/card-refunds`, { body: { paymentId, amount, confirm: true }, cookie });
  const resolve = (id, outcome, cookie = owner) =>
    call(`/admin/card-refunds/${id}/resolve`, { body: { outcome, confirm: true }, cookie });
  const payment = (await cardPayments()).json.payments[0];
  const netPaid = async () => (await f.store.workflow.get(ref)).net_paid;
  // Yönetici oturumu 8 saattir: ertesi güne geçince sahip yeniden giriş yapar.
  const nextDay = async () => {
    now += 24 * 3600000;
    owner = (
      await call("/admin/login", { body: { email: "sahip@rotakars.test", password: "sahip-parolasi-2026" } })
    ).cookie;
  };
  return { ...f, call, owner, ops, sent, payment, cardPayments, refund, resolve, netPaid, nextDay };
}

test("simülatör iptal ve iadeyi satış tutarına göre denetler", async () => {
  const vpos = async (fields) => {
    const xml = await (
      await simulatorFetch("http://x/__bank/vakifbank/vpos", {
        body: new URLSearchParams({
          prmstr: "<VposRequest>" + Object.entries(fields).map(([k, v]) => `<${k}>${v}</${k}>`).join("") + "</VposRequest>",
        }),
      })
    ).text();
    return {
      code: /<ResultCode>(\d+)</.exec(xml)[1],
      id: /<TransactionId>([^<]*)</.exec(xml)[1],
    };
  };
  const sale = await vpos({ TransactionType: "Sale", Pan: GOOD_CARD, CurrencyAmount: "100.00" });
  assert.equal(sale.code, "0000");
  assert.equal((await vpos({ TransactionType: "Refund", ReferenceTransactionId: sale.id, CurrencyAmount: "60.00" })).code, "0000");
  assert.equal((await vpos({ TransactionType: "Refund", ReferenceTransactionId: sale.id, CurrencyAmount: "40.01" })).code, "1085");
  assert.equal((await vpos({ TransactionType: "Cancel", ReferenceTransactionId: sale.id })).code, "1084");
  assert.equal((await vpos({ TransactionType: "Refund", ReferenceTransactionId: "PY123", CurrencyAmount: "1.00" })).code, "1033");
  const other = await vpos({ TransactionType: "Sale", Pan: GOOD_CARD, CurrencyAmount: "50.00" });
  assert.equal((await vpos({ TransactionType: "Cancel", ReferenceTransactionId: other.id })).code, "0000");
  assert.equal((await vpos({ TransactionType: "Cancel", ReferenceTransactionId: other.id })).code, "1084");
});

test("karta iade: aynı gün yalnız tamamı iptal (Cancel) edilir, ikinci iade reddedilir", async (t) => {
  const { r, payment, cardPayments, refund, sent, netPaid, store } = await paidByCard(t);
  assert.equal(payment.amount, r.deposit);
  assert.equal(payment.sameDay, true);
  assert.equal(payment.refundable, r.deposit);
  assert.equal(payment.maskedPan, "411111******1111");
  // Aynı gün kısmi iade yapılamaz (banka gün sonu öncesi yalnız iptal).
  const partial = await refund(payment.id, 10000);
  assert.equal(partial.status, 409);
  assert.match(partial.json.message, /yalnız tamamıyla/);
  assert.equal(sent.length, 0, "bankaya istek gitmez");
  const ok = await refund(payment.id, r.deposit);
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.equal(ok.json.status, "succeeded");
  assert.equal(ok.json.refund.type, "cancel");
  assert.equal(sent.length, 1);
  assert.match(sent[0], /<TransactionType>Cancel<\/TransactionType>/);
  assert.match(sent[0], new RegExp(`<ReferenceTransactionId>${payment.transactionId}</ReferenceTransactionId>`));
  assert.equal(await netPaid(), 0);
  const ledger = (await store.workflow.get(r.reference)).ledger.filter((l) => l.kind === "refund");
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].method, "online:vakifbank");
  assert.equal(ledger[0].external_reference, ok.json.refund.id);
  // Çift iade: tutar kalmadı, bankaya ikinci istek gitmez.
  assert.equal((await refund(payment.id, r.deposit)).status, 409);
  assert.equal(sent.length, 1);
  const after = (await cardPayments()).json.payments[0];
  assert.equal(after.refundable, 0);
  assert.equal(after.refunded, r.deposit);
});

test("karta iade: ertesi gün kısmi iade (Refund), toplamı tahsilatı aşamaz", async (t) => {
  const { r, payment, cardPayments, refund, sent, netPaid, nextDay, store } = await paidByCard(t);
  await nextDay();
  const first = (await cardPayments()).json.payments[0];
  assert.equal(first.sameDay, false);
  assert.equal(first.refundable, r.deposit);
  const part = await refund(payment.id, 10000);
  assert.equal(part.status, 200, JSON.stringify(part.json));
  assert.equal(part.json.refund.type, "refund");
  assert.match(sent[0], /<TransactionType>Refund<\/TransactionType>/);
  assert.match(sent[0], /<CurrencyAmount>100\.00<\/CurrencyAmount>/);
  assert.equal(await netPaid(), r.deposit - 10000);
  assert.equal((await cardPayments()).json.payments[0].refundable, r.deposit - 10000);
  // Kalanı aşan iade bankaya gitmez.
  const over = await refund(payment.id, r.deposit - 10000 + 1);
  assert.equal(over.status, 409);
  assert.match(over.json.message, /aşıyor/);
  assert.equal(sent.length, 1);
  assert.equal((await refund(payment.id, r.deposit - 10000)).status, 200);
  assert.equal(await netPaid(), 0);
  assert.equal((await refund(payment.id, 100)).status, 409);
  assert.equal(sent.length, 2);
  // Rezervasyonun durumu iadeyle değişmez (iptal ayrı bir karardır).
  assert.equal((await store.workflow.get(r.reference)).status, "confirmed");
});

test("karta iade: aynı anda iki iade isteği gelse de bankaya tek iade gider", async (t) => {
  const { r, payment, refund, sent, netPaid, nextDay } = await paidByCard(t, {
    bank: () => new Promise((done) => setTimeout(() => done(null), 150)),
  });
  await nextDay();
  const results = await Promise.all([refund(payment.id, r.deposit), refund(payment.id, r.deposit)]);
  assert.deepEqual(results.map((x) => x.status).sort(), [200, 409]);
  assert.equal(sent.length, 1);
  assert.equal(await netPaid(), 0);
});

test("karta iade: banka reddederse iade kaydı yazılmaz, yeniden denenebilir", async (t) => {
  const { r, payment, refund, cardPayments, netPaid, store } = await paidByCard(t, {
    bank: (_xml, n) => (n === 1 ? bankXml("0057", "İşleme izin verilmiyor") : null),
  });
  const declined = await refund(payment.id, r.deposit);
  assert.equal(declined.status, 402);
  assert.match(declined.json.message, /İşleme izin verilmiyor/);
  assert.equal(await netPaid(), r.deposit);
  const failed = (await cardPayments()).json.payments[0];
  assert.equal(failed.refundable, r.deposit, "kilit açıldı");
  assert.equal(failed.refunds[0].status, "failed");
  assert.equal(failed.refunds[0].resultCode, "0057");
  assert.equal((await store.workflow.get(r.reference)).ledger.filter((l) => l.kind === "refund").length, 0);
  assert.equal((await refund(payment.id, r.deposit)).status, 200);
  assert.equal(await netPaid(), 0);
});

test("karta iade: bankadan yanıt alınamazsa askıya alınır, acenteye bildirilir ve sonuçlandırılır", async (t) => {
  const { r, payment, refund, resolve, cardPayments, netPaid, store, ops, sent } = await paidByCard(t, {
    bank: (_xml, n) => (n <= 2 ? Promise.reject(new Error("timeout")) : null),
  });
  const lost = await refund(payment.id, r.deposit);
  assert.equal(lost.status, 202);
  assert.equal(lost.json.status, "unknown");
  assert.equal(await netPaid(), r.deposit, "iade kaydı yazılmaz");
  const outbox = await store.db.find("notification_outbox");
  assert.ok(outbox.some((n) => /Kart iadesi doğrulanamadı/.test(n.subject || "")));
  let view = (await cardPayments()).json;
  assert.equal(view.blocked, true);
  assert.equal(view.payments[0].refundable, 0);
  assert.equal(view.payments[0].refunds[0].resolvable, true);
  // Askıdaki iade sonuçlanmadan yeni iade bankaya gitmez.
  assert.equal((await refund(payment.id, r.deposit)).status, 409);
  assert.equal(sent.length, 1);
  // Operasyon rolü sonuçlandıramaz; sahip "gerçekleşmedi" der, kilit açılır.
  assert.equal((await resolve(lost.json.refund.id, "failed", ops)).status, 403);
  const dropped = await resolve(lost.json.refund.id, "failed");
  assert.equal(dropped.status, 200);
  assert.equal((await resolve(lost.json.refund.id, "succeeded")).status, 409, "ikinci kez sonuçlandırılamaz");
  view = (await cardPayments()).json;
  assert.equal(view.blocked, false);
  assert.equal(view.payments[0].refundable, r.deposit);
  // İkinci deneme de yanıtsız kalır; banka panelinde iade görünür: "gerçekleşti".
  const lost2 = await refund(payment.id, r.deposit);
  assert.equal(lost2.json.status, "unknown");
  const done = await resolve(lost2.json.refund.id, "succeeded");
  assert.equal(done.status, 200, JSON.stringify(done.json));
  assert.equal(await netPaid(), 0);
  assert.equal((await refund(payment.id, r.deposit)).status, 409);
});

test("karta iade: banka onaylayıp kayıt yazılamazsa iade kaybolmaz", async (t) => {
  const { r, payment, refund, resolve, netPaid, store } = await paidByCard(t);
  const original = store.workflow.payment;
  store.workflow.payment = async () => {
    throw new Error("db down");
  };
  const res = await refund(payment.id, r.deposit);
  store.workflow.payment = original;
  assert.equal(res.status, 202);
  assert.equal(res.json.status, "not_recorded");
  assert.ok((await store.db.find("notification_outbox")).some((n) => /Kart iadesi kaydedilemedi/.test(n.subject || "")));
  assert.equal((await resolve(res.json.refund.id, "failed")).status, 409, "banka onayladı; gerçekleşmedi denemez");
  assert.equal((await resolve(res.json.refund.id, "succeeded")).status, 200);
  assert.equal(await netPaid(), 0);
});

test("karta iade yalnız sahip rolündedir; operasyon durumu görür, rehber göremez", async (t) => {
  const { r, payment, refund, cardPayments, call, ops, owner, sent } = await paidByCard(t);
  const seen = await cardPayments(ops);
  assert.equal(seen.status, 200);
  assert.equal(seen.json.canRefund, false);
  assert.equal((await cardPayments(owner)).json.canRefund, true);
  assert.equal((await refund(payment.id, r.deposit, ops)).status, 403);
  assert.equal(sent.length, 0);
  await call("/admin/users", {
    body: { email: "rehber@rotakars.test", name: "Rehber", password: "rehber-parolasi-2026", role: "guide" },
    cookie: owner,
  });
  const guide = (
    await call("/admin/login", { body: { email: "rehber@rotakars.test", password: "rehber-parolasi-2026" } })
  ).cookie;
  assert.equal((await cardPayments(guide)).status, 403);
  assert.equal((await refund(payment.id, r.deposit, guide)).status, 403);
  // Onay kutusu olmadan istek kabul edilmez.
  const noConfirm = await call(`/admin/reservations/${r.reference}/card-refunds`, {
    body: { paymentId: payment.id, amount: r.deposit },
    cookie: owner,
  });
  assert.equal(noConfirm.status, 400);
  assert.equal(sent.length, 0);
});
