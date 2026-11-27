// Tur sonrası site içinden gelen ve acentenin onayladığı katılımcı yorumları. Yalnız ad
// ve soyadın baş harfi gösterilir; Google yorumlarından ayrı, tur sayfasında üstte durur.
import { useState } from "react";
import { BadgeCheck, Quote, Star } from "lucide-react";
import { useLang } from "../lib/i18n";
import type { VerifiedReview } from "../lib/types";
export function VerifiedReviews({ items }: { items: VerifiedReview[] }) {
  const { t, locale } = useLang(),
    [visible, setVisible] = useState(3);
  if (!items.length) return null;
  return (
    <div className="verified-reviews">
      <h3>
        <BadgeCheck size={20} aria-hidden="true" />
        {t("Doğrulanmış katılımcı yorumları")}
      </h3>
      <p className="review-order">
        {t(
          "Bu turun bir seferine katıldığı rezervasyon kaydıyla doğrulanan misafirlerimizin, tur sonrasında sitemizden bıraktığı yorumlar.",
        )}
      </p>
      <div className="review-list">
        {items.slice(0, visible).map((r) => (
          <article className="review is-verified" key={r.id}>
            <div className="review-author">
              <span className="review-initial">{r.name[0]}</span>
              <div>
                <strong>{r.name}</strong>
                <small>
                  <span className="verified-badge">
                    <BadgeCheck size={12} aria-hidden="true" />
                    {t("Doğrulanmış katılımcı")}
                  </span>
                  {" · "}
                  {new Date(r.date + "T12:00:00").toLocaleDateString(locale, {
                    month: "long",
                    year: "numeric",
                  })}
                </small>
              </div>
              <Quote className="quote-icon" size={25} />
            </div>
            <span
              className="stars"
              role="img"
              aria-label={t("{n} / 5 yıldız", { n: r.rating })}
            >
              {Array.from({ length: 5 }, (_, i) => (
                <Star
                  key={i}
                  size={14}
                  fill={i < r.rating ? "currentColor" : "none"}
                />
              ))}
            </span>
            <p>{r.text || t("Bu misafir yalnızca puan bırakmış.")}</p>
          </article>
        ))}
      </div>
      {items.length > visible && (
        <button
          className="btn btn-outline review-load-more"
          onClick={() => setVisible((v) => v + 6)}
        >
          {t("Daha fazla yorum göster ({n})", { n: items.length - visible })}
        </button>
      )}
    </div>
  );
}
