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
import { tours } from "./catalog.mjs";
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
