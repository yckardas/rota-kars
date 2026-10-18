import { readFileSync } from "node:fs";
import { business } from "./catalog.mjs";
// Google Haritalar'daki herkese açık işletme sayfasından alınmış gerçek puan ve
// yorumlar. API bağlantısı kurulana kadar sitede bunlar gösterilir.
export const reviewSnapshot = JSON.parse(
  readFileSync(new URL("./reviews-snapshot.json", import.meta.url), "utf8"),
);
const normalize = (s) =>
  s
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i");
const VAN_TOURS = ["van-gunubirlik", "van", "van-havzasi"];
// Yorum metninde aranan kelimeler. exact: kelimenin tamamı eşleşmeli
// ("ani" → "Ani'de" evet, "anılar" hayır); diğerleri kelime başıyla eşleşir.
export const TOUR_TERMS = [
  { term: "ani", exact: true, tours: ["ani-cildir"] },
  { term: "cildir", tours: ["ani-cildir"] },
  { term: "sarikamis", tours: ["sarikamis"] },
  { term: "kayak", tours: ["sarikamis"] },
  { term: "batum", tours: ["batum"] },
  { term: "gonio", tours: ["batum"] },
  { term: "van", exact: true, tours: VAN_TOURS },
  { term: "akdamar", tours: VAN_TOURS },
  { term: "muradiye", tours: VAN_TOURS },
  { term: "ishak", tours: ["van", "van-havzasi"] },
  { term: "tuzluca", tours: ["van", "van-havzasi"] },
  { term: "dogubayazit", tours: ["van", "van-havzasi"] },
  { term: "nemrut", tours: ["van-havzasi"] },
  { term: "ahlat", tours: ["van-havzasi"] },
  { term: "tatvan", tours: ["van-havzasi"] },
  { term: "bitlis", tours: ["van-havzasi"] },
];
export const tokenize = (text) =>
  normalize(text || "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
const termHits = (word, t) => (t.exact ? word === t.term : word.startsWith(t.term));
export function matchTourIds(text) {
  const words = tokenize(text);
  return [
    ...new Set(
      TOUR_TERMS.filter((t) => words.some((w) => termHits(w, t))).flatMap(
        (t) => t.tours,
      ),
    ),
  ];
}
// Tur sayfasında vurgulanacak kelimeler (istemci aynı kuralla eşleştirir).
export const tourTerms = (tourId) =>
  TOUR_TERMS.filter((t) => t.tours.includes(tourId)).map(({ term, exact }) => ({
    term,
    exact: Boolean(exact),
  }));
function scoped(items, tourId) {
  if (!tourId) return { scope: "all", reviews: items };
  const matched = items.filter((r) => r.tourIds.includes(tourId));
  return matched.length
    ? { scope: "tour", terms: tourTerms(tourId), reviews: matched }
    : { scope: "agency", terms: tourTerms(tourId), reviews: items };
}
// Business Profile, Türkçe olmayan yorumlarda "(Translated by Google) ... (Original) ..."
// biçiminde iki metin döndürür; sitede misafirin özgün yazdığı metin gösterilir.
export function cleanComment(comment = "") {
  const text = String(comment || "");
  const original = text.split(/\(Original\)\s*/i);
  if (original.length > 1) return original.at(-1).trim();
  return text.replace(/\s*\(Translated by Google\)[\s\S]*$/i, "").trim();
}
let lastErrorLog = 0;
const safeUrl = (u) => {
  try {
    const url = new URL(u);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
};
export function createReviewsService(
  env = process.env,
  fetcher = fetch,
  snapshot = reviewSnapshot,
) {
  let cache = null,
    inflight = null,
    accessToken = null,
    tokenExpires = 0;
  const mapsUrl = safeUrl(env.GOOGLE_MAPS_URL) || business.mapsUrl;
  const configured =
    env.GOOGLE_REVIEWS_PROVIDER === "places"
      ? Boolean(env.GOOGLE_PLACES_API_KEY && env.GOOGLE_PLACE_ID)
      : Boolean(
          env.GOOGLE_CLIENT_ID &&
          env.GOOGLE_CLIENT_SECRET &&
          env.GOOGLE_REFRESH_TOKEN &&
          env.GOOGLE_ACCOUNT_ID &&
          env.GOOGLE_LOCATION_ID,
        );
  async function json(url, options) {
    const r = await fetcher(url, {
      ...options,
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) {
      const e = Error(`Google review service unavailable (${r.status})`);
      e.status = r.status;
      throw e;
    }
    return r.json();
  }
  async function token() {
    if (accessToken && Date.now() < tokenExpires) return accessToken;
    const data = await json("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: env.GOOGLE_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    });
    if (!data.access_token) throw Error("Google authorization unavailable");
    accessToken = data.access_token;
    tokenExpires = Date.now() + ((data.expires_in || 3600) - 60) * 1000;
    return accessToken;
  }
  async function load() {
    if (env.GOOGLE_REVIEWS_PROVIDER === "places") {
      const p = await json(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(env.GOOGLE_PLACE_ID)}?languageCode=tr`,
        {
          headers: {
            "X-Goog-Api-Key": env.GOOGLE_PLACES_API_KEY,
            "X-Goog-FieldMask":
              "id,displayName,rating,userRatingCount,reviews,googleMapsUri",
          },
        },
      );
      return {
        rating: p.rating ?? null,
        total: p.userRatingCount ?? 0,
        sort: "Google’ın alaka düzeyine göre seçtiği yorumlar. En fazla 5 yorum.",
        reviews: (p.reviews || []).map((r) => ({
          id: r.name,
          author: r.authorAttribution?.displayName || "Google kullanıcısı",
          authorUrl: safeUrl(r.authorAttribution?.uri),
          avatar: safeUrl(r.authorAttribution?.photoUri),
          text: r.originalText?.text || r.text?.text || "",
          rating: r.rating,
          date: r.publishTime,
          url: safeUrl(r.googleMapsUri) || mapsUrl,
        })),
      };
    }
    const auth = await token();
    let pageToken = "",
      reviews = [],
      meta = {};
    for (let page = 0; page < 100; page++) {
      const query = new URLSearchParams({
        pageSize: "50",
        orderBy: "updateTime desc",
      });
      if (pageToken) query.set("pageToken", pageToken);
      const data = await json(
        `https://mybusiness.googleapis.com/v4/accounts/${encodeURIComponent(env.GOOGLE_ACCOUNT_ID)}/locations/${encodeURIComponent(env.GOOGLE_LOCATION_ID)}/reviews?${query}`,
        { headers: { Authorization: `Bearer ${auth}` } },
      );
      meta = data;
      reviews.push(...(data.reviews || []));
      pageToken = data.nextPageToken || "";
      if (!pageToken) break;
      if (page === 99) throw Error("Review pagination limit reached");
    }
    const ratings = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
    return {
      rating: meta.averageRating ?? null,
      total: meta.totalReviewCount ?? reviews.length,
      sort: "Güncelleme tarihine göre en yeniden eskiye. Tüm puanlar dahil.",
      reviews: reviews.map((r) => ({
        id: r.reviewId,
        author: r.reviewer?.displayName || "Google kullanıcısı",
        avatar: safeUrl(r.reviewer?.profilePhotoUrl),
        authorUrl: null,
        text: cleanComment(r.comment),
        rating: ratings[r.starRating] || 0,
        date: r.updateTime || r.createTime,
        url: mapsUrl,
      })),
    };
  }
  const fromSnapshot = (assignments, tourId) => {
    const items = snapshot.reviews.map((r) => ({
      ...r,
      authorUrl: null,
      url: mapsUrl,
      tourIds: Object.hasOwn(assignments, r.id)
        ? assignments[r.id]
        : matchTourIds(r.text),
    }));
    return {
      status: "snapshot",
      rating: snapshot.rating,
      total: snapshot.total,
      mapsUrl,
      fetchedAt: snapshot.fetchedAt,
      sort: `Google Haritalar'dan ${new Date(snapshot.fetchedAt + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })} tarihinde alınan en alakalı yorumlar.`,
      ...scoped(items, tourId),
    };
  };
  return {
    configured,
    async get(assignments = {}, tourId = null) {
      if (!configured && snapshot) return fromSnapshot(assignments, tourId);
      if (!configured)
        return {
          status: "not_configured",
          reviews: [],
          rating: null,
          total: null,
          mapsUrl,
          sort: null,
        };
      try {
        if (!cache || Date.now() - cache.at > 15 * 60 * 1000) {
          if (!inflight)
            inflight = load()
              .then((data) => {
                cache = { at: Date.now(), ...data };
              })
              .finally(() => (inflight = null));
          await inflight;
        }
        const items = cache.reviews.map((r) => ({
          ...r,
          tourIds: Object.hasOwn(assignments, r.id)
            ? assignments[r.id]
            : matchTourIds(r.text),
        }));
        return {
          status: "connected",
          rating: cache.rating,
          total: cache.total,
          mapsUrl,
          sort: cache.sort,
          ...scoped(items, tourId),
        };
      } catch (e) {
        // Kota 0 (başvuru onaysız), yetki veya ağ sorunu: teşhis için durum kodu yazılır.
        if (Date.now() - lastErrorLog > 10 * 60 * 1000) {
          lastErrorLog = Date.now();
          console.error(
            JSON.stringify({
              level: "warn",
              service: "google-reviews",
              status: e?.status || null,
              message: String(e?.message || "").slice(0, 200),
            }),
          );
        }
        if (snapshot) return fromSnapshot(assignments, tourId);
        return {
          status: "temporarily_unavailable",
          reviews: [],
          rating: null,
          total: null,
          mapsUrl,
          sort: null,
        };
      }
    },
  };
}
