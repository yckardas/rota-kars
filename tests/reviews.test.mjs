import { test } from "node:test";
import assert from "node:assert/strict";
import { matchTourIds, createReviewsService } from "../server/reviews.mjs";
test("tour matching handles Turkish and avoids ani within unrelated words", () => {
  assert.deepEqual(matchTourIds("Ani turu ve ÇILDIR GÖLÜ çok güzeldi"), [
    "ani-cildir",
  ]);
  assert.deepEqual(matchTourIds("Sarıkamış kayak turu"), ["sarikamis"]);
  assert.deepEqual(matchTourIds("Batum ve Van turu"), [
    "batum",
    "van-gunubirlik",
    "van",
    "van-havzasi",
  ]);
  assert.deepEqual(matchTourIds("Ani'de rehberimiz harikaydı"), ["ani-cildir"]);
  assert.deepEqual(matchTourIds("Nemrut Krater Gölü"), ["van-havzasi"]);
  assert.deepEqual(matchTourIds("İshak Paşa Sarayı"), ["van", "van-havzasi"]);
  assert.deepEqual(
    matchTourIds("Şahane bir organizasyon, anılarımız güzel."),
    [],
  );
});
test("unconfigured Google never returns invented reviews or stars", async () => {
  const r = await createReviewsService({}, fetch, null).get();
  assert.equal(r.status, "not_configured");
  assert.deepEqual(r.reviews, []);
  assert.equal(r.rating, null);
});
test("unconfigured Google falls back to the real Maps snapshot", async () => {
  const r = await createReviewsService({}).get();
  assert.equal(r.status, "snapshot");
  assert.equal(r.rating, 4.9);
  assert.equal(r.total, 456);
  assert.ok(r.reviews.length >= 5);
  assert.ok(r.reviews.every((x) => x.rating >= 1 && x.text));
});
test("Places reviews preserve authors/text, all scores and manual override", async () => {
  let calls = 0;
  const payload = {
    rating: 4.2,
    userRatingCount: 25,
    reviews: [
      {
        name: "r1",
        authorAttribution: {
          displayName: "Test Yazar",
          uri: "https://google.com/a",
          photoUri: "https://google.com/photo",
        },
        originalText: { text: "Ani turunda bir sorun yaşadım" },
        rating: 2,
        publishTime: "2026-10-01T12:00:00Z",
        googleMapsUri: "https://google.com/maps/r1",
      },
      {
        name: "r2",
        authorAttribution: { displayName: "Diğer Yazar" },
        originalText: { text: "Genel yorum" },
        rating: 5,
        publishTime: "2026-10-02T12:00:00Z",
      },
    ],
  };
  const svc = createReviewsService(
    {
      GOOGLE_REVIEWS_PROVIDER: "places",
      GOOGLE_PLACES_API_KEY: "fixture",
      GOOGLE_PLACE_ID: "fixture",
    },
    async () => {
      calls++;
      return { ok: true, json: async () => payload };
    },
  );
  let r = await svc.get({}, "ani-cildir");
  assert.equal(r.reviews.length, 1);
  assert.equal(r.reviews[0].rating, 2);
  assert.equal(r.reviews[0].text, payload.reviews[0].originalText.text);
  r = await svc.get({ r1: [], r2: ["ani-cildir"] }, "ani-cildir");
  assert.equal(r.reviews.length, 1);
  assert.equal(r.reviews[0].id, "r2");
  assert.equal(calls, 1);
});
test("Business Profile follows pages and refreshes OAuth without leaking tokens", async () => {
  const urls = [];
  const service = createReviewsService(
    {
      GOOGLE_CLIENT_ID: "test",
      GOOGLE_CLIENT_SECRET: "test",
      GOOGLE_REFRESH_TOKEN: "test",
      GOOGLE_ACCOUNT_ID: "1",
      GOOGLE_LOCATION_ID: "2",
    },
    async (url) => {
      urls.push(String(url));
      if (String(url).includes("oauth2"))
        return {
          ok: true,
          json: async () => ({ access_token: "secret", expires_in: 3600 }),
        };
      if (String(url).includes("pageToken="))
        return {
          ok: true,
          json: async () => ({
            reviews: [
              {
                reviewId: "r2",
                comment: "Sarıkamış",
                starRating: "ONE",
                reviewer: { displayName: "İkinci" },
                updateTime: "2026-10-02",
              },
            ],
            totalReviewCount: 2,
            averageRating: 3,
          }),
        };
      return {
        ok: true,
        json: async () => ({
          reviews: [
            {
              reviewId: "r1",
              comment: "Ani",
              starRating: "FIVE",
              reviewer: { displayName: "İlk" },
              updateTime: "2026-10-01",
            },
          ],
          totalReviewCount: 2,
          averageRating: 3,
          nextPageToken: "next",
        }),
      };
    },
  );
  const result = await service.get();
  assert.equal(urls.length, 3);
  assert.equal(result.reviews.length, 2);
  assert.equal(result.reviews[1].rating, 1);
  assert.ok(!JSON.stringify(result).includes("secret"));
});
test("Google error has safe fallback and no leaked credentials", async () => {
  const s = createReviewsService(
    {
      GOOGLE_REVIEWS_PROVIDER: "places",
      GOOGLE_PLACES_API_KEY: "secret",
      GOOGLE_PLACE_ID: "test",
    },
    async () => ({ ok: false }),
  );
  const r = await s.get();
  assert.equal(r.status, "snapshot");
  assert.ok(!JSON.stringify(r).includes("secret"));
});

test("tour page shows matching reviews, otherwise agency-wide ones", async () => {
  const snapshot = {
    rating: 5,
    total: 2,
    fetchedAt: "2026-10-16",
    reviews: [
      { id: "a", author: "A", rating: 5, date: "2026-01-01", text: "Ani ve Çıldır muhteşemdi" },
      { id: "b", author: "B", rating: 5, date: "2026-01-01", text: "Tiflis turu çok iyiydi" },
    ],
  };
  const s = createReviewsService({}, fetch, snapshot);
  const ani = await s.get({}, "ani-cildir");
  assert.equal(ani.scope, "tour");
  assert.deepEqual(ani.reviews.map((r) => r.id), ["a"]);
  assert.ok(ani.terms.some((t) => t.term === "ani" && t.exact));
  const batum = await s.get({}, "batum");
  assert.equal(batum.scope, "agency");
  assert.equal(batum.reviews.length, 2);
  const manual = await s.get({ b: ["batum"] }, "batum");
  assert.equal(manual.scope, "tour");
  assert.deepEqual(manual.reviews.map((r) => r.id), ["b"]);
});
