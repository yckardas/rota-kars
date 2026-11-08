import { Link, useLang } from "../lib/i18n";
import { responsive } from "../lib/images";
import { currency, type Tour } from "../lib/types";
import { placeName } from "../lib/place";
// Tek görüntülü hatıra kartı: büyük manzara, köşede ikinci görüntü, kırmızı yer şeridi.
export function TourCard({ tour }: { tour: Tour }) {
  const inset = tour.gallery.find((g) => g !== tour.image);
  const { t } = useLang();
  return (
    <Link className="tour-card" to={"/turlar/" + tour.id}>
      <div className="tour-card-image">
        <img
          {...responsive(tour.image)}
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
              alt=""
              loading="lazy"
              decoding="async"
            />
          </span>
        )}
        <span className="tour-card-ribbon">{placeName(tour)}</span>
        {!tour.salesOpen && (
          <span className="tour-sales-closed">{t("Şu an satışa kapalı")}</span>
        )}
      </div>
      <div className="tour-card-info">
        <div>
          <h3>{tour.name}</h3>
          <p>
            {tour.duration} · {t("Kars çıkışlı")}
            {tour.inquiryOnly ? " · " + t("tarih için arayın") : ""}
          </p>
        </div>
        <strong>
          {currency(tour.price)}
          <small>{t("kişi başı")}</small>
        </strong>
      </div>
    </Link>
  );
}
