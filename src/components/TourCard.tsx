import { useRef } from "react";
import { Link, localeOf, useLang } from "../lib/i18n";
import { useOpenTour } from "../lib/tour-transition";
import { responsive } from "../lib/images";
import { currency, type Tour } from "../lib/types";
import { placeName } from "../lib/place";
import { develop } from "../lib/reveal";
// Tek görüntülü hatıra kartı: büyük manzara, köşede ikinci görüntü, kırmızı yer şeridi.
// Tıklanınca kartın fotoğrafı tur sayfasının büyük görüntüsüne akar (tour-transition).
export function TourCard({ tour }: { tour: Tour }) {
  const inset = tour.gallery.find((g) => g !== tour.image);
  const { t } = useLang(),
    openTour = useOpenTour(),
    photo = useRef<HTMLImageElement>(null);
  return (
    <Link
      className="tour-card"
      to={"/turlar/" + tour.id}
      onClick={(e) => openTour(e, tour.id, photo.current)}
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
        {inset && (
          <span className="tour-card-inset">
            <img
              {...responsive(inset, "120px")}
              {...develop}
              alt=""
              loading="lazy"
              decoding="async"
            />
          </span>
        )}
        <span className="tour-card-ribbon">{placeName(tour)}</span>
        {!tour.salesOpen ? (
          <span className="tour-sales-closed">{t("Şu an satışa kapalı")}</span>
        ) : (
          tour.mode === "demand" && (
            <span className="tour-sales-closed tour-demand">{t("Ön kayıt açık")}</span>
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
              : tour.mode === "demand"
                ? " · " + t("yeterli talep olursa")
                : ""}
          </p>
          {tour.next && (
            <p className={"tour-card-next" + (tour.next.available <= 3 ? " is-few" : "")}>
              {t("İlk hareket {date}", {
                date: new Date(tour.next.date + "T12:00:00").toLocaleDateString(localeOf(), {
                  day: "numeric",
                  month: "short",
                }),
              })} ·{" "}
              {tour.next.available === 0
                ? t("dolu")
                : tour.next.available <= 3
                  ? t("son {n} koltuk", { n: tour.next.available })
                  : t("{n} boş koltuk", { n: tour.next.available })}
            </p>
          )}
        </div>
        <strong>
          {currency(tour.fromPrice ?? tour.price)}
          <small>{tour.mode === "demand" ? t("tahmini kişi başı") : t("kişi başı")}</small>
        </strong>
      </div>
    </Link>
  );
}
