import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Clock3,
  MapPin,
  Armchair,
  Check,
  Plus,
  ChevronRight,
  ArrowRight,
  Info,
  CalendarDays,
} from "lucide-react";
import { Reviews } from "../components/Reviews";
import { RequestForm } from "../components/RequestForm";
import { api } from "../lib/api";
import {
  currency,
  dateLabel,
  type Catalog,
  type Departure,
} from "../lib/types";
export function TourDetail({ catalog }: { catalog: Catalog }) {
  const { id } = useParams(),
    t = catalog.tours.find((t) => t.id === id);
  const [request, setRequest] = useState(false),
    [departures, setDepartures] = useState<Departure[]>([]),
    [activeImage, setActiveImage] = useState(0);
  useEffect(() => {
    setActiveImage(0);
    if (t && !t.inquiryOnly)
      api<Departure[]>(`/tours/${t.id}/departures`)
        .then(setDepartures)
        .catch(() => setDepartures([]));
    else setDepartures([]);
  }, [t]);
  if (!t)
    return (
      <div className="container empty-state">
        <h1>Bu rota bulunamadı.</h1>
        <Link className="btn" to="/turlar">
          Turlara dön
        </Link>
      </div>
    );
  return (
    <>
      <div className="container breadcrumb">
        <Link to="/">Ana sayfa</Link>
        <ChevronRight size={12} />
        <Link to="/turlar">Turlar</Link>
        <ChevronRight size={12} />
        <span>{t.name}</span>
      </div>
      <section className="container detail-heading">
        <span className="section-note">{t.season}</span>
        <h1>{t.name}</h1>
        <p>{t.subtitle}</p>
        <div className="detail-meta">
          <span>
            <MapPin size={16} />
            {t.location}
          </span>
          <span>
            <Clock3 size={16} />
            {t.duration}
          </span>
          <span>
            <Armchair size={16} />
            9+1 VIP minibüs
          </span>
        </div>
      </section>
      <div className="container detail-gallery">
        <img
          className="detail-main-image"
          src={t.gallery[activeImage]}
          alt={t.name}
          width="1280"
          height="600"
        />
        {t.gallery.length > 1 && (
          <div className="gallery-thumbs">
            {t.gallery.map((img, i) => (
              <button
                key={img}
                onClick={() => setActiveImage(i)}
                aria-label={`${i + 1}. fotoğrafı göster`}
                className={activeImage === i ? "active" : ""}
              >
                <img src={img} alt="" />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="container detail-layout">
        <div className="detail-content">
          <section>
            <h2>Bu yolculukta sizi neler bekliyor?</h2>
            <p className="lead-copy">{t.summary}</p>
          </section>
          {t.itinerary.length > 0 && (
            <section id="program">
              <h2>Günün akışı</h2>
              <div className="itinerary">
                {t.itinerary.map((s) => (
                  <div key={s.title}>
                    <span className="itinerary-time">{s.time}</span>
                    <div>
                      <h3>{s.title}</h3>
                      <p>{s.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          <section className="inclusions">
            <div>
              <h3>Fiyata dahil</h3>
              {t.included.map((s) => (
                <p key={s}>
                  <Check size={16} />
                  {s}
                </p>
              ))}
            </div>
            <div>
              <h3>Ekstra hizmetler</h3>
              {t.excluded.map((s) => (
                <p key={s}>
                  <Plus size={16} />
                  {s}
                </p>
              ))}
            </div>
          </section>
          <div className="info-note">
            <Info size={20} />
            <p>{t.note}</p>
          </div>
          <section>
            <h2>Yola çıkmadan önce</h2>
            <details>
              <summary>Rezervasyon nasıl kesinleşir?</summary>
              <p>
                Ön rezervasyonunuzu tarih ve koltuk seçerek oluşturabilirsiniz.
                Bu aşamada tahsilat yapılmaz. Acente programı ve ödeme
                koşullarını teyit ettikten sonra kesin rezervasyon sürecini
                tamamlar.
              </p>
            </details>
            <details>
              <summary>Rehber koltuğunu seçebilir miyim?</summary>
              <p>
                9+1 VIP aracın ön yolcu koltuğu rehbere ayrılmıştır. Şoför ve
                rehber dışında 8 misafir için koltuk seçilebilir.
              </p>
            </details>
            <details>
              <summary>İptal ve program değişikliği nasıl olur?</summary>
              <p>
                Ön rezervasyon talebinizi referans numarası ve e-posta
                adresinizle sorgulayabilir, acente onayı bekleyen talebinizi
                iptal edebilirsiniz. Kesin rezervasyonun iptal ve iade koşulları
                acente tarafından tur bazında paylaşılır.
              </p>
            </details>
          </section>
        </div>
        <aside className="booking-aside">
          <div className="booking-price">
            <strong>{currency(t.price)}</strong>
            <span>örnek kişi başı başlangıç fiyatı</span>
          </div>
          <p>
            Size uyan günü seçin.
            <br />
            Yolculuğunuzun yerini şimdiden belirleyin.
          </p>
          {!t.inquiryOnly && (
            <div className="next-departures">
              <CalendarDays size={18} />
              <span>
                {departures.length
                  ? `İlk örnek hareket: ${dateLabel(departures[0].date)}`
                  : "Uygun tarih için bize ulaşın."}
              </span>
            </div>
          )}
          {t.inquiryOnly ? (
            <button className="btn block" onClick={() => setRequest(true)}>
              Program ve fiyat isteyin
            </button>
          ) : (
            <Link className="btn block" to={"/rezervasyon/" + t.id}>
              Tarih ve koltuk seç <ArrowRight size={17} />
            </Link>
          )}
          <div className="aside-benefits">
            <span>
              <Armchair size={15} />
              Seçebileceğiniz 8 yolcu koltuğu
            </span>
            <span>
              <Check size={15} />
              Acente onaylı ön rezervasyon
            </span>
          </div>
          <small>
            Yerel önizlemede fiyat ve sefer tarihleri örnektir. Online ödeme
            henüz aktif değildir.
          </small>
          <a className="text-link" href="tel:+905459353410">
            Birlikte planlayalım: 0545 935 34 10
          </a>
        </aside>
      </div>
      <Reviews tourId={t.id} />
      {request && (
        <RequestForm kind="private-tour" onClose={() => setRequest(false)} />
      )}
    </>
  );
}
