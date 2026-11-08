import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { openStore } from "../server/store.mjs";
import { createApp } from "../server/app.mjs";
import { paymentConfig } from "../server/payments.mjs";
async function fixture(t, env) {
  const store = await openStore(":memory:");
  const server = createApp(store, { env }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await store.db.close();
  });
  const base = "http://127.0.0.1:" + server.address().port + "/api";
  const req = (path, body) =>
    fetch(base + path, {
      ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
      headers: { "Content-Type": "application/json", "X-Rota-Client": "web" },
    });
  const d = (await store.listDepartures("ani-cildir"))[0];
  const h = await store.hold(d.id, [2]);
  const r = await store.reserve({
    holdToken: h.token,
    name: "Ayşe Yılmaz",
    email: "ayse@example.com",
    phone: "05551112233",
    passengers: ["Ayşe Yılmaz"],
    paymentMode: "deposit",
  });
  return { store, req, r };
}
test("deneme sağlayıcısı üretimde açılmaz", () => {
  assert.equal(paymentConfig({}).enabled, false);
  assert.equal(paymentConfig({ PAYMENT_PROVIDER: "test" }).test, true);
  assert.equal(
    paymentConfig({ PAYMENT_PROVIDER: "test", NODE_ENV: "production" }).enabled,
    false,
  );
});
test("ödeme kapalıyken başlatılamaz", async (t) => {
  const { req, r } = await fixture(t, {});
  const res = await req("/payments/start", {
    reference: r.reference,
    email: "ayse@example.com",
  });
  assert.equal(res.status, 503);
  assert.equal(
    (
      await req("/payments/test/" + "a".repeat(48) + "/result", {
        result: "paid",
      })
    ).status,
    404,
  );
});
test("kapora ödenince tahsilat kaydedilir ve rezervasyon otomatik onaylanır", async (t) => {
  const { req, r, store } = await fixture(t, { PAYMENT_PROVIDER: "test" });
  assert.equal(
    (
      await req("/payments/start", {
        reference: r.reference,
        email: "baska@example.com",
      })
    ).status,
    404,
  );
  const start = await (
    await req("/payments/start", {
      reference: r.reference,
      email: "ayse@example.com",
    })
  ).json();
  assert.equal(start.amount, r.deposit);
  const id = start.redirectUrl.split("/").pop();

  // Başarısız deneme: para çekilmez, rezervasyon beklemede kalır.
  const failedStart = await (
    await req("/payments/start", {
      reference: r.reference,
      email: "ayse@example.com",
    })
  ).json();
  const failedId = failedStart.redirectUrl.split("/").pop();
  assert.equal(
    (
      await (
        await req(`/payments/test/${failedId}/result`, { result: "failed" })
      ).json()
    ).status,
    "failed",
  );
  assert.equal(
    (await store.workflow.get(r.reference)).status,
    "pending_agency",
  );

  const done = await (
    await req(`/payments/test/${id}/result`, { result: "paid" })
  ).json();
  assert.equal(done.status, "paid");
  const after = await store.workflow.get(r.reference);
  assert.equal(after.status, "confirmed");
  assert.equal(after.net_paid, r.deposit);
  // Aynı bildirim ikinci kez gelirse çift tahsilat olmaz.
  await req(`/payments/test/${id}/result`, { result: "paid" });
  assert.equal((await store.workflow.get(r.reference)).net_paid, r.deposit);
  const session = await (await req("/payments/sessions/" + id)).json();
  assert.equal(session.status, "paid");
  assert.equal(session.reservationStatus, "confirmed");
  // Ödendikten sonra yeni ödeme başlatılamaz.
  assert.equal(
    (
      await req("/payments/start", {
        reference: r.reference,
        email: "ayse@example.com",
      })
    ).status,
    409,
  );
});
