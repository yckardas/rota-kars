import { flushSync } from "react-dom";
import { Link, useLang, useLocalNavigate } from "../lib/i18n";
import { responsive } from "../lib/images";
import { currency, type Tour } from "../lib/types";
import { placeName } from "../lib/place";
import { develop } from "../lib/reveal";
// Tek görüntülü hatıra kartı: büyük manzara, köşede ikinci görüntü, kırmızı yer şeridi.
export function TourCard({ tour }: { tour: Tour }) {
  const inset = tour.gallery.find((g) => g !== tour.image);
  const { t } = useLang(),
    navigate = useLocalNavigate();
  // Kartın fotoğrafı tur sayfasının büyük görüntüsüne akar (View Transitions).
  // Uygulama bildirimsel BrowserRouter kullandığı için geçiş elle başlatılır;
  // desteklemeyen tarayıcıda ve "hareketi azalt"ta normal bağlantı gibi çalışır.
  const open = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      !document.startViewTransition ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    e.preventDefault();
    document.startViewTransition(() => {
      flushSync(() => navigate("/turlar/" + tour.id));
      // Yeni sayfanın görüntüsü en üstten alınsın; fotoğraf doğru yere aksın.
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  };
  return (
    <Link className="tour-card" to={"/turlar/" + tour.id} onClick={open}>
      <div className="tour-card-image">
        <img
          {...responsive(tour.image)}
          {...develop}
          style={{ viewTransitionName: "tour-" + tour.id }}
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
