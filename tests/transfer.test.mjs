// Tura eklenen transfer: tur bazında panelden yönetilen grup fiyatı (1 / 2–4 / 5+ kişi),
// geliş, dönüş veya gidiş-dönüş. Toplam, kapora, ön bilgi formu ve taşıma bu bedeli içerir.
import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app.mjs";
import { openStore } from "../server/store.mjs";
import { emptyTransfer, tierFor, priceTransfer } from "../server/transfer.mjs";

const config = () => {
  const c = emptyTransfer();
  c.enabled = true;
  c.oneWay.airport = { 1: 60000, "2-4": 90000, "5+": 140000 };
  c.roundTrip.airport = { 1: 110000, "2-4": 170000, "5+": 260000 };
  c.oneWay.bus = { 1: 30000, "2-4": 45000, "5+": null }; // kalabalık grup için otogar yok
  return c;
};

async function fixture(t) {
  let now = Date.UTC(2026, 9, 16, 12);
  const store = await openStore(":memory:", { clock: () => now });
  const env = { ADMIN_PASSWORD: "ilk-kurulum-parolasi", SITE_URL: "https://rotakarsturizm.com" };
  const app = createApp(store, { env, reviewsService: { get: async () => ({ status: "not_configured", reviews: [] }) } });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await store.db.close();
  });
  const root = `http://127.0.0.1:${server.address().port}`;
  let cookie = "";
  const call = async (path, body) => {
    const r = await fetch(root + "/api" + path, {
      method: body ? "POST" : "GET",
      body: body ? JSON.stringify(body) : undefined,
      headers: { "Content-Type": "application/json", "X-Rota-Client": "web", ...(cookie ? { Cookie: cookie } : {}) },
    });
    const setCookie = r.headers.get("set-cookie");
    if (setCookie && path === "/admin/login") cookie = setCookie.split(";")[0];
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  await call("/admin/login", { password: "ilk-kurulum-parolasi" });
  const [d] = await store.listDepartures("ani-cildir");
  return { store, call, d, tick: (n) => (now += n) };
}

test("tiers follow the party size", () => {
  assert.equal(tierFor(1).id, "1");
  assert.equal(tierFor(2).id, "2-4");
  assert.equal(tierFor(4).id, "2-4");
  assert.equal(tierFor(5).id, "5+");
  assert.equal(tierFor(30).id, "5+");
  const p = priceTransfer(config(), { point: "airport", direction: "both", info: "TK2690 10:40" }, 3);
  assert.deepEqual([p.amount, p.tier, p.pointLabel], [170000, "2-4", "Kars Harakani Havalimanı"]);
});

test("panel saves the per-tour table; the catalog exposes it", async (t) => {
  const { call } = await fixture(t);
  assert.equal((await call("/catalog")).json.tours.find((x) => x.id === "ani-cildir").transfer.enabled, false);
  const saved = await call("/admin/operations/ani-cildir/transfer", config());
  assert.equal(saved.status, 200, JSON.stringify(saved.json));
  const tour = (await call("/catalog")).json.tours.find((x) => x.id === "ani-cildir");
  assert.equal(tour.transfer.enabled, true);
  assert.equal(tour.transfer.oneWay.airport["2-4"], 90000);
  // Başka tura dokunulmaz; geçersiz fiyat reddedilir.
  assert.equal((await call("/catalog")).json.tours.find((x) => x.id === "sarikamis").transfer.enabled, false);
  const bad = config();
  bad.oneWay.airport["1"] = -5;
  assert.equal((await call("/admin/operations/ani-cildir/transfer", bad)).status, 400);
  assert.equal((await call("/admin/operations/yok/transfer", config())).status, 400);
});

test("quote adds the group price on top of the (coupon-free) tour total", async (t) => {
  const { call, d } = await fixture(t);
  await call("/admin/operations/ani-cildir/transfer", config());
  const plain = (await call("/reservations/quote", { departureId: d.id, count: 2 })).json;
  const withTransfer = await call("/reservations/quote", {
    departureId: d.id,
    count: 2,
    transfer: { point: "airport", direction: "arrival", info: "" },
  });
  assert.equal(withTransfer.status, 200, JSON.stringify(withTransfer.json));
  assert.equal(withTransfer.json.transfer.amount, 90000);
  assert.equal(withTransfer.json.total, plain.total + 90000);
  assert.equal(withTransfer.json.deposit, Math.round((plain.total + 90000) * 0.3));
  // Fiyatı olmayan nokta/kademe ve kapalı transfer reddedilir.
  const noBus = await call("/reservations/quote", {
    departureId: d.id,
    count: 2,
    transfer: { point: "train", direction: "arrival" },
  });
  assert.equal(noBus.status, 400);
  const off = config();
  off.enabled = false;
  await call("/admin/operations/ani-cildir/transfer", off);
  assert.equal(
    (await call("/reservations/quote", { departureId: d.id, count: 2, transfer: { point: "airport", direction: "arrival" } })).status,
    400,
  );
});

test("reservation stores the transfer, totals include it and a move keeps it", async (t) => {
  const { store, call, d } = await fixture(t);
  await call("/admin/operations/ani-cildir/transfer", config());
  const h = await store.hold(d.id, [1, 2]);
  const r = await store.reserve({
    holdToken: h.token,
    name: "Transfer Yolcu",
    email: "transfer@example.com",
    phone: "05550000000",
    passengers: ["Bir Yolcu", "İki Yolcu"],
    paymentMode: "deposit",
    transfer: { point: "airport", direction: "both", info: "TK2690 · 10:40" },
    legal: { onlinePayment: false, depositPercent: 30, othersDeclared: true },
  });
  assert.equal(r.transfer.amount, 170000);
  assert.equal(r.transfer_amount, 170000);
  assert.equal(r.total, d.price * 2 + 170000);
  assert.equal(r.deposit, Math.round(r.total * 0.3));
  const stored = await store.workflow.get(r.reference);
  assert.match(stored.pre_info_text, /Transfer: Kars Harakani Havalimanı · Gidiş-dönüş · 2–4 kişi · TK2690 · 10:40/);
  const outbox = await store.db.find("notification_outbox", {});
  assert.ok(outbox.some((m) => /Transfer: Kars Harakani Havalimanı/.test(m.body)), "e-posta ve acente bildirimi transferi içerir");

  // Başka sefere taşınınca transfer bedeli korunur.
  const [, next] = await store.listDepartures("ani-cildir");
  const moved = await store.workflow.move(r.reference, { departureId: next.id, seats: [5, 6] });
  assert.equal(moved.total, next.price * 2 + 170000);
  assert.equal(moved.transfer.amount, 170000);
});
