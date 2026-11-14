// Rehber yazısı kartı: rehber listesinde ve tur sayfasındaki "ilgili yazılar"da.
import { Link, useLang } from "../lib/i18n";
import { responsive } from "../lib/images";
import { ARTICLE_CATEGORIES, type Article } from "../lib/types";

export function ArticleCard({ article: a }: { article: Article }) {
  const { t } = useLang();
  return (
    <Link className="article-card" to={"/rehber/" + a.slug}>
      <span className="article-card-image">
        <img {...responsive(a.cover, "(max-width: 760px) 100vw, 33vw")} alt="" loading="lazy" decoding="async" />
      </span>
      <span className="article-card-body">
        <small>{t(ARTICLE_CATEGORIES[a.category])}</small>
        <strong>{a.title}</strong>
        <span>{a.summary}</span>
      </span>
    </Link>
  );
}

