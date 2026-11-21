// Ana sayfanın dönen vitrini: öne çıkan rotalar sırayla, yavaş yakınlaşan fotoğraf,
// büyük yer adı ve döner fiyat etiketiyle gelir. Fare üstündeyken ya da klavye odağı
// içerideyken durur; ayrıca durdur/sürdür düğmesi vardır (WCAG 2.2.2). "Hareketi azalt"
// açıkken kendiliğinden dönmez, oklar ve noktalarla gezilir.
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
} from "lucide-react";
import { Link, useLang } from "../lib/i18n";
import { isIllustrativePhoto, responsive } from "../lib/images";
import { placeName } from "../lib/place";
import { tourTone, toneStyle } from "../lib/tone";
import { currency, hasPrice, type Tour } from "../lib/types";

const SLIDE_MS = 6500;

function useReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduce, setReduce] = useState(
    () => typeof matchMedia !== "undefined" && matchMedia(query).matches,
  );
  useEffect(() => {
    const m = matchMedia(query),
      f = () => setReduce(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return reduce;
}

export function HeroSlider({
  tours,
  title,
  children,
}: {
  tours: Tour[];
  title: string;
  children?: ReactNode;
}) {
  const { t } = useLang();
  const [picked, setActive] = useState(0),
    [paused, setPaused] = useState(false),
    [hold, setHold] = useState(false);
  const reduce = useReducedMotion(),
    n = tours.length,
    // Katalog değişip rota sayısı azalırsa seçili slayt aralık dışında kalmasın.
    active = n ? picked % n : 0,
    running = n > 1 && !paused && !hold && !reduce;
  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => setActive((x) => (x + 1) % n), SLIDE_MS);
    return () => window.clearTimeout(id);
  }, [active, running, n]);
  const go = (k: number) => setActive((k + n) % n);
  // Gösterilecek rota yoksa vitrin çizilmez ama başlık ve arama çubuğu kalır.
  if (!n)
    return (
      <section
        className="rk-hero rk-hero-empty container"
        aria-labelledby="rk-hero-title"
      >
        <h1 id="rk-hero-title">{title}</h1>
        {children}
      </section>
    );
  return (
    <section
      className="rk-hero container"
      aria-labelledby="rk-hero-title"
      data-running={running || undefined}
    >
      <div
        className="rk-stage"
        aria-roledescription={t("vitrin")}
        onMouseEnter={() => setHold(true)}
        onMouseLeave={() => setHold(false)}
        onFocus={() => setHold(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null))
            setHold(false);
        }}
      >
        <h1 id="rk-hero-title" className="rk-hello">
          {title}
        </h1>
        {tours.map((tour, k) => {
          const price = tour.fromPrice ?? tour.price,
            on = k === active;
          return (
            <article
              key={tour.id}
              className="rk-slide"
              data-active={on || undefined}
              inert={!on}
              aria-roledescription={t("slayt")}
              aria-label={t("{n} / {total}: {name}", {
                n: k + 1,
                total: n,
                name: placeName(tour),
              })}
              style={toneStyle(tourTone(tour))}
            >
              <img
                {...responsive(tour.image, "(max-width: 760px) 100vw, 1280px")}
                alt=""
                width="1280"
                height="720"
                fetchPriority={k === 0 ? "high" : undefined}
                loading={k === 0 ? "eager" : "lazy"}
                decoding="async"
              />
              {isIllustrativePhoto(tour.image) && (
                <small className="kp-photo-disclosure">
                  {t("Temsili · Yapay zekâ")}
                </small>
              )}
              <div className="rk-slide-copy">
                <p className="rk-slide-name">{placeName(tour)}</p>
                <p className="rk-slide-sub">{tour.name}</p>
                <div className="rk-slide-actions">
                  <Link className="rk-slide-cta" to={"/turlar/" + tour.id}>
                    {t("Turu incele")} <ArrowRight size={18} />
                  </Link>
                  <span className="rk-chip">
                    {tour.category} · {tour.duration}
                  </span>
                </div>
              </div>
              <span className="rk-sticker">
                {!tour.salesOpen ? (
                  <b className="rk-sticker-text">{t("Şu an satışa kapalı")}</b>
                ) : hasPrice(price) ? (
                  <>
                    <b>{t("{price}’den", { price: currency(price) })}</b>
                    <small>{t("kişi başı")}</small>
                  </>
                ) : (
                  <b className="rk-sticker-text">{t("Fiyat için arayın")}</b>
                )}
              </span>
            </article>
          );
        })}
        {n > 1 && (
          <div className="rk-controls">
            <button
              type="button"
              className="rk-arrow"
              onClick={() => go(active - 1)}
              aria-label={t("Önceki rota")}
            >
              <ChevronLeft size={22} />
            </button>
            <div className="rk-dots" role="group" aria-label={t("Rota seçin")}>
              {tours.map((tour, k) => (
                <button
                  type="button"
                  key={tour.id}
                  className="rk-dot"
                  aria-current={k === active || undefined}
                  aria-label={placeName(tour)}
                  onClick={() => go(k)}
                  style={toneStyle(tourTone(tour))}
                >
                  <span key={k === active ? "on-" + active : "off"} />
                </button>
              ))}
            </div>
            <button
              type="button"
              className="rk-arrow"
              onClick={() => go(active + 1)}
              aria-label={t("Sonraki rota")}
            >
              <ChevronRight size={22} />
            </button>
            {!reduce && (
              <button
                type="button"
                className="rk-arrow rk-pause"
                onClick={() => setPaused(!paused)}
                aria-pressed={paused}
                aria-label={paused ? t("Vitrini sürdür") : t("Vitrini durdur")}
              >
                {paused ? <Play size={16} /> : <Pause size={16} />}
              </button>
            )}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}
