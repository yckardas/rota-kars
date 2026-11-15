// Tur listesi ve ana sayfadaki filtreler. "Günübirlik" bir kategori değil, süreye göre
// toplanır: kültür, doğa ya da yurt dışı fark etmeksizin bütün günübirlik turlar.
// /en altında kategori ve süre katalogda İngilizce gelir.
import type { Tour } from "./types";

export const TOUR_FILTERS = [
  "Günübirlik",
  "Kültür",
  "Doğa",
  "Kış",
  "Yurt dışı",
  "Konaklamalı",
];
export const isDayTrip = (tour: Pick<Tour, "duration">) =>
  /^(günübirlik|day trip)$/i.test(tour.duration.trim());
export const matchesTourFilter = (
  tour: Pick<Tour, "category" | "duration">,
  filter: string,
  t: (text: string) => string,
) => (filter === "Günübirlik" ? isDayTrip(tour) : tour.category === t(filter));
