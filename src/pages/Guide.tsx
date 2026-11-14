// Rehber (/rehber): Kars tanıtımı, aktiviteler ve gezi notları. Yazılar panelden
// yönetilir; yalnız yayındakiler gelir. Yazı sayfasının altında ilgili turlar durur.
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import { api } from "../lib/api";
import { Link, localeOf, useLang } from "../lib/i18n";
import { Markdown } from "../lib/markdown";
import { responsive } from "../lib/images";
import { TourCard } from "../components/TourCard";
import { ArticleCard } from "../components/ArticleCard";
import { ARTICLE_CATEGORIES, type Article, type Catalog } from "../lib/types";

const dateOf = (ms: number | null) =>
  ms ? new Date(ms).toLocaleDateString(localeOf(), { day: "numeric", month: "long", year: "numeric" }) : "";

export function Guide() {
  const { t, lang } = useLang();
  const [items, setItems] = useState<Article[] | null>(null),
    [category, setCategory] = useState<"" | Article["category"]>(""),
    [error, setError] = useState("");
  useEffect(() => {
    api<Article[]>("/articles")
      .then(setItems)
      .catch((e) => setError(e.message));
  }, []);
  const shown = (items || []).filter((a) => !category || a.category === category);
  const used = new Set((items || []).map((a) => a.category));
  return (
    <section className="container guide-page" aria-labelledby="guide-title">
      <h1 id="guide-title">{t("Kars’ı yakından tanıyın.")}</h1>
      <p className="muted guide-lead">
        {t("Buzun üstünde atlı kızaktan Sarıkamış’ın ormanlarına, Ani’nin taşlarından kış hazırlığına: ekibimizden gezi notları.")}
      </p>
      {lang === "en" && <p className="info-note">{t("Rehber yazılarımız şimdilik yalnız Türkçe.")}</p>}
      {used.size > 1 && (
        <div className="status-filters guide-filters" role="group" aria-label={t("Konu")}>
          <button type="button" className={"chip" + (!category ? " active" : "")} aria-pressed={!category} onClick={() => setCategory("")}>
            {t("Tümü")}
          </button>
          {(Object.keys(ARTICLE_CATEGORIES) as Article["category"][])
            .filter((c) => used.has(c))
            .map((c) => (
              <button key={c} type="button" className={"chip" + (category === c ? " active" : "")} aria-pressed={category === c} onClick={() => setCategory(c)}>
                {t(ARTICLE_CATEGORIES[c])}
              </button>
            ))}
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {t(error)}
        </p>
      )}
      {items && !shown.length && (
        <div className="empty-state guide-empty">
          <p>{t("Yeni yazılar yolda. Bu arada turlarımıza göz atabilirsiniz.")}</p>
          <Link className="btn" to="/turlar">
            {t("Turları gör")} <ArrowRight size={16} />
          </Link>
        </div>
      )}
      <div className="article-grid">
        {shown.map((a) => (
          <ArticleCard key={a.id} article={a} />
        ))}
      </div>
    </section>
  );
}

export function ArticlePage({ catalog }: { catalog: Catalog }) {
  const { slug } = useParams(),
    { t } = useLang();
  const [article, setArticle] = useState<Article | null>(null),
    [missing, setMissing] = useState(false);
  useEffect(() => {
    setArticle(null);
    setMissing(false);
    api<Article>("/articles/" + slug)
      .then(setArticle)
      .catch(() => setMissing(true));
  }, [slug]);
  if (missing)
    return (
      <div className="container empty-state">
        <h1>{t("Bu yazı bulunamadı.")}</h1>
        <Link className="btn" to="/rehber">
          {t("Rehbere dön")}
        </Link>
      </div>
    );
  if (!article) return <div className="container guide-page" aria-busy="true" />;
  const related = catalog.tours.filter((x) => article.tourIds.includes(x.id));
  return (
    <>
      <div className="container breadcrumb">
        <Link to="/">{t("Ana sayfa")}</Link>
        <ChevronRight size={12} />
        <Link to="/rehber">{t("Rehber")}</Link>
        <ChevronRight size={12} />
        <span>{article.title}</span>
      </div>
      <article className="container article-page">
        <header className="article-head">
          <small>
            {t(ARTICLE_CATEGORIES[article.category])} · {dateOf(article.publishedAt)}
          </small>
          <h1>{article.title}</h1>
          <p className="article-summary">{article.summary}</p>
        </header>
        <figure className="article-cover">
          <img {...responsive(article.cover, "(max-width: 900px) 100vw, 860px")} alt="" fetchPriority="high" />
        </figure>
        <div className="article-body">
          <Markdown source={article.body || ""} />
        </div>
        <Link className="text-link article-back" to="/rehber">
          <ArrowLeft size={15} /> {t("Tüm rehber yazıları")}
        </Link>
      </article>
      {related.length > 0 && (
        <section className="container section article-tours" aria-labelledby="article-tours-title">
          <h2 id="article-tours-title">{t("Bu yazıdaki rotalar")}</h2>
          <div className="tour-grid">
            {related.map((tour) => (
              <TourCard key={tour.id} tour={tour} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
