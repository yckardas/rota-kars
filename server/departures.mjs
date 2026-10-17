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
export async function createDepartures(db, { clock, tx, operations, cleanup }) {
  const columns = (await db.prepare("PRAGMA table_info(departures)").all()).map(
    (c) => c.name,
  );
  for (const [key, type] of Object.entries({
    start_time: "TEXT",
    pickup: "TEXT",
    guide_name: "TEXT",
    guide_phone: "TEXT",
    vehicle_model: "TEXT",
    passenger_seats: "INTEGER",
  }))
    if (!columns.includes(key))
      await db.exec(`ALTER TABLE departures ADD COLUMN ${key} ${type}`);
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
  return {
    enrich,
    async get(id, { allowClosed = false, allowPast = false } = {}) {
      const row = await db
        .prepare("SELECT * FROM departures WHERE id=?")
        .get(id);
      if (!row) throw new AppError(404, "Sefer bulunamadı.");
      const d = await enrich(row);
      if (!allowPast && d.date < localDate(clock()))
        throw new AppError(404, "Bu seferin tarihi geçti.");
      if (!allowClosed && !d.salesOpen)
        throw new AppError(409, "Bu sefer şu anda rezervasyona kapalı.");
      return d;
    },
    async list({ tourId, date } = {}) {
      await cleanup();
      const rows = await db
        .prepare("SELECT * FROM departures ORDER BY date,start_time,id")
        .all();
      return Promise.all(
        rows
          .filter(
            (r) =>
              (!tourId || r.tour_id === tourId) && (!date || r.date === date),
          )
          .map(async (row) => {
            const d = await enrich(row),
              used = await db
                .prepare(
                  "SELECT count(*) n FROM seat_locks WHERE departure_id=? AND expires_at>?",
                )
                .get(d.id, clock());
            return {
              ...d,
              available: d.vehicle.sellableSeats - Number(used.n),
            };
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
          (await db
            .prepare(
              "SELECT 1 FROM seat_locks WHERE departure_id=? AND expires_at>? LIMIT 1",
            )
            .get(id, clock()))
        )
          throw new AppError(
            409,
            "Ayrılmış koltuklar varken tarih, fiyat veya araç değiştirilemez. Yolcuyu başka sefere taşıyabilirsiniz.",
          );
        if (old)
          await db
            .prepare(
              "UPDATE departures SET date=?,price=?,active=?,start_time=?,pickup=?,guide_name=?,guide_phone=?,vehicle_model=?,passenger_seats=? WHERE id=?",
            )
            .run(
              input.date,
              input.price,
              input.active ? 1 : 0,
              input.startTime,
              input.pickup,
              input.guideName,
              input.guidePhone,
              input.vehicleModel,
              input.passengerSeats,
              id,
            );
        else
          await db
            .prepare(
              "INSERT INTO departures(id,tour_id,date,price,active,start_time,pickup,guide_name,guide_phone,vehicle_model,passenger_seats) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
            )
            .run(
              id,
              input.tourId,
              input.date,
              input.price,
              input.active ? 1 : 0,
              input.startTime,
              input.pickup,
              input.guideName,
              input.guidePhone,
              input.vehicleModel,
              input.passengerSeats,
            );
        return this.get(id, { allowClosed: true, allowPast: true });
      });
    },
  };
}
