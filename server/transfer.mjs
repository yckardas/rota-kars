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
