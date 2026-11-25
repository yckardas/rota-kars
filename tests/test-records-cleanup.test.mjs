import { test } from "node:test";
import assert from "node:assert/strict";
import { openStore } from "../server/store.mjs";
import { removeTestReservations, TEST_RESERVATIONS } from "../server/corrections.mjs";

const AGENT = { id: "ops-1", role: "operations", name: "Operasyon" };

test("test reservation cleanup: only listed, cancelled/expired, unpaid records go — with their linked data; runs once", async (t) => {
  let now = Date.parse("2026-10-17T06:00:00Z");
  const s = await openStore(":memory:", { clock: () => now });
  t.after(() => s.db.close());
  const d = await s.departures.save({ tourId: "ani-cildir", date: "2026-10-25", startTime: "09:00", pickup: "Kars", guideName: "", guidePhone: "", price: 100000, vehicleModel: "vip-midibus", passengerSeats: 18, active: true });
  const book = (seat, extra = {}) =>
    s.adminReserve({ departureId: d.id, seats: [seat], name: "Kayıt " + seat, phone: "05551112233", email: "kayit@example.com", passengers: ["Kayıt " + seat], paymentMode: "on_tour", confirm: true, ...extra }, AGENT);
  // 1: listede, iptal, ödenip iade edilmiş (net 0) → silinir, bağlı verisiyle.
  const gone = await book(1, { payment: { amount: 5000, method: "cash" } });
  await s.workflow.payment(gone.reference, { amount: 5000, method: "cash", kind: "refund", note: "iade" });
  await s.workflow.cancel(gone.reference, {});
  // 2: listede ama onaylı → dokunulmaz.
  const live = await book(2);
  // 3: listede, iptal ama üzerinde ödeme kalmış → dokunulmaz.
  const paid = await book(3, { payment: { amount: 5000, method: "cash" } });
  await s.workflow.cancel(paid.reference, {});
  // 4: listede değil, iptal → dokunulmaz.
  const other = await book(4);
  await s.workflow.cancel(other.reference, {});
  const goneRow = await s.db.one("reservations", { reference: gone.reference });
  assert.ok((await s.db.count("payment_ledger", { reservation_id: goneRow.id })) > 0);
  assert.ok((await s.db.count("reservation_audit", { reservation_id: goneRow.id })) > 0);

  const list = [gone.reference, live.reference, paid.reference, "RK-YOKBOYLE01"];
  const r = await removeTestReservations(s.db, { clock: () => now, references: list });
  assert.equal(r.applied, true);
  assert.deepEqual(r.removed, [gone.reference]);
  assert.deepEqual(r.skipped.map((x) => x.reference).sort(), [live.reference, paid.reference, "RK-YOKBOYLE01"].sort());
  assert.equal(await s.db.count("reservations", { reference: gone.reference }), 0);
  assert.equal(await s.db.count("payment_ledger", { reservation_id: goneRow.id }), 0);
  assert.equal(await s.db.count("reservation_audit", { reservation_id: goneRow.id }), 0);
  assert.equal(await s.db.count("seat_locks", { owner: gone.reference }), 0);
  for (const ref of [live.reference, paid.reference, other.reference]) assert.equal(await s.db.count("reservations", { reference: ref }), 1, ref);
  // İkinci çalıştırma hiçbir şey yapmaz.
  assert.deepEqual(await removeTestReservations(s.db, { clock: () => now, references: list }), { applied: false });
});

test("the production list holds exactly the 17 records the owner confirmed", () => {
  assert.equal(TEST_RESERVATIONS.length, 17);
  assert.equal(new Set(TEST_RESERVATIONS).size, 17);
  for (const kept of ["RK-264BB35C11", "RK-EFF13EA2AF", "RK-34699F91B9"]) assert.ok(!TEST_RESERVATIONS.includes(kept), kept + " silinmez");
  assert.ok(TEST_RESERVATIONS.every((r) => /^RK-[0-9A-F]{10}$/.test(r)));
});
