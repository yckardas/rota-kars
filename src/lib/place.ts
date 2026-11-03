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
