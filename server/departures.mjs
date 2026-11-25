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
// Kasım 2026 müşteri düzeltmesi: sabit buluşma noktası yerine Kars merkezde ev ve otelden alınış.
export const DEFAULT_PICKUP =
  "Kars merkezde ev, otel ve yakın noktalardan alıp bırakma";
export const OLD_DEFAULT_PICKUP = "Kars merkez · Acente buluşma noktası";
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
    const price = custom ?? tourPrice(row.tour_id);
    return {
      ...row,
      // Fiyatın tek kaynağı turun (panelden düzenlenen) fiyatı; sefer yalnız bilinçli
      // verilmiş özel fiyatla ondan ayrılır. Toplamlar hep bu alandan hesaplanır.
      price,
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
      // Aynı tarihteki ek araçlar 1. aracın id'siyle bağlanır (eski kayıtlarda alan yoktur).
      group_id: row.group_id || row.id,
      vehicle_no: Number(row.vehicle_no) || 1,
      // Online satışa kapalı koltuklar; acenta panelden yine yazabilir.
      closed_seats: (Array.isArray(row.closed_seats) ? row.closed_seats : []).filter(
        (n) => Number.isInteger(n) && n >= 1 && n <= (unit ? fleetVehicleLayout(unit, vehicle) : vehicle).sellableSeats,
      ),
      start_time:
        row.start_time ||
        tours
          .find((t) => t.id === row.tour_id)
          ?.departure.match(/^\d{2}:\d{2}$/)?.[0] ||
        "08:30",
      pickup: row.pickup || DEFAULT_PICKUP,
      guide_name: row.guide_name || "",
      guide_phone: row.guide_phone || "",
      // Seferin satış modu: null turun moduna uyar; "demand"/"online" yalnız bu tarih için
      // (ör. talep toplayan turda eşiği dolan tarih online satışa geçer).
      sales_mode: row.sales_mode ?? null,
      mode: row.sales_mode || base.mode,
      demand: (row.sales_mode || base.mode) === "demand",
      // Talep toplayan tarihte koltuk satılmaz; yalnız ön kayıt alınır.
      // Fiyatı girilmemiş (0) turun seferi de satılmaz: bedelsiz rezervasyon oluşmasın.
      salesOpen:
        base.salesOpen && (row.sales_mode || base.mode) !== "demand" && Boolean(row.active) && price > 0,
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
      const listed = await Promise.all(
        rows.map(async (row) => {
          const d = withCutoff(await enrich(row)),
            locked = new Set(
              (
                await db.find(
                  "seat_locks",
                  { departure_id: d.id, expires_at: { $gt: clock() } },
                  { projection: { seat: 1 } },
                )
              ).map((l) => l.seat),
            ),
            closed = d.closed_seats.filter((n) => !locked.has(n)).length;
          return { ...d, closed, available: d.vehicle.sellableSeats - locked.size - closed };
        }),
      );
      // Grubun satışı açık araçlarındaki toplam boş yer (bekleme listesi ve panel için).
      const groupFree = new Map();
      for (const d of listed)
        if (d.salesOpen) groupFree.set(d.group_id, (groupFree.get(d.group_id) || 0) + d.available);
      return listed.map((d) => ({ ...d, group_available: groupFree.get(d.group_id) || 0 }));
    },
    // group: "Araç ekle"den gelen ek araç ({ group_id, vehicle_no }); aynı tarih/saat kontrolünü atlar.
    async save(input, { group } = {}) {
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
        // Aynı tarihteki diğer araçlar (ek araç eklenince hepsinde group_id yazılıdır).
        const siblings = old
            ? await db.find("departures", { group_id: old.group_id, _id: { $ne: id } })
            : [],
          shared =
            old &&
            (old.date !== input.date ||
              old.price !== (input.price ?? tourPrice(input.tourId)) ||
              old.start_time !== input.startTime);
        // Satış modu: gönderilmezse eski değer kalır; ek araç grubun modunu alır.
        const salesMode =
          input.salesMode !== undefined
            ? input.salesMode
            : old
              ? old.sales_mode
              : group
                ? (await db.one("departures", { _id: group.group_id }))?.sales_mode ?? null
                : null;
        if (
          old &&
          !old.demand &&
          (salesMode || (await operations.get(input.tourId)).mode) === "demand" &&
          (await this.hasActiveBookings(old.group_id))
        )
          throw new AppError(409, "Bu tarihte rezervasyon var; talep toplamaya alınamaz.");
        if (
          (changed &&
            (await db.one("seat_locks", {
              departure_id: id,
              expires_at: { $gt: clock() },
            }))) ||
          (shared &&
            siblings.length &&
            (await db.one("seat_locks", {
              departure_id: { $in: siblings.map((x) => x.id) },
              expires_at: { $gt: clock() },
            })))
        )
          throw new AppError(
            409,
            "Ayrılmış koltuklar varken tarih, fiyat veya araç değiştirilemez. Yolcuyu başka sefere taşıyabilirsiniz.",
          );
        // Aynı tur, tarih ve saatte ikinci sefer açılmaz: müşteri aynı günü iki kez görürdü.
        if (!group && (!old || old.date !== input.date || old.start_time !== input.startTime)) {
          const own = old?.group_id;
          // Saatsiz eski kayıtlar okuma anında turun saatini alır; karşılaştırma okunan saatle.
          const twin = (await this.list({ tourId: input.tourId, date: input.date })).find(
            (x) => x.start_time === input.startTime && x.id !== id && x.group_id !== own,
          );
          if (twin)
            throw new AppError(
              409,
              "Bu tarih ve saatte sefer var; ikinci araç için seferde 'Araç ekle'yi kullanın.",
            );
        }
        if (old && old.date !== input.date)
          for (const x of siblings.filter((x) => x.vehicle_id)) {
            const clash = await db.one("departures", {
              vehicle_id: x.vehicle_id,
              date: input.date,
              group_id: { $ne: old.group_id },
            });
            if (clash)
              throw new AppError(
                409,
                `${x.vehicle_no || ""}. aracın plakası ${input.date} günü başka bir sefere atanmış. Önce o seferin aracını değiştirin.`,
              );
          }
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
          // Araç küçülürse kapasite dışında kalan kapalı koltuklar atılır.
          closed_seats: (old?.closed_seats || []).filter(
            (n) => n <= makeVehicle(input.vehicleModel, input.passengerSeats).sellableSeats,
          ),
          sales_mode: salesMode,
        };
        if (old) {
          await db.update("departures", { _id: id }, fields);
          // Tarih, saat, fiyat, buluşma noktası ve satış modu gruptaki tüm araçlarda aynıdır.
          if (siblings.length)
            await db.updateMany(
              "departures",
              { group_id: old.group_id, _id: { $ne: id } },
              {
                date: fields.date,
                start_time: fields.start_time,
                price: fields.price,
                pickup: fields.pickup,
                sales_mode: fields.sales_mode,
              },
            );
          // Ön kayıtlar sefer grubuna bağlıdır; tarih değişince kayıttaki tarih de güncellenir.
          if (old.date !== input.date)
            await db.updateMany("interest_list", { departure_id: old.group_id }, { departure_date: input.date });
        } else
          await db.insert("departures", id, {
            id,
            tour_id: input.tourId,
            ...fields,
            ...(group || {}),
          });
        return this.get(id, { allowClosed: true, allowPast: true });
      });
    },
    // Dolan tarihe ek araç: tarih, saat, fiyat, buluşma noktası, aktiflik ve araç tipi 1. araçtan
    // gelir; plaka, rehber ve kapalı koltuklar araca özeldir ve boş başlar.
    async addVehicle(id) {
      return tx(async () => {
        const src = await this.get(id, { allowClosed: true, allowPast: true }),
          gid = src.group_id,
          base = await this.get(gid, { allowClosed: true, allowPast: true }),
          members = await db.find("departures", { group_id: gid });
        await db.update("departures", { _id: gid }, { group_id: gid, vehicle_no: 1 });
        const next = Math.max(1, ...members.map((m) => Number(m.vehicle_no) || 1)) + 1;
        return this.save(
          {
            tourId: base.tour_id,
            date: base.date,
            startTime: base.start_time,
            price: base.custom_price,
            pickup: base.pickup,
            guideName: "",
            guidePhone: "",
            vehicleModel: base.vehicle.modelId,
            passengerSeats: base.vehicle.passengerSeats,
            vehicleId: "",
            active: Boolean(base.active),
          },
          { group: { group_id: gid, vehicle_no: next } },
        );
      });
    },
    // Online satışa kapalı koltuklar (ör. arka dörtlü). Satılmış koltuk sonradan kapatılamaz;
    // kapalı koltuğa acenta yazdıysa iptalde koltuk yeniden kapalıya döner.
    async setClosedSeats(id, seats) {
      return tx(async () => {
        await cleanup();
        const d = await this.get(id, { allowClosed: true, allowPast: true }),
          max = d.vehicle.sellableSeats;
        if (!Array.isArray(seats) || seats.some((n) => !Number.isInteger(n) || n < 1 || n > max))
          throw new AppError(400, `Yalnızca 1–${max} numaralı koltuklar kapatılabilir.`);
        const next = [...new Set(seats)].sort((a, b) => a - b),
          added = next.filter((n) => !d.closed_seats.includes(n));
        if (
          added.length &&
          (await db.one("seat_locks", {
            _id: { $in: added.map((n) => `${id}:${n}`) },
            expires_at: { $gt: clock() },
          }))
        )
          throw new AppError(409, "Bu koltuk dolu; önce rezervasyonu taşıyın.");
        await db.update("departures", { _id: id }, { closed_seats: next });
        return this.get(id, { allowClosed: true, allowPast: true });
      });
    },
    // Tarihin (gruptaki herhangi bir aracın) aktif rezervasyonu var mı?
    async hasActiveBookings(groupId) {
      const ids = [groupId, ...(await db.find("departures", { group_id: groupId })).map((x) => x.id)];
      return Boolean(
        await db.one("reservations", {
          departure_id: { $in: ids },
          status: { $in: ["pending_agency", "confirmed"] },
        }),
      );
    },
    // Yanlış açılmış sefer silinebilir; kaydı (iptal edilmiş olsa da) olan sefer yalnız kapatılır.
    async remove(id) {
      return tx(async () => {
        const d = await this.get(id, { allowClosed: true, allowPast: true });
        if (d.vehicle_no === 1 && (await db.one("departures", { group_id: id, _id: { $ne: id } })))
          throw new AppError(409, "Bu tarihin ek araçları var; önce diğer araçları silin.");
        if (await db.one("reservations", { departure_id: id }))
          throw new AppError(409, "Bu seferde rezervasyon kaydı var; silmek yerine satışa kapatın.");
        if (
          d.id === d.group_id &&
          (await db.one("interest_list", { departure_id: id, status: { $in: ["waiting", "notified"] } }))
        )
          throw new AppError(409, "Bu tarihte ön kayıt var; önce kayıtları kapatın.");
        await db.remove("seat_locks", { departure_id: id });
        await db.remove("departures", { _id: id });
        return { ok: true };
      });
    },
  };
}
