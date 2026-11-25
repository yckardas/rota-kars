import { test } from "node:test";
import assert from "node:assert/strict";
import { matchTours, unitPrice, requestEstimate } from "../server/finance.mjs";

test("matchTours: anahtar kelime, genel kelime yok sayılır, uzun ifade kısa olanı ezer", () => {
  assert.deepEqual(matchTours("Ani ve Çıldır için 6 kişi"), ["ani-cildir"]);
  assert.deepEqual(matchTours("Günübirlik bir tur istiyoruz"), []);
  assert.deepEqual(matchTours("VAN HAVZASI turu"), ["van-havzasi"]);
  assert.deepEqual(matchTours("Van turu").sort(), ["van", "van-gunubirlik", "van-havzasi"]);
  assert.deepEqual(matchTours("Batum ve Tiflis").sort(), ["batum", "tiflis"]);
  assert.deepEqual(matchTours("savan"), [], "kelime sınırı");
  assert.deepEqual(matchTours(""), []);
  assert.deepEqual(matchTours(undefined), []);
});

test("unitPrice: önceki sefer → gelecek sefer → katalog", () => {
  const deps = [
    { tour_id: "batum", date: "2026-10-01", price: 200000 },
    { tour_id: "batum", date: "2026-11-01", price: 220000 },
    { tour_id: "batum", date: "2026-12-01", price: 250000 },
    { tour_id: "tiflis", date: "2026-12-10", price: 300000 },
    { tour_id: "tiflis", date: "2026-12-03", price: 310000 },
  ];
  const tours = [{ id: "batum", price: 1 }, { id: "tiflis", price: 2 }, { id: "mardin", price: 400000 }];
  assert.equal(unitPrice("batum", deps, "2026-11-25", tours), 220000);
  assert.equal(unitPrice("tiflis", deps, "2026-11-25", tours), 310000, "en yakın gelecek sefer");
  assert.equal(unitPrice("mardin", deps, "2026-11-25", tours), 400000);
  assert.equal(unitPrice("yok", deps, "2026-11-25", tours), null);
});

test("requestEstimate: tourId önceliklidir; nottan çoklu eşleşmede ortalama; konaklama/araç tahminsiz", () => {
  const ctx = {
    today: "2026-11-25",
    tours: [
      { id: "van-gunubirlik", price: 300000 },
      { id: "van", price: 600000 },
      { id: "van-havzasi", price: 700000 },
      { id: "batum", price: 220000 },
    ],
    departures: [],
  };
  assert.deepEqual(requestEstimate({ kind: "tour-info", body: { tourId: "batum", guests: 3, notes: "Van" } }, ctx), {
    amount: 660000,
    tourIds: ["batum"],
    averaged: false,
  });
  const van = requestEstimate({ kind: "private-tour", body: { guests: 2, notes: "Van turu" } }, ctx);
  assert.equal(van.amount, 2 * Math.round((300000 + 600000 + 700000) / 3));
  assert.equal(van.averaged, true);
  assert.equal(requestEstimate({ kind: "hotel", body: { tourId: "batum", guests: 2 } }, ctx), null);
  assert.equal(requestEstimate({ kind: "vehicle", body: { guests: 2, notes: "Batum" } }, ctx), null);
  assert.equal(requestEstimate({ kind: "private-tour", body: { guests: 2, notes: "bir yer" } }, ctx), null);
  assert.equal(requestEstimate({ kind: "private-tour", body: { notes: "Batum" } }, ctx).amount, 220000, "kişi yoksa 1");
});

// ---- buildFinance ----
import { buildFinance, tourRows } from "../server/finance.mjs";
import { openStore } from "../server/store.mjs";

const at = (ymd, hm = "12:00") => Date.parse(`${ymd}T${hm}:00+03:00`);
let seq = 0;
const res = (o = {}) => {
  const reference = o.reference || "RK-" + ++seq;
  return { id: reference, reference, name: "Müşteri " + reference, phone: "05550000000", tourId: "batum", departure_id: "d-" + (o.date || "2026-11-10"), date: "2026-11-10", start_time: "08:00", seats: [1], total: 100000, net_paid: 0, status: "confirmed", ...o };
};
const led = (r, amount, ymd, o = {}) => ({ reservation_id: r.id, kind: "payment", amount, method: "cash", note: "", created_at: at(ymd, o.hm), ...o });
const input = (o = {}) => ({
  reservations: [],
  ledger: [],
  departures: [],
  requests: [],
  tours: [
    { id: "batum", name: "Günübirlik Batum", price: 220000 },
    { id: "van-gunubirlik", name: "Günübirlik Van Turu", price: 300000 },
    { id: "van", name: "Konaklamalı Van Turu", price: 600000 },
    { id: "van-havzasi", name: "Van Havzası Turu", price: 700000 },
  ],
  today: "2026-11-15",
  from: "2026-11-01",
  to: "2026-11-30",
  bucket: "day",
  ...o,
});

test("revenue by tour date, collected by payment day", () => {
  const inRange = res({ date: "2026-11-10", total: 300000, net_paid: 90000 }),
    nextMonth = res({ date: "2026-12-05", total: 200000, net_paid: 50000 });
  const f = buildFinance(
    input({ reservations: [inRange, nextMonth], ledger: [led(inRange, 90000, "2026-10-20"), led(nextMonth, 50000, "2026-11-12", { method: "bank_transfer" })] }),
  );
  assert.equal(f.summary.revenue, 300000);
  assert.equal(f.summary.collected, 50000);
  assert.equal(f.summary.payments, 50000);
  assert.deepEqual(f.methods, { cash: 0, bankTransfer: 50000, pos: 0, card: 0 });
  assert.equal(f.series.find((s) => s.key === "2026-11-10").revenue, 300000);
  assert.equal(f.series.find((s) => s.key === "2026-11-12").collected, 50000);
});

test("pending share is part of revenue and shown separately", () => {
  const f = buildFinance(input({ reservations: [res({ status: "pending_agency", total: 40000 }), res({ total: 60000 }), res({ status: "cancelled", total: 99999 })] }));
  assert.equal(f.summary.revenue, 100000);
  assert.equal(f.summary.revenuePending, 40000);
});

test("outstanding excludes no_show and is period-independent", () => {
  const rows = [
    res({ date: "2026-08-01", total: 100000, net_paid: 50000 }),
    res({ date: "2026-08-01", status: "no_show", total: 30000 }),
    res({ date: "2026-08-01", status: "cancelled", total: 99999 }),
  ];
  for (const range of [{}, { from: "2027-01-01", to: "2027-01-31" }]) {
    const f = buildFinance(input({ reservations: rows, ...range }));
    assert.equal(f.summary.outstanding, 50000);
    assert.equal(f.summary.outstandingNoShow, 30000);
  }
});

test("expected payments: next 30 days from today, vade = tur tarihi", () => {
  const f = buildFinance(
    input({
      reservations: [
        res({ date: "2026-11-15", total: 10000 }),
        res({ date: "2026-11-21", total: 20000 }),
        res({ date: "2026-11-22", total: 40000 }),
        res({ date: "2026-12-15", total: 5000 }),
        res({ date: "2026-11-14", total: 7000 }),
        res({ date: "2026-11-20", status: "no_show", total: 1 }),
      ],
    }),
  );
  assert.equal(f.summary.expected7, 30000);
  assert.equal(f.expected.total, 70000);
  assert.equal(f.expected.days.length, 30);
  assert.equal(f.expected.days[0].date, "2026-11-15");
  assert.equal(f.expected.days.at(-1).date, "2026-12-14");
  assert.deepEqual(f.expected.rows.map((r) => r.date), ["2026-11-15", "2026-11-21", "2026-11-22"]);
  assert.deepEqual(f.overdue.map((r) => r.date), ["2026-11-14"]);
});

test("overdue: only past confirmed/completed with balance", () => {
  const f = buildFinance(
    input({
      reservations: [
        res({ reference: "A", date: "2026-11-01", status: "pending_agency" }),
        res({ reference: "B", date: "2026-11-01", status: "completed" }),
        res({ reference: "C", date: "2026-11-02", status: "confirmed" }),
        res({ reference: "D", date: "2026-11-02", status: "completed", net_paid: 100000 }),
      ],
    }),
  );
  assert.deepEqual(f.overdue.map((r) => r.reference).sort(), ["B", "C"]);
  assert.equal(f.overdue[0].balance, 100000);
});

test("series buckets: weeks start Monday, every bucket present", () => {
  assert.deepEqual(
    buildFinance(input({ bucket: "week" })).series.map((s) => s.key),
    ["2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"],
  );
  assert.equal(buildFinance(input()).series.length, 30);
});

test("pipeline: stages, estimates, open totals exclude won/lost; outside range ignored", () => {
  const rq = (kind, status, body, ymd = "2026-11-05") => ({ id: kind + status + ymd, kind, status, body, created_at: at(ymd) });
  const f = buildFinance(
    input({
      requests: [
        rq("tour-info", "new", { tourId: "batum", guests: 2 }),
        rq("private-tour", "offered", { guests: 1, notes: "Van turu" }),
        rq("hotel", "new", { guests: 2 }),
        rq("private-tour", "won", { guests: 4, notes: "Batum" }),
        rq("tour-info", "new", { tourId: "batum", guests: 9 }, "2026-10-05"),
      ],
    }),
  );
  const stage = (s) => f.pipeline.stages.find((x) => x.status === s);
  assert.deepEqual(f.pipeline.stages.map((s) => s.status), ["new", "contacted", "in_progress", "offered", "won", "lost"]);
  assert.equal(stage("new").count, 2);
  assert.equal(stage("new").estimatedCount, 1);
  assert.equal(stage("new").estimate, 440000);
  assert.equal(stage("new").label, "Yeni");
  assert.equal(stage("won").estimate, 880000);
  assert.equal(f.pipeline.openCount, 3);
  assert.equal(f.pipeline.openEstimate, 440000 + Math.round((300000 + 600000 + 700000) / 3));
  assert.equal(f.pipeline.unestimated, 1);
});

test("day view lists that day's departures and ledger; null for longer ranges", () => {
  const r = res({ date: "2026-11-10", departure_id: "d1", seats: [1, 2], total: 200000, net_paid: 50000 });
  const deps = [{ id: "d1", tour_id: "batum", date: "2026-11-10", start_time: "08:00", price: 100000, vehicle: { sellableSeats: 18 } }];
  const f = buildFinance(input({ from: "2026-11-10", to: "2026-11-10", reservations: [r], departures: deps, ledger: [led(r, 50000, "2026-11-10", { note: "elden" })] }));
  assert.deepEqual(f.day.departures, [{ departureId: "d1", tourName: "Günübirlik Batum", start_time: "08:00", guests: 2, revenue: 200000, balance: 150000 }]);
  assert.equal(f.day.ledger.length, 1);
  assert.equal(f.day.ledger[0].note, "elden");
  assert.equal(f.day.ledger[0].reference, r.reference);
  assert.equal(buildFinance(input({ reservations: [r] })).day, null);
});

test("empty period: zeros everywhere, no throw", () => {
  const f = buildFinance(input());
  assert.equal(f.summary.revenue, 0);
  assert.equal(f.summary.outstanding, 0);
  assert.ok(f.series.every((s) => s.revenue === 0 && s.collected === 0));
  assert.deepEqual(f.byTour, []);
  assert.equal(f.pipeline.openEstimate, 0);
  assert.deepEqual(f.overdue, []);
});

test("istanbul day boundary for payments", () => {
  const r = res({ date: "2026-12-20" });
  const f = buildFinance(
    input({ reservations: [r], ledger: [{ ...led(r, 1000, "2026-11-10"), created_at: Date.parse("2026-11-10T20:30:00Z") }, { ...led(r, 2000, "2026-11-10"), created_at: Date.parse("2026-11-10T21:30:00Z") }] }),
  );
  assert.equal(f.series.find((s) => s.key === "2026-11-10").collected, 1000);
  assert.equal(f.series.find((s) => s.key === "2026-11-11").collected, 2000);
});

test("refunded booking never yields a negative balance", () => {
  const f = buildFinance(input({ reservations: [res({ date: "2026-11-01", total: 100000, net_paid: 150000 })] }));
  assert.equal(f.summary.outstanding, 0);
  assert.deepEqual(f.overdue, []);
});

test("unknown tour falls back to its id", () => {
  const f = buildFinance(input({ reservations: [res({ tourId: "silinmis-tur", date: "2026-11-20" })] }));
  assert.equal(f.byTour[0].tourName, "silinmis-tur");
  assert.equal(f.expected.rows[0].tourName, "silinmis-tur");
});

test("financeReport matches monthReport for a month", async (t) => {
  let now = Date.parse("2026-10-17T06:00:00Z");
  const s = await openStore(":memory:", { clock: () => now });
  t.after(() => s.db.close());
  const AGENT = { id: "ops-1", role: "operations", name: "Operasyon" };
  const d = await s.departures.save({ tourId: "ani-cildir", date: "2026-10-20", startTime: "09:00", pickup: "Kars", guideName: "", guidePhone: "", price: 150000, vehicleModel: "vip-midibus", passengerSeats: 18, active: true });
  const book = (seats, extra) => s.adminReserve({ departureId: d.id, seats, name: "Tel Müşteri", phone: "0555 111 22 33", email: "", passengers: seats.map((n) => "Yolcu " + n), paymentMode: "deposit", confirm: false, ...extra }, AGENT);
  await book([1, 2], { payment: { amount: 90000, method: "cash" } });
  await book([3], { payment: { amount: 150000, method: "pos" }, paymentMode: "full", confirm: true });
  await book([4]);
  const f = await s.workflow.financeReport({ from: "2026-10-01", to: "2026-10-31", bucket: "day" }),
    m = await s.workflow.monthReport("2026-10");
  assert.deepEqual(f.byTour, m.byTour);
  assert.equal(f.summary.revenue, m.totals.revenue);
  assert.equal(f.summary.collected, m.cash.net);
  assert.equal(f.methods.pos, m.cash.pos);
});

// ---- inceleme sonrası küçük bulgular ----
import { roleAllows } from "../server/admin-auth.mjs";

test("unitPrice uses what past customers actually paid (subtotal per seat) over today's price", () => {
  const deps = [{ id: "d-old", tour_id: "batum", date: "2026-10-01", price: 250000 }];
  const tours = [{ id: "batum", price: 250000 }];
  const rs = [
    { departure_id: "d-old", tourId: "batum", status: "completed", seats: [1, 2], subtotal: 400000, created_at: 1 },
    { departure_id: "d-old", tourId: "batum", status: "cancelled", seats: [3], subtotal: 999999, created_at: 2 },
  ];
  assert.equal(unitPrice("batum", deps, "2026-11-25", tours, rs), 200000, "o seferde satılan koltuk fiyatı");
  assert.equal(unitPrice("batum", deps, "2026-11-25", tours, []), 250000, "satış yoksa seferin fiyatı");
});

test("day view shows legacy receipt numbers but hides internal PANEL- references", () => {
  const r = res({ date: "2026-11-10" });
  const f = buildFinance(
    input({
      from: "2026-11-10",
      to: "2026-11-10",
      reservations: [r],
      ledger: [
        { ...led(r, 100, "2026-11-10", { hm: "09:00" }), note: undefined, external_reference: "EFT-123" },
        { ...led(r, 200, "2026-11-10", { hm: "10:00" }), note: "", external_reference: "PANEL-abc" },
      ],
    }),
  );
  assert.deepEqual(f.day.ledger.map((p) => p.note), ["EFT-123", ""]);
});

test("guide cannot open the finance endpoint; operations can", () => {
  assert.equal(roleAllows("guide", "GET", "/api/admin/finance"), false);
  assert.equal(roleAllows("operations", "GET", "/api/admin/finance"), true);
});

test("tourRows (shared by Finans and Aylık rapor) keeps a tour that left the catalog", () => {
  const rows = tourRows({
    tours: [{ id: "batum", name: "Günübirlik Batum" }],
    departures: [{ id: "d1", tour_id: "batum", date: "2026-11-10", vehicle: { sellableSeats: 18 } }],
    reservations: [res({ tourId: "katalogdan-kalkan", total: 150000, net_paid: 50000, seats: [1, 2] })],
  });
  assert.deepEqual(rows.map((x) => [x.tourId, x.tourName, x.revenue, x.collected, x.guests]), [
    ["batum", "Günübirlik Batum", 0, 0, 0],
    ["katalogdan-kalkan", "katalogdan-kalkan", 150000, 50000, 2],
  ]);
});

test("online payment without a bank reference is refused instead of silently getting a random one", async (t) => {
  const s = await openStore(":memory:");
  t.after(() => s.db.close());
  const d = (await s.listDepartures("ani-cildir"))[0];
  const h = await s.hold(d.id, [7]);
  const r = await s.reserve({ holdToken: h.token, name: "Kart Yolcu", email: "kart@example.com", phone: "05550000000", passengers: ["Kart Yolcu"], paymentMode: "deposit" });
  await assert.rejects(s.workflow.payment(r.reference, { amount: 1000, method: "online:vakifbank" }), (e) => e.status === 500);
  await assert.rejects(s.workflow.payment(r.reference, { amount: 1000, method: "online:vakifbank", externalReference: "" }), (e) => e.status === 500);
  assert.equal((await s.workflow.get(r.reference)).ledger.length, 0);
  // Elle yöntemlerde iç referans otomatik üretilir.
  await s.workflow.payment(r.reference, { amount: 1000, method: "cash", note: "elden" });
  assert.equal((await s.workflow.get(r.reference)).ledger.length, 1);
});
