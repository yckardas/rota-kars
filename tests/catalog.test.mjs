// Katalog bütünlüğü: her turun görselleri ve İngilizcesi var; fiyatı henüz girilmemiş
// (price 0) turda tutar gösterilmez ve koltuk satılmaz.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { tours } from "../server/catalog.mjs";
import { en } from "../server/catalog-en.mjs";
import { openStore } from "../server/store.mjs";
import { tourTitle, pageMeta } from "../server/seo.mjs";

const BASE = "https://rotakarsturizm.com";
const file = (src) => new URL("../public" + src, import.meta.url);

test("every tour image exists in both sizes", () => {
  for (const t of tours)
    for (const src of new Set([t.image, ...t.gallery])) {
      assert.ok(existsSync(file(src)), `${t.id}: ${src}`);
      // Kart boyu (-800) yalnız /images/tours altındakiler için üretilir (bkz. src/lib/images.ts).
      if (src.startsWith("/images/tours/"))
        assert.ok(existsSync(file(src.replace(/\.webp$/, "-800.webp"))), `${t.id}: ${src} (800)`);
    }
});

test("every tour has an English version with the same shape", () => {
  for (const t of tours) {
    const e = en.tours[t.id];
    assert.ok(e, t.id);
    for (const k of ["name", "subtitle", "category", "duration", "season", "summary", "note"]) assert.ok(e[k], `${t.id}.${k}`);
    for (const k of ["included", "excluded", "itinerary"]) assert.equal(e[k].length, t[k].length, `${t.id}.${k}`);
  }
});

test("a tour without a price shows no amount and cannot be sold", async (t) => {
  const tour = tours.find((x) => x.id === "butik-mardin");
  assert.equal(tour.price, 0);
  assert.ok(!tourTitle(tour).includes("₺"), tourTitle(tour));
  const meta = pageMeta("/turlar/butik-mardin", BASE);
  assert.equal(meta.status, 200);
  assert.ok(!/₺|başlayan fiyat/.test(meta.description), meta.description);

  const store = await openStore(":memory:", { clock: () => Date.parse("2026-10-17T06:00:00Z"), seed: false });
  t.after(() => store.db.close());
  // Acente turu talep toplamadan online satışa alsa bile fiyat girilmeden sefer satılmaz.
  await store.operations.setMode("butik-mardin", { mode: "online", threshold: 14, showProgress: false });
  const departure = (extra = {}) =>
    store.departures.save({
      tourId: "butik-mardin",
      date: "2026-10-24",
      startTime: "20:00",
      pickup: "Kars",
      guideName: "",
      guidePhone: "",
      price: null,
      vehicleModel: "vip-midibus",
      passengerSeats: 18,
      active: true,
      ...extra,
    });
  const free = await departure();
  assert.equal(free.price, 0);
  assert.equal(free.salesOpen, false);
  // Sefere özel fiyat verilince satılabilir.
  const priced = await departure({ date: "2026-10-31", price: 450000 });
  assert.equal(priced.salesOpen, true);
});
