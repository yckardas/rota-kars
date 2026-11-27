// Rezervasyondan yolcu çıkarma (kısmi iptal): koltuk boşalır, bedel kalan yolculara göre
// yeniden yazılır, transfer kademesi güncellenir, süre geçtiyse kapora payı kesilir.
import { test } from "node:test";
import assert from "node:assert/strict";
import { openStore } from "../server/store.mjs";

async function setup(t) {
  let now = Date.parse("2026-10-17T06:00:00Z");
  const s = await openStore(":memory:", { clock: () => now, env: {} });
  t.after(() => s.db.close());
  return { s, advance: (ms) => (now += ms) };
}
const departure = (s, extra = {}) =>
  s.departures.save({
    tourId: "ani-cildir",
    date: "2026-10-25",
    startTime: "12:30",
    pickup: "Kars Garı",
    guideName: "Rehber",
    guidePhone: "05550000000",
    price: 100000,
    vehicleModel: "vip-minibus",
    passengerSeats: 9,
    active: true,
    ...extra,
  });
async function booking(s, d, seats, extra = {}) {
  const h = await s.hold(d.id, seats);
  return s.reserve({
    holdToken: h.token,
    name: "Ayşe Yılmaz",
    email: "ayse@example.com",
    phone: "05551112233",
    passengers: seats.map((n) => "Yolcu " + n),
    passengerDetails: seats.map((n) => ({
      nationality: "TR",
      idNumber: "1000000000" + n,
      gender: n % 2 ? "E" : "K",
    })),
    paymentMode: "deposit",
    ...extra,
  });
}
const pay = (s, r, amount, ref = "BANK-" + amount) =>
  s.workflow.payment(r.reference, { amount, method: "bank_transfer", externalReference: ref });

test("süre içinde yolcu çıkarılınca koltuk boşalır, bedel düşer, fazla ödeme iade önerilir", async (t) => {
  const { s } = await setup(t);
  const d = await departure(s);
  const r = await booking(s, d, [1, 2, 3, 4]);
  assert.equal(r.total, 400000);
  await pay(s, r, 400000);
  await s.workflow.confirm(r.reference);

  const q = await s.workflow.removalQuote(r.reference, [3]);
  assert.equal(q.late, false);
  assert.deepEqual(q.names, ["Yolcu 3"]);
  assert.equal(q.share, 100000);
  assert.deepEqual(q.customer, { fee: 0, total: 300000, refund: 100000 });
  assert.deepEqual(q.agency, q.customer);

  const after = await s.workflow.removePassengers(r.reference, [3]);
  assert.deepEqual(after.seats, [1, 2, 4]);
  assert.deepEqual(after.passengers, ["Yolcu 1", "Yolcu 2", "Yolcu 4"]);
  // Kimlikler koltuk sırasıyla kalır (şifreli saklanıp açılır).
  assert.deepEqual(
    after.passenger_details.map((p) => p.idNumber),
    ["10000000001", "10000000002", "10000000004"],
  );
  assert.equal(after.total, 300000);
  assert.equal(after.subtotal, 300000);
  assert.equal(after.deposit, 90000);
  assert.equal(after.cancellation_fee, 0);
  assert.equal(after.status, "confirmed");
  assert.equal(after.balance_due, 0);
  const seats = (await s.availability(d.id)).seats;
  assert.equal(seats.find((x) => x.number === 3).status, "available");
  assert.equal(seats.find((x) => x.number === 4).status, "occupied");

  const mail = (await s.db.find("notification_outbox", {})).find((m) => m.kind === "passengers_removed");
  assert.match(mail.body, /Rezervasyondan çıkarılan yolcu: Yolcu 3 \(koltuk 3\)/);
  assert.match(mail.body, /Güncel tur bedeli: 3\.000,00 TL \(önceki 4\.000,00 TL\)/);
  assert.match(mail.body, /Koltuklar: 1, 2, 4\./);
  const log = await s.workflow.audit(r.reference);
  const row = log.find((a) => a.event === "passengers_removed");
  assert.deepEqual(row.details.seats, [3]);
  assert.equal(row.details.totalAfter, 300000);

  // Fazla tahsilat iade edilince kayıt dengelenir.
  const refunded = await s.workflow.payment(r.reference, {
    amount: 100000,
    method: "bank_transfer",
    kind: "refund",
  });
  assert.equal(refunded.net_paid, 300000);
  assert.equal(refunded.payment_state, "paid");
});

test("süre geçtiyse çıkan yolcunun kapora payı kesilir; acente kararıyla kesinti yapılmaz", async (t) => {
  const { s } = await setup(t);
  // Hareket 17 Ekim 12:30, saat 09:00 (TSİ): kesintisiz iptal süresi geçti.
  const d = await departure(s, { date: "2026-10-17" });
  const r = await booking(s, d, [1, 2, 3]);
  await pay(s, r, 300000);
  await s.workflow.confirm(r.reference);

  const q = await s.workflow.removalQuote(r.reference, [2]);
  assert.equal(q.late, true);
  assert.deepEqual(q.customer, { fee: 30000, total: 230000, refund: 70000 });
  assert.deepEqual(q.agency, { fee: 0, total: 200000, refund: 100000 });

  const after = await s.workflow.removePassengers(r.reference, [2]);
  assert.equal(after.total, 230000);
  assert.equal(after.cancellation_fee, 30000);
  assert.equal(after.subtotal, 200000);
  const mail = (await s.db.find("notification_outbox", {})).find((m) => m.kind === "passengers_removed");
  assert.match(mail.body, /kapora payı 300,00 TL iade edilmez/);

  // Kesinti sonraki işlemlerde de toplamda kalır: ikinci çıkarma ve başka sefere taşıma.
  const waived = await s.workflow.removePassengers(r.reference, [3], { waive: true });
  assert.equal(waived.total, 130000);
  assert.equal(waived.cancellation_fee, 30000);
  const other = await departure(s, { date: "2026-10-20", price: 110000 });
  await s.workflow.payment(r.reference, { amount: 170000, method: "bank_transfer", kind: "refund" });
  const moved = await s.workflow.move(r.reference, { departureId: other.id, seats: [5] });
  assert.equal(moved.total, 110000 + 30000);
});

test("kesinti en çok net tahsilat kadardır; ödemesiz ön rezervasyondan çıkarmak ücretsizdir", async (t) => {
  const { s } = await setup(t);
  const d = await departure(s, { date: "2026-10-17" });
  const r = await booking(s, d, [1, 2]);
  const q = await s.workflow.removalQuote(r.reference, [2]);
  assert.equal(q.late, true);
  assert.deepEqual(q.customer, { fee: 0, total: 100000, refund: 0 });
  const after = await s.workflow.removePassengers(r.reference, [2]);
  assert.equal(after.status, "pending_agency");
  assert.equal(after.total, 100000);
  assert.equal(after.deposit, 30000);
});

test("transfer grup fiyatı yeni kişi kademesine göre düşer, eski tutarı aşmaz", async (t) => {
  const { s } = await setup(t);
  const d = await departure(s);
  const r = await booking(s, d, [1, 2, 3, 4], {
    transfer: { point: "airport", destination: "kars", direction: "both", info: "" },
  });
  // Standart tablo: Kars merkez gidiş-dönüş 4–6 kişi 3.600 TL, 2–3 kişi 2.000 TL.
  assert.equal(r.transfer.amount, 360000);
  assert.equal(r.total, 400000 + 360000);
  const after = await s.workflow.removePassengers(r.reference, [4]);
  assert.equal(after.transfer.amount, 200000);
  assert.equal(after.transfer.tier, "2-3");
  assert.equal(after.transfer.tierLabel, "2–3 kişi");
  assert.equal(after.transfer_amount, 200000);
  assert.equal(after.total, 300000 + 200000);
  // Aynı kademede kalınca transfer değişmez.
  const again = await s.workflow.removePassengers(r.reference, [3]);
  assert.equal(again.transfer.amount, 200000);
  assert.equal(again.total, 200000 + 200000);
});

test("TL indirim kalan bedeli aşmaz; yüzde indirim yeniden hesaplanır", async (t) => {
  const { s } = await setup(t);
  const d = await departure(s);
  const fixed = await booking(s, d, [1, 2]);
  await s.db.update(
    "reservations",
    { _id: fixed.id },
    { discount_amount: 150000, total: 50000, deposit: 15000 },
  );
  const a = await s.workflow.removePassengers(fixed.reference, [2]);
  assert.equal(a.discount_amount, 100000);
  assert.equal(a.total, 0);

  const pct = await booking(s, d, [3, 4, 5, 6]);
  await s.db.update(
    "reservations",
    { _id: pct.id },
    { discount_amount: 40000, discount_percent: 10, total: 360000, deposit: 108000 },
  );
  const b = await s.workflow.removePassengers(pct.reference, [6]);
  assert.equal(b.discount_amount, 30000);
  assert.equal(b.total, 270000);
});

test("geçersiz yolcu çıkarma istekleri reddedilir", async (t) => {
  const { s } = await setup(t);
  const d = await departure(s);
  const r = await booking(s, d, [1, 2]);
  const fails = (seats, status) =>
    assert.rejects(s.workflow.removePassengers(r.reference, seats), (e) => e.status === status);
  await fails([1, 2], 400);
  await fails([7], 400);
  await fails([], 400);
  await fails([1, 1], 400);
  await s.workflow.cancel(r.reference);
  await fails([1], 409);
});
