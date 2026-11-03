import { Link } from "react-router-dom";
import { responsive } from "../lib/images";
import { currency, type Tour } from "../lib/types";
// Tek görüntülü hatıra kartı: büyük manzara, köşede ikinci görüntü, kırmızı yer şeridi.
// Şeritteki yer: güzergâhta geçen ve tur adında da yer alan ilk durak (Kars hariç).
const placeName = (tour: Tour) => {
  const stops = tour.location.split(" · ").filter(Boolean);
  return (
    stops.find((s) => s !== "Kars" && tour.name.includes(s)) ||
    stops[stops.length - 1] ||
    tour.name
  );
};
export function TourCard({ tour }: { tour: Tour }) {
  const inset = tour.gallery.find((g) => g !== tour.image);
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
          <span className="tour-sales-closed">Şu an satışa kapalı</span>
        )}
      </div>
      <div className="tour-card-info">
        <div>
          <h3>{tour.name}</h3>
          <p>
            {tour.duration} · Kars çıkışlı
            {tour.inquiryOnly ? " · tarih için arayın" : ""}
          </p>
        </div>
        <strong>
          {currency(tour.price)}
          <small>kişi başı</small>
        </strong>
      </div>
    </Link>
  );
}
