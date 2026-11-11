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
  const store = await openStore(":memory:", { env });
  const server = createApp(store, { env, ...options }).listen(0, "127.0.0.1");
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
  const card = (sessionId, pan = GOOD_CARD, extra = {}) =>
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
  return { store, api, form, r, start, card, throughBank, origin };
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
