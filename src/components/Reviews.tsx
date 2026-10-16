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
          <div className="google-overview">
            <div className="google-summary">
              <GoogleMark />
              <strong>
                {data.rating.toLocaleString("tr-TR", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}
              </strong>
              <span className="google-summary-meta">
                <Stars rating={Math.round(data.rating)} size={18} />
                <span>
                  {data.total} Google değerlendirmesi
                  {tourId ? " · Acente genel puanı" : ""}
                </span>
              </span>
              <a
                className="btn btn-small"
                href={url}
                target="_blank"
                rel="noreferrer"
              >
                Yorum yazın <ExternalLink size={14} />
              </a>
            </div>
            {!tourId && (
              <iframe
                className="google-map"
                title="Rota Kars Turizm Google Haritalar konumu"
                src="https://www.google.com/maps?cid=1539703208462618989&hl=tr&output=embed"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            )}
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
                        {r.relativeDate ||
                          new Date(r.date).toLocaleDateString("tr-TR", {
                            month: "long",
                            year: "numeric",
                          })}
                      </small>
                    </div>
                    <Quote className="quote-icon" size={25} />
                  </div>
                  <Stars rating={r.rating} />
                  <ReviewText text={r.text} />
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
function ReviewText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return <p>Bu misafir yalnızca puan bırakmış.</p>;
  const long = text.length > 260;
  return (
    <>
      <p className={long && !open ? "review-text clamped" : "review-text"}>
        {text}
      </p>
      {long && (
        <button className="review-more" onClick={() => setOpen(!open)}>
          {open ? "Daha az göster" : "Devamını oku"}
        </button>
      )}
    </>
  );
}
export function GoogleMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-label="Google">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
export function Stars({
  rating,
  size = 14,
}: {
  rating: number;
  size?: number;
}) {
  return (
    <span className="stars" aria-label={`${rating} / 5 yıldız`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={size}
          fill={i < rating ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}
