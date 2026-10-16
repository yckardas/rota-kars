import { useEffect, useState } from "react";
import { ExternalLink, Quote, Star, MessageSquareText } from "lucide-react";
import { api } from "../lib/api";
import type { ReviewsResponse } from "../lib/types";
export function Reviews({ tourId }: { tourId?: string }) {
  const [data, setData] = useState<ReviewsResponse | null>(null),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setData(null);
    api<ReviewsResponse>("/reviews" + (tourId ? "?tour=" + tourId : ""))
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [tourId]);
  const url =
    data?.mapsUrl || "https://www.google.com/maps?cid=1539703208462618989";
  return (
    <section
      className={"reviews-section " + (tourId ? "tour-reviews" : "")}
      id="yorumlar"
    >
      <div className="container">
        <div className="section-heading">
          <div>
            <span className="section-note">
              Yol arkadaşlarımızın hikâyeleri
            </span>
            <h2>
              {tourId
                ? "Bu rotayı gezenlerin gözünden"
                : "Müşterilerimizin gözünden Rota Kars"}
            </h2>
          </div>
          <a className="text-link" href={url} target="_blank" rel="noreferrer">
            Google’da yorumları okuyun <ExternalLink size={15} />
          </a>
        </div>
        {data?.rating != null && (
          <div className="google-summary">
            <span className="google-word">Google Maps</span>
            <strong>
              {data.rating.toLocaleString("tr-TR", {
                maximumFractionDigits: 1,
              })}
            </strong>
            <Stars rating={Math.round(data.rating)} />
            <span>
              {data.total} işletme değerlendirmesi
              {tourId ? " · Acente genel puanı" : ""}
            </span>
          </div>
        )}
        {!data && !failed ? (
          <p className="quiet">Yorumlar yükleniyor…</p>
        ) : data?.reviews.length ? (
          <>
            <p className="review-order">
              {data.sort}{" "}
              {tourId
                ? "Yalnızca bu rotayla eşleşen yorumlar gösteriliyor."
                : ""}
            </p>
            <div className="review-list">
              {data.reviews.slice(0, tourId ? 6 : 9).map((r) => (
                <article className="review" key={r.id}>
                  <div className="review-author">
                    {r.avatar ? (
                      <img
                        src={r.avatar}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="review-initial">{r.author[0]}</span>
                    )}
                    <div>
                      {r.authorUrl ? (
                        <a href={r.authorUrl} target="_blank" rel="noreferrer">
                          {r.author}
                        </a>
                      ) : (
                        <strong>{r.author}</strong>
                      )}
                      <small>
                        {new Date(r.date).toLocaleDateString("tr-TR", {
                          month: "long",
                          year: "numeric",
                        })}
                      </small>
                    </div>
                    <Quote className="quote-icon" size={25} />
                  </div>
                  <Stars rating={r.rating} />
                  <p>{r.text || "Bu misafir yalnızca puan bırakmış."}</p>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="review-source"
                  >
                    Google Maps’te görüntüle <ExternalLink size={12} />
                  </a>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="review-empty">
            <MessageSquareText size={33} strokeWidth={1.1} />
            <div>
              <h3>
                {tourId
                  ? "Bu rotanın deneyimlerini keşfedin."
                  : "Bir yolculuğun en güzel hatırası, anlatılan hikâyesi."}
              </h3>
              <p>
                {data?.status === "connected"
                  ? "Bu rotayla eşleşen bir yorum henüz bulunmuyor. Diğer deneyimleri Google’da okuyabilirsiniz."
                  : "Misafirlerimizin paylaştığı deneyimlere Google işletme sayfamızdan ulaşabilirsiniz."}
              </p>
            </div>
            <a
              className="btn btn-white"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              Google yorumları <ExternalLink size={15} />
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
export function Stars({ rating }: { rating: number }) {
  return (
    <span className="stars" aria-label={`${rating} / 5 yıldız`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={14} fill={i < rating ? "currentColor" : "none"} />
      ))}
    </span>
  );
}
