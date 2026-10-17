import { test } from "node:test";
import assert from "node:assert/strict";
import { openStore } from "../server/store.mjs";
import { makeVehicle, vehicleModels } from "../server/operations.mjs";
const fixture = async () => {
  let now = Date.now();
  const store = await openStore(":memory:", {
    clock: () => now,
  });
  return {
    store,
    advance: (ms) => {
      now += ms;
    },
  };
};
const register = async (s, email = "member@example.com", extra = {}) =>
  await s.members.register({
    name: "Test Yolcu",
    email,
    password: "test-password-1234",
    ...extra,
  });
async function reserve(s, member, couponId, seat = 1) {
  const d = (await s.listDepartures("ani-cildir"))[0];
  const hold = await s.hold(d.id, [seat]);
  return await s.reserve({
    holdToken: hold.token,
    name: member.name,
    email: member.email,
    phone: "05550000000",
    passengers: ["Test Yolcu"],
    paymentMode: "deposit",
    memberId: member.id,
    couponId,
  });
}
test("membership passwords and session tokens are hashed; login, unique email and logout work", async () => {
  const { store: s } = await fixture();
  try {
    const m = await register(s);
    const token = await s.members.session(m.id);
    assert.equal((await s.members.fromSession(token)).id, m.id);
    assert.notEqual(
      (await s.db.prepare("SELECT token_hash FROM member_sessions").get())
        .token_hash,
      token,
    );
    assert.ok(!JSON.stringify(m).includes("password"));
    assert.notEqual(
      (await s.db.prepare("SELECT password_hash FROM members").get())
        .password_hash,
      "test-password-1234",
    );
    assert.equal(
      (await s.members.login("MEMBER@EXAMPLE.COM", "test-password-1234")).id,
      m.id,
    );
    await assert.rejects(
      async () => await s.members.login(m.email, "wrong"),
      (e) => e.status === 401,
    );
    await assert.rejects(
      async () => await register(s, "MEMBER@EXAMPLE.COM"),
      (e) => e.status === 409,
    );
    await s.members.logout(token);
    assert.equal(await s.members.fromSession(token), null);
  } finally {
    await s.db.close();
  }
});
test("wheel is single-use, prices are server calculated, coupons cannot be shared or spent twice", async () => {
  const { store: s } = await fixture();
  try {
    const m = await register(s),
      other = await register(s, "other@example.com"),
      spin = await s.members.spin(m.id);
    assert.ok([5, 10, 15].includes(spin.coupon.percent));
    await assert.rejects(
      async () => await s.members.spin(m.id),
      (e) => e.status === 409,
    );
    await assert.rejects(
      async () => await s.members.priceCoupon(other.id, spin.coupon.id, 100000),
      (e) => e.status === 409,
    );
    const r = await reserve(s, m, spin.coupon.id);
    assert.equal(r.subtotal, 100000);
    assert.equal(r.total, 100000 - 1000 * spin.coupon.percent);
    assert.equal(r.deposit, Math.round(r.total * 0.3));
    await assert.rejects(
      async () => await reserve(s, m, spin.coupon.id, 2),
      (e) => e.status === 409,
    );
    await s.cancel(r.reference, m.email);
    assert.equal(
      (await s.members.priceCoupon(m.id, spin.coupon.id, 100000)).discount,
      1000 * spin.coupon.percent,
    );
  } finally {
    await s.db.close();
  }
});
test("expired booking restores a valid coupon; expired coupons remain rejected", async () => {
  const { store: s, advance } = await fixture();
  try {
    const m = await register(s),
      c = (await s.members.spin(m.id)).coupon;
    await reserve(s, m, c.id);
    advance(86400001);
    await s.cleanup();
    assert.ok((await s.members.priceCoupon(m.id, c.id, 100000)).discount > 0);
    advance(30 * 86400000);
    await assert.rejects(
      async () => await s.members.priceCoupon(m.id, c.id, 100000),
      (e) => e.status === 409,
    );
  } finally {
    await s.db.close();
  }
});
test("referral grants exactly one 10% coupon to both accounts after verified full payment, never after mere reservation", async () => {
  const { store: s } = await fixture();
  try {
    const inviter = await register(s),
      friend = await register(s, "friend@example.com", {
        referralCode: inviter.referralCode,
      });
    assert.equal((await s.members.dashboard(inviter.id)).coupons.length, 0);
    await s.campaigns.save({
      ...(await s.campaigns.get()),
      referralTrigger: "paid",
    });
    const booking = await reserve(s, friend);
    assert.equal((await s.members.dashboard(inviter.id)).coupons.length, 0);
    await s.workflow.payment(booking.reference, {
      amount: booking.total,
      method: "bank_transfer",
      externalReference: "REFERRAL-TEST",
    });
    assert.equal(
      (await s.members.dashboard(inviter.id)).coupons[0].percent,
      10,
    );
    assert.equal((await s.members.dashboard(friend.id)).coupons[0].percent, 10);
    await reserve(s, friend, undefined, 2);
    assert.equal((await s.members.dashboard(friend.id)).coupons.length, 1);
    assert.equal((await s.members.dashboard(inviter.id)).referrals.rewarded, 1);
    await assert.rejects(
      async () =>
        await register(s, "third@example.com", {
          referralCode: "0000000000",
        }),
      (e) => e.status === 400,
    );
  } finally {
    await s.db.close();
  }
});
test("social identities never silently attach to an existing email account", async () => {
  const { store: s } = await fixture();
  try {
    const m = await register(s);
    await assert.rejects(
      async () =>
        await s.members.social({
          provider: "google",
          subject: "provider-subject",
          email: m.email,
          name: m.name,
        }),
      (e) => e.status === 409,
    );
    assert.equal(
      (
        await s.members.social({
          provider: "google",
          subject: "provider-subject",
          email: m.email,
          name: m.name,
          linkMemberId: m.id,
        })
      ).id,
      m.id,
    );
    assert.equal(
      (
        await s.members.social({
          provider: "google",
          subject: "provider-subject",
          email: m.email,
          name: m.name,
        })
      ).id,
      m.id,
    );
  } finally {
    await s.db.close();
  }
});
test("all vehicle models have exactly the selected sellable capacity and a reserved guide", () => {
  for (const model of vehicleModels)
    for (const n of [model.min, model.seats, model.max]) {
      const v = makeVehicle(model.id, n),
        cells = v.layout.flat(),
        numbers = cells.filter((c) => typeof c === "number");
      assert.equal(numbers.length, n - 1);
      assert.equal(new Set(numbers).size, n - 1);
      assert.deepEqual(
        numbers,
        Array.from(
          {
            length: n - 1,
          },
          (_, i) => i + 1,
        ),
      );
      assert.equal(cells.filter((c) => c === "guide").length, 1);
      assert.equal(cells.filter((c) => c === "driver").length, 1);
    }
  assert.throws(
    () => makeVehicle("vip-minibus", 46),
    (e) => e.status === 400,
  );
});
test("tour capacity changes availability and seat bounds; locked seats block vehicle changes", async () => {
  const { store: s } = await fixture();
  try {
    await s.operations.update("ani-cildir", {
      salesOpen: true,
      vehicleModel: "vip-minibus",
      passengerSeats: 9,
    });
    const d = (await s.listDepartures("ani-cildir"))[0];
    assert.equal(d.available, 8);
    assert.equal((await s.availability(d.id)).seats.length, 8);
    await assert.rejects(
      async () => await s.hold(d.id, [9]),
      (e) => e.status === 400,
    );
    const hold = await s.hold(d.id, [8]);
    await assert.rejects(
      async () =>
        await s.operations.update("ani-cildir", {
          salesOpen: true,
          vehicleModel: "vip-midibus",
          passengerSeats: 18,
        }),
      (e) => e.status === 409,
    );
    await s.operations.update("ani-cildir", {
      salesOpen: false,
      vehicleModel: "vip-minibus",
      passengerSeats: 9,
    });
    assert.deepEqual(await s.listDepartures("ani-cildir"), []);
    await assert.rejects(
      async () =>
        await s.reserve({
          holdToken: hold.token,
          name: "Test",
          email: "test@example.com",
          phone: "05550000000",
          passengers: ["Test"],
          paymentMode: "full",
        }),
      (e) => e.status === 409,
    );
    await s.release(hold.token);
    await s.operations.update("ani-cildir", {
      salesOpen: true,
      vehicleModel: "coach",
      passengerSeats: 46,
    });
    assert.equal((await s.availability(d.id)).seats.length, 45);
  } finally {
    await s.db.close();
  }
});
test("administrator can open an initially inquiry-only tour with seeded departures", async () => {
  const { store: s } = await fixture();
  try {
    assert.deepEqual(await s.listDepartures("van-havzasi"), []);
    await s.operations.update("van-havzasi", {
      salesOpen: true,
      vehicleModel: "vip-midibus",
      passengerSeats: 18,
    });
    assert.equal(
      (await s.operations.list()).find((t) => t.id === "van-havzasi")
        .inquiryOnly,
      false,
    );
    assert.ok((await s.listDepartures("van-havzasi")).length > 0);
  } finally {
    await s.db.close();
  }
});
