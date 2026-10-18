import { test } from "node:test";
import assert from "node:assert/strict";
import { openStore } from "../server/store.mjs";
import { mongoConfiguration } from "../server/database.mjs";
// Bu testler çark davranışını doğrulanmamış üyelerle sınar; doğrulama kapısı ayrıca test edilir.
const allowUnverifiedWheel = async (s) =>
  s.campaigns.save({ ...(await s.campaigns.get()), requireVerified: false });
async function setup(t, env = {}) {
  let now = Date.parse("2026-10-17T06:00:00Z");
  const s = await openStore(":memory:", { clock: () => now, env });
  await allowUnverifiedWheel(s);
  t.after(() => s.db.close());
  return { s, advance: (ms) => (now += ms) };
}
const member = (s, email = "test@example.com", extra = {}) =>
  s.members.register({
    name: "Test Yolcu",
    email,
    password: "test-password-123",
    ...extra,
  });
async function departure(s, extra = {}) {
  return s.departures.save({
    tourId: "ani-cildir",
    date: "2026-10-17",
    startTime: "12:30",
    pickup: "Kars Garı",
    guideName: "Rehber",
    guidePhone: "05550000000",
    price: 123400,
    vehicleModel: "vip-minibus",
    passengerSeats: 9,
    active: true,
    ...extra,
  });
}
async function booking(s, d, m = null, seat = 1, extra = {}) {
  const h = await s.hold(d.id, [seat]);
  return s.reserve({
    holdToken: h.token,
    name: m?.name || "Test Yolcu",
    email: m?.email || "guest@example.com",
    phone: "05550000000",
    passengers: ["Test Yolcu"],
    paymentMode: "deposit",
    ...(m ? { memberId: m.id } : {}),
    ...extra,
  });
}
const pay = (s, r, amount = r.total, ref = "TEST-BANK-001", kind = "payment") =>
  s.workflow.payment(r.reference, {
    amount,
    method: "bank_transfer",
    externalReference: ref,
    kind,
  });
test("Mongo connection string is validated without echoing credentials", () => {
  assert.equal(
    mongoConfiguration({
      MONGODB_URI: "mongodb://app:secret@mongodb.railway.internal:27017/rota?replicaSet=rs0&authSource=admin",
    }).uri.startsWith("mongodb://"),
    true,
  );
  assert.equal(mongoConfiguration({ MONGO_URL: "mongodb+srv://x/y" }).uri, "mongodb+srv://x/y");
  // Railway şablonunun düz MONGO_URL'ine replica set ve authSource eklenir.
  const railway = new URL(
    mongoConfiguration({ MONGO_URL: "mongodb://mongo:p%40ss@mongodb.railway.internal:27017" }).uri,
  );
  assert.equal(railway.searchParams.get("replicaSet"), "rs0");
  assert.equal(railway.searchParams.get("authSource"), "admin");
  assert.equal(decodeURIComponent(railway.password), "p@ss");
  const parts = new URL(
    mongoConfiguration({ MONGOHOST: "mongodb.railway.internal", MONGOPORT: "27017", MONGOUSER: "mongo", MONGOPASSWORD: "a/b" }).uri,
  );
  assert.equal(parts.hostname, "mongodb.railway.internal");
  assert.equal(decodeURIComponent(parts.password), "a/b");
  // Açıkça verilen parametreler korunur; yerel directConnection adresine replicaSet zorlanmaz.
  assert.equal(
    new URL(mongoConfiguration({ MONGODB_URI: "mongodb://127.0.0.1:27017/?directConnection=true" }).uri).searchParams.get("replicaSet"),
    null,
  );
  assert.throws(
    () => mongoConfiguration({ MONGODB_URI: "${{MongoDB.MONGO_URL}}" }),
    /çözülmemiş/,
  );
  assert.throws(
    () => mongoConfiguration({ MONGODB_URI: "postgres://user:secret@host/db" }),
    (e) => !String(e.message).includes("secret"),
  );
});
test("per-date VIP capacity overrides tour template, locks protect plan and closure blocks sales", async (t) => {
  const { s } = await setup(t),
    d = await departure(s);
  assert.equal(d.vehicle.sellableSeats, 8);
  assert.equal((await s.availability(d.id)).seats.length, 8);
  await assert.rejects(s.hold(d.id, [9]), (e) => e.status === 400);
  await booking(s, d);
  await assert.rejects(
    departure(s, { id: d.id, price: 133400 }),
    (e) => e.status === 409,
  );
  await departure(s, { id: d.id, active: false });
  await assert.rejects(s.hold(d.id, [2]), (e) => e.status === 409);
});
test("manual ledger requires funds for confirmation, deduplicates references, caps refunds and never calls POS", async (t) => {
  const { s } = await setup(t),
    d = await departure(s),
    r = await booking(s, d);
  await assert.rejects(
    s.workflow.confirm(r.reference),
    (e) => e.status === 409,
  );
  await pay(s, r, r.deposit);
  await pay(s, r, r.deposit);
  let updated = await s.workflow.confirm(r.reference);
  assert.equal(updated.status, "confirmed");
  assert.equal(updated.net_paid, r.deposit);
  assert.equal(updated.ledger.length, 1);
  await assert.rejects(pay(s, r, r.total, "OVERPAY"), (e) => e.status === 409);
  await assert.rejects(
    pay(s, r, r.deposit + 1, "BAD-REFUND", "refund"),
    (e) => e.status === 409,
  );
  updated = await s.cancel(r.reference, r.email);
  assert.equal(updated.status, "confirmed");
  assert.ok(updated.cancellation_requested_at);
  assert.equal((await s.availability(d.id)).seats[0].status, "occupied");
  await s.workflow.cancel(r.reference);
  await pay(s, r, r.deposit, "REFUND-001", "refund");
  updated = await s.workflow.get(r.reference);
  assert.equal(updated.payment_state, "refunded");
  assert.equal(updated.net_paid, 0);
});
test("moving with collision rolls back old seats, successful move reprices and queues updates", async (t) => {
  const { s } = await setup(t),
    d = await departure(s),
    d2 = await departure(s, {
      date: "2026-10-18",
      price: 140000,
      pickup: "Kars Merkez",
    }),
    r = await booking(s, d);
  await booking(s, d2, null, 2);
  await assert.rejects(
    s.workflow.move(r.reference, { departureId: d2.id, seats: [2] }),
    (e) => e.status === 409,
  );
  assert.equal((await s.workflow.get(r.reference)).departure_id, d.id);
  assert.equal((await s.availability(d.id)).seats[0].status, "occupied");
  const moved = await s.workflow.move(r.reference, {
    departureId: d2.id,
    seats: [3],
  });
  assert.equal(moved.total, 140000);
  assert.equal(moved.deposit, 42000);
  assert.equal((await s.availability(d.id)).seats[0].status, "available");
  assert.equal(
    (await s.notifications.list()).items.filter(
      (n) => n.kind === "reservation_moved",
    ).length,
    1,
  );
});
test("default referral rewards only completed fully paid tour; QR omits PII and check-in is idempotent", async (t) => {
  const { s } = await setup(t),
    inviter = await member(s),
    friend = await member(s, "friend@example.com", {
      referralCode: inviter.referralCode,
    }),
    d = await departure(s),
    r = await booking(s, d, friend);
  assert.equal((await s.workflow.ticket(r.ticket_token)).valid, false);
  await pay(s, r);
  await s.workflow.confirm(r.reference);
  assert.equal((await s.members.dashboard(inviter.id)).coupons.length, 0);
  let info = await s.workflow.ticket(r.ticket_token);
  assert.equal(info.valid, true);
  assert.equal(info.email, undefined);
  assert.equal(info.name, undefined);
  await s.workflow.checkIn(r.ticket_token);
  await s.workflow.checkIn(r.ticket_token);
  assert.equal(
    (await s.workflow.audit(r.reference)).filter(
      (a) => a.event === "checked_in",
    ).length,
    1,
  );
  await s.workflow.complete(r.reference);
  await s.workflow.complete(r.reference);
  assert.equal((await s.members.dashboard(friend.id)).coupons.length, 1);
  assert.equal((await s.members.dashboard(inviter.id)).coupons[0].percent, 10);
  assert.equal(
    (await s.notifications.list()).items.filter(
      (n) => n.kind === "review_request",
    ).length,
    1,
  );
});
test("campaign policy is snapshotted, minimum and eligible tour enforced; verification gate works", async (t) => {
  const { s } = await setup(t),
    m = await member(s);
  await s.campaigns.save({
    ...(await s.campaigns.get()),
    sectors: [15, 15, 15, 15, 15, 15],
    minTotal: 200000,
    tourIds: ["ani-cildir"],
    validDays: 7,
  });
  const c = (await s.members.spin(m.id)).coupon;
  assert.equal(c.percent, 15);
  await assert.rejects(
    s.members.priceCoupon(m.id, c.id, 100000, "ani-cildir"),
    (e) => e.status === 400,
  );
  await assert.rejects(
    s.members.priceCoupon(m.id, c.id, 300000, "van-havzasi"),
    (e) => e.status === 400,
  );
  assert.equal(
    (await s.members.priceCoupon(m.id, c.id, 300000, "ani-cildir")).discount,
    45000,
  );
  await s.campaigns.save({
    ...(await s.campaigns.get()),
    requireVerified: true,
    minTotal: 0,
    tourIds: [],
  });
  await assert.rejects(
    s.members.priceCoupon(m.id, c.id, 300000, "ani-cildir"),
    (e) => e.status === 403,
  );
});
test("account verification and reset are purpose-bound, hashed, single-use, expire and revoke sessions", async (t) => {
  const { s, advance } = await setup(t),
    m = await member(s),
    session = await s.members.session(m.id);
  await s.accountSecurity.requestVerification(m, "https://example.com");
  let msgs = (await s.notifications.list()).items;
  const vt = new URL(
    msgs.find((x) => x.kind === "auth_verify").action_url,
  ).searchParams.get("token");
  assert.notEqual(
    (await s.db.one("account_tokens")).token_hash,
    vt,
  );
  await assert.rejects(
    s.accountSecurity.reset(vt, "new-password-123"),
    (e) => e.status === 410,
  );
  await s.accountSecurity.verify(vt);
  await assert.rejects(s.accountSecurity.verify(vt), (e) => e.status === 410);
  assert.equal((await s.members.dashboard(m.id)).member.emailVerified, true);
  assert.deepEqual(
    await s.accountSecurity.requestReset(
      "unknown@example.com",
      "https://example.com",
    ),
    await s.accountSecurity.requestReset(m.email, "https://example.com"),
  );
  msgs = (await s.notifications.list()).items;
  const rt = new URL(
    msgs.find((x) => x.kind === "auth_reset").action_url,
  ).searchParams.get("token");
  await s.accountSecurity.reset(rt, "new-password-123");
  assert.equal(await s.members.fromSession(session), null);
  assert.ok(await s.members.login(m.email, "new-password-123"));
  await assert.rejects(
    s.accountSecurity.reset(rt, "other-password-123"),
    (e) => e.status === 410,
  );
  await s.accountSecurity.requestReset(m.email, "https://example.com");
  const token = new URL(
    (await s.notifications.list()).items
      .filter((x) => x.kind === "auth_reset")
      .at(-1).action_url,
  ).searchParams.get("token");
  advance(3600001);
  await assert.rejects(
    s.accountSecurity.reset(token, "next-password-123"),
    (e) => e.status === 410,
  );
});
test("notification queue stays unsent without SMTP, retries and deduplicates scheduled reminders", async (t) => {
  const { s, advance } = await setup(t),
    d = await departure(s),
    r = await booking(s, d);
  await pay(s, r);
  await s.workflow.confirm(r.reference);
  await s.workflow.reminders();
  await s.workflow.reminders();
  assert.equal(
    (await s.notifications.list()).items.filter(
      (n) => n.kind === "departure_reminder",
    ).length,
    1,
  );
  assert.equal((await s.notifications.processBatch()).configured, false);
  assert.ok(
    (await s.notifications.list()).items.every((n) => n.status === "queued"),
  );
  await s.notifications.processBatch({
    send: async () => {
      throw new Error("provider secret");
    },
  });
  assert.ok(
    (await s.notifications.list()).items.every(
      (n) =>
        n.attempts === 1 &&
        n.status === "queued" &&
        !n.last_error.includes("secret"),
    ),
  );
  advance(120001);
  let deliveries = 0;
  await s.notifications.processBatch({
    send: async () => {
      deliveries++;
    },
  });
  assert.equal(deliveries, 3);
  assert.ok(
    (await s.notifications.list()).items.every((n) => n.status === "sent"),
  );
});
test("daily report reconciles collections and passenger CSV escapes spreadsheet formulas", async (t) => {
  const { s } = await setup(t),
    d = await departure(s),
    r = await booking(s, d, null, 1, { passengers: ['=HYPERLINK("bad")'] });
  await pay(s, r);
  await s.workflow.confirm(r.reference);
  const report = await s.workflow.report(d.date);
  assert.equal(report.netCollected, r.total);
  assert.equal(report.guests, 1);
  assert.match(await s.workflow.manifest(d.id), /'=HYPERLINK/);
});

test("expired pre-reservation cannot be revived by recording a late manual payment", async (t) => {
  const { s, advance } = await setup(t),
    d = await departure(s),
    r = await booking(s, d);
  advance(86400001);
  await assert.rejects(pay(s, r), (e) => e.status === 409);
  assert.equal((await s.workflow.get(r.reference)).status, "expired");
  assert.equal((await s.workflow.ticket(r.ticket_token)).valid, false);
});
test("agency inbox gets alerts for new bookings, cancellations and leads; wheel needs verified email by default", async (t) => {
  const { defaultCampaign } = await import("../server/campaigns.mjs");
  assert.equal(defaultCampaign.requireVerified, true);
  const { s } = await setup(t, { AGENCY_EMAIL: "ops@rotakars.test, bad-address" });
  const [d] = await s.listDepartures("ani-cildir");
  const r = await booking(s, d);
  await s.cancel(r.reference, "guest@example.com");
  await s.request("private-tour", { name: "Ayşe", phone: "05551112233", note: "6 kişi" });
  const agency = (await s.notifications.list()).items.filter((n) => n.kind.startsWith("agency_"));
  assert.deepEqual(
    agency.map((n) => n.kind).sort(),
    ["agency_cancellation_requested", "agency_request_private-tour", "agency_reservation_created"],
  );
  assert.ok(agency.every((n) => n.recipient === "ops@rotakars.test"));
  const created = agency.find((n) => n.kind === "agency_reservation_created");
  assert.match(created.body, /guest@example\.com/);
  assert.match(created.body, /wa\.me\/905550000000/);
});
