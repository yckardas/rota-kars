import { useEffect, useRef, useState, type FormEvent } from "react";
import { responsive } from "../lib/images";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Play,
  Compass,
  ShieldCheck,
  Armchair,
  ExternalLink,
  BedDouble,
  ChevronRight,
  Sparkles,
  Banknote,
  HeartHandshake,
  Bus,
  Star,
  MessageCircle,
  Check,
} from "lucide-react";
import type { Catalog, ReviewsResponse, Story } from "../lib/types";
import { currency } from "../lib/types";
import { useClearOfLaunchers } from "../lib/launchers";
import { api } from "../lib/api";
import { today } from "../lib/types";
import { TourCard } from "../components/TourCard";
import { Reviews, GoogleMark } from "../components/Reviews";
import { whatsappLink } from "../lib/whatsapp";
import { SeatMap } from "../components/SeatMap";
import { StoryPlayer } from "../components/StoryPlayer";
import { RequestForm } from "../components/RequestForm";
import { InstagramSection } from "../components/InstagramSection";
const featureIcons: Record<string, typeof Compass> = {
  sparkles: Sparkles,
  shield: ShieldCheck,
  lira: Banknote,
  heart: HeartHandshake,
};
// "Kars · Ani · Çıldır" -> "Çıldır": hatıra kartındaki küçük manzaranın adı.
const placeName = (location: string) =>
  location.split(" · ").filter(Boolean).pop() || location;
export function Home({ catalog }: { catalog: Catalog }) {
  const [filter, setFilter] = useState("Tüm rotalar"),
    [story, setStory] = useState<Story | null>(null),
    [request, setRequest] = useState(false),
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
  const guestLimit =
    catalog.tours.find((t) => t.id === searchTour)?.vehicle.sellableSeats ||
    Math.max(
      ...catalog.tours
        .filter((t) => t.salesOpen)
        .map((t) => t.vehicle.sellableSeats),
      1,
    );
  const heroCard = useRef<HTMLDivElement>(null);
  useClearOfLaunchers(heroCard);
  const insetTours = catalog.tours.filter((t) => !t.inquiryOnly).slice(0, 4);
  const navigate = useNavigate();
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
                alt="Ani Antik Kenti’nin kış manzarası"
                fetchPriority="high"
                width="1280"
                height="720"
              />
              <div className="kp-title">
                <h1 id="kp-hero-title">Kars’tan selamlar.</h1>
                <p>
                  Kendi VIP aracımızla, küçük gruplarla, rehberli günler. Bir
                  manzara seçin, gerisini birlikte planlayalım.
                </p>
              </div>
            </div>
            <div className="kp-insets" role="group" aria-label="Rota seçin">
              {insetTours.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  className="kp-inset"
                  aria-pressed={searchTour === t.id}
                  onClick={() => setSearchTour(searchTour === t.id ? "" : t.id)}
                >
                  <img
                    {...responsive(
                      i === 0 && t.gallery[1] ? t.gallery[1] : t.image,
                      "(max-width: 760px) 25vw, 16vw",
                    )}
                    alt=""
                    decoding="async"
                  />
                  <span className="kp-inset-label">
                    {placeName(t.location)}
                    <small>
                      {t.salesOpen
                        ? `${currency(t.price)}’den`
                        : "Şu an satışa kapalı"}
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
              <span>Rota</span>
              <select
                name="tour"
                value={searchTour}
                onChange={(e) => setSearchTour(e.target.value)}
              >
                <option value="">Nereye gitmek istersiniz?</option>
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
              <span>Tarih</span>
              <input type="date" name="date" min={today()} />
            </label>
            <label className="kp-field">
              <span>Yolcu</span>
              <select name="guests">
                {Array.from({ length: guestLimit }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1} kişi
                  </option>
                ))}
              </select>
            </label>
            <button className="btn" type="submit">
              Rotamı bul <ArrowRight size={18} />
            </button>
          </form>
          <p className="kp-printed">
            <span>
              Ani Antik Kenti, Kars · Rota Kars Turizm,{" "}
              {catalog.business.founded}
              ’dan beri Kars’ta · TÜRSAB A Grubu {catalog.business.tursabNo}
            </span>
            {rating?.rating != null && (
              <a className="kp-rating" href="#yorumlar">
                <GoogleMark size={16} />
                <strong>
                  {rating.rating.toLocaleString("tr-TR", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                </strong>
                <Star size={13} fill="currentColor" />
                <span>
                  {rating.total != null
                    ? `${rating.total.toLocaleString("tr-TR")} Google yorumu`
                    : "Google yorumları"}
                </span>
              </a>
            )}
            <span>Ödeme havale veya nakit; kart bilgisi istenmez.</span>
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
            <h2>Sizin için bir rota var.</h2>
          </div>
          <Link to="/turlar" className="text-link">
            Bütün turları görün <ArrowRight size={17} />
          </Link>
        </div>
        <div className="tour-filters">
          {["Tüm rotalar", "Kültür", "Kış", "Yurt dışı", "Konaklamalı"].map(
            (f) => (
              <button
                key={f}
                className={filter === f ? "active" : ""}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ),
          )}
        </div>
        <div className="tour-grid">
          {catalog.tours
            .filter((t) => filter === "Tüm rotalar" || t.category === filter)
            .slice(0, 6)
            .map((t) => (
              <TourCard key={t.id} tour={t} />
            ))}
        </div>
      </section>
      <section className="story-section">
        <div className="container">
          <div className="story-intro">
            <h2>
              Yola çıkmadan <br />
              küçük bir keşif.
            </h2>
            <p>
              Bir manzara, bir hikâye, bir sonraki yolculuğunuz.
              <br />
              Kars’ı yakından tanımaya buradan başlayın.
            </p>
            <span className="story-format">
              Fotoğraflarla kısa rota hikâyeleri
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
                  <small>{s.location}</small>
                  <strong>{s.title}</strong>
                  <span>
                    Hikâyeyi keşfet <ChevronRight size={14} />
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
              Yolculuğunuza uygun,
              <br />
              size ayrılmış bir yer.
            </h2>
            <p>
              Grubunuza uygun araçla yola çıkın. Araç ve koltuk düzenini tur
              sayfasında inceleyin; şoför yanındaki ön koltuk rehberinize
              ayrılmış olsun.
            </p>
            <div className="vip-facts">
              <div>
                <strong>{previewVehicle.passengerSeats}+1</strong>
                <span>{previewTour?.name || "Örnek araç düzeni"}</span>
              </div>
              <div>
                <strong>{previewVehicle.sellableSeats}</strong>
                <span>Misafir için koltuk</span>
              </div>
              <div>
                <ShieldCheck size={27} />
                <span>Şoför yanı rehbere ayrılır</span>
              </div>
            </div>
            <Link
              className="btn btn-white"
              to={previewTour ? "/rezervasyon/" + previewTour.id : "/turlar"}
            >
              Yeriniz şimdiden belli olsun <ArrowRight size={17} />
            </Link>
          </div>
          <div className="vip-visual">
            <div className="vip-visual-label">
              <Armchair size={17} />
              <span>Koltuk seçimi sizin elinizde.</span>
            </div>
            <SeatMap vehicle={previewVehicle} interactive={false} />
            <span className="vip-visual-foot">
              Şoför ve rehber koltukları satışa kapalıdır.
            </span>
          </div>
        </div>
      </section>
      <section className="container section services-section" id="hizmetler">
        <div className="section-heading">
          <div>
            <h2>Hizmetlerimiz</h2>
          </div>
          <a
            className="text-link"
            href={whatsappLink(
              catalog.business.whatsapp,
              "Merhaba, hizmetleriniz hakkında bilgi almak istiyorum.",
            )}
            target="_blank"
            rel="noreferrer"
          >
            Teklif alın <ArrowRight size={17} />
          </a>
        </div>
        <div className="service-grid">
          {catalog.services.map((s) => (
            <Link className="service-card" key={s.id} to={"/hizmetler/" + s.id}>
              <img
                {...responsive(s.image)}
                alt=""
                loading="lazy"
                decoding="async"
              />
              <h3>{s.title}</h3>
              <p>{s.text}</p>
              <span className="service-discover">
                Hizmeti keşfet <ArrowRight size={15} />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="fleet-section">
        <div className="container fleet-inner">
          <div className="fleet-photo">
            <img
              {...responsive(
                "/images/rota-bus.webp",
                "(max-width: 950px) 100vw, 55vw",
              )}
              alt="Rota Kars Tur logolu turizm otobüsü"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="fleet-copy">
            <h2>Grubunuz kaç kişi olursa olsun, aracı bizde.</h2>
            <p>{catalog.fleet.note}</p>
            <div className="fleet-groups">
              <div>
                <small>Turizm taşımacılığı</small>
                <div className="chips">
                  {catalog.fleet.tourism.map((c) => (
                    <span key={c}>{c}</span>
                  ))}
                </div>
              </div>
              <div>
                <small>VIP taşımacılık</small>
                <div className="chips">
                  {catalog.fleet.vip.map((c) => (
                    <span key={c}>{c}</span>
                  ))}
                </div>
              </div>
            </div>
            <ul className="fleet-perks">
              {catalog.fleet.perks.map((p) => (
                <li key={p}>
                  <Bus size={15} /> {p}
                </li>
              ))}
            </ul>
            <a
              className="btn"
              href={whatsappLink(
                catalog.business.whatsapp,
                "Merhaba, şoförlü araç kiralama için teklif almak istiyorum.",
              )}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={17} /> Araç için teklif alın
            </a>
          </div>
        </div>
      </section>
      <section className="container stay-section section">
        <div className="stay-photo">
          <img
            {...responsive(
              "/images/stay.webp",
              "(max-width: 950px) 100vw, 50vw",
            )}
            alt="Konaklama planlaması için temsili otel odası"
            loading="lazy"
            decoding="async"
          />
          <span>Temsili konaklama görseli</span>
        </div>
        <div className="stay-copy">
          <h2>
            Bir gün daha
            <br />
            Kars’ta kalın.
          </h2>
          <p>
            Anlaşmalı otellerimizde konaklamanızı planlayalım. Turunuzun
            öncesinde veya sonrasında Kars’a biraz daha zaman ayırın.
          </p>
          <div className="stay-detail">
            <BedDouble size={22} />
            <span>
              Tercihinize göre konaklama seçenekleri
              <br />
              <small>Müsaitlik ve fiyat için acente teyidi</small>
            </span>
          </div>
          <div className="button-row">
            <Link className="btn" to="/konaklama">
              Konaklamayı planla <ArrowRight size={17} />
            </Link>
            <button className="text-link" onClick={() => setRequest(true)}>
              Talep bırakın
            </button>
          </div>
        </div>
      </section>
      <section className="private-journey">
        <div className="container">
          <div>
            <h2>Yol arkadaşlarınızı alın, gerisini bize bırakın.</h2>
          </div>
          <a
            className="btn btn-outline"
            href={whatsappLink(
              catalog.business.whatsapp,
              "Merhaba, kişiye özel bir tur planlamak istiyorum.",
            )}
            target="_blank"
            rel="noreferrer"
          >
            Özel turunuzu konuşalım <ExternalLink size={16} />
          </a>
        </div>
      </section>
      <InstagramSection profileUrl={catalog.business.instagram} />
      <Reviews />
      {story && (
        <StoryPlayer story={story} onClose={() => setStory(null)} />
      )}{" "}
      {request && <RequestForm onClose={() => setRequest(false)} />}
    </>
  );
}
