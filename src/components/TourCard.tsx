import { useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import { Link, localeOf, useLang } from "../lib/i18n";
import { useOpenTour } from "../lib/tour-transition";
import { responsive } from "../lib/images";
import { tourTone, toneStyle } from "../lib/tone";
import { currency, hasPrice, type Tour } from "../lib/types";
import { placeName } from "../lib/place";
import { develop } from "../lib/reveal";
// Rota renkli tur kartı: büyük fotoğraf, tur türünün renginde yer etiketi ve fiyat.
// Tıklanınca kartın fotoğrafı tur sayfasının büyük görüntüsüne akar (tour-transition).
export function TourCard({ tour }: { tour: Tour }) {
  const { t } = useLang(),
    openTour = useOpenTour(),
    photo = useRef<HTMLImageElement>(null),
    ribbon = useRef<HTMLSpanElement>(null);
  // Talep turunda satışa açılmış bir tarih varsa kart satış görünümüne geçer.
  const demandOnly = tour.mode === "demand" && !tour.next,
    shortDate = (date: string) =>
      new Date(date + "T12:00:00").toLocaleDateString(localeOf(), { day: "numeric", month: "short" });
  return (
    <Link
      className="tour-card"
      style={toneStyle(tourTone(tour))}
      to={"/turlar/" + tour.id}
      onClick={(e) => openTour(e, tour.id, photo.current, ribbon.current)}
    >
      <div className="tour-card-image">
        <img
          {...responsive(tour.image)}
          {...develop}
          ref={photo}
          alt={tour.name}
          loading="lazy"
          decoding="async"
          width="600"
          height="450"
        />
        <span className="tour-card-ribbon" ref={ribbon}>{placeName(tour)}</span>
        <span className="tour-card-discover" aria-hidden="true">
          {t("Turu keşfet")} <ArrowUpRight size={16} />
        </span>
        {!tour.salesOpen ? (
          <span className="tour-sales-closed">{t("Şu an satışa kapalı")}</span>
        ) : demandOnly ? (
          <span className="tour-sales-closed tour-demand">
            {tour.demandDates?.length
              ? t("Ön kayıt açık · {date}", { date: shortDate(tour.demandDates[0].date) })
              : t("Ön kayıt açık")}
          </span>
        ) : (
          // İlk seferde az koltuk kaldıysa fotoğrafın üstünde turuncu etiket.
          tour.next &&
          tour.next.available <= 3 && (
            <span className={"tour-seat-badge" + (tour.next.available === 0 ? " is-full" : "")}>
              {tour.next.available === 0
                ? t("İlk sefer dolu")
                : tour.next.available === 1
                  ? t("Son 1 koltuk")
                  : t("Son {n} koltuk", { n: tour.next.available })}
            </span>
          )
        )}
      </div>
      <div className="tour-card-info">
        <div>
          <h3>{tour.name}</h3>
          <p>
            {tour.duration} · {t("Kars çıkışlı")}
            {tour.inquiryOnly
              ? " · " + t("tarih için arayın")
              : demandOnly
                ? " · " + t("yeterli talep olursa")
                : ""}
          </p>
          {tour.next && (
            <p className={"tour-card-next" + (tour.next.available <= 3 ? " is-few" : "")}>
              {t("İlk hareket {date}", { date: shortDate(tour.next.date) })} ·{" "}
              {tour.next.available === 0
                ? t("dolu")
                : tour.next.available <= 3
                  ? t("son {n} koltuk", { n: tour.next.available })
                  : t("{n} boş koltuk", { n: tour.next.available })}
            </p>
          )}
        </div>
        {hasPrice(tour.fromPrice ?? tour.price) ? (
          <strong>
            {currency(tour.fromPrice ?? tour.price)}
            <small>{demandOnly ? t("tahmini kişi başı") : t("kişi başı")}</small>
          </strong>
        ) : (
          <strong className="tour-card-ask">
            <small>{t("Fiyat için arayın")}</small>
          </strong>
        )}
      </div>
    </Link>
  );
}
