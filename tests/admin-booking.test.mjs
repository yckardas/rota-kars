import { test } from "node:test";
import assert from "node:assert/strict";
import { openStore } from "../server/store.mjs";

const AGENT = { id: "ops-1", role: "operations", name: "Operasyon" };
async function setup(t) {
  let now = Date.parse("2026-10-17T06:00:00Z");
  const s = await openStore(":memory:", { clock: () => now });
  t.after(() => s.db.close());
  const d = await s.departures.save({
    tourId: "ani-cildir",
    date: "2026-10-20",
    startTime: "09:00",
    pickup: "Kars Garı",
    guideName: "Rehber",
    guidePhone: "05550000000",
    price: 150000,
    vehicleModel: "vip-midibus",
    passengerSeats: 18,
    active: true,
  });
  return { s, d, advance: (ms) => (now += ms) };
}
const base = (d, extra = {}) => ({
  departureId: d.id,
  seats: [3, 4],
  name: "Telefon Müşteri",
  phone: "0555 111 22 33",
  email: "",
  passengers: ["Ayşe Yılmaz", "Mehmet Yılmaz"],
  paymentMode: "on_tour",
  notes: "Otelden alınacak",
  confirm: false,
  ...extra,
});

test("agency phone booking: pay on tour can be confirmed directly, no customer e-mail without address", async (t) => {
  const { s, d } = await setup(t);
  const r = await s.adminReserve(base(d, { confirm: true }), AGENT);
  assert.equal(r.status, "confirmed");
  assert.equal(r.deposit, 0);
  assert.equal(r.total, 300000);
  assert.equal(r.source, "agency");
  assert.equal(r.created_by, "ops-1");
  assert.equal(r.notes, "Otelden alınacak");
  assert.deepEqual(r.seats, [3, 4]);
  const mails = await s.db.find("notification_outbox", {});
  assert.equal(mails.filter((m) => !m.recipient).length, 0, "e-postasız müşteriye kayıt yazılmaz");
  assert.equal(mails.filter((m) => m.kind === "agency_reservation_created").length, 0, "acente kendine bildirim almaz");
  // Aynı koltuk ikinci kez satılamaz.
  await assert.rejects(s.adminReserve(base(d, { seats: [4, 5] }), AGENT), (e) => e.status === 409);
  assert.equal(await s.db.count("reservations", {}), 1, "başarısız deneme yarım kayıt bırakmaz");
});

test("agency booking with payment: full payment recorded then confirmed; deposit rule still enforced", async (t) => {
  const { s, d } = await setup(t);
  const paid = await s.adminReserve(
    base(d, { paymentMode: "full", seats: [1], passengers: ["Tek Yolcu"], email: "musteri@example.com", payment: { amount: 150000, method: "cash" }, confirm: true }),
    AGENT,
  );
  assert.equal(paid.status, "confirmed");
  assert.equal(paid.net_paid, 150000);
  // Kapora seçilip tahsilat girilmeden onay istenirse işlem tümden geri alınır.
  await assert.rejects(
    s.adminReserve(base(d, { paymentMode: "deposit", seats: [2], passengers: ["X Yolcu"], confirm: true }), AGENT),
    (e) => e.status === 409,
  );
  assert.equal((await s.availability(d.id)).seats.find((x) => x.number === 2).status, "available");
  // Toplamı aşan tahsilat da hiçbir şey yazılmadan reddedilir.
  await assert.rejects(
    s.adminReserve(base(d, { paymentMode: "full", seats: [6], passengers: ["Y Yolcu"], payment: { amount: 999999, method: "cash" } }), AGENT),
    (e) => e.status === 400,
  );
  assert.equal((await s.availability(d.id)).seats.find((x) => x.number === 6).status, "available");
  assert.equal(await s.db.count("reservations", {}), 1, "yalnız başarılı kayıt kaldı");
  assert.equal(await s.db.count("payment_ledger", {}), 1);
});

test("agency can still book a departure whose online sales are closed; web cannot", async (t) => {
  const { s, d } = await setup(t);
  await s.departures.save({
    id: d.id,
    tourId: d.tour_id,
    date: d.date,
    startTime: d.start_time,
    pickup: d.pickup,
    guideName: d.guide_name,
    guidePhone: d.guide_phone,
    price: d.price,
    vehicleModel: "vip-midibus",
    passengerSeats: 18,
    active: false,
  });
  await assert.rejects(s.hold(d.id, [7]), (e) => e.status === 409);
  const r = await s.adminReserve(base(d, { seats: [7], passengers: ["Son Dakika"] }), AGENT);
  assert.equal(r.status, "pending_agency");
});

test("reservation search: reference, name, passenger, phone written differently, status filter", async (t) => {
  const { s, d } = await setup(t);
  const a = await s.adminReserve(base(d), AGENT);
  await s.adminReserve(base(d, { seats: [9], name: "Başka Kişi", phone: "05329998877", passengers: ["Zeynep Kaya"], confirm: true }), AGENT);
  const find = async (q, extra = {}) => (await s.workflow.list({ q, ...extra })).map((r) => r.name);
  assert.deepEqual(await find(a.reference.toLowerCase()), ["Telefon Müşteri"]);
  assert.deepEqual(await find("telefon"), ["Telefon Müşteri"]);
  assert.deepEqual(await find("Zeynep"), ["Başka Kişi"]);
  assert.deepEqual(await find("5551112233"), ["Telefon Müşteri"]);
  assert.deepEqual(await find("+90 532 999 88 77"), ["Başka Kişi"]);
  assert.deepEqual(await find("", { status: "confirmed" }), ["Başka Kişi"]);
  assert.deepEqual(await find(".*"), [], "düzenli ifade karakterleri kaçışlanır");
});

test("overview: today's departures, pending sorted by expiry, new requests and week load", async (t) => {
  const { s, d } = await setup(t);
  const todayDep = await s.departures.save({
    tourId: "sarikamis",
    date: "2026-10-17",
    startTime: "18:00",
    pickup: "Kars merkez",
    guideName: "",
    guidePhone: "",
    price: 100000,
    vehicleModel: "vip-midibus",
    passengerSeats: 18,
    active: true,
  });
  await s.adminReserve(base(todayDep, { seats: [1, 2], confirm: true }), AGENT);
  await s.adminReserve(base(d, { paymentMode: "deposit", seats: [5], passengers: ["Bekleyen Bir"] }), AGENT);
  await s.request("private-tour", { name: "Talep Sahibi", email: "t@example.com", phone: "05551112233", guests: 2 });
  const o = await s.overview();
  assert.equal(o.today, "2026-10-17");
  assert.equal(o.todayDepartures.length, 1);
  assert.equal(o.todayDepartures[0].booked, 2);
  assert.equal(o.pending.count, 1);
  assert.equal(o.pending.items[0].name, "Telefon Müşteri");
  assert.equal(o.newRequests, 1);
  assert.equal(o.week.departures >= 2, true);
  assert.equal(o.week.booked, 3);
});

test("HTTP: bulk departures by weekday, duplicates skipped; guides cannot create bookings", async (t) => {
  const { once } = await import("node:events");
  const { createApp } = await import("../server/app.mjs");
  let now = Date.parse("2026-10-17T06:00:00Z");
  const s = await openStore(":memory:", { clock: () => now, seed: false });
  const app = createApp(s, {
    env: { ADMIN_PASSWORD: "ilk-kurulum-parolasi" },
    reviewsService: { get: async () => ({ status: "not_configured", reviews: [] }) },
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await s.db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (path, { body, cookie } = {}) => {
    const r = await fetch(base + path, {
      method: body ? "POST" : "GET",
      body: body ? JSON.stringify(body) : undefined,
      headers: { "Content-Type": "application/json", "X-Rota-Client": "web", ...(cookie ? { Cookie: cookie } : {}) },
    });
    return { status: r.status, json: await r.json().catch(() => null), cookie: r.headers.get("set-cookie")?.split(";")[0] };
  };
  const boot = (await call("/admin/login", { body: { password: "ilk-kurulum-parolasi" } })).cookie;
  const owner = (
    await call("/admin/users", {
      body: { email: "sahip@rotakars.test", name: "Sahip", password: "sahip-parolasi-2026", role: "owner" },
      cookie: boot,
    })
  ).cookie;
  const plan = {
    tourId: "ani-cildir",
    from: "2026-10-19",
    to: "2026-11-01",
    weekdays: [6, 0],
    startTime: "08:30",
    price: 150000,
    pickup: "Kars merkez",
    vehicleModel: "vip-midibus",
    passengerSeats: 18,
    active: true,
  };
  const first = await call("/admin/departures/bulk", { body: plan, cookie: owner });
  assert.equal(first.status, 201);
  assert.equal(first.json.created, 4, "2 hafta × Cumartesi + Pazar");
  const again = await call("/admin/departures/bulk", { body: { ...plan, weekdays: [6, 0, 1] }, cookie: owner });
  assert.equal(again.json.created, 2, "yalnız Pazartesiler eklenir");
  assert.equal(again.json.skipped, 4);
  assert.equal((await call("/admin/departures/bulk", { body: { ...plan, from: "2026-10-01" }, cookie: owner })).status, 400);
  assert.equal((await call("/admin/departures/bulk", { body: { ...plan, to: "2027-12-01" }, cookie: owner })).status, 400);

  const dep = (await call("/admin/departures?tourId=ani-cildir", { cookie: owner })).json[0];
  const booking = {
    departureId: dep.id,
    seats: [2],
    name: "Telefon Müşteri",
    phone: "05551112233",
    passengers: ["Telefon Müşteri"],
    paymentMode: "on_tour",
    confirm: true,
  };
  const created = await call("/admin/reservations", { body: booking, cookie: owner });
  assert.equal(created.status, 201);
  assert.match(created.json.ticketUrl, /\/bilet\//);
  assert.equal((await call(`/admin/departures/${dep.id}/seats`, { cookie: owner })).json.seats[1].status, "occupied");

  await call("/admin/users", {
    body: { email: "rehber@rotakars.test", name: "Rehber", password: "rehber-parolasi-2026", role: "guide" },
    cookie: owner,
  });
  const guide = (await call("/admin/login", { body: { email: "rehber@rotakars.test", password: "rehber-parolasi-2026" } })).cookie;
  assert.equal((await call("/admin/reservations", { body: { ...booking, seats: [3] }, cookie: guide })).status, 403);
  assert.equal((await call("/admin/departures/bulk", { body: plan, cookie: guide })).status, 403);
  assert.equal((await call("/admin/overview", { cookie: guide })).status, 403);
});

test("request tracking: status changes and notes are kept with author and time", async (t) => {
  const { s, advance } = await setup(t);
  const { reference } = await s.request("hotel", { name: "Otel Müşteri", email: "o@example.com", phone: "05551112233", guests: 2 });
  const row = (await s.db.find("requests", {}))[0];
  assert.ok(reference);
  let r = await s.updateRequest(row.id, { status: "contacted" }, { name: "Ayşe" });
  advance(60000);
  r = await s.updateRequest(row.id, { note: "Fiyat WhatsApp'tan gönderildi" }, { name: "Ayşe" });
  assert.equal(r.status, "contacted");
  assert.deepEqual(r.notes.map((n) => n.text), ["Durum: Arandı", "Fiyat WhatsApp'tan gönderildi"]);
  assert.equal(r.notes[1].by, "Ayşe");
  assert.equal(r.body.name, "Otel Müşteri");
  assert.equal((await s.overview()).newRequests, 0, "arandı durumundaki talep 'yeni' sayılmaz");
  await assert.rejects(s.updateRequest("00000000-0000-4000-8000-000000000000", { status: "lost" }, {}), (e) => e.status === 404);
});

test("monthly report: occupancy and revenue by tour date, cash by payment date, CSV-safe", async (t) => {
  const { s, d } = await setup(t);
  await s.adminReserve(base(d, { paymentMode: "full", seats: [1, 2], passengers: ["A Yolcu", "B Yolcu"], payment: { amount: 300000, method: "cash" }, confirm: true }), AGENT);
  await s.adminReserve(base(d, { paymentMode: "on_tour", seats: [3], passengers: ["=HYPERLINK(1)"], name: "=CMD()", confirm: true }), AGENT);
  const cancelled = await s.adminReserve(base(d, { seats: [4], passengers: ["İptal Eden"] }), AGENT);
  await s.workflow.cancel(cancelled.reference);
  const rep = await s.workflow.monthReport("2026-10");
  const ani = rep.byTour.find((x) => x.tourId === "ani-cildir");
  assert.equal(ani.departures >= 1, true);
  assert.equal(ani.guests, 3, "iptal edilen sayılmaz");
  assert.equal(ani.revenue, 450000);
  assert.equal(ani.collected, 300000);
  assert.equal(rep.cash.cash, 300000);
  assert.equal(rep.cash.bankTransfer, 0);
  assert.equal(rep.totals.cancelled, 1);
  assert.equal(rep.totals.outstanding, 150000);
  assert.equal((await s.workflow.monthReport("2026-11")).totals.reservations, 0);
});

test("agency booking: a late failure (reused bank reference) leaves no half-written booking in either Mongo mode", async (t) => {
  const { s, d } = await setup(t);
  const pay = (seat) =>
    base(d, { paymentMode: "full", seats: [seat], passengers: ["Yolcu " + seat], payment: { amount: 150000, method: "bank_transfer", externalReference: "EFT-2026-001" }, confirm: true });
  await s.adminReserve(pay(10), AGENT);
  await assert.rejects(s.adminReserve(pay(11), AGENT), (e) => e.status === 409);
  assert.equal((await s.availability(d.id)).seats.find((x) => x.number === 11).status, "available");
  assert.equal(await s.db.count("reservations", {}), 1);
  assert.equal(await s.db.count("payment_ledger", {}), 1);
  assert.equal(await s.db.count("holds", {}), 0);
});

test("quick filters, no-show and removing an unused departure", async (t) => {
  const { s, d, advance } = await setup(t);
  const open = await s.adminReserve(base(d, { confirm: true }), AGENT);
  const paid = await s.adminReserve(
    base(d, { paymentMode: "full", seats: [1], passengers: ["Tek Yolcu"], payment: { amount: 150000, method: "cash" }, confirm: true }),
    AGENT,
  );
  const refs = async (flag) => (await s.workflow.list({ flag })).map((r) => r.reference);
  assert.deepEqual(await refs("balance"), [open.reference], "tam ödenen bakiyede görünmez");
  assert.deepEqual(await refs("cancel_request"), []);
  // Tarihi gelmeden "gelmedi" işaretlenemez.
  await assert.rejects(s.workflow.noShow(open.reference), (e) => e.status === 409);
  advance(4 * 86400000);
  assert.equal((await s.workflow.noShow(open.reference)).status, "no_show");
  assert.ok((await s.workflow.audit(open.reference)).some((a) => a.event === "no_show"));
  assert.equal((await s.workflow.list({ status: "no_show" }))[0].reference, open.reference);
  assert.ok(paid.reference);
  // Kaydı olan sefer silinmez; boş sefer silinir.
  await assert.rejects(s.departures.remove(d.id), (e) => e.status === 409);
  const empty = await s.departures.save({ ...base(d), tourId: "ani-cildir", date: "2026-10-30", startTime: "09:00", pickup: "Kars", guideName: "", guidePhone: "", price: 1000, vehicleModel: "vip-midibus", passengerSeats: 18, active: true });
  await s.departures.remove(empty.id);
  await assert.rejects(s.departures.get(empty.id, { allowClosed: true, allowPast: true }), (e) => e.status === 404);
});
