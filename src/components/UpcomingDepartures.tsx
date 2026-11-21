// Ana sayfadaki "Yaklaşan seferler" şeridi: satıştaki turların ilk seferleri tarih
// sırasıyla, turun renginde tarih kutusu, saat, boş koltuk ve fiyatla yan yana akar.
// Karta tıklanınca rezervasyon o tarih seçili açılır. Veri katalogdaki ilk seferdir
// (tour.next); ayrı bir istek atılmaz.
import { useRef } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { Link, localeOf, useLang } from "../lib/i18n";
import { placeName } from "../lib/place";
import { tourTone, toneStyle } from "../lib/tone";
import { currency, hasPrice, type Tour } from "../lib/types";

export function UpcomingDepartures({ tours }: { tours: Tour[] }) {
  const { t } = useLang();
  const track = useRef<HTMLDivElement>(null);
  const list = tours
    .filter(
      (x) =>
        x.salesOpen &&
        !x.inquiryOnly &&
        x.mode !== "demand" &&
        x.next &&
        x.next.available > 0,
    )
    .sort((a, b) =>
      (a.next!.date + a.next!.startTime).localeCompare(
        b.next!.date + b.next!.startTime,
      ),
    )
    .slice(0, 10);
  if (list.length < 2) return null;
  const scroll = (dir: number) =>
    track.current?.scrollBy({
      left: dir * track.current.clientWidth * 0.8,
      behavior: "smooth",
    });
  return (
    <section
      className="container section rk-upcoming"
      aria-labelledby="rk-upcoming-title"
    >
      <div className="section-heading rk-reveal">
        <div>
          <h2 id="rk-upcoming-title">{t("Yaklaşan seferler")}</h2>
          <p className="muted">
            {t("Tarihi seçin, koltuğunuzu hemen ayırın.")}
          </p>
        </div>
        <div className="rk-upcoming-nav">
          <button
            type="button"
            className="rk-round"
            onClick={() => scroll(-1)}
            aria-label={t("Geri kaydır")}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            className="rk-round"
            onClick={() => scroll(1)}
            aria-label={t("İleri kaydır")}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
      <div className="rk-upcoming-track" ref={track}>
        {list.map((tour) => {
          const next = tour.next!,
            day = new Date(next.date + "T12:00:00"),
            few = next.available <= 3,
            price = tour.fromPrice ?? tour.price;
          return (
            <Link
              key={tour.id}
              className="rk-dep"
              style={toneStyle(tourTone(tour))}
              to={`/rezervasyon/${tour.id}?date=${next.date}`}
            >
              <span className="rk-dep-date" aria-hidden="true">
                <b>{day.toLocaleDateString(localeOf(), { day: "numeric" })}</b>
                <span>
                  {day.toLocaleDateString(localeOf(), { month: "short" })}
                </span>
                <small>
                  {day.toLocaleDateString(localeOf(), { weekday: "short" })}
                </small>
              </span>
              <span className="rk-dep-body">
                <span className="sr-only">
                  {day.toLocaleDateString(localeOf(), {
                    day: "numeric",
                    month: "long",
                    weekday: "long",
                  })}
                </span>
                <strong>{placeName(tour)}</strong>
                <span className="rk-dep-name">{tour.name}</span>
                <span className="rk-dep-meta">
                  <Clock3 size={14} aria-hidden="true" /> {next.startTime} ·{" "}
                  {tour.duration}
                </span>
                <span className={"rk-dep-seats" + (few ? " is-few" : "")}>
                  {few
                    ? next.available === 1
                      ? t("Son 1 koltuk")
                      : t("Son {n} koltuk", { n: next.available })
                    : t("{n} boş koltuk", { n: next.available })}
                </span>
              </span>
              <span className="rk-dep-foot">
                {hasPrice(price) ? (
                  <b>{t("{price}’den", { price: currency(price) })}</b>
                ) : (
                  <b>{t("Fiyat için arayın")}</b>
                )}
                <span className="rk-dep-go" aria-hidden="true">
                  <ArrowRight size={18} />
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
