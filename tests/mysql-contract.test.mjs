import { test } from "node:test";
import assert from "node:assert/strict";
import { openStore } from "../server/store.mjs";
import { randomUUID } from "node:crypto";
import { localDate } from "../server/departures.mjs";
const url = process.env.MYSQL_TEST_URL;
test(
  "MySQL: independent store instances serialize seats, preserve data and complete booking/account workflows",
  { skip: !url },
  async (t) => {
    const parsed = new URL(url);
    if (!/^rota_test(?:_[a-z0-9_]+)?$/.test(parsed.pathname.slice(1)))
      throw new Error("Only a dedicated rota_test database may be used");
    const env = { MYSQL_URL: url, NODE_ENV: "test" },
      s = await openStore(undefined, { env, seed: false });
    let other;
    t.after(async () => {
      if (other) await other.db.close();
      await s.db.close();
    });
    const suffix = randomUUID().slice(0, 8),
      date = localDate(Date.now()),
      d = await s.departures.save({
        tourId: "ani-cildir",
        date,
        startTime: "18:00",
        price: 123400,
        pickup: "Test Kars Garı",
        guideName: "Test rehber",
        guidePhone: "05550000000",
        vehicleModel: "vip-minibus",
        passengerSeats: 9,
        active: true,
      });
    other = await openStore(undefined, { env, seed: false });
    const results = await Promise.allSettled([
      s.hold(d.id, [1]),
      other.hold(d.id, [1]),
    ]);
    assert.equal(
      results.filter((r) => r.status === "fulfilled").length,
      1,
      JSON.stringify(results.map((r) => r.reason?.message || "fulfilled")),
    );
    assert.equal(
      results.find((r) => r.status === "rejected").reason.status,
      409,
    );
    const h = results.find((r) => r.status === "fulfilled").value;
    const m = await s.members.register({
        name: "Test Yolcu",
        email: suffix + "@example.com",
        password: "test-password-123",
      }),
      c = (await s.members.spin(m.id)).coupon;
    const r = await s.reserve({
      holdToken: h.token,
      name: m.name,
      email: m.email,
      phone: "05550000000",
      passengers: ["Test Yolcu"],
      paymentMode: "deposit",
      memberId: m.id,
      couponId: c.id,
    });
    assert.equal(r.total, 123400 - Math.round((123400 * c.percent) / 100));
    await other.workflow.payment(r.reference, {
      amount: r.total,
      method: "bank_transfer",
      externalReference: "MYSQL-" + suffix,
    });
    await s.workflow.confirm(r.reference);
    assert.equal((await other.workflow.get(r.reference)).status, "confirmed");
    assert.equal((await s.workflow.ticket(r.ticket_token)).valid, true);
    await s.accountSecurity.requestVerification(m, "https://test.example.com");
    const message = (await s.notifications.list()).items.find(
        (n) => n.recipient === m.email && n.kind === "auth_verify",
      ),
      token = new URL(message.action_url).searchParams.get("token");
    await other.accountSecurity.verify(token);
    assert.equal((await s.members.dashboard(m.id)).member.emailVerified, true);
    assert.match(await s.workflow.manifest(d.id), /Test Yolcu/);
    await other.workflow.complete(r.reference);
    assert.equal((await s.workflow.get(r.reference)).status, "completed");
    assert.ok((await s.workflow.report(date)).netCollected >= r.total);
    assert.equal(s.db.dialect, "mysql");
  },
);
