// Turdan bağımsız online transfer rezervasyonu (VIP transfer sayfası).
// Havalimanı, otogar ya da tren garından Kars merkezdeki veya Sarıkamış'taki adrese
// (geliş), adresten noktaya (dönüş) ya da ikisi (gidiş-dönüş). Fiyat, turla satılan
// transferle aynı tablo biçimindedir (grup başına toplam, kişi kademesine göre) ve
// panelden ayrıca yönetilir; varsayılanı acentenin standart transfer fiyatlarıdır.
//
// Kayıt, tur rezervasyonlarıyla aynı "reservations" koleksiyonuna kind: "transfer"
// olarak yazılır; ödeme (payments.mjs), onay, iptal, iade, bilet ve panel akışları
// aynen kullanılır. Sefer ve koltuk yoktur (departure_id: null, seats: []).
// Ödeme TAM ödemedir; kartla ödeme tamamlanınca kayıt otomatik onaylanır.
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { AppError } from "./store.mjs";
import {
  TRANSFER_DESTINATIONS,
  TRANSFER_DIRECTIONS,
  TRANSFER_POINTS,
  priceTransfer,
  standardTransfer,
  tierFor,
  transferConfigSchema,
} from "./transfer.mjs";

export const TRANSFER_SERVICE_ID = "transfer";
const SETTINGS_ID = "transfer_service";
// Panelden değiştirilebilir: alınış saatinden en az bu kadar saat önce online ayrılır.
export const DEFAULT_MIN_LEAD_HOURS = 12;
// Alınış saatinden bu kadar saat öncesine kadar yapılan iptal kesintisizdir (legal.mjs).
export const TRANSFER_FREE_CANCEL_HOURS = 24;
// En fazla bu kadar gün sonrası için online transfer ayrılır.
export const MAX_ADVANCE_DAYS = 365;
// Aynı e-postanın ödemesi tamamlanmamış en çok bu kadar transfer kaydı olabilir.
const PENDING_PER_EMAIL = 3;
export const MAX_PAX = 15;

// Kısa yer adları (başlık ve e-posta için) ve İngilizceleri.
const DEST_SHORT = { kars: "Kars merkez", sarikamis: "Sarıkamış" };
const DEST_SHORT_EN = { kars: "Kars city centre", sarikamis: "Sarıkamış" };
const POINT_EN = {
  airport: "Kars Harakani Airport",
  bus: "Kars Bus Terminal",
  train: "Kars Railway Station",
};
const pointLabel = (id) =>
  TRANSFER_POINTS.find((p) => p.id === id)?.label || id;

// Şemalar ilk kullanımda kurulur: transfer.mjs ↔ store.mjs döngüsel içe aktarımında bu
// modül, transfer.mjs'in sabitleri hazır olmadan değerlendirilebilir.
const lazy = (build) => {
  let value;
  return () => (value ??= build());
};
// Panel ayarı: satış açık/kapalı, en az kaç saat önceden ve fiyat tablosu.
export const transferServiceSchema = lazy(() =>
  transferConfigSchema.extend({
    minLeadHours: z.number().int().min(1).max(168),
  }),
);
export const defaultTransferService = () => ({
  ...standardTransfer(),
  // Canlıda gerçek tahsilat yapıldığı için satış panelden bilerek açılır.
  enabled: false,
  minLeadHours: DEFAULT_MIN_LEAD_HOURS,
});

const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir tarih seçin.")
  .refine(
    (s) => new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s,
    "Geçerli bir tarih seçin.",
  );
const hm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Geçerli bir saat seçin.");
const leg = z
  .object({
    date: ymd,
    time: hm,
    // Uçuş numarası (havalimanında zorunlu) ya da otobüs / tren sefer bilgisi.
    flight: z
      .string()
      .trim()
      .max(40)
      .regex(
        /^[\p{L}\d .:/-]*$/u,
        "Uçuş veya sefer bilgisini harf ve rakamla yazın (ör. TK2734).",
      )
      .default(""),
  })
  .strict();
// Müşterinin seçimi (fiyat teklifi, ön bilgi formu ve rezervasyon aynı alanları kullanır).
export const transferTripSchema = lazy(() =>
  z.object({
    point: z.enum(TRANSFER_POINTS.map((p) => p.id)),
    destination: z.enum(TRANSFER_DESTINATIONS.map((d) => d.id)),
    direction: z.enum(Object.keys(TRANSFER_DIRECTIONS)),
    arrival: leg.optional(),
    departure: leg.optional(),
    pax: z.number().int().min(1).max(MAX_PAX),
    bags: z.number().int().min(0).max(40).default(0),
    // Kars merkezde veya Sarıkamış'taki otel adı / açık adres.
    address: z.string().trim().min(3, "Otel adını veya adresi yazın.").max(200),
  }),
);

const atOf = (l) => Date.parse(`${l.date}T${l.time}:00+03:00`);
const trDate = (ymdText) => {
  const [y, m, d] = String(ymdText || "").split("-");
  return y && m && d ? `${d}.${m}.${y}` : String(ymdText || "");
};

// Yön seçimine göre gereken bacaklar; tarih/saat, önceden ayırma süresi ve uçuş no denetlenir.
// Dönüş: { legs: [{ type, date, time, flight, at }] } (zamana göre sıralı).
export function transferLegs(
  trip,
  { now, minLeadHours = DEFAULT_MIN_LEAD_HOURS },
) {
  const types =
    trip.direction === "both" ? ["arrival", "departure"] : [trip.direction];
  const legs = types.map((type) => {
    const l = trip[type];
    if (!l)
      throw new AppError(
        400,
        type === "arrival"
          ? "Geliş tarihini ve saatini seçin."
          : "Dönüş tarihini ve saatini seçin.",
      );
    const at = atOf(l);
    if (!Number.isFinite(at))
      throw new AppError(400, "Geçerli bir tarih ve saat seçin.");
    if (at <= now)
      throw new AppError(400, "Geçmiş bir tarih veya saat seçilemez.");
    if (at < now + minLeadHours * 3600000)
      throw new AppError(
        400,
        `Online transfer alınış saatinden en az ${minLeadHours} saat önce ayrılabilir. Daha yakın bir saat için bizi arayın.`,
      );
    if (at > now + MAX_ADVANCE_DAYS * 86400000)
      throw new AppError(
        400,
        "Online transfer en fazla bir yıl sonrası için ayrılabilir.",
      );
    if (trip.point === "airport" && !l.flight)
      throw new AppError(
        400,
        type === "arrival"
          ? "Geliş uçuş numaranızı yazın."
          : "Dönüş uçuş numaranızı yazın.",
      );
    return { type, date: l.date, time: l.time, flight: l.flight || "", at };
  });
  if (legs.length === 2 && legs[1].at <= legs[0].at)
    throw new AppError(400, "Dönüş transferi gelişten sonra olmalı.");
  return legs.sort((a, b) => a.at - b.at);
}

// Başlık: "VIP transfer · Kars Harakani Havalimanı → Kars merkez".
export function transferTitle(b, lang = "tr") {
  if (!b) return "VIP transfer";
  const point = lang === "en" ? POINT_EN[b.point] : pointLabel(b.point),
    place =
      (lang === "en" ? DEST_SHORT_EN : DEST_SHORT)[b.destination] ||
      b.destination,
    route =
      b.direction === "arrival"
        ? `${point} → ${place}`
        : b.direction === "departure"
          ? `${place} → ${point}`
          : `${point} ⇄ ${place}`;
  return `VIP transfer · ${route}`;
}
// Bacak satırı: "Geliş · 28.11.2026 14:30 · Kars Harakani Havalimanı → Otel adı · uçuş TK2734".
export function legLine(b, l, lang = "tr") {
  const point = lang === "en" ? POINT_EN[b.point] : pointLabel(b.point),
    flightWord =
      b.point === "airport"
        ? lang === "en"
          ? "flight"
          : "uçuş"
        : lang === "en"
          ? "service"
          : "sefer",
    route =
      l.type === "arrival"
        ? `${point} → ${b.address}`
        : `${b.address} → ${point}`,
    label =
      lang === "en"
        ? l.type === "arrival"
          ? "Arrival"
          : "Departure"
        : l.type === "arrival"
          ? "Geliş"
          : "Dönüş";
  return `${label} · ${trDate(l.date)} ${l.time} · ${route}${l.flight ? ` · ${flightWord} ${l.flight}` : ""}`;
}
// İlk bacağın alınış yeri (bilet ve ödeme ekranında "Alınış").
export const pickupOf = (b) =>
  !b?.legs?.length
    ? ""
    : b.legs[0].type === "arrival"
      ? pointLabel(b.point) +
        (b.legs[0].flight
          ? ` · ${b.point === "airport" ? "uçuş" : "sefer"} ${b.legs[0].flight}`
          : "")
      : b.address;
// E-posta ve panel için ayrıntı satırları.
export function transferDetailLines(r, lang = "tr") {
  const b = r.transfer_booking;
  if (!b) return [];
  return [
    ...(b.legs || []).map((l) => legLine(b, l, lang)),
    lang === "en"
      ? `${r.pax} passenger${r.pax > 1 ? "s" : ""} · ${b.bags} bag${b.bags === 1 ? "" : "s"}`
      : `${r.pax} kişi · ${b.bags} bagaj`,
  ];
}
// İngilizce e-posta bölümü (onay ve iptal e-postalarında Türkçenin altında).
export function transferEnglish(r, headline) {
  return [
    headline,
    `${r.reference} · ${transferTitle(r.transfer_booking, "en")}`,
    ...transferDetailLines(r, "en"),
    `Total: ${(r.total / 100).toFixed(2)} TL`,
  ];
}

export async function createTransferBookings(
  db,
  { clock, tx, cleanup, workflow, env = process.env },
) {
  const settings = async () => {
    const body = (await db.one("integration_settings", { _id: SETTINGS_ID }))
      ?.body;
    const parsed = body && transferServiceSchema().safeParse(body);
    return parsed?.success ? parsed.data : defaultTransferService();
  };
  // Fiyat ve bacaklar sunucuda hesaplanır; istemcinin gösterdiği fiyata güvenilmez.
  const quote = async (trip, { paymentEnabled }) => {
    const s = await settings();
    if (!s.enabled || !paymentEnabled)
      throw new AppError(
        409,
        "Online transfer satışı şu anda kapalı. Transfer için bizi arayın veya WhatsApp'tan yazın.",
      );
    if (!tierFor(trip.pax))
      throw new AppError(
        400,
        "15 kişiden kalabalık gruplar için transferi acenteyle planlayalım; lütfen bizi arayın.",
      );
    const legs = transferLegs(trip, {
      now: clock(),
      minLeadHours: s.minLeadHours,
    });
    const priced = priceTransfer(
      s,
      {
        point: trip.point,
        destination: trip.destination,
        direction: trip.direction,
        info: legs
          .map(
            (l) =>
              `${l.type === "arrival" ? "Geliş" : "Dönüş"} ${trDate(l.date)} ${l.time}${l.flight ? " " + l.flight : ""}`,
          )
          .join(" / "),
      },
      trip.pax,
    );
    const booking = {
      point: trip.point,
      destination: trip.destination,
      direction: trip.direction,
      address: trip.address,
      bags: trip.bags || 0,
      legs: legs.map(({ type, date, time, flight }) => ({
        type,
        date,
        time,
        flight,
      })),
    };
    return {
      priced,
      booking,
      legs,
      amount: priced.amount,
      startsAt: legs[0].at,
      settings: s,
    };
  };
  return {
    settings,
    async saveSettings(input) {
      const value = transferServiceSchema().parse(input);
      await db.upsert("integration_settings", SETTINGS_ID, {
        id: SETTINGS_ID,
        body: value,
        updated_at: clock(),
      });
      return settings();
    },
    // Sitede gösterilen ayar: satış yalnız online ödeme açıkken açıktır.
    async publicConfig({ paymentEnabled }) {
      const s = await settings();
      return {
        enabled: Boolean(s.enabled && paymentEnabled),
        minLeadHours: s.minLeadHours,
        freeCancelHours: TRANSFER_FREE_CANCEL_HOURS,
        maxPax: MAX_PAX,
        maxAdvanceDays: MAX_ADVANCE_DAYS,
        oneWay: s.oneWay,
        roundTrip: s.roundTrip,
      };
    },
    quote,
    // Ödeme öncesi kayıt: tam ödeme planıyla "pending_agency". Kartla ödeme tamamlanınca
    // payments.mjs kaydı onaylar. Ödenmeyen kayıt PENDING_HOLD_HOURS (varsayılan 24) saat
    // sonra ya da alınış saatinde (hangisi önceyse) düşer.
    reserve(
      input,
      { memberId = null, legal = null, paymentEnabled = false } = {},
    ) {
      return tx(async () => {
        await cleanup();
        const q = await quote(input, { paymentEnabled }),
          email = input.email.toLowerCase();
        const pending = await db.count("reservations", {
          kind: "transfer",
          email,
          status: "pending_agency",
          expires_at: { $gt: clock() },
        });
        if (pending >= PENDING_PER_EMAIL)
          throw new AppError(
            409,
            "Bu e-posta ile ödemesi tamamlanmamış transfer kayıtları var. Önce onları tamamlayın veya iptal edin.",
          );
        const id = randomUUID(),
          reference = "RK-" + randomBytes(5).toString("hex").toUpperCase(),
          first = q.legs[0],
          expires = Math.min(
            clock() +
              Math.max(1, Number(env.PENDING_HOLD_HOURS) || 24) * 3600000,
            q.startsAt,
          );
        await db.insert("reservations", id, {
          id,
          reference,
          kind: "transfer",
          departure_id: null,
          email,
          name: input.name,
          phone: input.phone,
          passengers: [input.name],
          passenger_details: [],
          seats: [],
          pax: input.pax,
          total: q.amount,
          deposit: q.amount,
          subtotal: q.amount,
          discount_amount: 0,
          discount_percent: 0,
          status: "pending_agency",
          created_at: clock(),
          expires_at: expires,
          member_id: memberId,
          coupon_id: null,
          ticket_token: randomBytes(24).toString("hex"),
          source: "web",
          created_by: null,
          payment_mode: "full",
          notes: String(input.notes || "").slice(0, 500),
          lang: input.lang === "en" ? "en" : "tr",
          transfer: q.priced,
          transfer_amount: q.amount,
          transfer_booking: q.booking,
          service_date: first.date,
          service_time: first.time,
        });
        return workflow.created(reference, { legal, notifyCustomer: false });
      });
    },
  };
}
