// Fiyatın tek kaynağı: turun (panelden düzenlenen) fiyatı. Sefer yalnız bilinçli
// olarak "özel fiyat" verilirse ondan ayrılır. Panelde tur fiyatı değişince tur detayı,
// yeni açılan seferler ve rezervasyon toplamı aynı fiyatı kullanır.
import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app.mjs";
import { openStore } from "../server/store.mjs";
import { migrateDeparturePrices, DEPARTURE_PRICE_MIGRATION } from "../server/departures.mjs";

const NOW = Date.parse("2030-05-01T06:00:00Z");
const plan = (extra = {}) => ({
  tourId: "ani-cildir",
  date: "2030-05-10",
  startTime: "08:30",
  pickup: "Kars",
  guideName: "",
  guidePhone: "",
  vehicleModel: "vip-midibus",
  passengerSeats: 18,
  active: true,
  ...extra,
});

async function fixture(t) {
  const store = await openStore(":memory:", { seed: false, clock: () => NOW });
  const env = { ADMIN_PASSWORD: "ilk-kurulum-parolasi", SITE_URL: "https://rotakarsturizm.com" };
  const app = createApp(store, { env, reviewsService: { get: async () => ({ status: "not_configured", reviews: [] }) } });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await store.content.resetTour("ani-cildir");
    await new Promise((r) => server.close(r));
    await store.db.close();
  });
  const root = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, { body, cookie } = {}) => {
    const r = await fetch(root + "/api" + path, {
      method: body ? "POST" : "GET",
      body: body ? JSON.stringify(body) : undefined,
      headers: { "Content-Type": "application/json", "X-Rota-Client": "web", ...(cookie ? { Cookie: cookie } : {}) },
    });
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  const cookie = (
    await fetch(root + "/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password: "ilk-kurulum-parolasi" }),
      headers: { "Content-Type": "application/json", "X-Rota-Client": "web" },
    })
  ).headers
    .get("set-cookie")
    .split(";")[0];
  const setTourPrice = async (price) => {
    const current = (await call("/admin/content/tours/ani-cildir", { cookie })).json.current;
    const r = await call("/admin/content/tours/ani-cildir", { body: { ...current, price }, cookie });
    assert.equal(r.status, 200);
  };
  return { store, call, cookie, setTourPrice };
}

test("departure without a custom price follows the tour price everywhere", async (t) => {
  const { store, call, cookie, setTourPrice } = await fixture(t);
  const created = await call("/admin/departures", { body: { ...plan(), price: null }, cookie });
  assert.equal(created.status, 200, JSON.stringify(created.json));
  assert.equal(created.json.price, 100000, "katalog fiyatı");
  assert.equal(created.json.custom_price, null);

  await setTourPrice(150000);

  const [listed] = (await call("/tours/ani-cildir/departures")).json;
  assert.equal(listed.price, 150000, "tur detayındaki sefer listesi yeni fiyatı gösterir");
  const tour = (await call("/catalog")).json.tours.find((x) => x.id === "ani-cildir");
  assert.equal(tour.price, 150000);
  assert.equal(tour.fromPrice, 150000, "anasayfa ve tur detayı aynı başlangıç fiyatını kullanır");

  const r = await store.adminReserve(
    { departureId: created.json.id, seats: [1, 2], name: "Fiyat Testi", phone: "05551112233", passengers: ["A B", "C D"], paymentMode: "full", confirm: false },
    { id: "x", name: "Test" },
  );
  assert.equal(r.total, 300000, "rezervasyon toplamı yeni fiyattan");

  // Alınmış rezervasyon kendi fiyatını korur; sonraki fiyat değişikliği onu etkilemez.
  await setTourPrice(180000);
  const kept = await store.db.one("reservations", { _id: r.id });
  assert.equal(kept.total, 300000);
  assert.equal((await store.departures.get(created.json.id)).price, 180000);
});

test("a custom departure price stays put and is reported as custom", async (t) => {
  const { call, cookie, setTourPrice } = await fixture(t);
  const special = (await call("/admin/departures", { body: { ...plan({ date: "2030-05-11" }), price: 90000 }, cookie })).json;
  const normal = (await call("/admin/departures", { body: { ...plan({ date: "2030-05-12" }), price: null }, cookie })).json;
  assert.equal(special.custom_price, 90000);
  await setTourPrice(150000);
  const list = (await call("/tours/ani-cildir/departures")).json;
  assert.equal(list.find((d) => d.id === special.id).price, 90000);
  assert.equal(list.find((d) => d.id === normal.id).price, 150000);
  const tour = (await call("/catalog")).json.tours.find((x) => x.id === "ani-cildir");
  assert.equal(tour.fromPrice, 90000, "en düşük açık sefer fiyatı");

  // Özel fiyat kaldırılınca sefer yeniden tur fiyatını izler.
  const back = await call("/admin/departures", { body: { ...plan({ date: "2030-05-11" }), id: special.id, price: null }, cookie });
  assert.equal(back.json.price, 150000);
  assert.equal(back.json.custom_price, null);
});

test("bulk-created departures follow the tour price", async (t) => {
  const { call, cookie, setTourPrice } = await fixture(t);
  await setTourPrice(150000);
  const { date, ...rest } = plan();
  const bulk = await call("/admin/departures/bulk", {
    body: { ...rest, from: "2030-05-13", to: "2030-05-19", weekdays: [1, 3], price: null },
    cookie,
  });
  assert.equal(bulk.status, 201, JSON.stringify(bulk.json));
  const list = (await call("/tours/ani-cildir/departures")).json;
  assert.ok(list.length >= 2);
  assert.ok(list.every((d) => d.price === 150000 && d.custom_price === null));
});

test("one-off migration releases default-looking future prices to the tour price", async (t) => {
  const { store } = await fixture(t);
  // Açılışta boş veritabanında çoktan çalıştı; düzeltmeden önceki bir veritabanını canlandır.
  await store.db.remove("integration_settings", { _id: DEPARTURE_PRICE_MIGRATION });
  const raw = (id, date, price) => store.db.insert("departures", id, { id, tour_id: "ani-cildir", date, price, active: 1 });
  await raw("eski-varsayilan", "2030-06-01", 100000); // panel formunun eski sabit varsayılanı
  await raw("ozel", "2030-06-02", 95000); // bilinçli farklı fiyat
  await raw("gecmis", "2030-04-01", 100000); // geçmiş sefer: muhasebe için olduğu gibi kalır
  await store.db.insert("departures", "sarikamis-katalog", { id: "sarikamis-katalog", tour_id: "sarikamis", date: "2030-06-03", price: 135000, active: 1 });

  const first = await migrateDeparturePrices(store.db, { clock: () => NOW });
  assert.equal(first.released, 2);
  assert.equal((await store.db.one("departures", { _id: "eski-varsayilan" })).price, null);
  assert.equal((await store.db.one("departures", { _id: "sarikamis-katalog" })).price, null);
  assert.equal((await store.db.one("departures", { _id: "ozel" })).price, 95000);
  assert.equal((await store.db.one("departures", { _id: "gecmis" })).price, 100000);
  // Bir kez çalışır: sonradan bilinçli girilen 1.000 TL'lik özel fiyata dokunmaz.
  await store.db.update("departures", { _id: "eski-varsayilan" }, { price: 100000 });
  assert.equal((await migrateDeparturePrices(store.db, { clock: () => NOW })).released, 0);
  assert.equal((await store.db.one("departures", { _id: "eski-varsayilan" })).price, 100000);
});
