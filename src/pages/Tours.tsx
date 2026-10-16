import { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { TourCard } from "../components/TourCard";
import type { Catalog } from "../lib/types";
export function Tours({ catalog }: { catalog: Catalog }) {
  const [q, setQ] = useState(""),
    [category, setCategory] = useState("Tümü");
  const tours = catalog.tours.filter(
    (t) =>
      (category === "Tümü" || t.category === category) &&
      `${t.name} ${t.location}`
        .toLocaleLowerCase("tr")
        .includes(q.toLocaleLowerCase("tr")),
  );
  return (
    <>
      <section className="page-intro container">
        <span className="section-note">Kars’tan başlayan yolculuklar</span>
        <h1>Bir sonraki rotanız.</h1>
        <p>
          Kısa bir kaçamak, kışın peşinde bir gün veya yeni bir şehrin hikâyesi.
        </p>
      </section>
      <section className="container catalog-section">
        <div className="catalog-controls">
          <label className="search-input">
            <Search size={18} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Bir rota veya şehir arayın"
              aria-label="Tur ara"
            />
          </label>
          <div className="tour-filters">
            <SlidersHorizontal size={17} />
            {["Tümü", "Kültür", "Kış", "Yurt dışı", "Konaklamalı"].map((c) => (
              <button
                key={c}
                className={category === c ? "active" : ""}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <p className="result-count">{tours.length} rota sizi bekliyor.</p>
        <div className="tour-grid">
          {tours.map((t) => (
            <TourCard key={t.id} tour={t} />
          ))}
        </div>
        {!tours.length && (
          <div className="empty-state">
            <h2>Bu aramayla eşleşen bir rota yok.</h2>
            <p>Başka bir şehir deneyin veya bütün rotalara göz atın.</p>
            <button
              className="btn"
              onClick={() => {
                setQ("");
                setCategory("Tümü");
              }}
            >
              Bütün rotaları göster
            </button>
          </div>
        )}
      </section>
    </>
  );
}
