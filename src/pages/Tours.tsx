import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowRight, BellRing, Search, SlidersHorizontal } from "lucide-react";
import { TourCard } from "../components/TourCard";
import { InterestForm } from "../components/InterestForm";
import type { Catalog, Tour } from "../lib/types";
import { useLang } from "../lib/i18n";
import { TOUR_FILTERS, matchesTourFilter } from "../lib/tourFilters";
import { filterTone, toneStyle } from "../lib/tone";
import { CategoryBadges } from "../components/CategoryBadges";
import { openFirst, placeName, searchKey } from "../lib/place";
import { RequestForm } from "../components/RequestForm";
export function Tours({ catalog }: { catalog: Catalog }) {
  // Ana sayfa aramasında birden çok rota eşleşirse liste ?q= ile süzülmüş açılır.
  const [params] = useSearchParams();
  const [q, setQ] = useState(() => (params.get("q") || "").slice(0, 60)),
    [category, setCategory] = useState("Tümü"),
    [filtered, setFiltered] = useState(false),
    // Listede olmayan rota için bireysel / özel tur talebi.
    [asking, setAsking] = useState(false),
    // Satışa kapalı tur için "tarih açılınca haber ver".
    [notify, setNotify] = useState<Tour | null>(null);
  const { t } = useLang();
  // Kategoriler /en altında katalogda İngilizce gelir.
  // Satışta ve ön kayıtta olan turlar üstte; satışa kapalılar ayrı, sakin bir bölümde altta.
  const matched = openFirst(
    catalog.tours.filter(
      (tour) =>
        (category === "Tümü" || matchesTourFilter(tour, category, t)) &&
        searchKey(`${placeName(tour)} ${tour.name} ${tour.location}`).includes(
          searchKey(q),
        ),
    ),
  );
  const tours = matched.filter((tour) => tour.salesOpen),
    closed = matched.filter((tour) => !tour.salesOpen);
  return (
    <>
      {/* Renkli başlık bandı: başlık ve tür rozetleri; rozet seçimi aşağıdaki filtreyle aynıdır. */}
      <section className="page-intro container rk-tours-hero">
        <h1>{t("Bir sonraki rotanız.")}</h1>
        <p>
          {t(
            "Kısa bir kaçamak, kışın peşinde bir gün veya yeni bir şehrin hikâyesi.",
          )}
        </p>
        <CategoryBadges
          tours={catalog.tours}
          active={category === "Tümü" ? null : category}
          onPick={(f) => {
            setFiltered(true);
            setCategory(category === f ? "Tümü" : f);
          }}
        />
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
            {["Tümü", ...TOUR_FILTERS].map((c) => (
              <button
                key={c}
                style={toneStyle(filterTone(c))}
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
            matched.length === 1
              ? "1 rota sizi bekliyor."
              : "{n} rota sizi bekliyor.",
            { n: matched.length },
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
        {closed.length > 0 && (
          <section
            className="closed-tours"
            aria-labelledby="closed-tours-title"
          >
            <h2 id="closed-tours-title">{t("Şu an satışa kapalı rotalar")}</h2>
            <p>
              {t(
                "Yeni tarih açılınca size e-postayla haber verelim. Kayıt ücretsizdir, koltuk tutulmaz.",
              )}
            </p>
            <div className="tour-grid is-quiet">
              {closed.map((tour) => (
                <div key={tour.id} className="closed-tour">
                  <TourCard tour={tour} />
                  <button
                    type="button"
                    className="btn btn-outline btn-small"
                    onClick={() => setNotify(tour)}
                  >
                    <BellRing size={15} aria-hidden="true" />{" "}
                    {t("Tarih açılınca haber ver")}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
        {!matched.length && (
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
      {/* Listede olmayan bir yere (ör. tek kişi Ağrı) gitmek isteyen buradan talep bırakır. */}
      <section className="private-journey tours-private-request">
        <div className="container">
          <div>
            <h2>{t("Aradığınız rota listede yok mu?")}</h2>
            <p>
              {t(
                "Tek başınıza ya da kendi grubunuzla, istediğiniz tarihte: gideceğiniz yeri ve ihtiyacınızı yazın, size özel programı ve fiyatı hazırlayalım.",
              )}
            </p>
          </div>
          <button
            className="btn btn-outline"
            type="button"
            onClick={() => setAsking(true)}
          >
            {t("Özel tur ve hizmet talebi")} <ArrowRight size={16} />
          </button>
        </div>
      </section>
      {notify && (
        <InterestForm
          kind="notify"
          tourId={notify.id}
          tourName={notify.name}
          onClose={() => setNotify(null)}
        />
      )}
      {asking && (
        <RequestForm
          kind="private-tour"
          initialGuests={1}
          initialNotes={
            q.trim()
              ? t("Gitmek istediğim yer: {place}", { place: q.trim() })
              : ""
          }
          onClose={() => setAsking(false)}
        />
      )}
    </>
  );
}
