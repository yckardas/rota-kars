import { randomUUID } from "node:crypto";
import { AppError } from "./store.mjs";
import {
  makeVehicle,
  fleetVehicle,
  fleetVehicles,
  fleetVehicleLayout,
} from "./operations.mjs";
import { tours, catalogPrices } from "./catalog.mjs";
export const localDate = (now) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
// Türkiye 2016'dan beri sürekli UTC+3. Satış, kalkıştan SALES_CUTOFF_MINUTES
// (varsayılan 60) dakika önce kapanır.
export const salesClosesAt = (date, startTime, cutoffMinutes = 60) => {
  const time = /^\d{2}:\d{2}$/.test(startTime || "") ? startTime : "00:00";
  return Date.parse(`${date}T${time}:00+03:00`) - cutoffMinutes * 60 * 1000;
};
const tourPrice = (tourId) => tours.find((t) => t.id === tourId)?.price ?? 0;
// Kasım 2026 düzeltmesi: eskiden sefer açılırken fiyat sefere kopyalanıyordu (panel formunun
// varsayılanı sabit 1.000 TL idi), bu yüzden panelde değişen tur fiyatı seferlere yansımıyordu.
// Gelecekteki seferlerden varsayılan görünen fiyatlar (1.000 TL ya da turun katalog fiyatı)
// bir kez serbest bırakılır ve tur fiyatını izler. Bilinçli farklı fiyatlara ve geçmiş seferlere
// dokunulmaz. Her veritabanında yalnız bir kez çalışır.
export const LEGACY_FORM_PRICE = 100000;
export const DEPARTURE_PRICE_MIGRATION = "departure_prices_follow_tour_2026_11";
export async function migrateDeparturePrices(db, { clock }) {
  const marker = DEPARTURE_PRICE_MIGRATION;
  if (await db.one("integration_settings", { _id: marker })) return { released: 0 };
  let released = 0;
  for (const [tourId, price] of catalogPrices)
    released += await db.updateMany(
      "departures",
      { tour_id: tourId, date: { $gte: localDate(clock()) }, price: { $in: [LEGACY_FORM_PRICE, price] } },
      { price: null },
    );
  await db.upsert("integration_settings", marker, {
    id: marker,
    body: { appliedAt: clock(), released },
    updated_at: clock(),
  });
  return { released };
}
export async function createDepartures(
  db,
  { clock, tx, operations, cleanup, env = process.env },
) {
  const cutoff = Math.max(0, Number(env.SALES_CUTOFF_MINUTES ?? 60) || 0);
  const enrich = async (row) => {
    const base = await operations.get(row.tour_id),
      custom = typeof row.price === "number" ? row.price : null,
      vehicle =
        row.vehicle_model && row.passenger_seats
          ? makeVehicle(row.vehicle_model, Number(row.passenger_seats))
          : base.vehicle;
    const unit = fleetVehicles.find((v) => v.id === row.vehicle_id);
    return {
      ...row,
      // Fiyatın tek kaynağı turun (panelden düzenlenen) fiyatı; sefer yalnız bilinçli
      // verilmiş özel fiyatla ondan ayrılır. Toplamlar hep bu alandan hesaplanır.
      price: custom ?? tourPrice(row.tour_id),
      custom_price: custom,
      vehicle: unit
        ? {
            ...fleetVehicleLayout(unit, vehicle),
            unit: {
              id: unit.id,
              name: unit.name,
              year: unit.year,
              plate: unit.plate,
            },
          }
        : vehicle,
      vehicle_id: unit ? unit.id : "",
      start_time:
        row.start_time ||
        tours
          .find((t) => t.id === row.tour_id)
          ?.departure.match(/^\d{2}:\d{2}$/)?.[0] ||
        "08:30",
      pickup: row.pickup || "Kars merkez · Acente buluşma noktası",
      guide_name: row.guide_name || "",
      guide_phone: row.guide_phone || "",
      // Talep toplama modundaki turda koltuk satılmaz; yalnız ön kayıt alınır.
      salesOpen: base.salesOpen && base.mode !== "demand" && Boolean(row.active),
    };
  };
  const withCutoff = (d) => {
    const closesAt = salesClosesAt(d.date, d.start_time, cutoff);
    return {
      ...d,
      salesClosesAt: closesAt,
      departed: clock() >= closesAt,
      salesOpen: d.salesOpen && clock() < closesAt,
    };
  };
  return {
    enrich,
    async get(id, { allowClosed = false, allowPast = false } = {}) {
      const row = await db.one("departures", { _id: id });
      if (!row) throw new AppError(404, "Sefer bulunamadı.");
      const d = withCutoff(await enrich(row));
      if (!allowPast && d.date < localDate(clock()))
        throw new AppError(404, "Bu seferin tarihi geçti.");
      if (!allowPast && !allowClosed && d.departed)
        throw new AppError(
          409,
          "Bu seferin online satışı kapandı. Son dakika yer için bizi arayın.",
        );
      if (!allowClosed && !d.salesOpen)
        throw new AppError(409, "Bu sefer şu anda rezervasyona kapalı.");
      return d;
    },
    async list({ tourId, date } = {}) {
      await cleanup();
      const rows = await db.find(
        "departures",
        { ...(tourId ? { tour_id: tourId } : {}), ...(date ? { date } : {}) },
        { sort: { date: 1, start_time: 1, id: 1 } },
      );
      return Promise.all(
        rows.map(async (row) => {
          const d = withCutoff(await enrich(row)),
            used = await db.count("seat_locks", {
              departure_id: d.id,
              expires_at: { $gt: clock() },
            });
          return { ...d, available: d.vehicle.sellableSeats - used };
        }),
      );
    },
    async save(input) {
      // Filodan bir araç seçildiyse sınıf ve kapasite o araçtan gelir.
      if (input.vehicleId) {
        const unit = fleetVehicle(input.vehicleId);
        input = {
          ...input,
          vehicleModel: unit.vehicleModel,
          passengerSeats: unit.passengerSeats,
        };
      }
      makeVehicle(input.vehicleModel, input.passengerSeats);
      return tx(async () => {
        await cleanup();
        const id = input.id || randomUUID(),
          old = input.id
            ? await this.get(id, { allowClosed: true, allowPast: true })
            : null;
        if (old && old.tour_id !== input.tourId)
          throw new AppError(400, "Seferin turu değiştirilemez.");
        const changed =
          old &&
          (old.date !== input.date ||
            old.price !== (input.price ?? tourPrice(input.tourId)) ||
            old.start_time !== input.startTime ||
            old.vehicle.modelId !== input.vehicleModel ||
            old.vehicle.passengerSeats !== input.passengerSeats);
        if (
          changed &&
          (await db.one("seat_locks", {
            departure_id: id,
            expires_at: { $gt: clock() },
          }))
        )
          throw new AppError(
            409,
            "Ayrılmış koltuklar varken tarih, fiyat veya araç değiştirilemez. Yolcuyu başka sefere taşıyabilirsiniz.",
          );
        if (input.vehicleId) {
          const clash = await db.one("departures", {
            vehicle_id: input.vehicleId,
            date: input.date,
            _id: { $ne: id },
          });
          if (clash)
            throw new AppError(
              409,
              `Bu araç ${input.date} günü başka bir sefere atanmış (${tours.find((t) => t.id === clash.tour_id)?.name || clash.tour_id}, ${clash.start_time || ""}). Önce o seferin aracını değiştirin.`,
            );
        }
        const fields = {
          date: input.date,
          // null: tur fiyatını izler.
          price: input.price ?? null,
          active: input.active ? 1 : 0,
          start_time: input.startTime,
          pickup: input.pickup,
          guide_name: input.guideName,
          guide_phone: input.guidePhone,
          vehicle_model: input.vehicleModel,
          passenger_seats: input.passengerSeats,
          vehicle_id: input.vehicleId || "",
        };
        if (old) await db.update("departures", { _id: id }, fields);
        else
          await db.insert("departures", id, {
            id,
            tour_id: input.tourId,
            ...fields,
          });
        return this.get(id, { allowClosed: true, allowPast: true });
      });
    },
    // Yanlış açılmış sefer silinebilir; kaydı (iptal edilmiş olsa da) olan sefer yalnız kapatılır.
    async remove(id) {
      return tx(async () => {
        await this.get(id, { allowClosed: true, allowPast: true });
        if (await db.one("reservations", { departure_id: id }))
          throw new AppError(409, "Bu seferde rezervasyon kaydı var; silmek yerine satışa kapatın.");
        await db.remove("seat_locks", { departure_id: id });
        await db.remove("departures", { _id: id });
        return { ok: true };
      });
    },
  };
}
