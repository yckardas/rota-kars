// Acentenin ödeme bağlantısı ile bilet (QR) belirteci ayrıdır: bileti gören biri ödeme
// ekranındaki kişisel verilere (ön bilgilendirme metni) ulaşamaz.
import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app.mjs";
import { openStore } from "../server/store.mjs";

async function fixture(t) {
  let now = Date.parse("2026-10-17T06:00:00Z");
  const env = {
    PAYMENT_PROVIDER: "test",
    PUBLIC_BASE_URL: "https://rotakarsturizm.com",
    AGENCY_EMAIL: "ekip@rotakars.test",
  };
  const store = await openStore(":memory:", {
    clock: () => now,
    env,
    seed: false,
  });
  const app = createApp(store, {
    env: { ...env, ADMIN_PASSWORD: "ilk-kurulum-parolasi" },
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
  const root = `http://127.0.0.1:${server.address().port}/api`;
  let cookie = "";
  const call = async (path, body, { admin = false } = {}) => {
    const r = await fetch(root + path, {
      method: body ? "POST" : "GET",
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        "Content-Type": "application/json",
        "X-Rota-Client": "web",
        ...(admin && cookie ? { Cookie: cookie } : {}),
      },
    });
    if (path === "/admin/login")
      cookie = r.headers.get("set-cookie").split(";")[0];
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  await call("/admin/login", { password: "ilk-kurulum-parolasi" });
  const d = await store.departures.save({
    tourId: "ani-cildir",
    date: "2026-10-24",
    startTime: "09:00",
    pickup: "Kars Garı",
    guideName: "",
    guidePhone: "",
    price: 200000,
    vehicleModel: "vip-midibus",
    passengerSeats: 18,
    active: true,
  });
  const h = await store.hold(d.id, [2]);
  const r = await store.reserve({
    holdToken: h.token,
    name: "Ayşe Yılmaz",
    email: "ayse@example.com",
    phone: "05551112233",
    passengers: ["Ayşe Yılmaz"],
    paymentMode: "deposit",
  });
  const creds = { reference: r.reference, email: "ayse@example.com" };
  const startPayment = async () => {
    const s = await call("/payments/start", creds);
    return { ...s, id: s.json?.redirectUrl?.split("/").pop() };
  };
  const pay = async () => {
    const s = await startPayment();
    assert.equal(s.status, 200, JSON.stringify(s.json));
    const done = await call(`/payments/test/${s.id}/result`, {
      result: "paid",
    });
    assert.equal(done.json.status, "paid");
    return s.id;
  };
  return {
    store,
    call,
    r,
    creds,
    startPayment,
    pay,
    advance: (ms) => (now += ms),
  };
}

test("bilet belirteci ödeme ekranını açmaz; kişisel veri yalnız ödeme bağlantısıyla görünür", async (t) => {
  const { store, call, r, pay } = await fixture(t);
  await pay();
  const paid = await store.workflow.get(r.reference);
  assert.ok(paid.balance_due > 0);
  // Bilet sayfası (QR) kişisel veri göstermez.
  const ticket = await call("/tickets/" + paid.ticket_token);
  assert.equal(ticket.status, 200);
  assert.doesNotMatch(
    JSON.stringify(ticket.json),
    /ayse@example\.com|05551112233/,
  );
  // Bilet belirteciyle ödeme bağlantısı: oturum açılmaz, yalnız Rezervasyonum'a yönlenir.
  const viaTicket = await call("/payments/start-ticket", {
    token: paid.ticket_token,
  });
  assert.equal(viaTicket.status, 200);
  assert.deepEqual(viaTicket.json, { lookup: r.reference });
  assert.equal(
    (
      await store.db.find("payment_sessions", { reference: r.reference })
    ).filter((s) => s.status === "pending").length,
    0,
    "bilet belirteci ödeme oturumu açmaz",
  );
  // Panelin ürettiği bağlantı ayrı belirteç taşır ve kalan ödemeyi açar.
  const link = await call(
    `/admin/reservations/${r.reference}/payment-link`,
    {},
    { admin: true },
  );
  assert.equal(link.status, 200, JSON.stringify(link.json));
  const payToken = link.json.url.split("/").pop();
  assert.notEqual(payToken, paid.ticket_token);
  const start = await call("/payments/start-ticket", { token: payToken });
  assert.equal(start.status, 200, JSON.stringify(start.json));
  const session = await call(
    "/payments/sessions/" + start.json.redirectUrl.split("/").pop(),
  );
  assert.match(session.json.documents.preInfo, /ayse@example\.com/);
  // Ödeme belirteci bilet açmaz.
  assert.equal((await call("/tickets/" + payToken)).status, 404);
  // Müşteriye dönen rezervasyonda ödeme belirteci yok.
  const lookup = await call("/reservations/lookup", {
    reference: r.reference,
    email: "ayse@example.com",
  });
  assert.equal(lookup.status, 200);
  assert.equal(lookup.json.pay_token, undefined);
  // Geçersiz biçim ve bilinmeyen belirteç.
  assert.equal(
    (await call("/payments/start-ticket", { token: "x".repeat(32) })).status,
    404,
  );
  assert.equal(
    (await call("/payments/start-ticket", { token: "a".repeat(48) })).status,
    404,
  );
});

test("ödeme bağlantısı kalan tutar ödenince ödeme açmaz", async (t) => {
  const { store, call, r, pay } = await fixture(t);
  await pay();
  const link = await call(
    `/admin/reservations/${r.reference}/payment-link`,
    {},
    { admin: true },
  );
  const payToken = link.json.url.split("/").pop();
  // Kalanı öde: bağlantı artık ödeme açmaz.
  const start = await call("/payments/start-ticket", { token: payToken });
  const id = start.json.redirectUrl.split("/").pop();
  assert.equal(
    (await call(`/payments/test/${id}/result`, { result: "paid" })).json.status,
    "paid",
  );
  assert.equal((await store.workflow.get(r.reference)).balance_due, 0);
  assert.equal(
    (await call("/payments/start-ticket", { token: payToken })).status,
    409,
  );
});

test("ödeme bağlantısı iptal edilen rezervasyonda ödeme açmaz", async (t) => {
  const { store, call, r, pay } = await fixture(t);
  await pay();
  const link = await call(
    `/admin/reservations/${r.reference}/payment-link`,
    {},
    { admin: true },
  );
  const payToken = link.json.url.split("/").pop();
  assert.ok((await store.workflow.get(r.reference)).balance_due > 0);
  await store.workflow.cancel(r.reference);
  assert.equal((await store.workflow.get(r.reference)).status, "cancelled");
  const after = await call("/payments/start-ticket", { token: payToken });
  assert.equal(after.status, 409);
  assert.equal(after.json.redirectUrl, undefined);
});
