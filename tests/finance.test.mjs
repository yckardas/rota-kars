import { test } from "node:test";
import assert from "node:assert/strict";
import { matchTours, unitPrice, requestEstimate } from "../server/finance.mjs";

test("matchTours: anahtar kelime, genel kelime yok sayılır, uzun ifade kısa olanı ezer", () => {
  assert.deepEqual(matchTours("Ani ve Çıldır için 6 kişi"), ["ani-cildir"]);
  assert.deepEqual(matchTours("Günübirlik bir tur istiyoruz"), []);
  assert.deepEqual(matchTours("VAN HAVZASI turu"), ["van-havzasi"]);
  assert.deepEqual(matchTours("Van turu").sort(), ["van", "van-gunubirlik", "van-havzasi"]);
  assert.deepEqual(matchTours("Batum ve Tiflis").sort(), ["batum", "tiflis"]);
  assert.deepEqual(matchTours("savan"), [], "kelime sınırı");
  assert.deepEqual(matchTours(""), []);
  assert.deepEqual(matchTours(undefined), []);
});

test("unitPrice: önceki sefer → gelecek sefer → katalog", () => {
  const deps = [
    { tour_id: "batum", date: "2026-10-01", price: 200000 },
    { tour_id: "batum", date: "2026-11-01", price: 220000 },
    { tour_id: "batum", date: "2026-12-01", price: 250000 },
    { tour_id: "tiflis", date: "2026-12-10", price: 300000 },
    { tour_id: "tiflis", date: "2026-12-03", price: 310000 },
  ];
  const tours = [{ id: "batum", price: 1 }, { id: "tiflis", price: 2 }, { id: "mardin", price: 400000 }];
  assert.equal(unitPrice("batum", deps, "2026-11-25", tours), 220000);
  assert.equal(unitPrice("tiflis", deps, "2026-11-25", tours), 310000, "en yakın gelecek sefer");
  assert.equal(unitPrice("mardin", deps, "2026-11-25", tours), 400000);
  assert.equal(unitPrice("yok", deps, "2026-11-25", tours), null);
});

test("requestEstimate: tourId önceliklidir; nottan çoklu eşleşmede ortalama; konaklama/araç tahminsiz", () => {
  const ctx = {
    today: "2026-11-25",
    tours: [
      { id: "van-gunubirlik", price: 300000 },
      { id: "van", price: 600000 },
      { id: "van-havzasi", price: 700000 },
      { id: "batum", price: 220000 },
    ],
    departures: [],
  };
  assert.deepEqual(requestEstimate({ kind: "tour-info", body: { tourId: "batum", guests: 3, notes: "Van" } }, ctx), {
    amount: 660000,
    tourIds: ["batum"],
    averaged: false,
  });
  const van = requestEstimate({ kind: "private-tour", body: { guests: 2, notes: "Van turu" } }, ctx);
  assert.equal(van.amount, 2 * Math.round((300000 + 600000 + 700000) / 3));
  assert.equal(van.averaged, true);
  assert.equal(requestEstimate({ kind: "hotel", body: { tourId: "batum", guests: 2 } }, ctx), null);
  assert.equal(requestEstimate({ kind: "vehicle", body: { guests: 2, notes: "Batum" } }, ctx), null);
  assert.equal(requestEstimate({ kind: "private-tour", body: { guests: 2, notes: "bir yer" } }, ctx), null);
  assert.equal(requestEstimate({ kind: "private-tour", body: { notes: "Batum" } }, ctx).amount, 220000, "kişi yoksa 1");
});
