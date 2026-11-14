import { emptyTransfer } from "./transfer.mjs";
import { AppError } from "./store.mjs";
import { tours, vehicle as defaultVehicle } from "./catalog.mjs";
export const vehicleModels = [
  {
    id: "binek",
    shape: "car",
    name: "Binek araç · Egea sınıfı",
    min: 4,
    max: 4,
    seats: 4,
    columns: 3,
    aisle: null,
  },
  {
    id: "vip-minibus",
    shape: "van",
    name: "VIP minibüs · Vito sınıfı",
    min: 4,
    max: 11,
    seats: 9,
    columns: 2,
  },
  {
    id: "vip-midibus",
    shape: "midibus",
    name: "VIP midibüs · Sprinter / Crafter sınıfı",
    min: 12,
    max: 19,
    seats: 18,
    columns: 3,
  },
  {
    id: "midibus",
    shape: "bus",
    name: "Turizm midibüsü · Otokar Sultan sınıfı",
    min: 20,
    max: 35,
    seats: 27,
    columns: 3,
  },
  {
    id: "coach",
    shape: "coach",
    name: "Turizm otobüsü · Travego sınıfı",
    min: 36,
    max: 54,
    seats: 46,
    columns: 4,
  },
];
// Seferlere atanabilen filodaki araçlar. Sefer bu araçlardan birine
// bağlanınca araç sınıfı ve koltuk sayısı araçtan gelir. Plaka yalnız panelde
// görünür; halka açık sefer bilgisinden çıkarılır.
export const fleetVehicles = [
  {
    id: "36ABN916",
    plan: "sprinter-19",
    plate: "36 ABN 916",
    name: "Mercedes Sprinter",
    year: 2025,
    vehicleModel: "vip-midibus",
    passengerSeats: 19,
    note: "Port bagajlı",
  },
  {
    id: "36EA491",
    plan: "sprinter-19",
    plate: "36 EA 491",
    name: "Volkswagen Crafter",
    year: 2015,
    vehicleModel: "vip-midibus",
    passengerSeats: 19,
    note: "Port bagajlı",
  },
  {
    id: "36EA484",
    plan: "sprinter-19",
    plate: "36 EA 484",
    name: "Volkswagen Crafter",
    year: 2013,
    vehicleModel: "vip-midibus",
    passengerSeats: 19,
    note: "Port bagajlı",
  },
  {
    id: "36AAP768",
    plan: "sultan-31",
    plate: "36 AAP 768",
    name: "Otokar Sultan",
    year: 2015,
    vehicleModel: "midibus",
    passengerSeats: 31,
    note: "",
  },
  {
    id: "61S6101",
    plan: "travego-46",
    plate: "61 S 6101",
    name: "Mercedes Travego",
    year: 2014,
    vehicleModel: "coach",
    passengerSeats: 46,
    note: "",
  },
  {
    id: "34BEH934",
    plan: "vito-9",
    plate: "34 BEH 934",
    name: "Mercedes Vito",
    year: 2020,
    vehicleModel: "vip-minibus",
    passengerSeats: 9,
    note: "",
  },
  {
    id: "36AAR070",
    plan: "egea-4",
    plate: "36 AAR 070",
    name: "Fiat Egea",
    year: 2022,
    vehicleModel: "binek",
    passengerSeats: 4,
    note: "",
  },
];
// Fabrika çıkışı standart iç düzenler (önden arkaya; sol baştadır, kapılar
// sağdadır). Koltuk numaraları 1'den satılabilir koltuk sayısına kadar
// kesintisizdir; rehber şoförün yanındadır. Araçların kendi fotoğrafları
// gelince farklı olanlar burada düzeltilir.
const D = "door";
export const seatPlans = {
  // Fiat Egea 4+1: önde şoför ve rehber, arkada yan yana üç koltuk.
  "egea-4": [
    ["driver", null, "guide"],
    [1, 2, 3],
  ],
  // Mercedes Vito 9+1: sağda sürgülü kapı, arkada iki üçlü sıra.
  "vito-9": [
    ["driver", null, "guide"],
    [1, 2, D],
    [3, 4, 5],
    [6, 7, 8],
  ],
  // Sprinter / Crafter 19+1: 2+1 sıralar, sağ önde kapı, arkada dörtlü sıra.
  "sprinter-19": [
    ["driver", null, null, "guide"],
    [1, 2, null, D],
    [3, 4, null, 5],
    [6, 7, null, 8],
    [9, 10, null, 11],
    [12, 13, null, 14],
    [15, 16, 17, 18],
  ],
  // Otokar Sultan 31+1: 2+2 sıralar, sağ önde kapı.
  "sultan-31": [
    ["driver", null, null, null, "guide"],
    [1, 2, null, D, D],
    ...Array.from({ length: 7 }, (_, i) => {
      const n = 3 + i * 4;
      return [n, n + 1, null, n + 2, n + 3];
    }),
  ],
  // Mercedes Travego 46+1: 2+2 sıralar, ön ve orta kapı, arkada beşli sıra.
  "travego-46": [
    ["driver", null, null, null, "guide"],
    [1, 2, null, D, D],
    ...Array.from({ length: 5 }, (_, i) => {
      const n = 3 + i * 4;
      return [n, n + 1, null, n + 2, n + 3];
    }),
    [23, 24, null, D, D],
    ...Array.from({ length: 4 }, (_, i) => {
      const n = 25 + i * 4;
      return [n, n + 1, null, n + 2, n + 3];
    }),
    [41, 42, 43, 44, 45],
  ],
};
// Filodaki aracın koltuk planı: sınıfın genel düzeni yerine aracın kendi düzeni.
export function fleetVehicleLayout(unit, vehicle) {
  const layout = seatPlans[unit.plan];
  return layout ? { ...vehicle, layout } : vehicle;
}
export const fleetVehicle = (id) => {
  const v = fleetVehicles.find((v) => v.id === id);
  if (!v) throw new AppError(400, "Seçilen araç filoda bulunamadı.");
  return v;
};
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
      shape: model.shape,
    };
  // Binek araçta koridor yoktur: arka sıra yan yana üç koltuktur.
  const aisle =
      model.aisle === undefined ? (model.columns === 2 ? 1 : 2) : model.aisle,
    width = aisle === null ? model.columns : model.columns + 1;
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
    shape: model.shape,
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
  for (const tour of tours)
    await db.insertIfAbsent("tour_operations", tour.id, {
      tour_id: tour.id,
      sales_open: tour.inquiryOnly ? 0 : 1,
      vehicle_model: "vip-midibus",
      passenger_seats: 18,
    });
  const today = () =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(clock()));
  const get = async (id) => {
    const row = await db.one("tour_operations", { _id: id });
    if (!row) throw new AppError(404, "Tur bulunamadı.");
    return {
      ...row,
      // Tur bazında transfer fiyatları (bkz. transfer.mjs); hiç ayarlanmadıysa kapalı.
      transfer: row.transfer || emptyTransfer(),
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
    async saveTransfer(id, config) {
      await get(id);
      await db.update("tour_operations", { _id: id }, { transfer: config });
      return (await get(id)).transfer;
    },
    update(id, { salesOpen, vehicleModel, passengerSeats }) {
      const vehicle = makeVehicle(vehicleModel, passengerSeats);
      return tx(async () => {
        await cleanup();
        const current = await get(id);
        if (
          current.vehicle_model !== vehicleModel ||
          current.passenger_seats !== passengerSeats
        ) {
          const upcoming = (
            await db.find(
              "departures",
              { tour_id: id, date: { $gte: today() } },
              { projection: { _id: 1, id: 1 } },
            )
          ).map((d) => d.id);
          const occupied =
            upcoming.length &&
            (await db.one("seat_locks", {
              departure_id: { $in: upcoming },
              expires_at: { $gt: clock() },
            }));
          if (occupied)
            throw new AppError(
              409,
              "Bu turda ayrılmış koltuklar var. Araç düzenini değiştirmeden önce mevcut ön rezervasyonları çözümleyin. Satışı kapatabilirsiniz.",
            );
        }
        await db.update(
          "tour_operations",
          { _id: id },
          {
            sales_open: salesOpen ? 1 : 0,
            vehicle_model: vehicleModel,
            passenger_seats: passengerSeats,
          },
        );
        return {
          ...(await get(id)),
          vehicle,
        };
      });
    },
  };
}
