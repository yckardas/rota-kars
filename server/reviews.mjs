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
export function matchTourIds(text) {
  const s = normalize(text || "");
  return [
    ...new Set(
      [
        /(^|[^a-z])ani([^a-z]|$)|cildir/.test(s) ? "ani-cildir" : null,
        /sarikamis/.test(s) ? "sarikamis" : null,
        /batum/.test(s) ? "batum" : null,
        /(^|[^a-z])van([^a-z]|$)|ishak pasa|akdamar/.test(s) ? "van" : null,
      ].filter(Boolean),
    ),
  ];
}
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
    if (!r.ok) throw Error("Google review service unavailable");
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
        text: r.comment || "",
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
      reviews: tourId ? items.filter((r) => r.tourIds.includes(tourId)) : items,
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
          reviews: tourId
            ? items.filter((r) => r.tourIds.includes(tourId))
            : items,
        };
      } catch {
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
