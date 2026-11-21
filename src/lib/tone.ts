// Rota renkleri: her tur türünün kendi rengi var. Kartlar, filtreler ve kategori
// rozetleri bu rengi CSS değişkeni olarak alır (--tone zemin, --on-tone üstündeki yazı,
// --tone-ink beyaz zeminde okunur yazı rengi).
// Renk değerleri src/renkli.css içinde tanımlıdır; burada yalnız ad eşlenir.
import type { CSSProperties } from "react";
import type { Tour } from "./types";
import { isDayTrip } from "./tourFilters";

export type Tone =
  "kultur" | "doga" | "kis" | "konak" | "gun" | "yurtdisi" | "aktivite";

// Katalog /en altında kategoriyi İngilizce verir; iki dil de aynı renge düşer.
const byCategory: Record<string, Tone> = {
  kültür: "kultur",
  culture: "kultur",
  doğa: "doga",
  nature: "doga",
  kış: "kis",
  winter: "kis",
  konaklamalı: "konak",
  overnight: "konak",
  "yurt dışı": "yurtdisi",
  abroad: "yurtdisi",
  aktivite: "aktivite",
  rehber: "aktivite",
};

// Filtre adları (TOUR_FILTERS) için renk.
const byFilter: Record<string, Tone> = {
  Günübirlik: "gun",
  Kültür: "kultur",
  Doğa: "doga",
  Kış: "kis",
  "Yurt dışı": "yurtdisi",
  Konaklamalı: "konak",
};

export function tourTone(tour: Pick<Tour, "category" | "duration">): Tone {
  const c = tour.category?.trim().toLocaleLowerCase("tr");
  if (c && byCategory[c]) return byCategory[c];
  return isDayTrip(tour) ? "gun" : "kultur";
}

export const filterTone = (filter: string): Tone | undefined =>
  byFilter[filter];

// Öğeye rengini verir: style={toneStyle("doga")}
export const toneStyle = (tone: Tone | undefined): CSSProperties | undefined =>
  tone
    ? ({
        "--tone": `var(--rk-${tone})`,
        "--on-tone": `var(--rk-${tone}-on)`,
        "--tone-ink": `var(--rk-${tone}-ink)`,
      } as CSSProperties)
    : undefined;
