// 15 Kasım 2026 müşteri düzeltmeleri: canlı veritabanındaki satış durumu, seferler, araç ve
// buluşma bilgisi bir kez güncellenir. Metin ve fiyat varsayılanları catalog.mjs'de; burada
// yalnız veritabanında tutulan (panelden yönetilen) kısımlar düzeltilir. Her veritabanında
// bir kez çalışır; sonrasında panelden yapılan değişikliklere dokunmaz.
//
// - Şimdilik yalnız Tiflis, Büyük Azerbaycan, Şavşat Karagöl ve (1 Aralık'tan itibaren)
//   Ani-Çıldır satışta; diğer turlar satışa kapalı.
// - Tiflis 21-22 Kasım, Azerbaycan 19-21 Kasım, Şavşat Karagöl 21, 22, 28 ve 29 Kasım.
// - Ani-Çıldır'ın 1 Aralık'tan önceki seferleri kaldırılır (kaydı olan sefer kapatılır).
// - 18 misafir koltuklu VIP minibüs: 19+1 düzen, en arka sıra dörtlü (koltuklar 18'de biter).
// - Buluşma: Kars merkezde ev, otel ve yakın noktalardan alıp bırakma.
import { isDeepStrictEqual } from "node:util";
import { tours } from "./catalog.mjs";
import { builtInDefaults, isBlank } from "./content.mjs";
import { TOUR_EN } from "./tour-en-2026-11.mjs";
import {
  DEFAULT_PICKUP,
  OLD_DEFAULT_PICKUP,
  localDate,
} from "./departures.mjs";

export const CORRECTIONS_RELEASE = "musteri_duzeltmeleri_2026_11_15";
export const OPEN_TOURS = [
  "tiflis",
  "buyuk-azerbaycan",
  "savsat-karagol",
  "ani-cildir",
];
export const ANI_SALES_START = "2026-12-01";
export const NEW_DEPARTURES = [
  { tourId: "tiflis", date: "2026-11-21", startTime: "05:00" },
  { tourId: "buyuk-azerbaycan", date: "2026-11-19", startTime: "08:30" },
  { tourId: "savsat-karagol", date: "2026-11-21", startTime: "08:30" },
  { tourId: "savsat-karagol", date: "2026-11-22", startTime: "08:30" },
  { tourId: "savsat-karagol", date: "2026-11-28", startTime: "08:30" },
  { tourId: "savsat-karagol", date: "2026-11-29", startTime: "08:30" },
];
// Panelde bu alanlara yazılmış eski metin/fiyat varsa kaldırılır; catalog.mjs'deki yeni
// varsayılan görünür. Diğer panel düzenlemeleri (fotoğraf vb.) korunur.
const CONTENT_RESETS = {
  tiflis: [
    "subtitle",
    "duration",
    "location",
    "price",
    "end",
    "summary",
    "included",
    "itinerary",
    "note",
  ],
  guneydogu: ["price"],
  "buyuk-azerbaycan": ["price", "note"],
};

export async function applyCustomerCorrections(db, { clock }) {
  if (await db.one("integration_settings", { _id: CORRECTIONS_RELEASE }))
    return { applied: false };
  const today = localDate(clock()),
    report = {
      opened: [],
      closed: [],
      created: [],
      reopened: [],
      removed: 0,
      deactivated: 0,
    };

  // Satış durumu: açık turlar online satışta (talep toplama modu kapanır), diğerleri kapalı.
  for (const tour of tours) {
    const open = OPEN_TOURS.includes(tour.id);
    await db.update(
      "tour_operations",
      { _id: tour.id },
      open ? { sales_open: 1, mode: "online" } : { sales_open: 0 },
    );
    report[open ? "opened" : "closed"].push(tour.id);
  }

  // 18 misafir koltuklu araç: 18+1 kayıtlar 19+1 düzene geçer (koltuk 1-17 numaraları aynı kalır).
  await db.updateMany(
    "tour_operations",
    { vehicle_model: "vip-midibus", passenger_seats: 18 },
    { passenger_seats: 19 },
  );
  await db.updateMany(
    "departures",
    {
      vehicle_model: "vip-midibus",
      passenger_seats: 18,
      date: { $gte: today },
    },
    { passenger_seats: 19 },
  );

  // Ani-Çıldır rezervasyonları 1 Aralık'tan başlar.
  for (const d of await db.find("departures", {
    tour_id: "ani-cildir",
    date: { $gte: today, $lt: ANI_SALES_START },
  })) {
    if (await db.one("reservations", { departure_id: d.id })) {
      await db.update("departures", { _id: d.id }, { active: 0 });
      report.deactivated++;
    } else {
      await db.remove("seat_locks", { departure_id: d.id });
      await db.remove("departures", { _id: d.id });
      report.removed++;
    }
  }

  // Yeni tarihler (geçmişte kalan tarih açılmaz; aynı gün sefer varsa satışa açılır).
  for (const n of NEW_DEPARTURES) {
    if (n.date < today) continue;
    const existing = await db.one("departures", {
      tour_id: n.tourId,
      date: n.date,
    });
    if (existing) {
      await db.update("departures", { _id: existing.id }, { active: 1 });
      report.reopened.push(`${n.tourId} ${n.date}`);
      continue;
    }
    const id = `${n.tourId}-${n.date}`;
    await db.insert("departures", id, {
      id,
      tour_id: n.tourId,
      date: n.date,
      price: null,
      active: 1,
      start_time: n.startTime,
      pickup: DEFAULT_PICKUP,
      guide_name: "",
      guide_phone: "",
      vehicle_model: "vip-midibus",
      passenger_seats: 19,
      vehicle_id: "",
    });
    report.created.push(`${n.tourId} ${n.date}`);
  }

  // Varsayılan buluşma metni: gelecekteki seferlerde eski varsayılan yeni metinle değişir.
  // Panelden özel yazılmış buluşma noktalarına dokunulmaz.
  await db.updateMany(
    "departures",
    { pickup: { $in: [OLD_DEFAULT_PICKUP, ""] }, date: { $gte: today } },
    { pickup: DEFAULT_PICKUP },
  );

  for (const [tourId, fields] of Object.entries(CONTENT_RESETS))
    await db.update(
      "site_content",
      { _id: "tour:" + tourId },
      {},
      { unset: Object.fromEntries(fields.map((f) => ["fields." + f, ""])) },
    );

  await db.upsert("integration_settings", CORRECTIONS_RELEASE, {
    id: CORRECTIONS_RELEASE,
    body: { appliedAt: clock(), ...report },
    updated_at: clock(),
  });
  return { applied: true, ...report };
}

// 15 Kasım 2026 (ikinci düzeltme): Ani-Çıldır'ın Aralık seferlerine panelde 4+1 binek araç
// (Egea) atanmıştı; müşteri bu seferlerin de 18 misafir koltuklu VIP minibüsle (19+1)
// yapılmasını istedi. Gelecekteki binek seferler minibüse geçer; 1-3 numaralı koltuklar
// minibüste de vardır, ayrılmış koltuk varsa yerinde kalır. Bir kez çalışır.
export const ANI_MINIBUS_RELEASE = "ani_minibus_2026_11_15";
export async function applyAniMinibus(db, { clock }) {
  if (await db.one("integration_settings", { _id: ANI_MINIBUS_RELEASE })) return { applied: false };
  const changed = await db.updateMany(
    "departures",
    { tour_id: "ani-cildir", vehicle_model: "binek", date: { $gte: localDate(clock()) } },
    { vehicle_model: "vip-midibus", passenger_seats: 19, vehicle_id: "" },
  );
  await db.upsert("integration_settings", ANI_MINIBUS_RELEASE, {
    id: ANI_MINIBUS_RELEASE,
    body: { appliedAt: clock(), changed },
    updated_at: clock(),
  });
  return { applied: true, changed };
}

// 26 Kasım 2026: canlıdaki deneme rezervasyonları sahibinin onayıyla kalıcı silinir.
// Liste numarayla sabittir; belirsiz görülen üç kayıt (RK-264BB35C11, RK-EFF13EA2AF,
// RK-34699F91B9) bilerek dışarıda bırakıldı. Güvenlik: o anda iptal
// ya da süresi dolmuş olmayan, ya da net tahsilatı sıfır olmayan kayda dokunulmaz.
export const TEST_RESERVATIONS_RELEASE = "test_rezervasyonlari_2026_11_26";
export const TEST_RESERVATIONS = [
  "RK-06AE3816FE",
  "RK-1AF51A0A0C",
  "RK-B77232C951",
  "RK-4FF9F37F05",
  "RK-91D640C74C",
  "RK-00E380E1C3",
  "RK-8191C02BB0",
  "RK-69446A0569",
  "RK-EAEAECE1CC",
  "RK-B2BB0E889E",
  "RK-5A9698489E",
  "RK-1E6CABD1C7",
  "RK-BFAFEF2014",
  "RK-1F89288F7E",
  "RK-2591BF9308",
  "RK-1C1F32FACC",
  "RK-8E1F0F0AB7",
];
export async function removeTestReservations(db, { clock, references = TEST_RESERVATIONS }) {
  if (await db.one("integration_settings", { _id: TEST_RESERVATIONS_RELEASE })) return { applied: false };
  const removed = [],
    skipped = [];
  for (const reference of references) {
    const r = await db.one("reservations", { reference });
    if (!r) {
      skipped.push({ reference, reason: "bulunamadı" });
      continue;
    }
    const ledger = await db.find("payment_ledger", { reservation_id: r.id });
    const net = ledger.reduce((n, p) => n + (p.kind === "refund" ? -1 : 1) * Number(p.amount), 0);
    if (!["cancelled", "expired"].includes(r.status) || net !== 0) {
      skipped.push({ reference, reason: `durum ${r.status}, net ${net}` });
      continue;
    }
    const sessions = await db.find("payment_sessions", { reference });
    if (sessions.length) await db.remove("payment_attempts", { session_id: { $in: sessions.map((x) => x.id) } });
    await db.remove("payment_sessions", { reference });
    await db.remove("card_refunds", { reference });
    await db.remove("payment_locks", { _id: reference });
    await db.remove("payment_ledger", { reservation_id: r.id });
    await db.remove("reservation_audit", { reservation_id: r.id });
    await db.remove("seat_locks", { owner: reference });
    // E-posta kuyruğu kaydı (gönderilmiş mesajın kopyası) referansı anahtarında taşır.
    await db.remove("notification_outbox", { dedupe_key: { $regex: reference.replace(/[^A-Z0-9-]/g, "") } });
    await db.remove("reservations", { _id: r.id });
    removed.push(reference);
  }
  await db.upsert("integration_settings", TEST_RESERVATIONS_RELEASE, {
    id: TEST_RESERVATIONS_RELEASE,
    body: { appliedAt: clock(), removed, skipped },
    updated_at: clock(),
  });
  return { applied: true, removed, skipped };
}

// 27 Kasım 2026: /en'de Türkçe görünen tur metinlerinin İngilizcesi (tour-en-2026-11.mjs)
// paneldeki İngilizce alanlara bir kez yazılır. Güvenlik: bir alan yalnız İngilizcesi boşsa ve
// kayıttaki Türkçe metin çevrilen Türkçe metinle birebir aynıysa yazılır; arada panelden
// değiştirilen alan atlanır. Türkçe alanlara (fields) hiç dokunulmaz.
export const TOUR_EN_RELEASE = "ingilizce_turlar_2026_11_27";
export async function applyTourTranslations(
  db,
  { clock, translations = TOUR_EN },
) {
  if (await db.one("integration_settings", { _id: TOUR_EN_RELEASE }))
    return { applied: false };
  const written = [],
    skipped = [];
  for (const [tourId, fields] of Object.entries(translations)) {
    const _id = "tour:" + tourId,
      doc = await db.one("site_content", { _id }),
      // Kayıtta olmayan alan turun varsayılanıdır: kopyada kopyalandığı andaki içerik.
      defaults =
        builtInDefaults(tourId) ||
        (await db.one("custom_tours", { _id: tourId }))?.defaults;
    if (!defaults) {
      skipped.push({ tour: tourId, reason: "tur bulunamadı" });
      continue;
    }
    const en = {},
      base = {};
    for (const [key, x] of Object.entries(fields)) {
      const current =
        doc?.fields && key in doc.fields ? doc.fields[key] : defaults[key];
      if (!isBlank(doc?.en?.[key]))
        skipped.push({ tour: tourId, field: key, reason: "İngilizce dolu" });
      else if (!isDeepStrictEqual(current, x.tr))
        skipped.push({ tour: tourId, field: key, reason: "Türkçe değişmiş" });
      else {
        en[key] = x.en;
        base[key] = x.tr;
        written.push(`${tourId}.${key}`);
      }
    }
    if (!Object.keys(en).length) continue;
    if (doc) {
      const set = {};
      for (const key of Object.keys(en)) {
        set["en." + key] = en[key];
        set["en_base." + key] = base[key];
      }
      await db.update("site_content", { _id }, set);
    } else
      await db.insert("site_content", _id, {
        id: _id,
        fields: {},
        en,
        en_base: base,
        updated_at: clock(),
        updated_by: null,
      });
  }
  await db.upsert("integration_settings", TOUR_EN_RELEASE, {
    id: TOUR_EN_RELEASE,
    body: { appliedAt: clock(), written, skipped },
    updated_at: clock(),
  });
  return { applied: true, written, skipped };
}
