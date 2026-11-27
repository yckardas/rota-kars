// Turdan bağımsız online transfer: sunucuda fiyat, tarih kuralları, ödeme sonrası onay,
// bilet, panel listesi, iptal ve iade (tur rezervasyonlarıyla aynı akış).
import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app.mjs";
import { openStore } from "../server/store.mjs";
import {
  transferLegs,
  defaultTransferService,
  transferTitle,
} from "../server/transfer-booking.mjs";
import { cancellationQuote, serviceFor } from "../server/legal.mjs";

const HOUR = 3600000;
// 2026-11-27 12:00 İstanbul (UTC+3).
const START = Date.UTC(2026, 10, 27, 9);
const ymd = (ms) => new Date(ms + 3 * HOUR).toISOString().slice(0, 10);
const hm = (ms) => new Date(ms + 3 * HOUR).toISOString().slice(11, 16);
const legAt = (ms, flight = "TK2734") => ({
  date: ymd(ms),
  time: hm(ms),
  flight,
});
const consents = {
  preInfo: true,
  contract: true,
  cancellation: true,
  privacy: true,
};

async function fixture(t, extraEnv = {}) {
  let now = START;
  const env = {
    ADMIN_PASSWORD: "ilk-kurulum-parolasi",
    SITE_URL: "https://rotakarsturizm.com",
    PAYMENT_PROVIDER: "test",
    AGENCY_EMAIL: "ekip@example.com",
    ...extraEnv,
  };
  const store = await openStore(":memory:", { clock: () => now, env });
  const app = createApp(store, {
    env,
    reviewsService: {
      get: async () => ({ status: "not_configured", reviews: [] }),
    },
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await store.db.close();
  });
  const root = `http://127.0.0.1:${server.address().port}`;
  let cookie = "";
  const call = async (path, body, method) => {
    const r = await fetch(root + "/api" + path, {
      method: method || (body ? "POST" : "GET"),
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        "Content-Type": "application/json",
        "X-Rota-Client": "web",
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });
    const setCookie = r.headers.get("set-cookie");
    if (setCookie && path === "/admin/login") cookie = setCookie.split(";")[0];
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  // Yönetici oturumu saat ileri alınınca düşebilir; testler gerektiğinde yeniden girer.
  const login = async () =>
    assert.equal(
      (await call("/admin/login", { password: "ilk-kurulum-parolasi" })).status,
      200,
    );
  await login();
  const enable = async (patch = {}) => {
    const s = (await call("/admin/transfer-service")).json;
    const { paymentEnabled, ...settings } = s;
    void paymentEnabled;
    const saved = await call("/admin/transfer-service", {
      ...settings,
      enabled: true,
      ...patch,
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.json));
    return saved.json;
  };
  return {
    store,
    call,
    enable,
    login,
    now: () => now,
    tick: (n) => (now += n),
  };
}

const trip = (now, over = {}) => ({
  point: "airport",
  destination: "kars",
  direction: "arrival",
  arrival: legAt(now + 48 * HOUR),
  pax: 1,
  bags: 2,
  address: "Kars Otel, Faikbey Cad.",
  ...over,
});
const booking = (now, over = {}) => ({
  ...trip(now),
  name: "Ayşe Yılmaz",
  email: "ayse@example.com",
  phone: "05551112233",
  notes: "Bebek koltuğu",
  consents,
  ...over,
});

test("bacak kuralları: geçmiş, yakın saat, uçuş no, sıra ve bir yıl sınırı", () => {
  const now = START,
    opts = { now, minLeadHours: 12 };
  assert.throws(
    () => transferLegs(trip(now, { arrival: legAt(now - HOUR) }), opts),
    /Geçmiş/,
  );
  assert.throws(
    () => transferLegs(trip(now, { arrival: legAt(now + 6 * HOUR) }), opts),
    /en az 12 saat/,
  );
  assert.throws(
    () =>
      transferLegs(trip(now, { arrival: legAt(now + 48 * HOUR, "") }), opts),
    /uçuş numaranızı/,
  );
  // Otogar ve garda sefer bilgisi isteğe bağlıdır.
  assert.equal(
    transferLegs(
      trip(now, { point: "bus", arrival: legAt(now + 48 * HOUR, "") }),
      opts,
    ).length,
    1,
  );
  assert.throws(
    () =>
      transferLegs(trip(now, { arrival: legAt(now + 400 * 24 * HOUR) }), opts),
    /bir yıl/,
  );
  assert.throws(
    () => transferLegs(trip(now, { direction: "departure" }), opts),
    /Dönüş tarihini/,
  );
  assert.throws(
    () =>
      transferLegs(
        trip(now, {
          direction: "both",
          arrival: legAt(now + 72 * HOUR),
          departure: legAt(now + 48 * HOUR),
        }),
        opts,
      ),
    /gelişten sonra/,
  );
  const legs = transferLegs(
    trip(now, {
      direction: "both",
      arrival: legAt(now + 48 * HOUR),
      departure: legAt(now + 96 * HOUR, "PC2011"),
    }),
    opts,
  );
  assert.deepEqual(
    legs.map((l) => [l.type, l.flight]),
    [
      ["arrival", "TK2734"],
      ["departure", "PC2011"],
    ],
  );
  assert.equal(
    transferTitle({ point: "airport", destination: "kars", direction: "both" }),
    "VIP transfer · Kars Harakani Havalimanı ⇄ Kars merkez",
  );
  // Varsayılan ayar: standart fiyatlar, satış kapalı, en az 12 saat önceden.
  const d = defaultTransferService();
  assert.equal(d.enabled, false);
  assert.equal(d.minLeadHours, 12);
  assert.equal(d.oneWay.kars.airport["1"], 40000);
});

test("iptal kuralı: alınıştan 24 saat öncesine kadar tam iade, sonrasında %30 kesinti", () => {
  const tour = serviceFor({
    kind: "transfer",
    transfer_booking: {
      point: "airport",
      destination: "kars",
      direction: "arrival",
    },
  });
  const at = START + 48 * HOUR;
  const base = {
    tour,
    date: ymd(at),
    startTime: hm(at),
    total: 100000,
    netPaid: 100000,
    depositPercent: 30,
  };
  const early = cancellationQuote({ ...base, now: at - 25 * HOUR });
  assert.equal(early.late, false);
  assert.equal(early.customer.refund, 100000);
  const late = cancellationQuote({ ...base, now: at - 23 * HOUR });
  assert.equal(late.late, true);
  assert.equal(late.customer.retained, 30000);
  assert.equal(late.customer.refund, 70000);
  assert.equal(late.agency.refund, 100000, "acentenin iptalinde kesinti yok");
});

test("satış panelden açılana ve online ödeme açık olana kadar kapalıdır", async (t) => {
  const { call, enable, now } = await fixture(t);
  assert.equal((await call("/transfers/config")).json.enabled, false);
  assert.equal((await call("/transfers/quote", trip(now()))).status, 409);
  assert.equal(
    (await call("/transfers/reservations", booking(now()))).status,
    409,
  );
  await enable();
  const config = (await call("/transfers/config")).json;
  assert.equal(config.enabled, true);
  assert.equal(config.minLeadHours, 12);
  assert.equal(config.freeCancelHours, 24);
  assert.equal(config.oneWay.kars.airport["1"], 40000);
  // Satış açık olsa da online ödeme kapalıysa transfer satılmaz.
  const off = await fixture(t, { PAYMENT_PROVIDER: "disabled" });
  await off.enable();
  assert.equal((await off.call("/transfers/config")).json.enabled, false);
  assert.equal(
    (await off.call("/transfers/quote", trip(off.now()))).status,
    409,
  );
});

test("fiyat sunucuda tablodan hesaplanır; istemcinin gönderdiği tutar yok sayılır", async (t) => {
  const { call, enable, now, store } = await fixture(t);
  await enable();
  // Gidiş-dönüş, 3 kişi, Kars merkez: tablo 2–3 kişi kademesi (standart 2 × 1.000 TL).
  const both = {
    direction: "both",
    arrival: legAt(now() + 48 * HOUR),
    departure: legAt(now() + 120 * HOUR, "TK2735"),
    pax: 3,
  };
  const q = await call("/transfers/quote", trip(now(), both));
  assert.equal(q.status, 200, JSON.stringify(q.json));
  assert.equal(q.json.amount, 200000);
  assert.equal(q.json.tierLabel, "2–3 kişi");
  assert.match(q.json.preInfo, /ÖN BİLGİLENDİRME FORMU · TRANSFER HİZMETİ/);
  assert.match(
    q.json.preInfo,
    /Geliş · .* · Kars Harakani Havalimanı → Kars Otel, Faikbey Cad\. · uçuş TK2734/,
  );
  assert.match(q.json.contract, /TRANSFER HİZMET SÖZLEŞMESİ/);
  assert.ok(q.json.cancellation.some((l) => /24 saat öncesine kadar/.test(l)));
  // Sarıkamış 5 kişi tek yön: 4–6 kişi kademesi 5.000 TL.
  assert.equal(
    (
      await call(
        "/transfers/quote",
        trip(now(), { destination: "sarikamis", pax: 5 }),
      )
    ).json.amount,
    500000,
  );
  assert.equal(
    (await call("/transfers/quote", trip(now(), { pax: 16 }))).status,
    400,
  );
  // Tutar, toplam ve kademe alanları istemciden gelse de kayda geçmez.
  const created = await call("/transfers/reservations", {
    ...booking(now(), both),
    amount: 1,
    total: 1,
    deposit: 1,
    transfer: { amount: 1 },
  });
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const r = await store.workflow.get(created.json.reference);
  assert.equal(r.kind, "transfer");
  assert.equal(r.total, 200000);
  assert.equal(r.deposit, 200000, "online transfer tam ödemelidir");
  assert.equal(r.payment_mode, "full");
  assert.equal(r.status, "pending_agency");
  assert.equal(r.pax, 3);
  assert.deepEqual(r.seats, []);
  assert.equal(r.date, both.arrival.date);
  assert.equal(r.start_time, both.arrival.time);
  assert.equal(
    r.tourName,
    "VIP transfer · Kars Harakani Havalimanı ⇄ Kars merkez",
  );
  assert.match(r.pickup, /Kars Harakani Havalimanı · uçuş TK2734/);
  assert.equal(r.transfer_booking.legs.length, 2);
  assert.match(r.pre_info_text, /TRANSFER HİZMETİ/);
  assert.ok(r.booking_consents?.pre_info);
  // Ödenmeyen kayıt en geç 24 saat sonra düşer (alınış daha yakınsa alınışta).
  assert.equal(r.expires_at, now() + 24 * HOUR);
  // Panelde fiyat değişirse yeni kayıt güncel fiyatla yazılır.
  const s = await enable();
  s.oneWay.kars.airport["1"] = 55000;
  await enable({ oneWay: s.oneWay });
  const again = await call(
    "/transfers/reservations",
    booking(now(), { email: "can@example.com" }),
  );
  assert.equal((await store.workflow.get(again.json.reference)).total, 55000);
});

test("geçmiş tarih, çok yakın saat ve eksik onay reddedilir", async (t) => {
  const { call, enable, now } = await fixture(t);
  await enable({ minLeadHours: 6 });
  const past = await call(
    "/transfers/reservations",
    booking(now(), { arrival: legAt(now() - 2 * HOUR) }),
  );
  assert.equal(past.status, 400);
  assert.match(past.json.message, /Geçmiş/);
  const close = await call(
    "/transfers/reservations",
    booking(now(), { arrival: legAt(now() + 3 * HOUR) }),
  );
  assert.equal(close.status, 400);
  assert.match(close.json.message, /en az 6 saat/);
  const badDate = await call(
    "/transfers/reservations",
    booking(now(), {
      arrival: { date: "2026-02-30", time: "10:00", flight: "TK1" },
    }),
  );
  assert.equal(badDate.status, 400);
  const noConsent = await call(
    "/transfers/reservations",
    booking(now(), { consents: { ...consents, contract: false } }),
  );
  assert.equal(noConsent.status, 400);
  const noAddress = await call(
    "/transfers/reservations",
    booking(now(), { address: "" }),
  );
  assert.equal(noAddress.status, 400);
  // Yakın saatli kayıt (6 saat sonra) alınış saatinde düşer.
  const ok = await call(
    "/transfers/reservations",
    booking(now(), { arrival: legAt(now() + 7 * HOUR) }),
  );
  assert.equal(ok.status, 201);
  assert.match(ok.json.pre_info_text, /Son dakika rezervasyonu/);
});

test("ödeme tamamlanınca transfer onaylanır; e-posta, bilet ve panel güncellenir", async (t) => {
  const { call, enable, now, store } = await fixture(t);
  await enable();
  const created = (
    await call("/transfers/reservations", booking(now(), { pax: 2 }))
  ).json;
  assert.equal(created.total, 100000);
  // Mevcut ödeme akışı: referans + e-posta ile başlar, tutarın tamamı istenir.
  const start = await call("/payments/start", {
    reference: created.reference,
    email: "ayse@example.com",
  });
  assert.equal(start.status, 200, JSON.stringify(start.json));
  assert.equal(start.json.amount, 100000);
  const id = start.json.redirectUrl.split("/").pop();
  const session = (await call("/payments/sessions/" + id)).json;
  assert.equal(session.summary.kind, "transfer");
  assert.equal(session.summary.count, 2);
  assert.equal(session.summary.paymentMode, "full");
  assert.match(session.summary.tourName, /VIP transfer/);
  assert.match(session.documents.contract, /TRANSFER HİZMET SÖZLEŞMESİ/);
  assert.ok(session.documents.cancellation.some((l) => /24 saat/.test(l)));
  // Kapora seçilemez.
  assert.equal(
    (await call("/payments/mode/" + id, { mode: "deposit" })).status,
    409,
  );
  assert.equal(
    (await call("/payments/consent/" + id, { terms: true })).status,
    200,
  );
  const done = await call(`/payments/test/${id}/result`, { result: "paid" });
  assert.equal(done.json.status, "paid");
  const r = await store.workflow.get(created.reference);
  assert.equal(r.status, "confirmed");
  assert.equal(r.net_paid, 100000);
  assert.equal(r.balance_due, 0);
  assert.equal(r.payment_state, "paid");
  assert.match(r.contract_text, /TRANSFER HİZMET SÖZLEŞMESİ/);
  assert.match(r.contract_text, /online ödeme ile otomatik onay/);
  // Müşteriye iki dilli onay e-postası (bilet kartı, sözleşme ve ön bilgi PDF).
  const mail = await store.db.one("notification_outbox", {
    _id: "reservation_confirmed:" + r.reference,
  });
  assert.equal(mail.recipient, "ayse@example.com");
  assert.equal(mail.ticket.kind, "transfer");
  assert.match(mail.ticket.transfer, /Geliş · .* uçuş TK2734/);
  assert.ok(
    mail.ticket.english.some((l) =>
      /Payment received, your transfer is confirmed/.test(l),
    ),
  );
  assert.deepEqual(
    mail.documents.map((d) => d.title),
    ["Transfer Hizmet Sözleşmesi", "Ön Bilgilendirme Formu"],
  );
  // Ödeme öncesi müşteriye "ön rezervasyon" e-postası gitmez; ekip ödemeyle haberdar edilir.
  assert.equal(
    await store.db.one("notification_outbox", {
      _id: "reservation_created:" + r.reference,
    }),
    null,
  );
  const agency = await store.db.one("notification_outbox", {
    _id: "agency:ekip@example.com:transfer_confirmed:" + r.reference,
  });
  assert.match(agency.subject, /Yeni transfer \(ödendi\)/);
  assert.match(agency.body, /Adres: Kars Otel/);
  assert.match(agency.body, /Not: Bebek koltuğu/);
  // Rezervasyonum ve QR bilet.
  const lookup = await call("/reservations/lookup", {
    reference: r.reference,
    email: "ayse@example.com",
  });
  assert.equal(lookup.json.kind, "transfer");
  assert.equal(lookup.json.transfer_booking.address, "Kars Otel, Faikbey Cad.");
  assert.ok(lookup.json.qrDataUrl.startsWith("data:image/png"));
  const ticket = (await call("/tickets/" + r.ticket_token)).json;
  assert.equal(ticket.kind, "transfer");
  assert.equal(ticket.valid, true);
  assert.equal(ticket.pax, 2);
  assert.match(ticket.transferLines[0], /Geliş/);
  // Panel: Transfer filtresi ve tarih aralığı transfer kaydını bulur.
  const list = (await call("/admin/reservations?flag=transfer")).json;
  assert.deepEqual(
    list.map((x) => x.reference),
    [r.reference],
  );
  const byDate = (await call(`/admin/reservations?from=${r.date}&to=${r.date}`))
    .json;
  assert.ok(byDate.some((x) => x.reference === r.reference));
  // Yolcu çıkarma ve sefer taşıma transferde yoktur.
  assert.equal(
    (await call(`/admin/reservations/${r.reference}/removal-quote?seats=1`))
      .status,
    409,
  );
  // Hatırlatma: alınıştan 24 saat önce.
  await store.workflow.reminders();
  assert.equal(
    await store.db.one("notification_outbox", { kind: "departure_reminder" }),
    null,
  );
});

test("iptal talebi ve panelden iade: tur akışıyla aynı kurallar", async (t) => {
  const { call, enable, login, now, tick, store } = await fixture(t);
  await enable();
  const created = (await call("/transfers/reservations", booking(now()))).json;
  const id = (
    await call("/payments/start", {
      reference: created.reference,
      email: "ayse@example.com",
    })
  ).json.redirectUrl
    .split("/")
    .pop();
  await call(`/payments/test/${id}/result`, { result: "paid" });
  // Müşteri Rezervasyonum'dan iptal talep eder (ödenmiş kayıt hemen iptal olmaz).
  const requested = await call("/reservations/cancel", {
    reference: created.reference,
    email: "ayse@example.com",
  });
  assert.equal(requested.status, 200);
  assert.equal(requested.json.status, "confirmed");
  assert.ok(requested.json.cancellation_requested_at);
  // Talep 48 saat önce geldi: kurallara göre tam iade.
  const quote = (
    await call(`/admin/reservations/${created.reference}/cancel-quote`)
  ).json;
  assert.equal(quote.late, false);
  assert.equal(quote.customer.refund, 40000);
  // Panelden iptal ve iade kaydı (karta iade bu ortamda yok; nakit kaydı).
  const cancelled = await call(
    `/admin/reservations/${created.reference}/cancel`,
    {
      refund: { amount: 40000, method: "cash", note: "ofiste" },
    },
  );
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.json));
  assert.equal(cancelled.json.reservation.status, "cancelled");
  assert.equal(cancelled.json.refund.status, "succeeded");
  const r = await store.workflow.get(created.reference);
  assert.equal(r.net_paid, 0);
  assert.equal(r.payment_state, "refunded");
  const mail = await store.db.one("notification_outbox", {
    _id: "reservation_cancelled:" + r.reference,
  });
  assert.match(mail.body, /iadeniz acente tarafından yapıldı/);
  assert.match(mail.body, /— English —/);

  // Geç iptal: alınışa 24 saatten az kala gelen talepte %30 kesinti önerilir.
  const late = (
    await call(
      "/transfers/reservations",
      booking(now(), { email: "can@example.com" }),
    )
  ).json;
  const lateId = (
    await call("/payments/start", {
      reference: late.reference,
      email: "can@example.com",
    })
  ).json.redirectUrl
    .split("/")
    .pop();
  await call(`/payments/test/${lateId}/result`, { result: "paid" });
  tick(30 * HOUR);
  await call("/reservations/cancel", {
    reference: late.reference,
    email: "can@example.com",
  });
  await login();
  const lateQuote = (
    await call(`/admin/reservations/${late.reference}/cancel-quote`)
  ).json;
  assert.equal(lateQuote.late, true);
  assert.equal(lateQuote.customer.retained, 12000);
  assert.equal(lateQuote.customer.refund, 28000);
});

test("ödenmemiş kayıt: müşteri ücretsiz iptal eder, süresi dolunca düşer, e-posta başına sınır", async (t) => {
  const { call, enable, now, tick, store } = await fixture(t);
  await enable();
  const a = (await call("/transfers/reservations", booking(now()))).json;
  const cancelled = await call("/reservations/cancel", {
    reference: a.reference,
    email: "ayse@example.com",
  });
  assert.equal(cancelled.json.status, "cancelled");
  for (let i = 0; i < 3; i++)
    assert.equal(
      (await call("/transfers/reservations", booking(now()))).status,
      201,
    );
  const fourth = await call("/transfers/reservations", booking(now()));
  assert.equal(fourth.status, 409);
  tick(25 * HOUR);
  await store.cleanup({ force: true });
  const rows = await store.db.find("reservations", {
    kind: "transfer",
    email: "ayse@example.com",
  });
  assert.equal(rows.filter((r) => r.status === "expired").length, 3);
  // Süresi dolan kayıt için ödeme başlatılamaz.
  const expired = rows.find((r) => r.status === "expired");
  assert.equal(
    (
      await call("/payments/start", {
        reference: expired.reference,
        email: "ayse@example.com",
      })
    ).status,
    409,
  );
});

test("onaylı transfere her bacak için hatırlatma gider", async (t) => {
  const { call, enable, now, tick, store } = await fixture(t);
  await enable();
  const created = (
    await call(
      "/transfers/reservations",
      booking(now(), {
        direction: "both",
        arrival: legAt(now() + 30 * HOUR),
        departure: legAt(now() + 80 * HOUR, "TK2735"),
      }),
    )
  ).json;
  const id = (
    await call("/payments/start", {
      reference: created.reference,
      email: "ayse@example.com",
    })
  ).json.redirectUrl
    .split("/")
    .pop();
  await call(`/payments/test/${id}/result`, { result: "paid" });
  tick(8 * HOUR);
  await store.workflow.reminders();
  const first = await store.db.find("notification_outbox", {
    kind: "departure_reminder",
  });
  assert.equal(first.length, 1);
  assert.match(first[0].body, /Transferiniz yaklaşıyor/);
  tick(50 * HOUR);
  await store.workflow.reminders();
  assert.equal(
    (await store.db.find("notification_outbox", { kind: "departure_reminder" }))
      .length,
    2,
  );
});

test("VakıfBank simülatörü: transfer kartla ödenir, onaylanır; iptalde tutar karta iade edilir", async (t) => {
  const env = {
    ADMIN_PASSWORD: "ilk-kurulum-parolasi",
    PAYMENT_PROVIDER: "vakifbank",
    VAKIFBANK_ENV: "simulator",
  };
  const store = await openStore(":memory:", { env });
  const server = createApp(store, {
    env,
    reviewsService: {
      get: async () => ({ status: "not_configured", reviews: [] }),
    },
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await store.db.close();
  });
  const origin = "http://127.0.0.1:" + server.address().port;
  let cookie = "";
  const call = async (path, body) => {
    const r = await fetch(origin + "/api" + path, {
      method: body ? "POST" : "GET",
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        "Content-Type": "application/json",
        "X-Rota-Client": "web",
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });
    if (path === "/admin/login")
      cookie = r.headers.get("set-cookie").split(";")[0];
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  const form = (path, fields) =>
    fetch(origin + path, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields),
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
  await call("/admin/login", { password: "ilk-kurulum-parolasi" });
  const s = (await call("/admin/transfer-service")).json;
  assert.equal(
    (await call("/admin/transfer-service", { ...s, enabled: true })).status,
    200,
  );
  const now = Date.now();
  const created = await call("/transfers/reservations", booking(now));
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const start = (
    await call("/payments/start", {
      reference: created.json.reference,
      email: "ayse@example.com",
    })
  ).json;
  assert.match(start.redirectUrl, /^\/odeme\/kart\/[a-f0-9]{48}$/);
  const id = start.redirectUrl.split("/").pop();
  assert.equal(
    (await call("/payments/consent/" + id, { terms: true })).status,
    200,
  );
  const cardRes = await call("/payments/card/" + id, {
    holder: "Ayşe Yılmaz",
    pan: "4111111111111111",
    expiry:
      "12/" + String((new Date().getFullYear() + 3) % 100).padStart(2, "0"),
    cvv: "123",
  });
  assert.equal(cardRes.status, 200, JSON.stringify(cardRes.json));
  const page = await (await fetch(origin + cardRes.json.redirect)).text();
  const acs = await form("/__bank/vakifbank/acs/complete", {
    ...hidden(page),
    decision: "Y",
  });
  const back = await form(
    "/api/payments/vakifbank/return",
    hidden(await acs.text()),
  );
  assert.equal(back.status, 303);
  const paid = await store.workflow.get(created.json.reference);
  assert.equal(paid.status, "confirmed");
  assert.equal(paid.net_paid, 40000);
  assert.equal(paid.ledger[0].method, "online:vakifbank");
  // Panelden iptal: aynı gün tamamı karta iade (bankada Cancel).
  const cancelled = await call(`/admin/reservations/${paid.reference}/cancel`, {
    refund: { amount: 40000, method: "card" },
  });
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.json));
  assert.equal(cancelled.json.refund.status, "succeeded");
  assert.equal(cancelled.json.reservation.status, "cancelled");
  assert.equal((await store.workflow.get(paid.reference)).net_paid, 0);
});
