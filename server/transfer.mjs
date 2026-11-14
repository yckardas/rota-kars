// Tur rezervasyonuna eklenebilen transfer: havalimanı, otogar veya tren garından tur
// buluşma noktasına (geliş), turdan bu noktaya (dönüş) ya da ikisi. Fiyatlar tur
// bazında panelden yönetilir ve GRUP BAŞINA TOPLAMDIR: rezervasyondaki kişi sayısına
// göre kademe seçilir (1 kişi / 2–4 kişi / 5 kişi ve üzeri). Gidiş-dönüş fiyatı ayrı
// tablodadır (panel ilk açılışta tek yönün iki katını önerir).
import { z } from "zod";
import { AppError } from "./store.mjs";

export const TRANSFER_POINTS = [
  { id: "airport", label: "Kars Harakani Havalimanı" },
  { id: "bus", label: "Kars Otogarı" },
  { id: "train", label: "Kars Garı" },
];
export const TRANSFER_TIERS = [
  { id: "1", label: "1 kişi", min: 1, max: 1 },
  { id: "2-4", label: "2–4 kişi", min: 2, max: 4 },
  { id: "5+", label: "5 kişi ve üzeri", min: 5, max: Infinity },
];
export const TRANSFER_DIRECTIONS = {
  arrival: "Gelişte: noktadan tur buluşmasına",
  departure: "Dönüşte: turdan noktaya",
  both: "Gidiş-dönüş",
};
export const tierFor = (count) => TRANSFER_TIERS.find((t) => count >= t.min && count <= t.max) || TRANSFER_TIERS.at(-1);

// Panelden gelen fiyat tablosu: boş (null) hücre o nokta/kademe için transfer yok demektir.
const price = z.number().int().min(1).max(10000000).nullable();
const tierPrices = z.object(Object.fromEntries(TRANSFER_TIERS.map((t) => [t.id, price])));
const table = z.object(Object.fromEntries(TRANSFER_POINTS.map((p) => [p.id, tierPrices])));
export const transferConfigSchema = z.object({
  enabled: z.boolean(),
  oneWay: table,
  roundTrip: table,
});
export const emptyTransfer = () => {
  const blank = () =>
    Object.fromEntries(TRANSFER_POINTS.map((p) => [p.id, Object.fromEntries(TRANSFER_TIERS.map((t) => [t.id, null]))]));
  return { enabled: false, oneWay: blank(), roundTrip: blank() };
};
// Müşterinin seçimi (rezervasyon, fiyat teklifi ve ön bilgi formu aynı şemayı kullanır).
export const transferChoiceSchema = z
  .object({
    point: z.enum(TRANSFER_POINTS.map((p) => p.id)),
    direction: z.enum(Object.keys(TRANSFER_DIRECTIONS)),
    // Uçuş / otobüs / tren bilgisi ve saati; acente karşılamayı buna göre planlar.
    info: z.string().trim().max(160).default(""),
  })
  .strict();

// Seçim + tur ayarı + kişi sayısı → fiyatlanmış transfer (rezervasyona yazılan hâli).
export function priceTransfer(config, choice, count) {
  if (!choice) return null;
  if (!config?.enabled) throw new AppError(400, "Bu tur için transfer şu anda sunulmuyor.");
  const tier = tierFor(count),
    tableKey = choice.direction === "both" ? "roundTrip" : "oneWay",
    amount = config[tableKey]?.[choice.point]?.[tier.id];
  if (!amount)
    throw new AppError(400, "Seçtiğiniz nokta ve kişi sayısı için transfer fiyatı yok. Lütfen başka bir seçenek deneyin.");
  const point = TRANSFER_POINTS.find((p) => p.id === choice.point);
  return {
    point: point.id,
    pointLabel: point.label,
    direction: choice.direction,
    directionLabel: TRANSFER_DIRECTIONS[choice.direction],
    tier: tier.id,
    tierLabel: tier.label,
    amount,
    info: choice.info || "",
  };
}
// Sözleşme, e-posta ve panel için tek satır özet.
export const transferLine = (t) =>
  t ? `Transfer: ${t.pointLabel} · ${t.directionLabel} · ${t.tierLabel}${t.info ? ` · ${t.info}` : ""}` : "";

// Kasım 2026: acentenin verdiği standart transfer fiyatları (grup başına toplam):
// 1 kişi 300 TL, 2–4 kişi 750 TL, 5+ kişi 1.200 TL; üç noktada da aynı. Gidiş-dönüş
// tek yönün iki katı. Her veritabanında bir kez çalışır ve yalnız transferi hiç
// ayarlanmamış turlara yazılır; panelden girilmiş fiyatlara dokunmaz.
export const STANDARD_TRANSFER_RELEASE = "transfer_prices_2026_11";
export const standardTransfer = () => {
  const one = { 1: 30000, "2-4": 75000, "5+": 120000 },
    both = { 1: 60000, "2-4": 150000, "5+": 240000 };
  return {
    enabled: true,
    oneWay: Object.fromEntries(TRANSFER_POINTS.map((p) => [p.id, { ...one }])),
    roundTrip: Object.fromEntries(TRANSFER_POINTS.map((p) => [p.id, { ...both }])),
  };
};
const untouched = (t) =>
  !t || (!t.enabled && [t.oneWay, t.roundTrip].every((table) => Object.values(table || {}).every((tiers) => Object.values(tiers).every((v) => !v))));
export async function applyStandardTransfer(db, { clock }) {
  if (await db.one("integration_settings", { _id: STANDARD_TRANSFER_RELEASE })) return { applied: 0 };
  let applied = 0;
  for (const row of await db.find("tour_operations", {}))
    if (untouched(row.transfer)) {
      await db.update("tour_operations", { _id: row.tour_id }, { transfer: standardTransfer() });
      applied++;
    }
  await db.upsert("integration_settings", STANDARD_TRANSFER_RELEASE, {
    id: STANDARD_TRANSFER_RELEASE,
    body: { appliedAt: clock(), applied },
    updated_at: clock(),
  });
  return { applied };
}
