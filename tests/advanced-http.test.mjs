import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { openStore } from "../server/store.mjs";
import { createApp } from "../server/app.mjs";
async function fixture(t) {
  const store = await openStore(":memory:"),
    password = randomBytes(32).toString("hex");
  const server = createApp(store, { env: { ADMIN_PASSWORD: password } }).listen(
    0,
    "127.0.0.1",
  );
  await once(server, "listening");
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await store.db.close();
  });
  const base = "http://127.0.0.1:" + server.address().port;
  let cookie = "";
  const req = (path, body, auth = true) =>
    fetch(base + "/api" + path, {
      ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
      headers: {
        "Content-Type": "application/json",
        "X-Rota-Client": "web",
        ...(auth ? { Cookie: cookie } : {}),
      },
    });
  return {
    store,
    req,
    async login() {
      const r = await req("/admin/login", { password });
      cookie = r.headers.get("set-cookie").split(";")[0];
      return cookie;
    },
  };
}
test("new administrative routes require admin; confirmed QR protects PII and CSV requires authorization", async (t) => {
  const { store: s, req, login } = await fixture(t),
    d = (await s.listDepartures("ani-cildir"))[0];
  for (const path of [
    "/admin/departures",
    "/admin/reservations",
    "/admin/notifications",
    "/admin/reports?date=" + d.date,
    "/admin/departures/" + d.id + "/passengers.csv",
  ])
    assert.equal((await req(path)).status, 401);
  await login();
  assert.equal((await req("/admin/departures")).status, 200);
  assert.equal((await req("/admin/campaigns", { active: true })).status, 400);
  const h = await s.hold(d.id, [1]),
    r = await s.reserve({
      holdToken: h.token,
      name: "Test Yolcu",
      email: "guest@example.com",
      phone: "05550000000",
      passengers: ["Test Yolcu"],
      paymentMode: "deposit",
    });
  assert.equal(
    (
      await req("/admin/reservations/" + r.reference + "/payments", {
        amount: r.total,
        method: "bank_transfer",
        externalReference: "HTTP-TEST",
      })
    ).status,
    400,
  );
  const paid = await req("/admin/reservations/" + r.reference + "/payments", {
    amount: r.total,
    method: "bank_transfer",
    externalReference: "HTTP-TEST",
    recordedExternally: true,
  });
  assert.equal(paid.status, 200);
  const confirmed = await (
    await req("/admin/reservations/" + r.reference + "/confirm", {})
  ).json();
  assert.match(confirmed.qrDataUrl, /^data:image\/png;base64,/);
  assert.equal(confirmed.net_paid, r.total);
  const updated = await req("/admin/departures", {
    id: d.id,
    tourId: d.tour_id,
    date: d.date,
    startTime: d.start_time,
    price: d.price,
    pickup: "Yeni buluşma noktası",
    guideName: "Yeni Rehber",
    guidePhone: "",
    vehicleModel: d.vehicle.modelId,
    passengerSeats: d.vehicle.passengerSeats,
    active: true,
  });
  assert.equal(updated.status, 200);
  assert.equal(
    (await s.notifications.list()).items.filter(
      (n) => n.kind === "pickup_updated",
    ).length,
    1,
  );

  const ticket = await (
    await req("/tickets/" + r.ticket_token, undefined, false)
  ).json();
  assert.equal(ticket.valid, true);
  assert.ok(!JSON.stringify(ticket).includes(r.email));
  assert.equal(
    (await req("/admin/tickets/" + r.ticket_token + "/check-in", {}, false))
      .status,
    401,
  );
  // Okutma ekranı: yolcu adı, irtibat ve ödeme yalnız yönetici oturumunda.
  assert.equal(
    (await req("/admin/tickets/" + r.ticket_token, undefined, false)).status,
    401,
  );
  const detail = await (await req("/admin/tickets/" + r.ticket_token)).json();
  assert.equal(detail.reference, r.reference);
  assert.deepEqual(
    detail.passengers.map((p) => [p.seat, p.name]),
    [[1, "Test Yolcu"]],
  );
  assert.equal(detail.contactName, "Test Yolcu");
  assert.equal(detail.phone, "05550000000");
  assert.equal(detail.balanceDue, 0);
  assert.equal(detail.paymentState, "paid");
  assert.equal(
    (await req("/admin/departures/" + d.id + "/passengers.csv")).status,
    200,
  );
  await req("/admin/logout", {});
  assert.equal((await req("/admin/session")).status, 401);
});
test("email/reset endpoints return generic requests, tokens do not leak and profile requires member session", async (t) => {
  const { store: s, req } = await fixture(t);
  assert.equal(
    (await req("/member/profile", { name: "A Person", phone: "" })).status,
    401,
  );
  const r = await req("/auth/register", {
    name: "Test Yolcu",
    email: "new@example.com",
    password: "test-password-123",
    consent: true,
  });
  assert.equal(r.status, 201);
  const body = await r.json();
  assert.equal(body.member.emailVerified, false);
  assert.ok(!JSON.stringify(body).includes("?token="));
  assert.equal((await s.notifications.list()).items.length, 1);
  const a = await (
      await req("/auth/forgot-password", { email: "new@example.com" })
    ).json(),
    b = await (
      await req("/auth/forgot-password", { email: "unknown@example.com" })
    ).json();
  assert.deepEqual(a, b);
  assert.equal((await req("/auth/verify", { token: "bad" })).status, 400);
});

test("panel booking accepts a missing passenger id but rejects a half-filled one", async (t) => {
  const { store: s, req, login } = await fixture(t),
    d = (await s.listDepartures("ani-cildir"))[0];
  await login();
  const body = (passengerDetails) => ({
    departureId: d.id,
    seats: [1, 2],
    name: "Telefon Müşteri",
    phone: "05551112233",
    passengers: ["Ayşe Yılmaz", "Ali Yılmaz"],
    paymentMode: "on_tour",
    passengerDetails,
  });
  const half = await req(
    "/admin/reservations",
    body([{ nationality: "TR", idNumber: "", gender: "K" }, null]),
  );
  assert.equal(half.status, 400);
  const badTc = await req(
    "/admin/reservations",
    body([{ nationality: "TR", idNumber: "12345678901", gender: "K" }, null]),
  );
  assert.equal(badTc.status, 400);
  // Şemayı geçer; kurulum parolasıyla girişte rezervasyon eklenemez (403).
  const ok = await req(
    "/admin/reservations",
    body([{ nationality: "TR", idNumber: "10000000146", gender: "K" }, null]),
  );
  assert.equal(ok.status, 403);
});

test("manual payment receipt field is free text: short, empty or repeated notes are all accepted", async (t) => {
  const { store: s, req, login } = await fixture(t),
    d = (await s.listDepartures("ani-cildir"))[0];
  await login();
  const book = async (seat) => {
    const h = await s.hold(d.id, [seat]);
    return s.reserve({ holdToken: h.token, name: "Not Yolcu", email: "not@example.com", phone: "05550000000", passengers: ["Not Yolcu"], paymentMode: "deposit" });
  };
  const a = await book(2),
    b = await book(3);
  const pay = (r, externalReference, amount = 1000) =>
    req("/admin/reservations/" + r.reference + "/payments", { amount, method: "cash", externalReference, recordedExternally: true });
  // Kısa metin, boş alan ve aynı not iki kez aynı kayıtta ve başka kayıtta.
  for (const [r, note] of [[a, "x"], [a, ""], [a, "elden alındı"], [a, "elden alındı"], [b, "elden alındı"]])
    assert.equal((await pay(r, note)).status, 200, `not kabul edilmeli: "${note}"`);
  const ledger = (await s.workflow.get(a.reference)).ledger;
  assert.equal(ledger.length, 4, "aynı not ve tutarla ikinci tahsilat da yazılır");
  assert.deepEqual(ledger.map((p) => p.note).sort(), ["", "elden alındı", "elden alındı", "x"]);
  assert.equal((await s.workflow.get(b.reference)).net_paid, 1000);
  // Uzun not sınırı korunur.
  assert.equal((await pay(a, "y".repeat(201))).status, 400);
  // İade de serbest notla kaydedilir.
  const refund = await req("/admin/reservations/" + a.reference + "/refunds", { amount: 500, method: "cash", externalReference: "", recordedExternally: true });
  assert.equal(refund.status, 200);
});

test("finance endpoint: auth, range validation, shape", async (t) => {
  const { req, login } = await fixture(t);
  assert.equal((await req("/admin/finance?from=2026-11-01&to=2026-11-30")).status, 401);
  await login();
  const reversed = await req("/admin/finance?from=2026-11-10&to=2026-11-01");
  assert.equal(reversed.status, 400);
  assert.match((await reversed.json()).message, /Başlangıç/);
  assert.equal((await req("/admin/finance?from=2026-01-01&to=2027-01-03")).status, 400);
  assert.equal((await req("/admin/finance?from=bozuk&to=2026-11-30")).status, 400);
  const ok = await req("/admin/finance?from=2026-11-01&to=2026-11-30&bucket=week");
  assert.equal(ok.status, 200);
  const body = await ok.json();
  for (const key of ["summary", "series", "expected", "byTour", "methods", "pipeline", "overdue", "day"]) assert.ok(key in body, key);
  assert.equal(body.day, null);
  assert.equal(body.series[0].key, "2026-10-26");
});

test("manual payment retried with the same form id is recorded once; refund too", async (t) => {
  const { store: s, req, login } = await fixture(t),
    d = (await s.listDepartures("ani-cildir"))[0];
  await login();
  const h = await s.hold(d.id, [4]);
  const r = await s.reserve({ holdToken: h.token, name: "Tekrar Yolcu", email: "tekrar@example.com", phone: "05550000000", passengers: ["Tekrar Yolcu"], paymentMode: "deposit" });
  const requestId = "0b6f6d1e-3c1a-4f5e-9d2b-7a8c9e0f1a2b";
  const pay = () => req("/admin/reservations/" + r.reference + "/payments", { amount: 1500, method: "cash", externalReference: "elden", recordedExternally: true, requestId });
  assert.equal((await pay()).status, 200);
  assert.equal((await pay()).status, 200, "tekrar deneme hata vermez");
  assert.equal((await s.workflow.get(r.reference)).ledger.length, 1, "bağlantı kopup yeniden gönderilen tahsilat bir kez yazılır");
  const refund = () => req("/admin/reservations/" + r.reference + "/refunds", { amount: 500, method: "cash", externalReference: "", recordedExternally: true, requestId: "1c7e7e2f-4d2b-4a6f-8e3c-8b9d0f1a2b3c" });
  assert.equal((await refund()).status, 200);
  assert.equal((await refund()).status, 200);
  assert.equal((await s.workflow.get(r.reference)).net_paid, 1000);
});

test("finance endpoint: readable date messages and a one-year (366 day) limit", async (t) => {
  const { req, login } = await fixture(t);
  await login();
  for (const q of ["from=bozuk&to=2026-11-30", "to=2026-11-30"]) {
    const r = await req("/admin/finance?" + q);
    assert.equal(r.status, 400);
    assert.match((await r.json()).message, /tarih/i, q);
  }
  assert.equal((await req("/admin/finance?from=2026-01-01&to=2027-01-01")).status, 200, "366 gün (iki uç dahil)");
  assert.equal((await req("/admin/finance?from=2026-01-01&to=2027-01-02")).status, 400, "367 gün");
});

test("manual payment accepts the note under its own name; externalReference stays as a legacy alias", async (t) => {
  const { store: s, req, login } = await fixture(t),
    d = (await s.listDepartures("ani-cildir"))[0];
  await login();
  const h = await s.hold(d.id, [6]);
  const r = await s.reserve({ holdToken: h.token, name: "Not Adı", email: "notadi@example.com", phone: "05550000000", passengers: ["Not Adı"], paymentMode: "deposit" });
  const post = (body) => req("/admin/reservations/" + r.reference + "/payments", { amount: 1000, method: "cash", recordedExternally: true, ...body });
  assert.equal((await post({ note: "yeni ad" })).status, 200);
  assert.equal((await post({ externalReference: "eski ad" })).status, 200);
  assert.deepEqual((await s.workflow.get(r.reference)).ledger.map((p) => p.note).sort(), ["eski ad", "yeni ad"]);
});

test("admin panel traffic has its own rate limit bucket; public API limit is untouched", async (t) => {
  const store = await openStore(":memory:"),
    password = randomBytes(32).toString("hex");
  const server = createApp(store, { env: { ADMIN_PASSWORD: password, ADMIN_LIMIT_PER_15MIN: "400" } }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await store.db.close();
  });
  const base = "http://127.0.0.1:" + server.address().port;
  const login = await fetch(base + "/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json", "X-Rota-Client": "web" }, body: JSON.stringify({ password }) });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const get = (path) => fetch(base + "/api" + path, { headers: { Cookie: cookie } });
  // Sefer düzenlerken art arda yüklemeler: genel 300 sınırı panel işini kesmemeli.
  const statuses = [];
  for (let i = 0; i < 320; i++) statuses.push((await get("/admin/session")).status);
  assert.ok(statuses.every((s) => s === 200), "panel 300 istekten sonra da çalışır: " + statuses.filter((s) => s !== 200).length + " red");
  assert.equal((await get("/catalog")).status, 200, "panel trafiği sitenin genel sınırından yemez");
  // Panelin kendi sınırı da var; dolunca ne zaman açılacağı söylenir.
  let blocked;
  for (let i = 0; i < 100 && !blocked; i++) {
    const r = await get("/admin/session");
    if (r.status === 429) blocked = r;
  }
  assert.ok(blocked, "panel sınırı da işler");
  assert.ok(Number(blocked.headers.get("retry-after")) > 0, "Retry-After başlığı");
});

test("integrations endpoint reports the real payment and e-mail setup", async (t) => {
  const run = async (extra) => {
    const password = randomBytes(32).toString("hex"),
      env = { ADMIN_PASSWORD: password, ...extra },
      store = await openStore(":memory:", { env });
    const server = createApp(store, { env }).listen(0, "127.0.0.1");
    await once(server, "listening");
    t.after(async () => {
      await new Promise((r) => server.close(r));
      await store.db.close();
    });
    const base = "http://127.0.0.1:" + server.address().port;
    const h = { "Content-Type": "application/json", "X-Rota-Client": "web" };
    assert.equal((await fetch(base + "/api/admin/integrations")).status, 401);
    const login = await fetch(base + "/api/admin/login", { method: "POST", headers: h, body: JSON.stringify({ password }) });
    return (await fetch(base + "/api/admin/integrations", { headers: { Cookie: login.headers.get("set-cookie").split(";")[0] } })).json();
  };
  const off = await run({});
  assert.deepEqual(off.payment, { enabled: false, provider: null, test: false, simulator: false });
  assert.equal(off.email.delivery, null);
  const on = await run({ PAYMENT_PROVIDER: "test", MAIL_FROM: "Rota <info@ornek.test>", PUBLIC_BASE_URL: "https://ornek.test", RESEND_API_KEY: "re_test" });
  assert.equal(on.payment.enabled, true);
  assert.equal(on.payment.provider, "test");
  assert.equal(on.payment.test, true);
  assert.equal(on.email.delivery, "resend");
  assert.ok(!JSON.stringify(on).includes("re_test"), "anahtar istemciye gitmez");
});

test("reservation list filters by a tour date range; manual payments record who entered them", async (t) => {
  const { store: s, req, login } = await fixture(t);
  await login();
  const deps = await s.listDepartures("ani-cildir");
  const [d1, d2, d3] = [deps[0], deps[1], deps[2]];
  const book = async (d, seat) => {
    const h = await s.hold(d.id, [seat]);
    return s.reserve({ holdToken: h.token, name: "Aralık " + d.date, email: "aralik@example.com", phone: "05550000000", passengers: ["Aralık"], paymentMode: "deposit" });
  };
  const a = await book(d1, 2),
    b = await book(d2, 2);
  await book(d3, 2);
  const list = await (await req(`/admin/reservations?from=${d1.date}&to=${d2.date}`)).json();
  assert.deepEqual(list.map((r) => r.reference).sort(), [a.reference, b.reference].sort());
  assert.equal((await req(`/admin/reservations?from=${d2.date}&to=${d1.date}`)).status, 400);
  // Elle tahsilat kaydı, kaydeden yöneticiyi taşır.
  await req("/admin/reservations/" + a.reference + "/payments", { amount: 1000, method: "cash", note: "elden", recordedExternally: true });
  const row = (await s.workflow.get(a.reference)).ledger[0];
  assert.ok(row.recorded_by?.name, "kaydeden adı yazılır: " + JSON.stringify(row.recorded_by));
});
