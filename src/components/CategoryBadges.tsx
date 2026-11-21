// Yuvarlak tür rozetleri (ana sayfa ve tur listesi): her filtre için o türdeki bir turun
// fotoğrafı, tür rengi ve tur sayısı. Tıklanınca o tür seçilir; seçiliyken tekrar
// tıklanınca seçim kalkar (karar sayfanın kendisinde).
import { useEffect, useRef, type CSSProperties } from "react";
import { useLang } from "../lib/i18n";
import { responsive } from "../lib/images";
import { distinctPlacesFirst } from "../lib/place";
import { watchReveal } from "../lib/reveal";
import { filterTone, toneStyle } from "../lib/tone";
import { TOUR_FILTERS, matchesTourFilter } from "../lib/tourFilters";
import type { Tour } from "../lib/types";

export function CategoryBadges({
  tours,
  active,
  onPick,
  className = "",
}: {
  tours: Tour[];
  active: string | null;
  onPick: (filter: string) => void;
  className?: string;
}) {
  const { t } = useLang();
  const root = useRef<HTMLElement>(null);
  useEffect(() => watchReveal(root.current), []);
  // Aynı fotoğraf iki rozette görünmesin: her rozet henüz kullanılmamış ilk fotoğrafı alır.
  const used = new Set<string>();
  const categories = TOUR_FILTERS.map((f) => {
    const list = distinctPlacesFirst(tours).filter((tour) =>
      matchesTourFilter(tour, f, t),
    );
    const image = (list.find((tour) => !used.has(tour.image)) ?? list[0])
      ?.image;
    if (image) used.add(image);
    return { filter: f, count: list.length, image };
  }).filter(
    (c): c is { filter: string; count: number; image: string } => !!c.image,
  );
  if (categories.length < 2) return null;
  return (
    <nav
      ref={root}
      className={"rk-cats rk-reveal-group " + className}
      aria-label={t("Tur türleri")}
    >
      {categories.map((c, i) => (
        <button
          key={c.filter}
          type="button"
          className="rk-cat"
          style={
            { ...toneStyle(filterTone(c.filter)), "--i": i } as CSSProperties
          }
          aria-pressed={active === c.filter}
          onClick={() => onPick(c.filter)}
        >
          <span className="rk-cat-ring">
            <img
              {...responsive(c.image, "112px")}
              alt=""
              loading="lazy"
              decoding="async"
            />
          </span>
          <span className="rk-cat-name">{t(c.filter)}</span>
          <small>{t("{n} rota", { n: c.count })}</small>
        </button>
      ))}
    </nav>
  );
}
