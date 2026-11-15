// Tura eklenen transfer: tur bazında panelden yönetilen grup fiyatı (1 / 2–3 / 4–6 / 7–15
// kişi), Kars merkez ya da Sarıkamış konaklama yerine; geliş, dönüş veya gidiş-dönüş. Toplam, kapora, ön bilgi formu ve taşıma bu bedeli içerir.
import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app.mjs";
import { openStore } from "../server/store.mjs";
import {
  emptyTransfer,
  tierFor,
  priceTransfer,
  transferLine,
  applyStandardTransfer,
  STANDARD_TRANSFER_RELEASE,
} from "../server/transfer.mjs";

const config = () => {
  const c = emptyTransfer();
  c.enabled = true;
  c.oneWay.kars.airport = {
    1: 60000,
    "2-3": 90000,
    "4-6": 140000,
    "7-15": 200000,
  };
  c.roundTrip.kars.airport = {
    1: 110000,
    "2-3": 170000,
    "4-6": 260000,
    "7-15": 380000,
  };
  c.oneWay.kars.bus = { 1: 30000, "2-3": 45000, "4-6": null, "7-15": null }; // kalabalık grup için otogar yok
  c.oneWay.sarikamis.airport = {
    1: 250000,
    "2-3": 400000,
    "4-6": 500000,
    "7-15": 700000,
  };
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

test("tiers follow the party size; destination picks the table", () => {
  assert.equal(tierFor(1).id, "1");
  assert.equal(tierFor(2).id, "2-3");
  assert.equal(tierFor(3).id, "2-3");
  assert.equal(tierFor(4).id, "4-6");
  assert.equal(tierFor(6).id, "4-6");
  assert.equal(tierFor(7).id, "7-15");
  assert.equal(tierFor(15).id, "7-15");
  assert.equal(tierFor(16), null, "15 kişiden kalabalık gruba kademe yok");
  const p = priceTransfer(
    config(),
    {
      point: "airport",
      destination: "kars",
      direction: "both",
      info: "TK2690 10:40",
    },
    3,
  );
  assert.deepEqual(
    [p.amount, p.tier, p.pointLabel, p.destinationLabel],
    [170000, "2-3", "Kars Harakani Havalimanı", "Kars merkez konaklama yeri"],
  );
  // Varış yeri verilmezse Kars merkez sayılır (eski istemciler).
  assert.equal(
    priceTransfer(config(), { point: "airport", direction: "arrival" }, 1)
      .amount,
    60000,
  );
  const far = priceTransfer(
    config(),
    { point: "airport", destination: "sarikamis", direction: "arrival" },
    5,
  );
  assert.equal(far.amount, 500000);
  assert.match(
    transferLine(far),
    /Kars Harakani Havalimanı ↔ Sarıkamış konaklama yeri · Gelişte/,
  );
  assert.throws(
    () =>
      priceTransfer(
        config(),
        { point: "airport", destination: "kars", direction: "arrival" },
        16,
      ),
    (e) => e.status === 400,
  );
});

test("panel saves the per-tour table; the catalog exposes it", async (t) => {
  const { call } = await fixture(t);
  // Açılışta acentenin standart fiyatları: Kars merkez 400 / 1.000 / 1.800 / 2.500 TL,
  // Sarıkamış 2.500 / 4.000 / 5.000 / 7.000 TL; gidiş-dönüş iki katı, üç noktada aynı.
  const start = (await call("/catalog")).json.tours.find(
    (x) => x.id === "ani-cildir",
  ).transfer;
  assert.equal(start.enabled, true);
  assert.deepEqual(start.oneWay.kars.bus, {
    1: 40000,
    "2-3": 100000,
    "4-6": 180000,
    "7-15": 250000,
  });
  assert.deepEqual(start.oneWay.sarikamis.train, {
    1: 250000,
    "2-3": 400000,
    "4-6": 500000,
    "7-15": 700000,
  });
  assert.deepEqual(start.roundTrip.kars.airport, {
    1: 80000,
    "2-3": 200000,
    "4-6": 360000,
    "7-15": 500000,
  });
  const saved = await call("/admin/operations/ani-cildir/transfer", config());
  assert.equal(saved.status, 200, JSON.stringify(saved.json));
  const tour = (await call("/catalog")).json.tours.find((x) => x.id === "ani-cildir");
  assert.equal(tour.transfer.enabled, true);
  assert.equal(tour.transfer.oneWay.kars.airport["2-3"], 90000);
  // Başka tura dokunulmaz; geçersiz fiyat ve eski biçim (varış yersiz) reddedilir.
  assert.equal(
    (await call("/catalog")).json.tours.find((x) => x.id === "sarikamis")
      .transfer.oneWay.kars.airport["2-3"],
    100000,
  );
  const bad = config();
  bad.oneWay.kars.airport["1"] = -5;
  assert.equal(
    (await call("/admin/operations/ani-cildir/transfer", bad)).status,
    400,
  );
  const legacy = {
    enabled: true,
    oneWay: config().oneWay.kars,
    roundTrip: config().roundTrip.kars,
  };
  assert.equal(
    (await call("/admin/operations/ani-cildir/transfer", legacy)).status,
    400,
  );
  assert.equal(
    (await call("/admin/operations/yok/transfer", config())).status,
    400,
  );
});

test("quote adds the group price on top of the (coupon-free) tour total", async (t) => {
  const { call, d } = await fixture(t);
  await call("/admin/operations/ani-cildir/transfer", config());
  const plain = (await call("/reservations/quote", { departureId: d.id, count: 2 })).json;
  const withTransfer = await call("/reservations/quote", {
    departureId: d.id,
    count: 2,
    transfer: {
      point: "airport",
      destination: "kars",
      direction: "arrival",
      info: "",
    },
  });
  assert.equal(withTransfer.status, 200, JSON.stringify(withTransfer.json));
  const sarikamis = await call("/reservations/quote", {
    departureId: d.id,
    count: 2,
    transfer: {
      point: "airport",
      destination: "sarikamis",
      direction: "arrival",
    },
  });
  assert.equal(sarikamis.json.transfer.amount, 400000);
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
    transfer: {
      point: "airport",
      destination: "kars",
      direction: "both",
      info: "TK2690 · 10:40",
    },
    legal: { onlinePayment: false, depositPercent: 30, othersDeclared: true },
  });
  assert.equal(r.transfer.amount, 170000);
  assert.equal(r.transfer_amount, 170000);
  assert.equal(r.total, d.price * 2 + 170000);
  assert.equal(r.deposit, Math.round(r.total * 0.3));
  const stored = await store.workflow.get(r.reference);
  assert.match(
    stored.pre_info_text,
    /Transfer: Kars Harakani Havalimanı ↔ Kars merkez konaklama yeri · Gidiş-dönüş · 2–3 kişi · TK2690 · 10:40/,
  );
  const outbox = await store.db.find("notification_outbox", {});
  assert.ok(outbox.some((m) => /Transfer: Kars Harakani Havalimanı/.test(m.body)), "e-posta ve acente bildirimi transferi içerir");

  // Başka sefere taşınınca transfer bedeli korunur.
  const [, next] = await store.listDepartures("ani-cildir");
  const moved = await store.workflow.move(r.reference, { departureId: next.id, seats: [5, 6] });
  assert.equal(moved.total, next.price * 2 + 170000);
  assert.equal(moved.transfer.amount, 170000);
});

test("standard prices replace the old table format once, keeping a closed transfer closed", async (t) => {
  const { store, call } = await fixture(t);
  // Eski biçim (varış yeri yok) yeni kodda fiyat üretmez; sürüm bir kez bütün turlara yazılır.
  await store.db.update(
    "tour_operations",
    { _id: "ani-cildir" },
    {
      transfer: {
        enabled: true,
        oneWay: { airport: { 1: 30000 } },
        roundTrip: {},
      },
    },
  );
  await store.db.update(
    "tour_operations",
    { _id: "sarikamis" },
    { transfer: { ...emptyTransfer(), enabled: false } },
  );
  assert.equal(
    (await call("/catalog")).json.tours.find((x) => x.id === "ani-cildir")
      .transfer.enabled,
    false,
    "eski biçim boş sayılır",
  );
  await store.db.remove("integration_settings", {
    _id: STANDARD_TRANSFER_RELEASE,
  });
  const run = await applyStandardTransfer(store.db, {
    clock: () => Date.now(),
  });
  assert.ok(run.applied >= 2);
  const tours = (await call("/catalog")).json.tours;
  const ani = tours.find((x) => x.id === "ani-cildir").transfer;
  assert.equal(ani.enabled, true);
  assert.equal(ani.oneWay.kars.airport["1"], 40000);
  assert.equal(ani.oneWay.sarikamis.bus["7-15"], 700000);
  const sarikamis = tours.find((x) => x.id === "sarikamis").transfer;
  assert.equal(
    sarikamis.enabled,
    false,
    "panelden kapatılan transfer kapalı kalır",
  );
  assert.equal(sarikamis.oneWay.kars.train["2-3"], 100000);
  await call("/admin/operations/ani-cildir/transfer", config());
  assert.equal(
    (await applyStandardTransfer(store.db, { clock: () => Date.now() }))
      .applied,
    0,
    "bir kez çalışır",
  );
  assert.equal(
    (await call("/catalog")).json.tours.find((x) => x.id === "ani-cildir")
      .transfer.oneWay.kars.airport["2-3"],
    90000,
  );
});
