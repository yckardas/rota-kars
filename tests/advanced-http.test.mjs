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
