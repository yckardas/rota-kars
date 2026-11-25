// Tarih bazında talep toplama (2026-11-25 müşteri isteği): acenta talep tarihini sefer
// olarak açar, müşteri ön kayıtta tarih seçer, eşiği dolan tarih tek başına satışa açılır.
import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app.mjs";
import { openStore } from "../server/store.mjs";

const AGENT = { id: "ops-1", role: "operations", name: "Operasyon" };
const DATE = "2026-10-24";
async function fixture(t) {
  let now = Date.parse("2026-10-17T06:00:00Z");
  const env = { AGENCY_EMAIL: "ekip@rotakars.test", PUBLIC_BASE_URL: "https://rotakarsturizm.com" };
  const store = await openStore(":memory:", { clock: () => now, env, seed: false });
  const app = createApp(store, {
    env: { ...env, ADMIN_PASSWORD: "ilk-kurulum-parolasi" },
    reviewsService: { get: async () => ({ status: "not_configured", reviews: [] }) },
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await store.db.close();
  });
  const root = `http://127.0.0.1:${server.address().port}`;
  let cookie = "";
  const call = async (path, body) => {
    const r = await fetch(root + "/api" + path, {
      method: body ? "POST" : "GET",
      body: body ? JSON.stringify(body) : undefined,
      headers: { "Content-Type": "application/json", "X-Rota-Client": "web", ...(cookie ? { Cookie: cookie } : {}) },
    });
    if (path === "/admin/login") cookie = r.headers.get("set-cookie").split(";")[0];
    const type = r.headers.get("content-type") || "";
    return { status: r.status, json: type.includes("json") ? await r.json() : null };
  };
  await call("/admin/login", { password: "ilk-kurulum-parolasi" });
  const departure = (tourId, extra = {}) =>
    store.departures.save({
      tourId,
      date: DATE,
      startTime: "05:00",
      pickup: "Kars",
      guideName: "",
      guidePhone: "",
      price: null,
      vehicleModel: "vip-midibus",
      passengerSeats: 18,
      active: true,
      ...extra,
    });
  const outbox = () => store.db.find("notification_outbox", {}, { sort: { created_at: 1 } });
  const book = (departureId) =>
    store.adminReserve(
      { departureId, seats: [1], name: "Telefon Müşteri", phone: "05551112233", passengers: ["Yolcu 1"], paymentMode: "on_tour" },
      AGENT,
    );
  return { store, call, departure, outbox, book, advance: (ms) => (now += ms) };
}
const person = (extra = {}) => ({
  name: "Ön Kayıt Misafir",
  email: "onkayit@example.com",
  phone: "05551112233",
  count: 2,
  consent: true,
  ...extra,
});

test("a departure on a demand tour is a demand date; salesMode overrides the tour mode", async (t) => {
  const { store, departure } = await fixture(t);
  const d = await departure("guneydogu", { price: 250000 });
  assert.equal(d.mode, "demand");
  assert.equal(d.demand, true);
  assert.equal(d.salesOpen, false);
  const online = await departure("guneydogu", { id: d.id, price: 250000, salesMode: "online" });
  assert.equal(online.mode, "online");
  assert.equal(online.demand, false);
  assert.equal(online.salesOpen, true);
  const a = await departure("ani-cildir", { salesMode: "demand" });
  assert.equal(a.demand, true);
  assert.equal(a.salesOpen, false);
  await assert.rejects(store.hold(a.id, [1]), (e) => e.status === 409);
  // salesMode gönderilmeyen kayıt eski değeri korur.
  const kept = await departure("ani-cildir", { id: a.id });
  assert.equal(kept.sales_mode, "demand");
  // null: turun moduna geri döner.
  const back = await departure("ani-cildir", { id: a.id, salesMode: null });
  assert.equal(back.sales_mode, null);
  assert.equal(back.mode, "online");
});

test("sales mode is shared across the vehicles of a date", async (t) => {
  const { store, departure } = await fixture(t);
  const d = await departure("guneydogu", { price: 250000 });
  const v2 = await store.departures.addVehicle(d.id);
  assert.equal(v2.demand, true);
  await departure("guneydogu", { id: d.id, price: 250000, salesMode: "online" });
  const after = await store.departures.get(v2.id, { allowClosed: true });
  assert.equal(after.sales_mode, "online");
  assert.equal(after.salesOpen, true);
  const v3 = await store.departures.addVehicle(d.id);
  assert.equal(v3.sales_mode, "online", "yeni araç grubun modunu alır");
});

test("a date with bookings cannot become a demand date", async (t) => {
  const { departure, book } = await fixture(t);
  const a = await departure("ani-cildir");
  await book(a.id);
  await assert.rejects(
    departure("ani-cildir", { id: a.id, salesMode: "demand" }),
    (e) => e.status === 409 && /rezervasyon var/.test(e.message),
  );
});

test("a demand date with pre-registrations cannot be deleted; a date change carries them over", async (t) => {
  const { store, departure } = await fixture(t);
  const d = await departure("guneydogu", { price: 250000 });
  await store.db.insert("interest_list", "k1", {
    id: "k1",
    kind: "prereg",
    tour_id: "guneydogu",
    departure_id: d.id,
    departure_date: DATE,
    email: "a@example.com",
    count: 2,
    status: "waiting",
    token: "a".repeat(36),
    created_at: Date.now(),
  });
  await assert.rejects(store.departures.remove(d.id), (e) => e.status === 409 && /ön kayıt var/.test(e.message));
  await departure("guneydogu", { id: d.id, price: 250000, date: "2026-10-31" });
  assert.equal((await store.db.one("interest_list", { _id: "k1" })).departure_date, "2026-10-31");
});
