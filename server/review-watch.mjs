// Google'a yeni yorum gelince yöneticilere bildirim (uygulama + acente e-postası).
// Google Places API (New) ile düzenli kontrol: GOOGLE_PLACES_API_KEY + GOOGLE_PLACE_ID.
// Places en fazla 5 yorum döndürür ve sıralamayı Google yapar; bu yüzden asıl
// sinyal toplam yorum sayısının artmasıdır. Yeni yorum listede görünüyorsa
// yazarı, puanı ve metni bildirime eklenir.
// Maliyet: her kontrol bir "Place Details (Enterprise + Atmosphere)" çağrısıdır.
// Saatlik kontrol ayda ~744 çağrı eder (Google'ın aylık ücretsiz kotası içinde).
const STATE_ID = "google_reviews";
const DAY = 86400000;

export function reviewWatchInterval(env = process.env) {
  return Math.max(15, Number(env.GOOGLE_REVIEW_POLL_MINUTES) || 60) * 60000;
}

export function createReviewWatch({ db, notifications, env = process.env, fetchImpl = fetch, clock = Date.now }) {
  const configured = Boolean(env.GOOGLE_PLACES_API_KEY && env.GOOGLE_PLACE_ID);
  async function fetchPlace() {
    const res = await fetchImpl(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(env.GOOGLE_PLACE_ID)}?languageCode=tr`,
      {
        headers: {
          "X-Goog-Api-Key": env.GOOGLE_PLACES_API_KEY,
          "X-Goog-FieldMask": "rating,userRatingCount,reviews",
        },
        signal: AbortSignal.timeout(12000),
      },
    );
    if (!res.ok) throw new Error(`Google Places ${res.status}`);
    const p = await res.json();
    return {
      count: Number(p.userRatingCount) || 0,
      rating: p.rating ?? null,
      reviews: (p.reviews || []).map((r) => ({
        id: String(r.name || ""),
        author: r.authorAttribution?.displayName || "Bir Google kullanıcısı",
        rating: Number(r.rating) || 0,
        text: String(r.originalText?.text || r.text?.text || "").replace(/\s+/g, " ").trim(),
        at: Date.parse(r.publishTime) || 0,
      })),
    };
  }
  return {
    configured,
    async check() {
      if (!configured) return { skipped: true };
      const place = await fetchPlace();
      const state = await db.one("app_state", { _id: STATE_ID });
      const seen = new Set(state?.seen || []);
      const save = () =>
        db.upsert("app_state", STATE_ID, {
          count: place.count,
          rating: place.rating,
          seen: [...new Set([...place.reviews.map((r) => r.id), ...seen])].slice(0, 200),
          checked_at: clock(),
        });
      // İlk çalıştırma yalnız mevcut durumu kaydeder; eski yorumlar için bildirim gitmez.
      if (!state) {
        await save();
        return { initialized: true, count: place.count };
      }
      // Google'ın sıralaması değişince eski yorumlar da listeye girebilir:
      // yalnız son 14 günde yazılmış, daha önce görülmemiş yorumlar "yeni" sayılır.
      const fresh = place.reviews
        .filter((r) => r.id && !seen.has(r.id) && r.at > clock() - 14 * DAY)
        .sort((a, b) => b.at - a.at);
      const added = Math.max(0, place.count - (state.count || 0));
      const sent = [];
      for (const r of fresh) {
        const low = r.rating && r.rating <= 3;
        await notifications.notifyAgency({
          subject: `${low ? "Dikkat: düşük puan · " : ""}Yeni Google yorumu ${"★".repeat(r.rating)} · ${r.author}`,
          body: [
            "Google'da yeni yorum",
            `${r.author} · ${r.rating}/5`,
            r.text ? r.text.slice(0, 400) : "(Yorum metni yok, yalnız puan)",
            `Toplam ${place.count} yorum · Ortalama ${place.rating ?? "-"}`,
          ].join("\n"),
          kind: "google_review",
          dedupeKey: "google-review:" + r.id,
        });
        sent.push(r.id);
      }
      // Sayı arttı ama yeni yorum listede görünmüyor (ör. yalnız puan verilmiş).
      if (added > sent.length)
        await notifications.notifyAgency({
          subject: `Google'da ${added - sent.length} yeni değerlendirme`,
          body: [
            "Google'da yeni değerlendirme",
            `Toplam ${place.count} yorum · Ortalama ${place.rating ?? "-"}`,
            "Ayrıntı için Google İşletme Profili'ne bakın.",
          ].join("\n"),
          kind: "google_review",
          dedupeKey: "google-review-count:" + place.count,
        });
      await save();
      return { count: place.count, added, notified: sent.length };
    },
  };
}
