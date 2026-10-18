import { Link } from "react-router-dom";
import { responsive } from "../lib/images";
import { Clock3, MoveUpRight, MapPin } from "lucide-react";
import { currency, type Tour } from "../lib/types";
export function TourCard({ tour }: { tour: Tour }) {
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
        <span className="tour-category">{tour.category}</span>
        {!tour.salesOpen && (
          <span className="tour-sales-closed">Şu an satışa kapalı</span>
        )}
        <span className="tour-open">
          <MoveUpRight size={21} />
        </span>
      </div>
      <div className="tour-card-info">
        <div className="tour-card-meta">
          <span>
            <Clock3 size={13} />
            {tour.duration}
          </span>
          <span>Kars çıkışlı</span>
        </div>
        <h3>{tour.name}</h3>
        <p>{tour.subtitle}</p>
        <div className="tour-card-bottom">
          <span>
            <MapPin size={13} />
            {tour.location.split(" · ").slice(0, 2).join(", ")}
          </span>
          <div>
            <strong>{currency(tour.price)}</strong>
            <small>kişi başı</small>
          </div>
        </div>
      </div>
    </Link>
  );
}
