import { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { TourCard } from "../components/TourCard";
import type { Catalog } from "../lib/types";
import { useLang } from "../lib/i18n";
export function Tours({ catalog }: { catalog: Catalog }) {
  const [q, setQ] = useState(""),
    [category, setCategory] = useState("Tümü"),
    [filtered, setFiltered] = useState(false);
  const { t } = useLang();
  // Kategoriler /en altında katalogda İngilizce gelir.
  const tours = catalog.tours.filter(
    (tour) =>
      (category === "Tümü" || tour.category === t(category)) &&
      `${tour.name} ${tour.location}`
        .toLocaleLowerCase("tr")
        .includes(q.toLocaleLowerCase("tr")),
  );
  return (
    <>
      <section className="page-intro container">
        <h1>{t("Bir sonraki rotanız.")}</h1>
        <p>
          {t(
            "Kısa bir kaçamak, kışın peşinde bir gün veya yeni bir şehrin hikâyesi.",
          )}
        </p>
      </section>
      <section className="container catalog-section">
        <div className="catalog-controls">
          <label className="search-input">
            <Search size={18} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("Bir rota veya şehir arayın")}
              aria-label={t("Tur ara")}
            />
          </label>
          <div className="tour-filters">
            <SlidersHorizontal size={17} />
            {["Tümü", "Kültür", "Kış", "Yurt dışı", "Konaklamalı"].map((c) => (
              <button
                key={c}
                className={category === c ? "active" : ""}
                onClick={() => {
                  setFiltered(true);
                  setCategory(c);
                }}
              >
                {t(c)}
              </button>
            ))}
          </div>
        </div>
        <p className="result-count">
          {t(
            tours.length === 1
              ? "1 rota sizi bekliyor."
              : "{n} rota sizi bekliyor.",
            { n: tours.length },
          )}
        </p>
        <div
          className={"tour-grid" + (filtered ? " is-refiltered" : "")}
          key={category}
        >
          {tours.map((tour) => (
            <TourCard key={tour.id} tour={tour} />
          ))}
        </div>
        {!tours.length && (
          <div className="empty-state">
            <h2>{t("Bu aramayla eşleşen bir rota yok.")}</h2>
            <p>{t("Başka bir şehir deneyin veya bütün rotalara göz atın.")}</p>
            <button
              className="btn"
              onClick={() => {
                setQ("");
                setCategory("Tümü");
              }}
            >
              {t("Bütün rotaları göster")}
            </button>
          </div>
        )}
      </section>
    </>
  );
}
