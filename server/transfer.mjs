// Tur rezervasyonuna eklenebilen transfer: havalimanı, otogar veya tren garından Kars
// merkezdeki ya da Sarıkamış'taki konaklama yerine (geliş), konaklama yerinden bu noktaya
// (dönüş) ya da ikisi. Fiyatlar tur bazında panelden yönetilir ve GRUP BAŞINA TOPLAMDIR:
// rezervasyondaki kişi sayısına göre kademe seçilir (1 / 2–3 / 4–6 / 7–15 kişi).
// Gidiş-dönüş fiyatı ayrı tablodadır (panel tek yönün iki katını önerir).
// Tablo biçimi: oneWay[varış yeri][nokta][kademe].
import { z } from "zod";
import { AppError } from "./store.mjs";

export const TRANSFER_POINTS = [
  { id: "airport", label: "Kars Harakani Havalimanı" },
  { id: "bus", label: "Kars Otogarı" },
  { id: "train", label: "Kars Tren Garı" },
];
export const TRANSFER_DESTINATIONS = [
  { id: "kars", label: "Kars merkez konaklama yeri" },
  { id: "sarikamis", label: "Sarıkamış konaklama yeri" },
];
export const TRANSFER_TIERS = [
  { id: "1", label: "1 kişi", min: 1, max: 1 },
  { id: "2-3", label: "2–3 kişi", min: 2, max: 3 },
  { id: "4-6", label: "4–6 kişi", min: 4, max: 6 },
  { id: "7-15", label: "7–15 kişi", min: 7, max: 15 },
];
export const TRANSFER_DIRECTIONS = {
  arrival: "Gelişte: noktadan konaklama yerine",
  departure: "Dönüşte: konaklama yerinden noktaya",
  both: "Gidiş-dönüş",
};
// 15 kişiden kalabalık gruba kademe yoktur (transfer acenteyle ayrıca planlanır).
export const tierFor = (count) =>
  TRANSFER_TIERS.find((t) => count >= t.min && count <= t.max) || null;

// Panelden gelen fiyat tablosu: boş (null) hücre o nokta/kademe için transfer yok demektir.
const price = z.number().int().min(1).max(10000000).nullable();
const tierPrices = z.object(
  Object.fromEntries(TRANSFER_TIERS.map((t) => [t.id, price])),
);
const pointTable = z.object(
  Object.fromEntries(TRANSFER_POINTS.map((p) => [p.id, tierPrices])),
);
const table = z.object(
  Object.fromEntries(TRANSFER_DESTINATIONS.map((d) => [d.id, pointTable])),
);
export const transferConfigSchema = z.object({
  enabled: z.boolean(),
  oneWay: table,
  roundTrip: table,
});
const blankTable = (fill = () => null) =>
  Object.fromEntries(
    TRANSFER_DESTINATIONS.map((d) => [
      d.id,
      Object.fromEntries(
        TRANSFER_POINTS.map((p) => [
          p.id,
          Object.fromEntries(TRANSFER_TIERS.map((t) => [t.id, fill(d, t)])),
        ]),
      ),
    ]),
  );
export const emptyTransfer = () => ({
  enabled: false,
  oneWay: blankTable(),
  roundTrip: blankTable(),
});
// Eski biçimdeki (varış yeri olmayan) kayıt yeni kodda fiyat üretmesin: boş tablo sayılır.
export const normalizeTransfer = (config) =>
  config &&
  TRANSFER_DESTINATIONS.every(
    (d) => config.oneWay?.[d.id] && config.roundTrip?.[d.id],
  )
    ? config
    : emptyTransfer();
// Müşterinin seçimi (rezervasyon, fiyat teklifi ve ön bilgi formu aynı şemayı kullanır).
export const transferChoiceSchema = z
  .object({
    point: z.enum(TRANSFER_POINTS.map((p) => p.id)),
    destination: z.enum(TRANSFER_DESTINATIONS.map((d) => d.id)).default("kars"),
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
    destination = choice.destination || "kars",
    tableKey = choice.direction === "both" ? "roundTrip" : "oneWay",
    amount = tier && config[tableKey]?.[destination]?.[choice.point]?.[tier.id];
  if (!tier)
    throw new AppError(
      400,
      "15 kişiden kalabalık gruplar için transferi acenteyle planlayalım; lütfen bizi arayın.",
    );
  if (!amount)
    throw new AppError(
      400,
      "Seçtiğiniz nokta ve kişi sayısı için transfer fiyatı yok. Lütfen başka bir seçenek deneyin.",
    );
  const point = TRANSFER_POINTS.find((p) => p.id === choice.point),
    place = TRANSFER_DESTINATIONS.find((d) => d.id === destination);
  return {
    point: point.id,
    pointLabel: point.label,
    destination: place.id,
    destinationLabel: place.label,
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
  t
    ? `Transfer: ${t.pointLabel}${t.destinationLabel ? ` ↔ ${t.destinationLabel}` : ""} · ${t.directionLabel} · ${t.tierLabel}${t.info ? ` · ${t.info}` : ""}`
    : "";

// Kasım 2026 (15 Kasım güncellemesi): acentenin verdiği tek yön transfer fiyatları (grup
// başına toplam, üç noktada da aynı). Gidiş-dönüş tek yönün iki katı.
//   Kars merkez konaklama:   1 kişi 400 · 2–3 kişi 1.000 · 4–6 kişi 1.800 · 7–15 kişi 2.500 TL
//   Sarıkamış konaklama:     1 kişi 2.500 · 2–3 kişi 4.000 · 4–6 kişi 5.000 · 7–15 kişi 7.000 TL
// Tablo biçimi değiştiği için her veritabanında bir kez bütün turlara yazılır; turun
// transferi panelden kapatılmışsa kapalı kalır.
export const STANDARD_TRANSFER_RELEASE = "transfer_prices_2026_11_15";
const STANDARD_ONE_WAY = {
  kars: { 1: 40000, "2-3": 100000, "4-6": 180000, "7-15": 250000 },
  sarikamis: { 1: 250000, "2-3": 400000, "4-6": 500000, "7-15": 700000 },
};
export const standardTransfer = () => ({
  enabled: true,
  oneWay: blankTable((d, t) => STANDARD_ONE_WAY[d.id][t.id]),
  roundTrip: blankTable((d, t) => STANDARD_ONE_WAY[d.id][t.id] * 2),
});
export async function applyStandardTransfer(db, { clock }) {
  if (await db.one("integration_settings", { _id: STANDARD_TRANSFER_RELEASE })) return { applied: 0 };
  let applied = 0;
  for (const row of await db.find("tour_operations", {})) {
    await db.update(
      "tour_operations",
      { _id: row.tour_id },
      {
        transfer: {
          ...standardTransfer(),
          enabled: row.transfer ? row.transfer.enabled !== false : true,
        },
      },
    );
    applied++;
  }
  await db.upsert("integration_settings", STANDARD_TRANSFER_RELEASE, {
    id: STANDARD_TRANSFER_RELEASE,
    body: { appliedAt: clock(), applied },
    updated_at: clock(),
  });
  return { applied };
}
