import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  MapPin,
  CalendarDays,
  UsersRound,
  ChevronDown,
  Play,
  Compass,
  Mountain,
  ShieldCheck,
  Armchair,
  Search,
  ExternalLink,
  BedDouble,
  ChevronRight,
} from "lucide-react";
import type { Catalog, Story } from "../lib/types";
import { today } from "../lib/types";
import { TourCard } from "../components/TourCard";
import { Reviews } from "../components/Reviews";
import { SeatMap } from "../components/SeatMap";
import { StoryPlayer } from "../components/StoryPlayer";
import { RequestForm } from "../components/RequestForm";
export function Home({ catalog }: { catalog: Catalog }) {
  const [filter, setFilter] = useState("Tüm rotalar"),
    [story, setStory] = useState<Story | null>(null),
    [request, setRequest] = useState(false);
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
          src="/images/ani.jpg"
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
          <Link className="btn btn-white" to="/turlar">
            Rotaları keşfedin <ArrowRight size={17} />
          </Link>
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
              <select name="tour" aria-label="Rotanız">
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
                {Array.from({ length: 8 }, (_, i) => (
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
      <div className="container intro-strip">
        <span>
          <Compass size={22} />
          <span>Bir yerel gibi keşfedin</span>
        </span>
        <span>
          <Armchair size={22} />
          <span>Az kişi, rahat bir yolculuk</span>
        </span>
        <span>
          <Mountain size={22} />
          <span>Her mevsime bir rota</span>
        </span>
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
            .slice(0, 3)
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
                <img src={s.image} alt={s.location} loading="lazy" />
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
              Kalabalıktan uzak,
              <br />
              Kars’a daha yakın.
            </h2>
            <p>
              VIP minibüslerimizle küçük bir grupla yola çıkın. Rehberiniz yanı
              başınızda, keşfe ayıracak daha çok zamanınız olsun.
            </p>
            <div className="vip-facts">
              <div>
                <strong>9+1</strong>
                <span>VIP minibüs düzeni</span>
              </div>
              <div>
                <strong>8</strong>
                <span>Misafir için koltuk</span>
              </div>
              <div>
                <ShieldCheck size={27} />
                <span>Rehbere ayrılan ön koltuk</span>
              </div>
            </div>
            <Link className="btn btn-white" to="/rezervasyon/ani-cildir">
              Yeriniz şimdiden belli olsun <ArrowRight size={17} />
            </Link>
          </div>
          <div className="vip-visual">
            <div className="vip-visual-label">
              <Armchair size={17} />
              <span>Koltuk seçimi sizin elinizde.</span>
            </div>
            <SeatMap vehicle={catalog.vehicle} interactive={false} />
            <span className="vip-visual-foot">
              Şoför ve rehber koltukları satışa kapalıdır.
            </span>
          </div>
        </div>
      </section>
      <section className="container stay-section section">
        <div className="stay-photo">
          <img
            src="/images/stay.jpg"
            alt="Konaklama planlaması için temsili otel odası"
            loading="lazy"
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
          <a className="btn btn-outline" href="tel:+905459353410">
            Özel turunuzu konuşalım <ExternalLink size={16} />
          </a>
        </div>
      </section>
      <Reviews />
      {story && (
        <StoryPlayer story={story} onClose={() => setStory(null)} />
      )}{" "}
      {request && <RequestForm onClose={() => setRequest(false)} />}
    </>
  );
}
