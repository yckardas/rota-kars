import { useEffect, useState, type FormEvent } from "react";
import { responsive } from "../lib/images";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  MapPin,
  CalendarDays,
  UsersRound,
  ChevronDown,
  Play,
  Compass,
  ShieldCheck,
  Armchair,
  Search,
  ExternalLink,
  BedDouble,
  ChevronRight,
  Sparkles,
  Banknote,
  HeartHandshake,
  Bus,
  Star,
  MessageCircle,
} from "lucide-react";
import type { Catalog, ReviewsResponse, Story } from "../lib/types";
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
      <section className="hero">
        <img
          className="hero-image"
          {...responsive("/images/ani.webp", "100vw")}
          alt="Ani Antik Kenti’nin kış manzarası"
          fetchPriority="high"
          width="1280"
          height="720"
        />
        <div className="hero-shade" />
        <div className="container hero-content">
          <div className="hero-location">
            <span /> Her mevsim, başka bir Kars
          </div>
          <h1>
            Kars’a bir de
            <br />
            bizimle bakın.
          </h1>
          <p>
            Bin yıllık hikâyeler, bembeyaz yollar.
            <br />
            Bu coğrafyanın insanlarıyla, size özel bir yolculuk.
          </p>
          <div className="button-row">
            <Link className="btn btn-white" to="/turlar">
              Rotaları keşfedin <ArrowRight size={17} />
            </Link>
            {rating?.rating != null && (
              <a className="hero-rating" href="#yorumlar">
                <GoogleMark size={20} />
                <strong>
                  {rating.rating.toLocaleString("tr-TR", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                </strong>
                <Star size={15} fill="currentColor" />
                <span>
                  {rating.total != null
                    ? `${rating.total.toLocaleString("tr-TR")} Google yorumu`
                    : "Google yorumları"}
                </span>
              </a>
            )}
          </div>
        </div>
        <div className="hero-bottom">
          <div className="container">
            <span>
              <MapPin size={15} /> Ani Antik Kenti, Kars
            </span>
            <span>Bir fotoğraftan fazlasını yaşayın.</span>
          </div>
        </div>
      </section>
      <div className="container search-wrap">
        <form className="trip-search" onSubmit={search}>
          <label>
            <MapPin size={18} />
            <span>
              Rotanız
              <select
                name="tour"
                aria-label="Rotanız"
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
            </span>
            <ChevronDown size={15} />
          </label>
          <label>
            <CalendarDays size={18} />
            <span>
              Yolculuk tarihi
              <input
                type="date"
                name="date"
                aria-label="Yolculuk tarihi"
                min={today()}
              />
            </span>
          </label>
          <label>
            <UsersRound size={18} />
            <span>
              Yol arkadaşlarınız
              <select name="guests" aria-label="Yolcu sayısı">
                {Array.from({ length: guestLimit }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1} kişi
                  </option>
                ))}
              </select>
            </span>
            <ChevronDown size={15} />
          </label>
          <button className="btn" type="submit">
            <Search size={18} /> Rotamı bul
          </button>
        </form>
      </div>
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
            <span className="section-note">
              Yola çıkmak için güzel bir neden
            </span>
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
            <span className="section-note">Rotanın ruhunu hissedin</span>
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
            <span className="section-note">
              Yolculuğun kendisi de güzel olsun.
            </span>
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
            <span className="section-note">
              {catalog.business.founded}’dan bu yana Doğu Anadolu’da
            </span>
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
            <span className="section-note">Araç kiralama hizmeti</span>
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
          <span className="section-note">Yolculuğunuzu tamamlayın</span>
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
            <span className="section-note">
              Rota sizin, planı birlikte yapalım.
            </span>
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
