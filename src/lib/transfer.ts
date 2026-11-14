// Tura eklenen transfer (sunucudaki server/transfer.mjs ile aynı kurallar).
// Fiyat grup başına toplamdır; kademe rezervasyondaki kişi sayısından seçilir.
export type TransferPointId = "airport" | "bus" | "train";
export type TransferTierId = "1" | "2-4" | "5+";
export type TransferDirection = "arrival" | "departure" | "both";
export type TransferTable = Record<TransferPointId, Record<TransferTierId, number | null>>;
export type TransferConfig = { enabled: boolean; oneWay: TransferTable; roundTrip: TransferTable };
export type TransferChoice = { point: TransferPointId; direction: TransferDirection; info: string };
export type PricedTransfer = {
  point: TransferPointId;
  pointLabel: string;
  direction: TransferDirection;
  directionLabel: string;
  tier: TransferTierId;
  tierLabel: string;
  amount: number;
  info: string;
};
export const TRANSFER_POINTS: { id: TransferPointId; label: string }[] = [
  { id: "airport", label: "Kars Harakani Havalimanı" },
  { id: "bus", label: "Kars Otogarı" },
  { id: "train", label: "Kars Garı" },
];
export const TRANSFER_TIERS: { id: TransferTierId; label: string; min: number; max: number }[] = [
  { id: "1", label: "1 kişi", min: 1, max: 1 },
  { id: "2-4", label: "2–4 kişi", min: 2, max: 4 },
  { id: "5+", label: "5 kişi ve üzeri", min: 5, max: Infinity },
];
export const TRANSFER_DIRECTIONS: { id: TransferDirection; label: string }[] = [
  { id: "arrival", label: "Gelişte: noktadan tur buluşmasına" },
  { id: "departure", label: "Dönüşte: turdan noktaya" },
  { id: "both", label: "Gidiş-dönüş" },
];
export const tierFor = (count: number) =>
  TRANSFER_TIERS.find((t) => count >= t.min && count <= t.max) || TRANSFER_TIERS[TRANSFER_TIERS.length - 1];
export const transferPrice = (
  config: TransferConfig | undefined,
  point: TransferPointId,
  direction: TransferDirection,
  count: number,
) => (config?.enabled ? config[direction === "both" ? "roundTrip" : "oneWay"][point]?.[tierFor(count).id] ?? null : null);
// Turda en az bir fiyatlı nokta varsa transfer sunulur.
export const offersTransfer = (config?: TransferConfig) =>
  Boolean(
    config?.enabled &&
      [config.oneWay, config.roundTrip].some((table) =>
        Object.values(table).some((tiers) => Object.values(tiers).some(Boolean)),
      ),
  );
export const emptyTransfer = (): TransferConfig => {
  const blank = () =>
    Object.fromEntries(
      TRANSFER_POINTS.map((p) => [p.id, Object.fromEntries(TRANSFER_TIERS.map((t) => [t.id, null]))]),
    ) as TransferTable;
  return { enabled: false, oneWay: blank(), roundTrip: blank() };
};
