import { test } from "node:test";
import assert from "node:assert/strict";
import { openStore } from "../server/store.mjs";
const base = Date.UTC(2026, 9, 16, 12);
async function fixture() {
  let now = base;
  const s = await openStore(":memory:", {
    clock: () => now,
  });
  return {
    s,
    id: (await s.listDepartures("ani-cildir"))[0].id,
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
test("18+1 model has guide excluded and exactly seventeen sellable seats", async () => {
  const { s, id } = await fixture();
  try {
    const a = await s.availability(id);
    assert.equal(a.vehicle.passengerSeats, 18);
    assert.equal(a.vehicle.driverSeats, 1);
    assert.equal(a.vehicle.guideSeats, 1);
    assert.equal(a.seats.length, 17);
    assert.equal(a.vehicle.layout[0][3], "guide");
    for (const seats of [[0], [18], ["guide"], ["driver"], [1, 1], [], [1.5]])
      await assert.rejects(
        async () => await s.hold(id, seats),
        (e) => e.status === 400,
      );
  } finally {
    await s.db.close();
  }
});
test("competing holds reject an already locked seat atomically", async () => {
  const { s, id } = await fixture();
  try {
    await s.hold(id, [1]);
    await assert.rejects(
      async () => await s.hold(id, [2, 1]),
      (e) => e.status === 409,
    );
    assert.equal(
      (await s.availability(id)).seats.find((x) => x.number === 2).status,
      "available",
    );
    assert.equal((await s.listDepartures("ani-cildir"))[0].available, 16);
  } finally {
    await s.db.close();
  }
});
test("expired hold releases seats and cannot become a reservation", async () => {
  const { s, id, tick } = await fixture();
  try {
    const h = await s.hold(id, [1]);
    tick(10 * 60 * 1000 + 1);
    assert.equal((await s.availability(id)).seats[0].status, "available");
    await assert.rejects(
      async () => await s.reserve(person(h.token)),
      (e) => e.status === 410,
    );
    assert.ok(await s.hold(id, [1]));
  } finally {
    await s.db.close();
  }
});
test("price uses server amount, deposit is correct, replay is rejected", async () => {
  const { s, id } = await fixture();
  try {
    const h = await s.hold(id, [1, 2]);
    const r = await s.reserve({
      ...person(h.token),
      passengers: ["Birinci Yolcu", "İkinci Yolcu"],
      total: 1,
    });
    assert.equal(r.total, 200000);
    assert.equal(r.deposit, 60000);
    assert.equal(r.status, "pending_agency");
    assert.equal(
      (await s.lookup(r.reference, "test@example.com")).reference,
      r.reference,
    );
    await assert.rejects(
      async () =>
        await s.reserve({
          ...person(h.token),
          passengers: ["Birinci Yolcu", "İkinci Yolcu"],
        }),
      (e) => e.status === 410,
    );
    assert.equal((await s.availability(id)).seats[0].status, "occupied");
  } finally {
    await s.db.close();
  }
});
test("each selected seat needs a passenger, validation does not lose the hold", async () => {
  const { s, id } = await fixture();
  try {
    const h = await s.hold(id, [1, 2]);
    await assert.rejects(
      async () => await s.reserve(person(h.token)),
      (e) => e.status === 400,
    );
    assert.ok(
      await s.reserve({
        ...person(h.token),
        passengers: ["Birinci Yolcu", "İkinci Yolcu"],
      }),
    );
  } finally {
    await s.db.close();
  }
});
test("lookup requires matching email, cancellation releases seats, pending request expires", async () => {
  const { s, id, tick } = await fixture();
  try {
    let r = await s.reserve(person((await s.hold(id, [1])).token));
    await assert.rejects(
      async () => await s.lookup(r.reference, "wrong@example.com"),
      (e) => e.status === 404,
    );
    assert.equal((await s.cancel(r.reference, r.email)).status, "cancelled");
    assert.equal((await s.availability(id)).seats[0].status, "available");
    r = await s.reserve(person((await s.hold(id, [1])).token));
    tick(24 * 3600 * 1000 + 1);
    assert.equal((await s.lookup(r.reference, r.email)).status, "expired");
    assert.equal((await s.availability(id)).seats[0].status, "available");
  } finally {
    await s.db.close();
  }
});
test("hotels are unpublished by default and only active partners appear", async () => {
  const { s } = await fixture();
  try {
    const h = {
      name: "Test Oteli",
      location: "Kars",
      description: "Yalnızca test kaydı",
      amenities: ["Wi-Fi"],
      active: false,
    };
    const { id } = await s.upsertHotel(h);
    assert.equal((await s.hotels()).length, 0);
    await s.upsertHotel({
      ...h,
      id,
      active: true,
    });
    assert.equal((await s.hotels()).length, 1);
    await s.upsertHotel({
      ...h,
      id,
      active: false,
    });
    assert.equal((await s.hotels()).length, 0);
  } finally {
    await s.db.close();
  }
});
