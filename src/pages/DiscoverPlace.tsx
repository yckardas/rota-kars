// Veriyle beslenen keşif sayfası (/kesfet/cildir, /kesfet/sarikamis). Ani sayfasıyla
// aynı hatıra kartı parçaları: açılışta kart masaya yerleşir ve başlık şeridi oturur,
// tanıtımda masaya bırakılmış fotoğraf, ekrana girince çizilen rota çizgisi, ayları
// soldan dolan mevsim takvimi, sırayla yerine oturan "neler yapılır" kartları, ipuçları,
// ilgili rehber yazıları ve tur kartı. Hareket azaltma tercihinde her şey baştan yerinde.
import { useEffect, useState, type CSSProperties } from "react";
import {
  ArrowRight,
  CalendarDays,
  Camera,
  ChevronRight,
  Mountain,
  MapPin,
  Shirt,
  Snowflake,
  Sun,
  Ticket,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { Link, localeOf, useLang } from "../lib/i18n";
import { responsive } from "../lib/images";
import { develop, useReveal } from "../lib/reveal";
import { api } from "../lib/api";
import { TourCard } from "../components/TourCard";
import { ArticleCard } from "../components/ArticleCard";
import type { Place, PlaceTip } from "../lib/discover-places";
import type { Article, Catalog } from "../lib/types";

const FACT_ICONS: Record<Place["facts"][number]["icon"], LucideIcon> = {
  pin: MapPin,
  mountain: Mountain,
  snow: Snowflake,
  calendar: CalendarDays,
};
const TIP_ICONS: Record<PlaceTip["icon"], LucideIcon> = {
  sun: Sun,
  shirt: Shirt,
  ice: TriangleAlert,
  ticket: Ticket,
  camera: Camera,
  ski: Snowflake,
  mountain: Mountain,
};
// Ay kısaltmaları sayfanın diline göre (Oca, Şub… / Jan, Feb…).
const monthNames = () =>
  Array.from({ length: 12 }, (_, i) =>
    new Date(2026, i, 15).toLocaleDateString(localeOf(), { month: "short" }).replace(".", ""),
  );
// Bir satırın kapladığı ay aralıkları (yıl sonundan başa saranlar iki parça olur).
const spans = (from: number, to: number) => (from <= to ? [[from, to]] : [[from, 12], [1, to]]);

export function DiscoverPlace({ place: p, catalog }: { place: Place; catalog: Catalog }) {
  const { t, lang } = useLang();
  const timeline = useReveal<HTMLDivElement>(),
    seasons = useReveal<HTMLDivElement>(),
    highlights = useReveal<HTMLDivElement>();
  const [articles, setArticles] = useState<Article[]>([]);
  const tour = catalog.tours.find((x) => x.id === p.tourId);
  useEffect(() => {
    api<Article[]>("/articles" + (lang === "en" ? "?lang=en" : ""))
      .then((list) => setArticles(p.articles.map((s) => list.find((a) => a.slug === s)).filter((a): a is Article => Boolean(a))))
      .catch(() => setArticles([]));
  }, [p, lang]);
  const months = monthNames();
  return (
    <div className="discover-page">
      <div className="container breadcrumb">
        <Link to="/">{t("Ana sayfa")}</Link>
        <ChevronRight size={12} />
        {tour && (
          <>
            <Link to={"/turlar/" + tour.id}>{tour.name}</Link>
            <ChevronRight size={12} />
          </>
        )}
        <span>{t(p.title)}</span>
      </div>
      <section className="container kp-detail-card discover-hero" aria-labelledby="discover-title">
        <div className="kp-card">
          <div className="kp-views kp-views-single">
            <div className="kp-main-view">
              <img
                {...responsive(p.hero.src, "(max-width: 760px) 100vw, 62vw")}
                alt={t(p.hero.alt)}
                width="1280"
                height="720"
                fetchPriority="high"
              />
              <div className="kp-title">
                <h1 id="discover-title">{t(p.title)}</h1>
                <p>{t(p.tagline)}</p>
              </div>
            </div>
          </div>
          <div className="kp-strip kp-detail-strip">
            <dl className="kp-facts discover-facts">
              {p.facts.map((f) => {
                const Icon = FACT_ICONS[f.icon];
                return (
                  <div key={f.label}>
                    <dt>{t(f.label)}</dt>
                    <dd>
                      <Icon size={16} /> {t(f.value)}
                    </dd>
                  </div>
                );
              })}
            </dl>
            {tour && (
              <Link className="btn" to={"/turlar/" + tour.id}>
                {t("Rehberle gezin")} <ArrowRight size={17} />
              </Link>
            )}
          </div>
          <p className="kp-printed">
            <span>{t(p.printed)}</span>
            <span>
              <Link to="/gorsel-kaynaklari">{t(p.credit)}</Link>
            </span>
          </p>
        </div>
      </section>

      <div className="container discover-layout">
        <section className="detail-content discover-intro">
          <figure className="discover-photo">
            <img
              {...responsive(p.intro.photo.src, "(max-width: 860px) 100vw, 36vw")}
              {...develop}
              alt={t(p.intro.photo.alt)}
              loading="lazy"
              decoding="async"
            />
            <figcaption>{t(p.intro.photo.caption)}</figcaption>
          </figure>
          <h2>{t(p.intro.heading)}</h2>
          {p.intro.paragraphs.map((text) => (
            <p key={text} className="lead-copy">
              {t(text)}
            </p>
          ))}
        </section>

        <section className="detail-content discover-timeline" aria-labelledby="timeline-title">
          <h2 id="timeline-title">{t(p.timeline.heading)}</h2>
          <div className="itinerary kp-await" ref={timeline}>
            {p.timeline.items.map((s, i) => (
              <div key={s.title} style={{ "--i": i } as CSSProperties}>
                <span className="itinerary-time">{t(s.time)}</span>
                <div>
                  <h3>{t(s.title)}</h3>
                  <p>{t(s.text)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="detail-content discover-seasons" aria-labelledby="seasons-title">
          <h2 id="seasons-title">{t(p.seasons.heading)}</h2>
          <p className="muted">{t(p.seasons.note)}</p>
          <div className="season-chart kp-await" ref={seasons}>
            {/* Ay başlıkları çubuklarla aynı iki sütunlu ızgarada: aylar çubuk izinin üstünde. */}
            <div className="season-months" aria-hidden="true">
              <span />
              <div className="season-month-grid">
                {months.map((m) => (
                  <span key={m}>{m}</span>
                ))}
              </div>
            </div>
            {p.seasons.rows.map((row, i) => (
              <div key={row.label} className="season-row" style={{ "--i": i } as CSSProperties}>
                <span className="season-label">
                  {t(row.label)}
                  <small className="sr-only">
                    {" "}
                    {months[row.from - 1]}–{months[row.to - 1]}
                  </small>
                </span>
                <div className="season-track" aria-hidden="true">
                  {spans(row.from, row.to).map(([a, b]) => (
                    <i key={a} style={{ gridColumn: `${a} / ${b + 1}` }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {p.story && (
          <section className="detail-content discover-intro discover-story">
            <figure className="discover-photo">
              <img
                {...responsive(p.story.photo.src, "(max-width: 860px) 100vw, 36vw")}
                {...develop}
                alt={t(p.story.photo.alt)}
                loading="lazy"
                decoding="async"
              />
              <figcaption>{t(p.story.photo.caption)}</figcaption>
            </figure>
            <h2>{t(p.story.heading)}</h2>
            {p.story.paragraphs.map((text) => (
              <p key={text} className="lead-copy">
                {t(text)}
              </p>
            ))}
          </section>
        )}

        <section className="discover-highlights" aria-labelledby="highlights-title">
          <h2 id="highlights-title">{t(p.highlights.heading)}</h2>
          <div className="highlight-grid kp-await" ref={highlights}>
            {p.highlights.items.map((h, i) => (
              <article key={h.title} className={"highlight-card" + (h.image ? " has-image" : "")} style={{ "--i": i } as CSSProperties}>
                {h.image && (
                  <span className="highlight-image">
                    <img {...responsive(h.image, "(max-width: 760px) 100vw, 25vw")} {...develop} alt="" loading="lazy" decoding="async" />
                  </span>
                )}
                <h3>{t(h.title)}</h3>
                <p>{t(h.text)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="discover-tips" aria-labelledby="tips-title">
          <h2 id="tips-title">{t("Gitmeden bilin.")}</h2>
          <div className="discover-tip-grid">
            {p.tips.map((tip) => {
              const Icon = TIP_ICONS[tip.icon];
              return (
                <article key={tip.title} className="discover-tip">
                  <h3>
                    <Icon size={17} /> {t(tip.title)}
                  </h3>
                  <p>{t(tip.text)}</p>
                </article>
              );
            })}
          </div>
        </section>

        {articles.length > 0 && (
          <section className="discover-articles" aria-labelledby="articles-title">
            <h2 id="articles-title">{t("Yola çıkmadan okuyun.")}</h2>
            <div className="article-grid">
              {articles.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
          </section>
        )}

        {tour && (
          <section className="discover-cta" aria-labelledby="cta-title">
            <div>
              <h2 id="cta-title">{t(p.cta.heading)}</h2>
              <p className="lead-copy">{t(p.cta.text)}</p>
              <Link className="btn" to={"/turlar/" + tour.id}>
                {t("Turu incele")} <ArrowRight size={17} />
              </Link>
            </div>
            <div className="discover-cta-card">
              <TourCard tour={tour} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
