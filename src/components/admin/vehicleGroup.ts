import type { Departure } from "../../lib/types";
// Aynı tarihteki ek araçlar group_id ile bağlıdır. Grupta birden fazla araç varsa
// panel satırlarına "2. araç" gibi etiket eklenir; tek araçlı seferde etiket yoktur.
export const groupSizes = (items: Departure[]) => {
  const sizes = new Map<string, number>();
  for (const d of items) {
    const g = d.group_id || d.id;
    sizes.set(g, (sizes.get(g) || 0) + 1);
  }
  return sizes;
};
export const vehicleTag = (d: Departure, sizes: Map<string, number>) =>
  (sizes.get(d.group_id || d.id) || 0) > 1 ? `${d.vehicle_no || 1}. araç` : "";
// Panelde dolu koltuk: satılabilir − boş − satışa kapalı (kapalı koltuk dolu sayılmaz).
export const soldSeats = (d: Departure) =>
  Math.max(0, (d.vehicle?.sellableSeats || 0) - d.available - (d.closed || 0));
// Listeyi bozmadan aynı grubun araçlarını ilk aracın hemen altına toplar (1., 2., 3. araç).
export function groupedOrder<T extends Departure>(items: T[]): T[] {
  const byGroup = new Map<string, T[]>();
  for (const d of items) {
    const g = d.group_id || d.id;
    byGroup.set(g, [...(byGroup.get(g) || []), d]);
  }
  const out: T[] = [],
    seen = new Set<string>();
  for (const d of items) {
    const g = d.group_id || d.id;
    if (seen.has(g)) continue;
    seen.add(g);
    out.push(...byGroup.get(g)!.sort((a, b) => (a.vehicle_no || 1) - (b.vehicle_no || 1)));
  }
  return out;
}
