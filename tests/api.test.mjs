import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { createApp } from "../server/app.mjs";
import { openStore } from "../server/store.mjs";
async function fixture(t) {
  const store = openStore(":memory:");
  const password = randomBytes(24).toString("hex");
  const app = createApp(store, {
      env: { ADMIN_PASSWORD: password },
      reviewsService: {
        get: async () => ({ status: "not_configured", reviews: [] }),
      },
    }),
    server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((r) => server.close(r));
    store.db.close();
  });
  const req = (path, body, extra = {}) =>
    fetch(base + "/api" + path, {
      ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
      headers: {
        "Content-Type": "application/json",
        "X-Rota-Client": "web",
        ...extra,
      },
    });
  return { store, req, password };
}
test("HTTP concurrent booking race locks a seat only once", async (t) => {
  const { store, req } = await fixture(t);
  const departureId = store.listDepartures("ani-cildir")[0].id;
  const result = await Promise.all([
    req("/holds", { departureId, seats: [1] }),
    req("/holds", { departureId, seats: [1] }),
  ]);
  assert.deepEqual(result.map((r) => r.status).sort(), [201, 409]);
  const good = result.find((r) => r.status === 201);
  const hold = await good.json();
  const invalid = await req("/reservations", {
    holdToken: hold.token,
    name: "A",
    email: "bad",
    phone: "no",
    passengers: ["A"],
    consent: true,
    paymentMode: "deposit",
  });
  assert.equal(invalid.status, 400);
  const goodReservation = await req("/reservations", {
    holdToken: hold.token,
    name: "Test Kişi",
    email: "test@example.com",
    phone: "05550000000",
    passengers: ["Test Yolcu"],
    consent: true,
    paymentMode: "deposit",
    total: 1,
  });
  assert.equal(goodReservation.status, 201);
  const r = await goodReservation.json();
  assert.equal(r.total, 100000);
  assert.equal(r.deposit, 30000);
  assert.equal((await req("/payment/checkout", {})).status, 503);
});
test("admin sessions gate hotels, errors and cross-origin writes", async (t) => {
  const { req, password } = await fixture(t);
  assert.equal((await req("/admin/dashboard")).status, 401);
  assert.equal((await req("/admin/login", { password: "wrong" })).status, 401);
  const login = await req("/admin/login", { password });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  assert.ok(login.headers.get("set-cookie").includes("HttpOnly"));
  assert.equal(
    (await req("/admin/dashboard", undefined, { Cookie: cookie })).status,
    200,
  );
  const denied = await req(
    "/admin/hotels",
    {},
    { Cookie: cookie, Origin: "https://untrusted.example" },
  );
  assert.equal(denied.status, 403);
  const created = await req(
    "/admin/hotels",
    {
      name: "Test Tesis",
      location: "Kars merkez",
      description: "Sadece otomatik test için bir otel kaydı.",
      amenities: ["Kahvaltı"],
      active: true,
    },
    { Cookie: cookie },
  );
  assert.equal(created.status, 200);
  assert.equal((await (await req("/hotels")).json()).length, 1);
  await req("/admin/logout", {}, { Cookie: cookie });
  assert.equal(
    (await req("/admin/dashboard", undefined, { Cookie: cookie })).status,
    401,
  );
});
test("invalid hotel dates and unknown partner never create confirmed bookings", async (t) => {
  const { req, store } = await fixture(t);
  const input = {
    kind: "hotel",
    name: "Test Kişi",
    email: "hotel@example.com",
    phone: "05550000000",
    checkIn: "2027-02-01",
    checkOut: "2027-01-31",
    guests: 2,
    consent: true,
    notes: "",
  };
  assert.equal((await req("/requests", input)).status, 400);
  assert.equal(
    (await req("/requests", { ...input, checkOut: "2027-02-30" })).status,
    400,
  );
  assert.equal(
    (
      await req("/requests", {
        ...input,
        checkOut: "2027-02-03",
        hotelId: "55f87650-3d18-42ed-86fa-d6c70cbe46bf",
      })
    ).status,
    400,
  );
  const response = await req("/requests", { ...input, checkOut: "2027-02-03" });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).status, "received");
  assert.equal(store.dashboard().requests.length, 1);
});
test("chat answers locally without an API key and offers WhatsApp handoff", async () => {
  const { createChatService } = await import("../server/chat.mjs");
  const chat = createChatService({});
  assert.equal(chat.provider, "local");
  const seats = await chat.reply([
    { role: "user", content: "Araçta kaç koltuk var, rehber nerede oturuyor?" },
  ]);
  assert.match(seats.text, /18\+1/);
  assert.match(seats.text, /17/);
  const batum = await chat.reply([{ role: "user", content: "Batum turu ne kadar?" }]);
  assert.match(batum.text, /2\.500/);
  const unknown = await chat.reply([{ role: "user", content: "Vize işlemleri?" }]);
  assert.equal(unknown.handoff, true);
});
