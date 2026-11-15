// 15 Kasım 2026 müşteri düzeltmeleri (server/corrections.mjs): canlı veritabanında satış
// durumu, seferler, araç düzeni, buluşma metni ve paneldeki eski Tiflis metni bir kez düzelir.
import { test } from "node:test";
import assert from "node:assert/strict";
import { openStore } from "../server/store.mjs";
import {
  applyAniMinibus,
  applyCustomerCorrections,
  CORRECTIONS_RELEASE,
} from "../server/corrections.mjs";
import { DEFAULT_PICKUP, OLD_DEFAULT_PICKUP } from "../server/departures.mjs";
import { tours } from "../server/catalog.mjs";

const row = (tourId, date, extra = {}) => ({
  id: `${tourId}-${date}`,
  tour_id: tourId,
  date,
  price: null,
  active: 1,
  start_time: "08:30",
  pickup: OLD_DEFAULT_PICKUP,
  guide_name: "",
  guide_phone: "",
  vehicle_model: "vip-midibus",
  passenger_seats: 18,
  vehicle_id: "",
  ...extra,
});

test("customer corrections open only the agreed tours and dates, once", async (t) => {
  let now = Date.UTC(2026, 10, 15, 9);
  const store = await openStore(":memory:", {
    clock: () => now,
    seed: false,
    dataReleases: false,
  });
  t.after(() => store.db.close());
  const { db } = store;
  // Canlıdaki durumu taklit et: eski 18+1 kayıtlar, talep modunda Tiflis, Kasım'da Ani seferleri.
  await db.updateMany("tour_operations", {}, { passenger_seats: 18 });
  await db.update("tour_operations", { _id: "tiflis" }, { mode: "demand" });
  for (const d of [
    row("ani-cildir", "2026-11-20"),
    row("ani-cildir", "2026-11-27"),
    row("ani-cildir", "2026-12-01"),
    row("ani-cildir", "2026-12-02", { pickup: "Kars Kalesi önü" }),
    row("sarikamis", "2026-11-20"),
    row("savsat-karagol", "2026-11-22", { active: 0 }),
  ])
    await db.insert("departures", d.id, d);
  await db.insert("reservations", "r1", {
    id: "r1",
    reference: "RK-1",
    departure_id: "ani-cildir-2026-11-27",
    status: "confirmed",
  });
  await db.upsert("site_content", "tour:tiflis", {
    id: "tour:tiflis",
    fields: {
      price: 900000,
      duration: "3 gün · 2 gece",
      summary: "Eski metin",
      image: "/images/ozel.webp",
    },
  });

  const report = await applyCustomerCorrections(db, { clock: () => now });
  assert.equal(report.applied, true);

  const ops = Object.fromEntries(
    (await db.find("tour_operations", {})).map((o) => [o.tour_id, o]),
  );
  const open = Object.values(ops)
    .filter((o) => o.sales_open)
    .map((o) => o.tour_id)
    .sort();
  assert.deepEqual(open, [
    "ani-cildir",
    "buyuk-azerbaycan",
    "savsat-karagol",
    "tiflis",
  ]);
  assert.equal(
    ops.tiflis.mode,
    "online",
    "Tiflis talep toplamadan satışa geçer",
  );
  assert.equal(ops["buyuk-azerbaycan"].mode, "online");
  assert.equal(ops.guneydogu.sales_open, 0);
  assert.ok(
    Object.values(ops).every((o) => o.passenger_seats === 19),
    "18 misafir koltuklu 19+1 düzen",
  );

  // Ani: 1 Aralık'tan önceki seferler kalkar; kaydı olan sefer silinmez, kapanır.
  assert.equal(
    await db.one("departures", { _id: "ani-cildir-2026-11-20" }),
    null,
  );
  assert.equal(
    (await db.one("departures", { _id: "ani-cildir-2026-11-27" })).active,
    0,
  );
  assert.equal(
    (await db.one("departures", { _id: "ani-cildir-2026-12-01" })).active,
    1,
  );

  // Yeni tarihler ve buluşma metni.
  const dates = async (tourId) =>
    (
      await db.find(
        "departures",
        { tour_id: tourId, active: 1 },
        { sort: { date: 1 } },
      )
    ).map((d) => d.date);
  assert.deepEqual(await dates("tiflis"), ["2026-11-21"]);
  assert.deepEqual(await dates("buyuk-azerbaycan"), ["2026-11-19"]);
  assert.deepEqual(await dates("savsat-karagol"), [
    "2026-11-21",
    "2026-11-22",
    "2026-11-28",
    "2026-11-29",
  ]);
  assert.equal(
    (await db.one("departures", { _id: "tiflis-2026-11-21" })).start_time,
    "05:00",
  );
  assert.equal(
    (await db.one("departures", { _id: "ani-cildir-2026-12-01" })).pickup,
    DEFAULT_PICKUP,
  );
  assert.equal(
    (await db.one("departures", { _id: "ani-cildir-2026-12-02" })).pickup,
    "Kars Kalesi önü",
    "özel nokta korunur",
  );

  // Paneldeki eski Tiflis metni/fiyatı kalkar, özel fotoğraf kalır.
  assert.deepEqual(
    (await db.one("site_content", { _id: "tour:tiflis" })).fields,
    { image: "/images/ozel.webp" },
  );

  // Satışta: Tiflis 5.000 TL, 18 koltuk; kapalı turun seferi satılmaz.
  const [tiflis] = await store.listDepartures("tiflis");
  assert.equal(tiflis.price, tours.find((x) => x.id === "tiflis").price);
  assert.equal(tiflis.price, 500000);
  assert.equal(tiflis.salesOpen, true);
  assert.equal(tiflis.available, 18);
  const [azerbaycan] = await store.listDepartures("buyuk-azerbaycan");
  assert.equal(azerbaycan.price, 2000000);
  assert.equal(azerbaycan.salesOpen, true);
  assert.deepEqual(
    await store.listDepartures("sarikamis"),
    [],
    "kapalı turun seferi satışta görünmez",
  );
  assert.deepEqual(
    (await store.listDepartures("ani-cildir")).map((d) => d.date),
    ["2026-12-01", "2026-12-02"],
  );

  // Bir kez çalışır: sonradan panelden açılan tura dokunmaz.
  await db.update("tour_operations", { _id: "sarikamis" }, { sales_open: 1 });
  assert.equal(
    (await applyCustomerCorrections(db, { clock: () => now })).applied,
    false,
  );
  assert.equal(
    (await db.one("tour_operations", { _id: "sarikamis" })).sales_open,
    1,
  );
  assert.ok(await db.one("integration_settings", { _id: CORRECTIONS_RELEASE }));
});

test("past dates are not opened when the release runs late", async (t) => {
  const now = Date.UTC(2026, 10, 25, 9);
  const store = await openStore(":memory:", {
    clock: () => now,
    seed: false,
    dataReleases: false,
  });
  t.after(() => store.db.close());
  await applyCustomerCorrections(store.db, { clock: () => now });
  const dates = (
    await store.db.find("departures", { tour_id: "savsat-karagol" })
  )
    .map((d) => d.date)
    .sort();
  assert.deepEqual(dates, ["2026-11-28", "2026-11-29"]);
  assert.equal(await store.db.one("departures", { tour_id: "tiflis" }), null);
});

test("Ani's Egea departures move to the 18-guest minibus, once", async (t) => {
  const now = Date.UTC(2026, 10, 15, 9);
  const store = await openStore(":memory:", { clock: () => now, seed: false, dataReleases: false });
  t.after(() => store.db.close());
  const { db } = store;
  const egea = { vehicle_model: "binek", passenger_seats: 4, pickup: DEFAULT_PICKUP };
  for (const d of [
    row("ani-cildir", "2026-12-01", egea),
    row("ani-cildir", "2026-12-02", egea),
    row("ani-cildir", "2026-11-10", egea),
    row("sarikamis", "2026-12-01", egea),
  ])
    await db.insert("departures", d.id, d);
  await store.hold("ani-cildir-2026-12-02", [2]);
  const run = await applyAniMinibus(db, { clock: () => now });
  assert.deepEqual(run, { applied: true, changed: 2 });
  const [first, second] = await store.listDepartures("ani-cildir");
  assert.equal(first.vehicle.name, "VIP minibüs");
  assert.equal(first.vehicle.sellableSeats, 18);
  assert.deepEqual(first.vehicle.layout.at(-1), [15, 16, 17, 18]);
  assert.equal(second.available, 17, "ayrılmış koltuk yerinde kalır");
  assert.equal((await db.one("departures", { _id: "ani-cildir-2026-11-10" })).vehicle_model, "binek", "geçmiş sefere dokunulmaz");
  assert.equal((await db.one("departures", { _id: "sarikamis-2026-12-01" })).vehicle_model, "binek", "başka tura dokunulmaz");
  assert.equal((await applyAniMinibus(db, { clock: () => now })).applied, false);
});
