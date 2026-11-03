import { InstagramSection } from "../components/InstagramSection";
import { responsive } from "../lib/images";
import { useEffect, useRef, useState } from "react";
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
import { telHref } from "../lib/phone";
import { useClearOfLaunchers } from "../lib/launchers";
import {
  currency,
  dateLabel,
  type Catalog,
  type Departure,
} from "../lib/types";
// Posta damgası tarihi: "2026-11-06" -> "06 KAS 26"
const postmarkDate = (iso: string) =>
  new Date(iso + "T12:00:00")
    .toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    })
    .replace(/\./g, "")
    .toLocaleUpperCase("tr-TR");
export function TourDetail({ catalog }: { catalog: Catalog }) {
  const { id } = useParams(),
    t = catalog.tours.find((t) => t.id === id);
  const [request, setRequest] = useState(false),
    [departures, setDepartures] = useState<Departure[]>([]),
    [activeImage, setActiveImage] = useState(0);
  const strip = useRef<HTMLDivElement>(null),
    stripVisible = useClearOfLaunchers(strip);
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
  const next = departures[0],
    startingPrice = departures.length
      ? Math.min(...departures.map((d) => d.price))
      : t.price,
    currentVehicle = next?.vehicle || t.vehicle;
  const mapUrl =
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(t.location + " " + t.name);
  return (
    <>
      <div className="container breadcrumb">
        <Link to="/">Ana sayfa</Link>
        <ChevronRight size={12} />
        <Link to="/turlar">Turlar</Link>
        <ChevronRight size={12} />
        <span>{t.name}</span>
      </div>
      <section
        className="container kp-detail-card"
        aria-labelledby="tour-title"
      >
        <div className="kp-card">
          <div
            className={
              "kp-views" + (t.gallery.length > 1 ? "" : " kp-views-single")
            }
          >
            <div className="kp-main-view">
              <img
                {...responsive(
                  t.gallery[activeImage] || t.image,
                  "(max-width: 760px) 100vw, 62vw",
                )}
                alt={t.name}
                width="1280"
                height="720"
              />
              <div className="kp-title">
                <h1 id="tour-title">{t.name}</h1>
                <p>{t.subtitle}</p>
              </div>
              {!t.salesOpen && !t.inquiryOnly && (
                <span className="tour-sales-closed">Şu an satışa kapalı</span>
              )}
            </div>
            {t.gallery.length > 1 && (
              <div className="kp-insets kp-insets-stack">
                {t.gallery.map((img, i) => (
                  <button
                    key={img}
                    type="button"
                    className="kp-inset"
                    onClick={() => setActiveImage(i)}
                    aria-label={`${i + 1}. fotoğrafı göster`}
                    aria-pressed={activeImage === i}
                  >
                    <img
                      {...responsive(img, "(max-width: 760px) 33vw, 20vw")}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="kp-strip kp-detail-strip" ref={strip}>
            <dl className="kp-facts">
              <div>
                <dt>Güzergâh</dt>
                <dd>
                  <MapPin size={15} />
                  {t.location}
                </dd>
              </div>
              <div>
                <dt>Süre</dt>
                <dd>
                  <Clock3 size={15} />
                  {t.duration}
                </dd>
              </div>
              <div>
                <dt>Araç</dt>
                <dd>
                  <Armchair size={15} />
                  {currentVehicle.passengerSeats}+1 {currentVehicle.name}
                </dd>
              </div>
              <div className="kp-fact-price">
                <dt>Kişi başı</dt>
                <dd>{currency(startingPrice)}’den</dd>
              </div>
            </dl>
            {t.inquiryOnly ? (
              <button className="btn" onClick={() => setRequest(true)}>
                Bu tur için bilgi alın
              </button>
            ) : (
              <Link className="btn" to={"/rezervasyon/" + t.id}>
                Tarih ve koltuk seç <ArrowRight size={17} />
              </Link>
            )}
          </div>
          <p className="kp-printed">
            <span>{t.season} · Kars çıkışlı</span>
            <span>
              {!t.inquiryOnly && departures.length
                ? `İlk hareket: ${dateLabel(departures[0].date)} · ${departures[0].start_time}`
                : "Uygun tarih için bize ulaşın."}
            </span>
          </p>
        </div>
      </section>
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
            <h2>Buluşalım, yola çıkalım.</h2>
            <div className="tour-meeting">
              <MapPin size={24} />
              <div>
                <strong>
                  {next?.pickup ||
                    "Kars merkez · Kesin buluşma noktası acente tarafından paylaşılır"}
                </strong>
                <p>
                  {next
                    ? `${dateLabel(next.date)} · ${next.start_time}`
                    : "Tarihinizi acenteyle planlayın."}
                </p>
                {next?.guide_name && <p>Rehber: {next.guide_name}</p>}
                <a
                  className="text-link"
                  href={mapUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Tur bölgesini haritada aç <ArrowRight size={15} />
                </a>
              </div>
            </div>
            <h2>Yola çıkmadan önce</h2>
            <details>
              <summary>Çocuklar için koltuk ve fiyat nasıl belirlenir?</summary>
              <p>
                Koltuklu her yolcu için ayrı koltuk seçilir. Çocuk indirimi veya
                çocuk koltuğu ihtiyacını rezervasyon öncesinde acenteye
                bildirin; yaşa göre koşullar teyit edilir. Ekrandaki kişi başı
                fiyat otomatik çocuk indirimi içermez.
              </p>
            </details>
            <details>
              <summary>
                Buluşma saati veya rehber değişirse nasıl öğrenirim?
              </summary>
              <p>
                Seçtiğiniz seferin hareket ve buluşma bilgileri rezervasyon
                belgenizde görünür. E-posta hizmeti etkin olduğunda
                güncellemeler ve hareket hatırlatması kayıtlı adresinize
                iletilir.
              </p>
            </details>
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
                {currentVehicle.passengerSeats}+1 aracın şoför yanındaki ön
                koltuğu rehbere ayrılmıştır. Şoför ve rehber dışında{" "}
                {currentVehicle.sellableSeats} misafir için koltuk seçilebilir.
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
          <div className="kp-stamp-row">
            <div className="kp-stamp">
              <div className="booking-price">
                <span className="kp-stamp-place">{t.name}</span>
                <strong>{currency(startingPrice)}</strong>
                <span>kişi başı başlangıç fiyatı</span>
              </div>
            </div>
            {!t.inquiryOnly && next && (
              <svg
                className="kp-postmark"
                viewBox="0 0 132 132"
                role="img"
                aria-label={`İlk hareket ${dateLabel(next.date)}, ${next.start_time}`}
              >
                <circle cx="66" cy="66" r="60" />
                <circle cx="66" cy="66" r="42" />
                <text x="66" y="22" textAnchor="middle" className="kp-pm-ring">
                  KARS
                </text>
                <text x="66" y="64" textAnchor="middle" className="kp-pm-date">
                  {postmarkDate(next.date)}
                </text>
                <text x="66" y="84" textAnchor="middle" className="kp-pm-time">
                  {next.start_time}
                </text>
              </svg>
            )}
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
                  ? `İlk hareket: ${dateLabel(departures[0].date)}`
                  : "Uygun tarih için bize ulaşın."}
              </span>
            </div>
          )}
          {t.inquiryOnly ? (
            <button className="btn block" onClick={() => setRequest(true)}>
              Bu tur için bilgi alın
            </button>
          ) : (
            <Link className="btn block" to={"/rezervasyon/" + t.id}>
              Tarih ve koltuk seç <ArrowRight size={17} />
            </Link>
          )}
          <div className="aside-benefits">
            <span>
              <Armchair size={15} />
              {currentVehicle.sellableSeats} yolcu koltuğu
            </span>
            <span>
              <Check size={15} />
              Acente onaylı ön rezervasyon
            </span>
          </div>
          {catalog.demo ? (
            <small>
              Demo sürümünde fiyat ve sefer tarihleri örnektir. Online ödeme
              henüz aktif değildir.
            </small>
          ) : (
            !catalog.payment.enabled && (
              <small>Online ödeme henüz aktif değildir.</small>
            )
          )}
          <a className="text-link" href={telHref(catalog.business.mobile)}>
            Birlikte planlayalım: {catalog.business.mobile}
          </a>
        </aside>
      </div>
      <InstagramSection profileUrl={catalog.business.instagram} />
      <Reviews tourId={t.id} />
      <div
        className={"tour-mobile-booking" + (stripVisible ? " is-tucked" : "")}
        aria-hidden={stripVisible || undefined}
      >
        <div>
          <strong>{currency(startingPrice)}</strong>
          <small>kişi başı başlangıç</small>
        </div>
        {t.inquiryOnly ? (
          <button className="btn" onClick={() => setRequest(true)}>
            Bilgi alın
          </button>
        ) : (
          <Link className="btn" to={"/rezervasyon/" + t.id}>
            Tarih ve koltuk seç <ArrowRight size={16} />
          </Link>
        )}
      </div>
      {request && (
        <RequestForm kind="private-tour" onClose={() => setRequest(false)} />
      )}
    </>
  );
}
