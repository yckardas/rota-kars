import type { Tour } from "./types";
// Kartpostal şeridindeki yer adı: güzergâhta geçen ve tur adında da yer alan
// ilk durak (Kars hariç); yoksa son durak.
export function placeName(tour: Pick<Tour, "name" | "location">) {
  const stops = tour.location.split(" · ").filter(Boolean);
  return (
    stops.find((s) => s !== "Kars" && tour.name.includes(s)) ||
    stops[stops.length - 1] ||
    tour.name
  );
}
// Vitrin sırası: her yer önce bir kez görünür; aynı yere giden diğer turlar
// (ör. üç ayrı Van turu) listenin sonuna kalır. Katalog sırası korunur.
export function distinctPlacesFirst<T extends Pick<Tour, "name" | "location">>(tours: T[]): T[] {
  const seen = new Set<string>(),
    first: T[] = [],
    rest: T[] = [];
  for (const tour of tours) {
    const place = placeName(tour);
    (seen.has(place) ? rest : first).push(tour);
    seen.add(place);
  }
  return [...first, ...rest];
}
// Ana sayfanın açılış kartındaki dört küçük görüntü: satışı açık turlardan dört ayrı yer.
// Aralarında yurt dışı tur yoksa sonuncunun yerine ilk yurt dışı tur gelir.
export function heroTours<T extends Pick<Tour, "name" | "location" | "inquiryOnly" | "abroad">>(tours: T[]): T[] {
  const open = distinctPlacesFirst(tours.filter((t) => !t.inquiryOnly)),
    picked = open.slice(0, 4),
    abroad = open.find((t) => t.abroad);
  if (abroad && picked.length === 4 && !picked.some((t) => t.abroad)) picked[3] = abroad;
  return picked;
}
