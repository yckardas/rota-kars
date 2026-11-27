import { useEffect, useMemo, useRef, useState } from "react";
import { responsive } from "../lib/images";
import { Link, useLang } from "../lib/i18n";
import {
  ArrowRight,
  Play,
  Armchair,
  BadgeCheck,
  CreditCard,
  ExternalLink,
  ChevronRight,
  Image as ImageIcon,
  MapPin,
  Snowflake,
  Star,
} from "lucide-react";
import type { Catalog, ReviewsResponse, Story } from "../lib/types";
import { currency, hasPrice } from "../lib/types";
import { useClearOfLaunchers } from "../lib/launchers";
import { api } from "../lib/api";
import { TourCard } from "../components/TourCard";
import { distinctPlacesFirst, heroTours, openFirst } from "../lib/place";
import { develop, watchReveal } from "../lib/reveal";
import { Reviews, GoogleMark } from "../components/Reviews";
import { whatsappLink } from "../lib/whatsapp";
import { SeatMap } from "../components/SeatMap";
import { StoryPlayer } from "../components/StoryPlayer";
import { InstagramSection } from "../components/InstagramSection";
import { FeatureMarquee } from "../components/FeatureMarquee";
import { HeroSlider } from "../components/HeroSlider";
import { HeroSearch } from "../components/HeroSearch";
import { CategoryBadges } from "../components/CategoryBadges";
import { UpcomingDepartures } from "../components/UpcomingDepartures";
import { filterTone, toneStyle } from "../lib/tone";
import { TOUR_FILTERS, matchesTourFilter } from "../lib/tourFilters";
export function Home({ catalog }: { catalog: Catalog }) {
  const [filter, setFilter] = useState("Tüm rotalar"),
    [filtered, setFiltered] = useState(false),
    [story, setStory] = useState<Story | null>(null),
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
  const { t, locale } = useLang();
  const heroCard = useRef<HTMLFormElement>(null),
    trustRow = useRef<HTMLParagraphElement>(null),
    heroParts = useMemo(() => [heroCard, trustRow], []);
  useClearOfLaunchers(heroCard);
  // Telefonda da: arama kutusu ve güven satırı görünürken WhatsApp ve asistan
  // düğmeleri "Rotamı bul"un ve satırın üstüne binmesin.
  useClearOfLaunchers(heroParts, "actionVisible");
  // Vitrinde önce satışta olan rotalar; yeterince yoksa bütün rotalardan seçilir.
  const onSale = catalog.tours.filter((tour) => tour.salesOpen),
    insetTours = heroTours(onSale.length >= 3 ? onSale : catalog.tours);
  // Bölümler ekrana girince yükselerek gelir (renkli.css, .rk-reveal).
  useEffect(() => {
    const stops = Array.from(
      document.querySelectorAll(".rk-reveal"),
      (el) => watchReveal(el),
    );
    return () => stops.forEach((stop) => stop());
  }, []);
  // Yuvarlak tür rozetleri: her filtre için o türdeki ilk turun fotoğrafı ve tur sayısı.
  function pickCategory(f: string) {
    setFiltered(true);
    setFilter(filtered && filter === f ? "Tüm rotalar" : f);
    document.getElementById("turlar")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  return (
    <>
      <HeroSlider tours={insetTours} title={t("Kars’tan selamlar.")}>
        <HeroSearch catalog={catalog} formRef={heroCard} />
        <p className="rk-trust" ref={trustRow}>
          <span>
            <BadgeCheck size={16} aria-hidden="true" />
            {t("TÜRSAB A Grubu {no}", { no: catalog.business.tursabNo })}
          </span>
          <span>
            <MapPin size={16} aria-hidden="true" />
            {t("{year}’dan beri Kars’ta", { year: catalog.business.founded })}
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
            <CreditCard size={16} aria-hidden="true" />
            {catalog.payment.enabled
              ? t("Kaporayı kartla güvenle ödeyin; rezervasyonunuz anında onaylanır.")
              : t("Ödeme havale veya nakitle; rezervasyonunuzu acentemiz onaylar.")}
          </span>
        </p>
      </HeroSlider>
      <CategoryBadges
        className="container"
        tours={catalog.tours}
        active={filtered && filter !== "Tüm rotalar" ? filter : null}
        onPick={pickCategory}
      />
      <FeatureMarquee features={catalog.features} />
      <UpcomingDepartures tours={catalog.tours} />
      <section className="container section tours-section" id="turlar">
        <div className="section-heading rk-reveal">
          <div>
            <h2>{t("Sizin için bir rota var.")}</h2>
          </div>
          <Link to="/turlar" className="text-link">
            {t("Bütün turları görün")} <ArrowRight size={17} />
          </Link>
        </div>
        <div className="tour-filters">
          {["Tüm rotalar", ...TOUR_FILTERS].map((f) => (
            <button
              key={f}
              style={toneStyle(filterTone(f))}
              className={filter === f ? "active" : ""}
              onClick={() => {
                setFiltered(true);
                setFilter(f);
              }}
            >
              {t(f)}
            </button>
          ))}
        </div>
        {/* Filtre değişince kartlar sırayla yerine "oturur" (ilk yüklemede değil). */}
        <div
          className={"tour-grid" + (filtered ? " is-refiltered" : "")}
          key={filter}
        >
          {/* Bütün turlar ana sayfada: satışta olanlar üstte, kapalılar altta; aynı yere
              giden ikinci, üçüncü tur kendi grubunun sonuna kalır. */}
          {openFirst(distinctPlacesFirst(catalog.tours))
            // Kategoriler /en altında katalogda İngilizce gelir.
            .filter(
              (tour) =>
                filter === "Tüm rotalar" || matchesTourFilter(tour, filter, t),
            )
            .map((tour) => (
              <TourCard key={tour.id} tour={tour} />
            ))}
        </div>
        {/* Telefonda ana sayfa 6 turla kısa kalır; gerisi tur listesinde. */}
        <Link className="tours-all-link" to="/turlar">
          {t("Bütün turları görün ({n})", { n: catalog.tours.length })}{" "}
          <ArrowRight size={16} />
        </Link>
      </section>
      <section className="story-section" id="kesif-kartpostallari">
        <div className="container">
          <div className="story-intro rk-reveal">
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
              {t("Fotoğraf, video ve animasyonla kısa rota hikâyeleri")}
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
                  {s.scenes[0]?.video ? (
                    <Play size={17} fill="currentColor" aria-hidden="true" />
                  ) : s.scenes[0]?.motion ? (
                    <Snowflake size={18} aria-hidden="true" />
                  ) : (
                    <ImageIcon size={18} aria-hidden="true" />
                  )}
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
        <div className="container vip-inner rk-reveal">
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
        <div className="kp-more-grid rk-reveal">
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
        <div className="container rk-reveal">
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
