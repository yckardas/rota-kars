import { useEffect, useState, type CSSProperties } from "react";
import {
  Bus,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Pause,
  Play,
} from "lucide-react";
import { useLang } from "../lib/i18n";
import { responsive } from "../lib/images";
import { whatsappLink } from "../lib/whatsapp";
import type { Catalog } from "../lib/types";

const SLIDE_MS = 4500;

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

// Araç filosu ve şoförlü kiralama. Ana sayfadan Hizmetler sayfasına taşındı;
// ana sayfadaki "Kars'ta başka neler var?" bandı buraya (#filo) bağlanır.
// Sol tarafta listedeki araçların fotoğrafları sırayla geçer (sayfa başındaki
// otobüs fotoğrafı burada tekrar kullanılmaz). Fare üstündeyken ya da klavye odağı
// içerideyken durur; durdur/sürdür düğmesi vardır (WCAG 2.2.2). "Hareketi azalt"
// açıkken kendiliğinden dönmez. Sağdaki araç çiplerine dokununca o araca geçer.
export function FleetSection({ catalog }: { catalog: Catalog }) {
  const { t } = useLang();
  const slides = (catalog.fleet.slides || []).map((s) => ({
      ...s,
      label: t(s.label),
    })),
    n = slides.length,
    [picked, setPicked] = useState(0),
    [paused, setPaused] = useState(false),
    [hold, setHold] = useState(false),
    reduce = useReducedMotion(),
    active = n ? picked % n : 0,
    running = n > 1 && !paused && !hold && !reduce;
  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => setPicked((x) => (x + 1) % n), SLIDE_MS);
    return () => window.clearTimeout(id);
  }, [active, running, n]);
  const go = (k: number) => setPicked((k + n) % n),
    current = slides[active]?.label;
  const chip = (c: string) => {
    const k = slides.findIndex((s) => s.label === c);
    if (k < 0) return <span key={c}>{c}</span>;
    return (
      <button
        key={c}
        type="button"
        className={k === active ? "is-showing" : undefined}
        aria-pressed={k === active}
        onClick={() => {
          go(k);
          setPaused(true);
        }}
      >
        {c}
      </button>
    );
  };
  return (
    <section className="fleet-section" id="filo">
      <div className="container fleet-inner">
        <div
          className="fleet-photo"
          onMouseEnter={() => setHold(true)}
          onMouseLeave={() => setHold(false)}
          onFocus={() => setHold(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node))
              setHold(false);
          }}
        >
          {n ? (
            <div
              className="fleet-slider"
              role="region"
              aria-roledescription={t("slayt gösterisi")}
              aria-label={t("Araç fotoğrafları")}
            >
              {/* Fotoğrafların oranı farklı (dikey, yatay); araç kırpılmadan
                  tam görünür, kalan boşluğu aynı fotoğrafın bulanık hali doldurur. */}
              {slides.map((s, k) => {
                const img = responsive(s.photo, "(max-width: 950px) 100vw, 55vw"),
                  bg = img.srcSet ? s.photo.replace(/\.webp$/, "-800.webp") : s.photo;
                return (
                  <div
                    key={s.photo}
                    className="fleet-slide"
                    data-active={k === active || undefined}
                    aria-hidden={k !== active || undefined}
                    style={{ "--fleet-bg": `url("${bg}")` } as CSSProperties}
                  >
                    <img
                      {...img}
                      alt={s.label}
                      loading={k === 0 ? undefined : "lazy"}
                      decoding="async"
                    />
                  </div>
                );
              })}
              <p
                className="fleet-slide-caption"
                aria-live={running ? "off" : "polite"}
              >
                <strong>{current?.split(" ")[0]}</strong>{" "}
                {current?.split(" ").slice(1).join(" ")}
              </p>
              {n > 1 && (
                <div className="fleet-slide-controls">
                  <button
                    type="button"
                    aria-label={t("Önceki araç")}
                    onClick={() => go(active - 1)}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <div className="fleet-slide-dots">
                    {slides.map((s, k) => (
                      <button
                        key={s.photo}
                        type="button"
                        aria-label={s.label}
                        aria-current={k === active || undefined}
                        onClick={() => go(k)}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    aria-label={t("Sonraki araç")}
                    onClick={() => go(active + 1)}
                  >
                    <ChevronRight size={18} />
                  </button>
                  {!reduce && (
                    <button
                      type="button"
                      aria-label={
                        paused ? t("Slaytı sürdür") : t("Slaytı durdur")
                      }
                      onClick={() => setPaused(!paused)}
                    >
                      {paused ? <Play size={16} /> : <Pause size={16} />}
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <img
              {...responsive(
                "/images/rota-bus.webp",
                "(max-width: 950px) 100vw, 55vw",
              )}
              alt={t("Rota Kars Tur logolu turizm otobüsü")}
              loading="lazy"
              decoding="async"
            />
          )}
        </div>
        <div className="fleet-copy">
          <h2>{t("Grubunuz kaç kişi olursa olsun, aracı bizde.")}</h2>
          <p>{catalog.fleet.note}</p>
          <div className="fleet-groups">
            <div>
              <small>{t("Turizm taşımacılığı")}</small>
              <div className="chips">{catalog.fleet.tourism.map(chip)}</div>
            </div>
            <div>
              <small>{t("VIP taşımacılık")}</small>
              <div className="chips">{catalog.fleet.vip.map(chip)}</div>
            </div>
          </div>
          <ul className="fleet-perks">
            {catalog.fleet.perks.map((p) => (
              <li key={p}>
                <Bus size={15} /> {p}
              </li>
            ))}
          </ul>
          <a
            className="btn btn-outline"
            href={whatsappLink(
              catalog.business.whatsapp,
              t("Merhaba, şoförlü araç kiralama için teklif almak istiyorum."),
            )}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle size={17} /> {t("Araç için teklif alın")}
          </a>
        </div>
      </div>
    </section>
  );
}
