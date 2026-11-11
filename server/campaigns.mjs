import { randomInt } from "node:crypto";
import { fromJson } from "./database.mjs";
// Çark dilimi: yüzde ya da sabit tutar (kuruş) indirim; weight, dilimin kazanma
// ağırlığıdır (görselde bütün dilimler eşit genişlikte çizilir). Her dilim bir
// ödüldür; "boş" dilim yoktur.
export const defaultSectors = [
  { kind: "percent", value: 5, weight: 30 },
  { kind: "percent", value: 7, weight: 25 },
  { kind: "amount", value: 10000, weight: 20 },
  { kind: "percent", value: 10, weight: 15 },
  { kind: "amount", value: 15000, weight: 7 },
  { kind: "amount", value: 20000, weight: 3 },
];
export const defaultCampaign = {
  active: true,
  sectors: defaultSectors,
  validDays: 30,
  minTotal: 0,
  // Sabit tutarlı (TL) kuponların geçerli olduğu en düşük tur bedeli (kuruş).
  amountMinTotal: 100000,
  tourIds: [],
  referralTrigger: "completed",
  // Sahte hesaplarla kupon toplanmasın diye çark için e-posta doğrulaması gerekir.
  requireVerified: true,
};
// Eski ayar düz yüzde dizisiydi ([5, 10, 5, 15, 10, 5]). Acente 11.11.2026'da yeni
// ödül setini seçti; eski biçimdeki ayar yeni varsayılan dilimlere geçer.
export const normalizeSectors = (sectors) =>
  Array.isArray(sectors) &&
  sectors.length &&
  sectors.every((s) => s && typeof s === "object")
    ? sectors.map((s) => ({
        kind: s.kind === "amount" ? "amount" : "percent",
        value: Number(s.value),
        weight: Math.max(1, Number(s.weight) || 1),
      }))
    : defaultSectors;
// Ağırlığa göre dilim seçer; sonuç sunucuda belirlenir.
export function pickSector(sectors, rand = randomInt) {
  const total = sectors.reduce((n, s) => n + s.weight, 0);
  let roll = rand(total);
  for (const [i, s] of sectors.entries()) {
    if (roll < s.weight) return i;
    roll -= s.weight;
  }
  return sectors.length - 1;
}
export async function createCampaigns(db, { clock }) {
  await db.insertIfAbsent("campaign_settings", "main", {
    id: "main",
    body: defaultCampaign,
    updated_at: clock(),
  });
  return {
    async get() {
      const row = await db.one("campaign_settings", { _id: "main" });
      const merged = { ...defaultCampaign, ...fromJson(row.body, {}) };
      return {
        ...merged,
        sectors: normalizeSectors(merged.sectors),
        updatedAt: row.updated_at,
      };
    },
    async save(input) {
      const { updatedAt, ...body } = input;
      await db.update(
        "campaign_settings",
        { _id: "main" },
        { body, updated_at: clock() },
      );
      return this.get();
    },
  };
}
