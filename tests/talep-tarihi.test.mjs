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
  // Talep tarihi, karar tarihine (hareket − asgari katılımcı bildirim süresi; Güneydoğu
  // 4 günlük olduğundan 7 gün) kadar ön kayda açıktır; saat buna göre iki hafta öncedir.
  let now = Date.parse("2026-10-10T06:00:00Z");
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

const to = (m) => m.recipient || m.email;

test("pre-registration for a demand date binds to the date's first vehicle", async (t) => {
  const { store, call, departure, outbox } = await fixture(t);
  const d = await departure("guneydogu", { price: 250000 });
  const v2 = await store.departures.addVehicle(d.id);
  const r = await call("/interest", { kind: "prereg", tourId: "guneydogu", departureId: v2.id, ...person() });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const row = await store.db.one("interest_list", { email: "onkayit@example.com" });
  assert.equal(row.departure_id, d.id);
  assert.equal(row.departure_date, DATE);
  assert.equal(await store.interest.demandCount("guneydogu", d.id), 2);
  assert.equal(await store.interest.demandCount("guneydogu"), 0, "tarihsiz sayaç ayrı");
  const mails = await outbox();
  assert.match(mails.find((m) => to(m) === "onkayit@example.com").body, /2026-10-24/);
  assert.ok(mails.some((m) => to(m) !== "onkayit@example.com" && /2026-10-24/.test(m.body)), "acenta bildirimi tarihli");
  const a = await departure("ani-cildir");
  const sale = await call("/interest", { kind: "prereg", tourId: "ani-cildir", departureId: a.id, ...person() });
  assert.equal(sale.status, 409);
  assert.match(sale.json.message, /ön kayıt alınmıyor/);
  const other = await call("/interest", { kind: "prereg", tourId: "butik-mardin", departureId: d.id, ...person() });
  assert.equal(other.status, 400, "başka turun seferi");
});

test("an undated pre-registration does not overwrite a dated one from the same e-mail", async (t) => {
  const { store, call, departure } = await fixture(t);
  const d = await departure("guneydogu", { price: 250000 });
  await call("/interest", { kind: "prereg", tourId: "guneydogu", departureId: d.id, ...person() });
  const undated = await call("/interest", { kind: "prereg", tourId: "guneydogu", ...person({ count: 3 }) });
  assert.equal(undated.json.updated, false);
  const rows = await store.db.find("interest_list", { email: "onkayit@example.com" });
  assert.equal(rows.length, 2);
  assert.equal(rows.find((x) => x.departure_id === d.id).count, 2);
  assert.equal(await store.interest.demandCount("guneydogu"), 3);
});

test("opening a date e-mails only that date's waiting guests, once", async (t) => {
  const { store, call, departure, outbox } = await fixture(t);
  const d1 = await departure("guneydogu", { price: 250000 });
  const v2 = await store.departures.addVehicle(d1.id);
  const d2 = await departure("guneydogu", { price: 250000, date: "2026-10-31" });
  await call("/interest", { kind: "prereg", tourId: "guneydogu", departureId: d1.id, ...person({ email: "a@example.com" }) });
  await call("/interest", { kind: "prereg", tourId: "guneydogu", departureId: d2.id, ...person({ email: "b@example.com" }) });
  await call("/interest", { kind: "prereg", tourId: "guneydogu", departureId: d1.id, ...person({ email: "c@example.com" }) });
  const c = await store.db.one("interest_list", { email: "c@example.com" });
  await store.interest.setStatus(c.id, "cancelled");
  const opened = await call(`/admin/departures/${d1.id}/open-sales`, {});
  assert.equal(opened.status, 200, JSON.stringify(opened.json));
  assert.equal(opened.json.notified, 1);
  assert.equal((await store.departures.get(d1.id)).salesOpen, true);
  assert.equal((await store.departures.get(v2.id)).salesOpen, true, "tarihin tüm araçları açılır");
  assert.equal((await store.departures.get(d2.id, { allowClosed: true })).demand, true);
  const sale = (await outbox()).filter((m) => m.kind === "interest_open");
  assert.deepEqual(sale.map(to), ["a@example.com"]);
  assert.match(sale[0].action_url, /\?date=2026-10-24$/);
  assert.match(sale[0].subject, /2026-10-24/);
  await store.interest.notifyDemandDates();
  await store.interest.notifyDemandDates();
  assert.equal((await outbox()).filter((m) => m.kind === "interest_open").length, 1);
  assert.equal((await call(`/admin/departures/${d1.id}/open-sales`, {})).status, 409, "zaten satışta");
  const off = await departure("guneydogu", { price: 250000, date: "2026-11-07", active: false });
  const inactive = await call(`/admin/departures/${off.id}/open-sales`, {});
  assert.equal(inactive.status, 409);
  assert.match(inactive.json.message, /aktif/);
});

test("a date that becomes sellable another way still notifies its guests", async (t) => {
  const { store, call, departure, outbox } = await fixture(t);
  const d = await departure("guneydogu", { price: 250000 });
  await call("/interest", { kind: "prereg", tourId: "guneydogu", departureId: d.id, ...person() });
  assert.equal((await store.interest.notifyDemandDates()).notified, 0);
  await departure("guneydogu", { id: d.id, price: 250000, salesMode: "online" });
  assert.equal((await store.interest.notifyDemandDates()).notified, 1);
  assert.equal((await outbox()).filter((m) => m.kind === "interest_open").length, 1);
});

test("tour-wide open keeps pinned demand dates collecting", async (t) => {
  const { store, call, departure, outbox } = await fixture(t);
  const d1 = await departure("guneydogu", { price: 250000 });
  const d2 = await departure("guneydogu", { price: 250000, date: "2026-10-31", salesMode: "demand" });
  await call("/interest", { kind: "prereg", tourId: "guneydogu", ...person({ email: "u@example.com" }) });
  await call("/interest", { kind: "prereg", tourId: "guneydogu", departureId: d1.id, ...person({ email: "a@example.com" }) });
  await call("/interest", { kind: "prereg", tourId: "guneydogu", departureId: d2.id, ...person({ email: "b@example.com" }) });
  const opened = await call("/admin/operations/guneydogu/open-sales", {});
  assert.equal(opened.status, 200, JSON.stringify(opened.json));
  assert.equal(opened.json.notified, 2);
  const sale = (await outbox()).filter((m) => m.kind === "interest_open");
  assert.deepEqual(sale.map(to).sort(), ["a@example.com", "u@example.com"]);
  assert.equal((await store.departures.get(d2.id, { allowClosed: true })).demand, true);
  assert.equal((await store.db.one("interest_list", { email: "b@example.com" })).status, "waiting");
});

test("the admin interest view lists each tour's dates with their own counts", async (t) => {
  const { call, departure } = await fixture(t);
  const d = await departure("guneydogu", { price: 250000 });
  await call("/interest", { kind: "prereg", tourId: "guneydogu", departureId: d.id, ...person() });
  await call("/interest", { kind: "prereg", tourId: "guneydogu", ...person({ email: "u@example.com", count: 5 }) });
  const tour = (await call("/admin/interest")).json.tours.find((x) => x.id === "guneydogu");
  assert.equal(tour.preregCount, 5);
  assert.deepEqual(
    tour.dates.map((x) => [x.id, x.date, x.count, x.demand]),
    [[d.id, DATE, 2, true]],
  );
});

test("the catalog lists demand dates without leaking internals; an opened date sells like any tour", async (t) => {
  const { call, departure } = await fixture(t);
  const tour = async () => (await call("/catalog")).json.tours.find((x) => x.id === "guneydogu");
  const d1 = await departure("guneydogu", { price: 250000, guideName: "Ali", guidePhone: "05550000000" });
  const d2 = await departure("guneydogu", { price: 250000, date: "2026-10-31", active: false });
  await departure("guneydogu", { price: 250000, date: "2026-10-10", startTime: "10:00" }); // satış kesimi geçti
  let g = await tour();
  assert.deepEqual(
    g.demandDates.map((x) => [x.id, x.date, x.start_time, x.price]),
    [[d1.id, DATE, "05:00", 250000]],
  );
  assert.doesNotMatch(JSON.stringify(g.demandDates), /plate|guide|closed|sales_mode|vehicle/);
  assert.equal(g.demandDates[0].count, undefined, "ilerleme kapalıyken sayı yok");
  assert.equal(g.next, undefined);
  const late = await call("/interest", { kind: "prereg", tourId: "guneydogu", departureId: d2.id, ...person() });
  assert.equal(late.status, 409, "pasif tarihe ön kayıt yok");
  await call("/interest", { kind: "prereg", tourId: "guneydogu", departureId: d1.id, ...person() });
  await call("/admin/operations/guneydogu/mode", { mode: "demand", threshold: 14, showProgress: true });
  g = await tour();
  assert.equal(g.demandDates[0].count, 2);
  assert.equal(g.demand.count, 0, "tur sayacı tarihsiz kayıtlar");
  assert.equal((await call(`/admin/departures/${d1.id}/open-sales`, {})).status, 200);
  g = await tour();
  assert.equal(g.demandDates, undefined);
  assert.equal(g.next.date, DATE);
  assert.equal(g.fromPrice, 250000);
  assert.equal((await call("/tours/guneydogu/departures")).json.length, 1);
});

test("tour-wide open refuses when every upcoming date is pinned to demand", async (t) => {
  const { call, departure, outbox } = await fixture(t);
  await departure("guneydogu", { price: 250000, salesMode: "demand" });
  await call("/interest", { kind: "prereg", tourId: "guneydogu", ...person({ email: "u@example.com" }) });
  const r = await call("/admin/operations/guneydogu/open-sales", {});
  assert.equal(r.status, 409, JSON.stringify(r.json));
  assert.equal((await call("/catalog")).json.tours.find((x) => x.id === "guneydogu").mode, "demand");
  assert.equal((await outbox()).filter((m) => m.kind === "interest_open").length, 0);
});
