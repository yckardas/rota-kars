// Turların İngilizce metinleri (server/tour-en-2026-11.mjs): canlıdaki kayıtlara bir kez,
// yalnız İngilizcesi boş ve Türkçesi çevrilen metinle aynı alanlara yazılır; Türkçe değişmez.
import { test } from "node:test";
import assert from "node:assert/strict";
import { openStore } from "../server/store.mjs";
import {
  applyTourTranslations,
  TOUR_EN_RELEASE,
} from "../server/corrections.mjs";
import { TOUR_EN } from "../server/tour-en-2026-11.mjs";
import { builtInDefaults, currentEn } from "../server/content.mjs";

const trOf = (id) =>
  Object.fromEntries(Object.entries(TOUR_EN[id]).map(([k, x]) => [k, x.tr]));
const enOf = (id) =>
  Object.fromEntries(Object.entries(TOUR_EN[id]).map(([k, x]) => [k, x.en]));
const BATUM = "konaklamali-batum-turu",
  BAKU = "azerbaycan-baku-turu-yilbasi-ozel";

// Canlıya benzer veritabanı: düzenlenmiş yerleşik turlar ve iki kopya tur.
async function liveLike(t) {
  const store = await openStore(":memory:", {
    seed: false,
    dataReleases: false,
  });
  t.after(async () => {
    for (const row of await store.db.find("custom_tours", {}))
      await store.content.deleteTour(row.id, { force: true });
    await store.db.close();
  });
  const { db } = store,
    content = (id, fields, extra = {}) =>
      db.upsert("site_content", "tour:" + id, {
        id: "tour:" + id,
        fields,
        updated_at: 1,
        updated_by: "Sahip",
        ...extra,
      });
  // Ani: özet, çeviri hazırlandıktan sonra panelde değişti.
  await content("ani-cildir", {
    ...builtInDefaults("ani-cildir"),
    ...trOf("ani-cildir"),
    summary: "Panelde sonradan değişen özet.",
  });
  // Tiflis: adın İngilizcesi panelde zaten girilmiş.
  await content(
    "tiflis",
    { ...builtInDefaults("tiflis"), ...trOf("tiflis") },
    {
      en: { name: "Tbilisi Christmas Tour" },
      en_base: { name: TOUR_EN.tiflis.name.tr },
    },
  );
  // Nahçıvan: yalnız değişen alanlar kayıtta, diğerleri varsayılan.
  await content("nahcivan", trOf("nahcivan"));
  const copy = (id, source, defaults) =>
    db.insert("custom_tours", id, {
      id,
      source_id: source,
      hidden: false,
      base: {},
      defaults,
      created_at: 1,
      created_by: "Sahip",
    });
  // Batum kopyası: Türkçe metin panel kaydında; Bakü kopyası: kopyalandığı hâliyle, panel kaydı yok.
  await copy(BATUM, "batum", {
    ...builtInDefaults("batum"),
    name: TOUR_EN[BATUM].name.tr,
  });
  await content(BATUM, { ...builtInDefaults("batum"), ...trOf(BATUM) });
  await copy(BAKU, "buyuk-azerbaycan", {
    ...builtInDefaults("buyuk-azerbaycan"),
    ...trOf(BAKU),
  });
  await store.content.reload();
  return store;
}

test("English tour texts fill only empty fields whose Turkish still matches, once", async (t) => {
  const store = await liveLike(t),
    { db } = store;
  const before = await db.find("site_content", {}, { sort: { _id: 1 } });
  const report = await applyTourTranslations(db, { clock: () => 1000 });
  assert.equal(report.applied, true);
  assert.deepEqual(
    report.skipped.map((s) => `${s.tour}.${s.field}: ${s.reason}`).sort(),
    ["ani-cildir.summary: Türkçe değişmiş", "tiflis.name: İngilizce dolu"],
  );
  const total = Object.values(TOUR_EN).reduce(
    (n, f) => n + Object.keys(f).length,
    0,
  );
  assert.equal(report.written.length, total - 2);

  const docs = Object.fromEntries(
    (await db.find("site_content", {})).map((d) => [d.id, d]),
  );
  // Türkçe alanlar hiç değişmez.
  for (const b of before)
    assert.deepEqual(docs[b.id].fields, b.fields, b.id + " Türkçe aynı");
  assert.deepEqual(
    docs["tour:" + BAKU].fields,
    {},
    "kaydı olmayan kopyaya yalnız İngilizce yazılır",
  );
  // Boş alan dolar, tabanı çevrilen Türkçe metindir.
  assert.equal(docs["tour:ani-cildir"].en.name, TOUR_EN["ani-cildir"].name.en);
  assert.equal(
    docs["tour:ani-cildir"].en.summary,
    undefined,
    "değişen Türkçe atlanır",
  );
  assert.equal(
    docs["tour:tiflis"].en.name,
    "Tbilisi Christmas Tour",
    "paneldeki İngilizce ezilmez",
  );
  assert.deepEqual(
    docs["tour:tiflis"].en.itinerary,
    TOUR_EN.tiflis.itinerary.en,
  );
  assert.deepEqual(docs["tour:nahcivan"].en_base, trOf("nahcivan"));
  assert.deepEqual(docs["tour:" + BAKU].en, enOf(BAKU));
  assert.ok(
    (await db.one("integration_settings", { _id: TOUR_EN_RELEASE })).body
      .written.length,
  );

  // İkinci çalıştırma hiçbir şey yapmaz.
  const after = await db.find("site_content", {}, { sort: { _id: 1 } });
  assert.deepEqual(await applyTourTranslations(db, { clock: () => 2000 }), {
    applied: false,
  });
  assert.deepEqual(
    await db.find("site_content", {}, { sort: { _id: 1 } }),
    after,
  );

  // /en: yazılan İngilizce görünür, panelde uyarı yok; atlanan alan Türkçe kalır.
  await store.content.reload();
  const en = currentEn().tours;
  assert.equal(
    en["ani-cildir"].name,
    "Ancient City of Ani, Lake Çıldır and Kars Tour",
  );
  assert.equal(en["ani-cildir"].summary, "Panelde sonradan değişen özet.");
  assert.equal(
    en["ani-cildir"].subtitle,
    "One day, thousands of years of stories.",
    "değişmeyen alanda eski çeviri",
  );
  assert.equal(en.tiflis.name, "Tbilisi Christmas Tour");
  assert.equal(en[BAKU].cardLabel, "New Year in Baku");
  assert.equal(
    en[BAKU].subtitle,
    "Three days from Nakhchivan to Baku, flights included.",
    "kopyada kaynağın eski çevirisi",
  );
  assert.equal(en[BATUM].name, "Batumi Tour with Overnight Stay");
  assert.equal(en[BATUM].location, "Kars · Artvin · Batumi");
  for (const id of ["ani-cildir", "tiflis", "nahcivan", BATUM, BAKU]) {
    const info = await store.content.tour(id);
    assert.deepEqual(info.enStale, [], id + " uyarısız");
    // Hiçbir alan Türkçe kalmaz (atlanan Ani özeti dışında).
    const turkish = Object.keys(TOUR_EN[id]).filter(
      (k) => JSON.stringify(en[id][k]) === JSON.stringify(info.current[k]),
    );
    assert.deepEqual(turkish, id === "ani-cildir" ? ["summary"] : [], id);
  }
});

test("a copied tour takes the source's English except the name", async (t) => {
  const store = await liveLike(t);
  await applyTourTranslations(store.db, { clock: () => 1000 });
  await store.content.reload();
  const copy = await store.content.copyTour(
    "tiflis",
    { id: "tiflis-yilbasi", name: "Tiflis Yılbaşı Turu" },
    { name: "Sahip" },
  );
  assert.equal(copy.en.name, undefined, "kopyanın adı yeni; İngilizcesi boş");
  assert.deepEqual(copy.en.itinerary, TOUR_EN.tiflis.itinerary.en);
  assert.deepEqual(copy.enStale, []);
  // Kopyada Türkçe değişince panel uyarır.
  const saved = await store.content.saveTour(
    "tiflis-yilbasi",
    { ...copy.current, note: "Yeni not.", en: copy.en },
    { name: "Sahip" },
  );
  assert.deepEqual(saved.enStale, ["note"]);
});
