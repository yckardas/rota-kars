import { useEffect, useRef, useState, type FormEvent } from "react";
import { responsive } from "../lib/images";
import { Link, useLang, useLocalNavigate } from "../lib/i18n";
import {
  ArrowRight,
  Play,
  Compass,
  ShieldCheck,
  Armchair,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Banknote,
  HeartHandshake,
  Star,
  Check,
} from "lucide-react";
import type { Catalog, ReviewsResponse, Story } from "../lib/types";
import { currency } from "../lib/types";
import { useClearOfLaunchers } from "../lib/launchers";
import { api } from "../lib/api";
import { today } from "../lib/types";
import { TourCard } from "../components/TourCard";
import { placeName } from "../lib/place";
import { develop } from "../lib/reveal";
import { Reviews, GoogleMark } from "../components/Reviews";
import { whatsappLink } from "../lib/whatsapp";
import { SeatMap } from "../components/SeatMap";
import { StoryPlayer } from "../components/StoryPlayer";
import { InstagramSection } from "../components/InstagramSection";
const featureIcons: Record<string, typeof Compass> = {
  sparkles: Sparkles,
  shield: ShieldCheck,
  lira: Banknote,
  heart: HeartHandshake,
};
export function Home({ catalog }: { catalog: Catalog }) {
  const [filter, setFilter] = useState("Tüm rotalar"),
    [filtered, setFiltered] = useState(false),
    [story, setStory] = useState<Story | null>(null),
    [searchTour, setSearchTour] = useState(""),
    [rating, setRating] = useState<{
      rating: number | null;
      total: number | null;
    } | null>(null);
  useEffect(() => {
    let active = true;
    api<ReviewsResponse>("/reviews")
      .then((d) => {
        if (active) setRating({ rating: d.rating, total: d.total });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const previewTour = catalog.tours.find((t) => t.salesOpen),
    previewVehicle = previewTour?.vehicle || catalog.vehicle;
  // Tek rezervasyonda en fazla 4 yolcu; büyük gruplar acenteyle planlanır.
  const guestLimit = Math.min(
    4,
    catalog.tours.find((t) => t.id === searchTour)?.vehicle.sellableSeats ||
      Math.max(
        ...catalog.tours
          .filter((t) => t.salesOpen)
          .map((t) => t.vehicle.sellableSeats),
        1,
      ),
  );
  const { t, locale } = useLang();
  const heroCard = useRef<HTMLDivElement>(null);
  useClearOfLaunchers(heroCard);
  const insetTours = catalog.tours.filter((t) => !t.inquiryOnly).slice(0, 4);
  const navigate = useLocalNavigate();
  function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      tour = String(f.get("tour"));
    if (tour)
      navigate(
        `/rezervasyon/${tour}?date=${f.get("date") || ""}&guests=${f.get("guests") || 1}`,
      );
    else navigate("/turlar");
  }
  return (
    <>
      <section className="container kp-hero" aria-labelledby="kp-hero-title">
        <div className="kp-card" ref={heroCard}>
          <div className="kp-views">
            <div className="kp-main-view">
              <img
                {...responsive(
                  "/images/ani.webp",
                  "(max-width: 760px) 100vw, 62vw",
                )}
                alt={t("Ani Antik Kenti’nin kış manzarası")}
                fetchPriority="high"
                width="1280"
                height="720"
              />
              <div className="kp-title">
                <h1 id="kp-hero-title">{t("Kars’tan selamlar.")}</h1>
                <p>
                  {t(
                    "Kendi VIP aracımızla, küçük gruplarla, rehberli günler. Bir manzara seçin, gerisini birlikte planlayalım.",
                  )}
                </p>
              </div>
            </div>
            <div
              className="kp-insets"
              role="group"
              aria-label={t("Rota seçin")}
            >
              {insetTours.map((tour, i) => (
                <button
                  key={tour.id}
                  type="button"
                  className="kp-inset"
                  aria-pressed={searchTour === tour.id}
                  onClick={() =>
                    setSearchTour(searchTour === tour.id ? "" : tour.id)
                  }
                >
                  <img
                    {...responsive(
                      i === 0 && tour.gallery[1] ? tour.gallery[1] : tour.image,
                      "(max-width: 760px) 25vw, 16vw",
                    )}
                    {...develop}
                    alt=""
                    decoding="async"
                  />
                  <span className="kp-inset-label">
                    {placeName(tour)}
                    <small>
                      {tour.salesOpen
                        ? t("{price}’den", { price: currency(tour.fromPrice ?? tour.price) })
                        : t("Şu an satışa kapalı")}
                    </small>
                  </span>
                  <span className="kp-inset-check" aria-hidden="true">
                    <Check size={15} strokeWidth={3} />
                  </span>
                </button>
              ))}
            </div>
          </div>
          <form className="kp-strip" onSubmit={search}>
            <label className="kp-field kp-field-tour">
              <span>{t("Rota")}</span>
              <select
                name="tour"
                value={searchTour}
                onChange={(e) => setSearchTour(e.target.value)}
              >
                <option value="">{t("Nereye gitmek istersiniz?")}</option>
                {catalog.tours
                  .filter((t) => !t.inquiryOnly)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="kp-field">
              <span>{t("Tarih")}</span>
              <input type="date" name="date" min={today()} />
            </label>
            <label className="kp-field">
              <span>{t("Yolcu")}</span>
              <select name="guests">
                {Array.from({ length: guestLimit }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {t(i === 0 ? "1 kişi" : "{n} kişi", { n: i + 1 })}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn" type="submit">
              {t("Rotamı bul")} <ArrowRight size={18} />
            </button>
          </form>
          <p className="kp-printed">
            <span>
              {t(
                "Ani Antik Kenti, Kars · Rota Kars Turizm, {year}’dan beri Kars’ta · TÜRSAB A Grubu {no}",
                {
                  year: catalog.business.founded,
                  no: catalog.business.tursabNo,
                },
              )}
            </span>
            {rating?.rating != null && (
              <a className="kp-rating" href="#yorumlar">
                <GoogleMark size={16} />
                <strong>
                  {rating.rating.toLocaleString(locale, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                </strong>
                <Star size={13} fill="currentColor" />
                <span>
                  {rating.total != null
                    ? t("{n} Google yorumu", {
                        n: rating.total.toLocaleString(locale),
                      })
                    : t("Google yorumları")}
                </span>
              </a>
            )}
            <span>
              {catalog.payment.enabled
                ? t("Kaporayı kartla güvenle ödeyin; rezervasyonunuz anında onaylanır.")
                : t("Ödeme havale veya nakitle; rezervasyonunuzu acentemiz onaylar.")}
            </span>
          </p>
        </div>
      </section>
      <div className="container feature-strip">
        {catalog.features.map((f) => {
          const Icon = featureIcons[f.icon] || Compass;
          return (
            <div className="feature" key={f.title}>
              <Icon size={24} strokeWidth={1.4} />
              <div>
                <strong>{f.title}</strong>
                <span>{f.text}</span>
              </div>
            </div>
          );
        })}
      </div>
      <section className="container section tours-section" id="turlar">
        <div className="section-heading">
          <div>
            <h2>{t("Sizin için bir rota var.")}</h2>
          </div>
          <Link to="/turlar" className="text-link">
            {t("Bütün turları görün")} <ArrowRight size={17} />
          </Link>
        </div>
        <div className="tour-filters">
          {["Tüm rotalar", "Kültür", "Kış", "Yurt dışı", "Konaklamalı"].map(
            (f) => (
              <button
                key={f}
                className={filter === f ? "active" : ""}
                onClick={() => {
                  setFiltered(true);
                  setFilter(f);
                }}
              >
                {t(f)}
              </button>
            ),
          )}
        </div>
        {/* Filtre değişince kartlar sırayla yerine "oturur" (ilk yüklemede değil). */}
        <div
          className={"tour-grid" + (filtered ? " is-refiltered" : "")}
          key={filter}
        >
          {catalog.tours
            // Kategoriler /en altında katalogda İngilizce gelir.
            .filter(
              (tour) => filter === "Tüm rotalar" || tour.category === t(filter),
            )
            .slice(0, 6)
            .map((tour) => (
              <TourCard key={tour.id} tour={tour} />
            ))}
        </div>
        {/* Telefonda ana sayfa 3 turla kısa kalır; gerisi tur listesinde. */}
        <Link className="tours-all-link" to="/turlar">
          {t("Bütün turları görün ({n})", { n: catalog.tours.length })}{" "}
          <ArrowRight size={16} />
        </Link>
      </section>
      <section className="story-section">
        <div className="container">
          <div className="story-intro">
            <h2>
              {t("Yola çıkmadan")} <br />
              {t("küçük bir keşif.")}
            </h2>
            <p>
              {t("Bir manzara, bir hikâye, bir sonraki yolculuğunuz.")}
              <br />
              {t("Kars’ı yakından tanımaya buradan başlayın.")}
            </p>
            <span className="story-format">
              {t("Fotoğraflarla kısa rota hikâyeleri")}
            </span>
          </div>
          <div className="story-grid">
            {catalog.stories.map((s) => (
              <button
                className="story-card"
                key={s.id}
                onClick={() => setStory(s)}
              >
                <img
                  {...responsive(s.image, "(max-width: 760px) 80vw, 25vw")}
                  alt={s.location}
                  loading="lazy"
                  decoding="async"
                />
                <span className="story-play">
                  <Play size={17} fill="currentColor" />
                </span>
                <span className="story-card-copy">
                  <strong>{s.title}</strong>
                  <span>
                    {t("Hikâyeyi keşfet")} <ChevronRight size={14} />
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="vip-section section">
        <div className="container vip-inner">
          <div className="vip-copy">
            <h2>
              {t("Yolculuğunuza uygun,")}
              <br />
              {t("size ayrılmış bir yer.")}
            </h2>
            <p>
              {t(
                "Grubunuza uygun araçla yola çıkın. Araç ve koltuk düzenini tur sayfasında inceleyin; şoför yanındaki ön koltuk rehberinize ayrılmış olsun.",
              )}
            </p>
            <p className="vip-caption">
              {t(
                "{seats}+1 {vehicle} · {guests} misafir koltuğu · şoför yanı rehbere ayrılır",
                {
                  seats: previewVehicle.passengerSeats,
                  vehicle: previewVehicle.name,
                  guests: previewVehicle.sellableSeats,
                },
              )}
            </p>
            <Link
              className="btn btn-white"
              to={previewTour ? "/rezervasyon/" + previewTour.id : "/turlar"}
            >
              {t("Yeriniz şimdiden belli olsun")} <ArrowRight size={17} />
            </Link>
          </div>
          <div className="vip-visual">
            <div className="vip-visual-label">
              <Armchair size={17} />
              <span>{t("Koltuk seçimi sizin elinizde.")}</span>
            </div>
            <SeatMap vehicle={previewVehicle} interactive={false} />
            <span className="vip-visual-foot">
              {t("Şoför ve rehber koltukları satışa kapalıdır.")}
            </span>
          </div>
        </div>
      </section>
      {/* Yan hizmetler tek bantta: tur seçme ve koltuk görme işini bölmeden
          hizmetler, araç kiralama ve konaklamaya kısa yollar. */}
      <section className="container section kp-more" aria-labelledby="kp-more-title">
        <h2 id="kp-more-title">{t("Kars’ta başka neler var?")}</h2>
        <div className="kp-more-grid">
          {[
            {
              to: "/hizmetler",
              image: "/images/kars.webp",
              title: t("Transfer ve özel ulaşım"),
              text: t("Havalimanı transferi, VIP araç, kongre ve gezi ulaşımı."),
              cta: t("Hizmetlerimiz"),
            },
            {
              to: "/hizmetler#filo",
              image: "/images/rota-bus.webp",
              title: t("Şoförlü araç kiralama"),
              text: t("4+1’den 46+1’e araç; D2 ve B2 belgeli, deneyimli kaptanlarla."),
              cta: t("Filoyu görün"),
            },
            {
              to: "/konaklama",
              image: "/images/stay.webp",
              title: t("Bir gün daha kalın"),
              text: t("Turunuzun öncesinde veya sonrasında anlaşmalı otellerde konaklama."),
              cta: t("Konaklamayı planla"),
            },
          ].map((m) => (
            <Link className="kp-more-card" key={m.to} to={m.to}>
              <span className="kp-more-photo">
                <img
                  {...responsive(m.image, "(max-width: 760px) 90vw, 30vw")}
                  {...develop}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              </span>
              <h3>{m.title}</h3>
              <p>{m.text}</p>
              <span className="kp-more-link">
                {m.cta} <ArrowRight size={15} />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="private-journey">
        <div className="container">
          <div>
            <h2>{t("Yol arkadaşlarınızı alın, gerisini bize bırakın.")}</h2>
          </div>
          <a
            className="btn btn-outline"
            href={whatsappLink(
              catalog.business.whatsapp,
              t("Merhaba, kişiye özel bir tur planlamak istiyorum."),
            )}
            target="_blank"
            rel="noreferrer"
          >
            {t("Özel turunuzu konuşalım")} <ExternalLink size={16} />
          </a>
        </div>
      </section>
      <InstagramSection profileUrl={catalog.business.instagram} />
      <Reviews />
      {story && (
        <StoryPlayer story={story} onClose={() => setStory(null)} />
      )}{" "}
    </>
  );
}
