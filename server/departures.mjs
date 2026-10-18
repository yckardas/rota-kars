import { randomUUID } from "node:crypto";
import { AppError } from "./store.mjs";
import { makeVehicle } from "./operations.mjs";
import { tours } from "./catalog.mjs";
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
export async function createDepartures(
  db,
  { clock, tx, operations, cleanup, env = process.env },
) {
  const cutoff = Math.max(0, Number(env.SALES_CUTOFF_MINUTES ?? 60) || 0);
  const enrich = async (row) => {
    const base = await operations.get(row.tour_id),
      vehicle =
        row.vehicle_model && row.passenger_seats
          ? makeVehicle(row.vehicle_model, Number(row.passenger_seats))
          : base.vehicle;
    return {
      ...row,
      vehicle,
      start_time:
        row.start_time ||
        tours
          .find((t) => t.id === row.tour_id)
          ?.departure.match(/^\d{2}:\d{2}$/)?.[0] ||
        "08:30",
      pickup: row.pickup || "Kars merkez · Acente buluşma noktası",
      guide_name: row.guide_name || "",
      guide_phone: row.guide_phone || "",
      salesOpen: base.salesOpen && Boolean(row.active),
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
            old.price !== input.price ||
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
        const fields = {
          date: input.date,
          price: input.price,
          active: input.active ? 1 : 0,
          start_time: input.startTime,
          pickup: input.pickup,
          guide_name: input.guideName,
          guide_phone: input.guidePhone,
          vehicle_model: input.vehicleModel,
          passenger_seats: input.passengerSeats,
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
  };
}
