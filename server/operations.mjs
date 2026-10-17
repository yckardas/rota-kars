import { AppError } from "./store.mjs";
import { tours, vehicle as defaultVehicle } from "./catalog.mjs";
export const vehicleModels = [
  {
    id: "vip-minibus",
    name: "VIP minibüs · Vito sınıfı",
    min: 4,
    max: 11,
    seats: 9,
    columns: 2,
  },
  {
    id: "vip-midibus",
    name: "VIP midibüs · Sprinter sınıfı",
    min: 12,
    max: 19,
    seats: 18,
    columns: 3,
  },
  {
    id: "midibus",
    name: "Turizm midibüsü",
    min: 20,
    max: 35,
    seats: 27,
    columns: 3,
  },
  {
    id: "coach",
    name: "Turizm otobüsü",
    min: 36,
    max: 54,
    seats: 46,
    columns: 4,
  },
];
export function makeVehicle(modelId, passengerSeats) {
  const model = vehicleModels.find((m) => m.id === modelId);
  if (
    !model ||
    !Number.isInteger(passengerSeats) ||
    passengerSeats < model.min ||
    passengerSeats > model.max
  )
    throw new AppError(400, "Araç modeline uygun bir yolcu kapasitesi seçin.");
  if (modelId === "vip-midibus" && passengerSeats === 18)
    return {
      ...defaultVehicle,
      modelId,
    };
  const width = model.columns + 1,
    aisle = model.columns === 2 ? 1 : 2;
  const cockpit = Array(width).fill(null);
  cockpit[0] = "driver";
  cockpit[width - 1] = "guide";
  const rows = [];
  let number = 1;
  while (number <= passengerSeats - 1) {
    const row = Array(width).fill(null);
    for (let i = 0; i < width; i++)
      if (i !== aisle && number <= passengerSeats - 1) row[i] = number++;
    rows.push(row);
  }
  return {
    id: `${modelId}-${passengerSeats}`,
    modelId,
    name: model.name,
    passengerSeats,
    driverSeats: 1,
    guideSeats: 1,
    sellableSeats: passengerSeats - 1,
    layout: [cockpit, ...rows],
    description: `${passengerSeats}+1 araç; ön koltuk rehbere ayrılır, ${passengerSeats - 1} misafir koltuğu seçilebilir.`,
  };
}
export async function createOperations(db, { clock, cleanup, tx }) {
  await db.exec(
    "CREATE TABLE IF NOT EXISTS tour_operations(tour_id TEXT PRIMARY KEY,sales_open INTEGER NOT NULL,vehicle_model TEXT NOT NULL,passenger_seats INTEGER NOT NULL)",
  );
  for (const tour of tours)
    await db
      .prepare("INSERT OR IGNORE INTO tour_operations VALUES(?,?,?,?)")
      .run(tour.id, tour.inquiryOnly ? 0 : 1, "vip-midibus", 18);
  const get = async (id) => {
    const row = await db
      .prepare("SELECT * FROM tour_operations WHERE tour_id=?")
      .get(id);
    if (!row) throw new AppError(404, "Tur bulunamadı.");
    return {
      ...row,
      salesOpen: Boolean(row.sales_open),
      vehicle: makeVehicle(row.vehicle_model, row.passenger_seats),
    };
  };
  return {
    get,
    list: async () =>
      await Promise.all(
        tours.map(async (t) => {
          const config = await get(t.id);
          return {
            ...t,
            ...config,
            inquiryOnly: !config.salesOpen,
          };
        }),
      ),
    update(id, { salesOpen, vehicleModel, passengerSeats }) {
      const vehicle = makeVehicle(vehicleModel, passengerSeats);
      return tx(async () => {
        await cleanup();
        const current = await get(id);
        if (
          current.vehicle_model !== vehicleModel ||
          current.passenger_seats !== passengerSeats
        ) {
          const occupied = await db
            .prepare(
              "SELECT 1 FROM seat_locks s JOIN departures d ON d.id=s.departure_id WHERE d.tour_id=? AND s.expires_at>? AND d.date>=? LIMIT 1",
            )
            .get(id, clock(), new Date(clock()).toISOString().slice(0, 10));
          if (occupied)
            throw new AppError(
              409,
              "Bu turda ayrılmış koltuklar var. Araç düzenini değiştirmeden önce mevcut ön rezervasyonları çözümleyin. Satışı kapatabilirsiniz.",
            );
        }
        await db
          .prepare(
            "UPDATE tour_operations SET sales_open=?,vehicle_model=?,passenger_seats=? WHERE tour_id=?",
          )
          .run(salesOpen ? 1 : 0, vehicleModel, passengerSeats, id);
        return {
          ...(await get(id)),
          vehicle,
        };
      });
    },
  };
}
