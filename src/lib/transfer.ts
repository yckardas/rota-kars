// Tura eklenen transfer (sunucudaki server/transfer.mjs ile aynı kurallar).
// Havalimanı, otogar ya da tren garından Kars merkezdeki veya Sarıkamış'taki konaklama
// yerine. Fiyat grup başına toplamdır; kademe rezervasyondaki kişi sayısından seçilir.
export type TransferPointId = "airport" | "bus" | "train";
export type TransferDestinationId = "kars" | "sarikamis";
export type TransferTierId = "1" | "2-3" | "4-6" | "7-15";
export type TransferDirection = "arrival" | "departure" | "both";
export type TransferPointTable = Record<
  TransferPointId,
  Record<TransferTierId, number | null>
>;
export type TransferTable = Record<TransferDestinationId, TransferPointTable>;
export type TransferConfig = {
  enabled: boolean;
  oneWay: TransferTable;
  roundTrip: TransferTable;
};
export type TransferChoice = {
  point: TransferPointId;
  destination: TransferDestinationId;
  direction: TransferDirection;
  info: string;
};
export type PricedTransfer = {
  point: TransferPointId;
  pointLabel: string;
  // Kasım 2026 öncesi rezervasyonlarda varış yeri yoktur.
  destination?: TransferDestinationId;
  destinationLabel?: string;
  direction: TransferDirection;
  directionLabel: string;
  tier: string;
  tierLabel: string;
  amount: number;
  info: string;
};
export const TRANSFER_POINTS: { id: TransferPointId; label: string }[] = [
  { id: "airport", label: "Kars Harakani Havalimanı" },
  { id: "bus", label: "Kars Otogarı" },
  { id: "train", label: "Kars Tren Garı" },
];
export const TRANSFER_DESTINATIONS: {
  id: TransferDestinationId;
  label: string;
}[] = [
  { id: "kars", label: "Kars merkez konaklama yeri" },
  { id: "sarikamis", label: "Sarıkamış konaklama yeri" },
];
export const TRANSFER_TIERS: {
  id: TransferTierId;
  label: string;
  min: number;
  max: number;
}[] = [
  { id: "1", label: "1 kişi", min: 1, max: 1 },
  { id: "2-3", label: "2–3 kişi", min: 2, max: 3 },
  { id: "4-6", label: "4–6 kişi", min: 4, max: 6 },
  { id: "7-15", label: "7–15 kişi", min: 7, max: 15 },
];
export const TRANSFER_DIRECTIONS: { id: TransferDirection; label: string }[] = [
  { id: "arrival", label: "Gelişte: noktadan konaklama yerine" },
  { id: "departure", label: "Dönüşte: konaklama yerinden noktaya" },
  { id: "both", label: "Gidiş-dönüş" },
];
// 15 kişiden kalabalık gruba kademe yoktur.
export const tierFor = (count: number) =>
  TRANSFER_TIERS.find((t) => count >= t.min && count <= t.max) || null;
export const transferPrice = (
  config: TransferConfig | undefined,
  destination: TransferDestinationId,
  point: TransferPointId,
  direction: TransferDirection,
  count: number,
) => {
  const tier = tierFor(count);
  if (!config?.enabled || !tier) return null;
  return (
    config[direction === "both" ? "roundTrip" : "oneWay"]?.[destination]?.[
      point
    ]?.[tier.id] ?? null
  );
};
const hasPrice = (table?: TransferPointTable) =>
  Boolean(
    table &&
    Object.values(table).some((tiers) => Object.values(tiers).some(Boolean)),
  );
// Varış yerinde en az bir fiyatlı nokta var mı?
export const destinationOffered = (
  config: TransferConfig | undefined,
  destination: TransferDestinationId,
) =>
  Boolean(
    config?.enabled &&
    (hasPrice(config.oneWay?.[destination]) ||
      hasPrice(config.roundTrip?.[destination])),
  );
// Turda en az bir fiyatlı nokta varsa transfer sunulur.
export const offersTransfer = (config?: TransferConfig) =>
  TRANSFER_DESTINATIONS.some((d) => destinationOffered(config, d.id));
export const emptyTransfer = (): TransferConfig => {
  const blank = () =>
    Object.fromEntries(
      TRANSFER_DESTINATIONS.map((d) => [
        d.id,
        Object.fromEntries(
          TRANSFER_POINTS.map((p) => [
            p.id,
            Object.fromEntries(TRANSFER_TIERS.map((t) => [t.id, null])),
          ]),
        ),
      ]),
    ) as TransferTable;
  return { enabled: false, oneWay: blank(), roundTrip: blank() };
};
