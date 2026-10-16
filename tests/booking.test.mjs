import { test } from "node:test";
import assert from "node:assert/strict";
import { openStore } from "../server/store.mjs";
const base = Date.UTC(2026, 9, 16, 12);
function fixture() {
  let now = base;
  const s = openStore(":memory:", { clock: () => now });
  return {
    s,
    id: s.listDepartures("ani-cildir")[0].id,
    tick: (n) => (now += n),
  };
}
const person = (holdToken) => ({
  holdToken,
  name: "Test Yolcu",
  email: "TEST@example.com",
  phone: "05550000000",
  passengers: ["Birinci Yolcu"],
  paymentMode: "deposit",
});
test("18+1 model has guide excluded and exactly seventeen sellable seats", () => {
  const { s, id } = fixture();
  try {
    const a = s.availability(id);
    assert.equal(a.vehicle.passengerSeats, 18);
    assert.equal(a.vehicle.driverSeats, 1);
    assert.equal(a.vehicle.guideSeats, 1);
    assert.equal(a.seats.length, 17);
    assert.equal(a.vehicle.layout[0][3], "guide");
    for (const seats of [[0], [18], ["guide"], ["driver"], [1, 1], [], [1.5]])
      assert.throws(
        () => s.hold(id, seats),
        (e) => e.status === 400,
      );
  } finally {
    s.db.close();
  }
});
test("competing holds reject an already locked seat atomically", () => {
  const { s, id } = fixture();
  try {
    s.hold(id, [1]);
    assert.throws(
      () => s.hold(id, [2, 1]),
      (e) => e.status === 409,
    );
    assert.equal(
      s.availability(id).seats.find((x) => x.number === 2).status,
      "available",
    );
    assert.equal(s.listDepartures("ani-cildir")[0].available, 16);
  } finally {
    s.db.close();
  }
});
test("expired hold releases seats and cannot become a reservation", () => {
  const { s, id, tick } = fixture();
  try {
    const h = s.hold(id, [1]);
    tick(10 * 60 * 1000 + 1);
    assert.equal(s.availability(id).seats[0].status, "available");
    assert.throws(
      () => s.reserve(person(h.token)),
      (e) => e.status === 410,
    );
    assert.ok(s.hold(id, [1]));
  } finally {
    s.db.close();
  }
});
test("price uses server amount, deposit is correct, replay is rejected", () => {
  const { s, id } = fixture();
  try {
    const h = s.hold(id, [1, 2]);
    const r = s.reserve({
      ...person(h.token),
      passengers: ["Birinci Yolcu", "İkinci Yolcu"],
      total: 1,
    });
    assert.equal(r.total, 200000);
    assert.equal(r.deposit, 60000);
    assert.equal(r.status, "pending_agency");
    assert.equal(
      s.lookup(r.reference, "test@example.com").reference,
      r.reference,
    );
    assert.throws(
      () =>
        s.reserve({
          ...person(h.token),
          passengers: ["Birinci Yolcu", "İkinci Yolcu"],
        }),
      (e) => e.status === 410,
    );
    assert.equal(s.availability(id).seats[0].status, "occupied");
  } finally {
    s.db.close();
  }
});
test("each selected seat needs a passenger, validation does not lose the hold", () => {
  const { s, id } = fixture();
  try {
    const h = s.hold(id, [1, 2]);
    assert.throws(
      () => s.reserve(person(h.token)),
      (e) => e.status === 400,
    );
    assert.ok(
      s.reserve({
        ...person(h.token),
        passengers: ["Birinci Yolcu", "İkinci Yolcu"],
      }),
    );
  } finally {
    s.db.close();
  }
});
test("lookup requires matching email, cancellation releases seats, pending request expires", () => {
  const { s, id, tick } = fixture();
  try {
    let r = s.reserve(person(s.hold(id, [1]).token));
    assert.throws(
      () => s.lookup(r.reference, "wrong@example.com"),
      (e) => e.status === 404,
    );
    assert.equal(s.cancel(r.reference, r.email).status, "cancelled");
    assert.equal(s.availability(id).seats[0].status, "available");
    r = s.reserve(person(s.hold(id, [1]).token));
    tick(24 * 3600 * 1000 + 1);
    assert.equal(s.lookup(r.reference, r.email).status, "expired");
    assert.equal(s.availability(id).seats[0].status, "available");
  } finally {
    s.db.close();
  }
});
test("hotels are unpublished by default and only active partners appear", () => {
  const { s } = fixture();
  try {
    const h = {
      name: "Test Oteli",
      location: "Kars",
      description: "Yalnızca test kaydı",
      amenities: ["Wi-Fi"],
      active: false,
    };
    const { id } = s.upsertHotel(h);
    assert.equal(s.hotels().length, 0);
    s.upsertHotel({ ...h, id, active: true });
    assert.equal(s.hotels().length, 1);
    s.upsertHotel({ ...h, id, active: false });
    assert.equal(s.hotels().length, 0);
  } finally {
    s.db.close();
  }
});
