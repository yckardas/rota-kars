import { test } from "node:test";
import assert from "node:assert/strict";
import { createReviewsService } from "../server/reviews.mjs";
import {
  parseEnv,
  updateEnv,
  pickLocation,
  explainGoogleError,
} from "../scripts/google-connect.mjs";

const env = {
  GOOGLE_REVIEWS_PROVIDER: "business",
  GOOGLE_CLIENT_ID: "id",
  GOOGLE_CLIENT_SECRET: "secret",
  GOOGLE_REFRESH_TOKEN: "refresh",
  GOOGLE_ACCOUNT_ID: "111",
  GOOGLE_LOCATION_ID: "222",
};
const review = (id, comment, stars = "FIVE") => ({
  reviewId: id,
  reviewer: { displayName: "Misafir " + id },
  comment,
  starRating: stars,
  updateTime: "2026-09-01T10:00:00Z",
});

function fakeGoogle(pages) {
  const calls = [];
  const fetcher = async (url) => {
    calls.push(String(url));
    if (String(url).includes("oauth2"))
      return { ok: true, json: async () => ({ access_token: "at", expires_in: 3600 }) };
    const token = new URL(url).searchParams.get("pageToken") || "0";
    return { ok: true, json: async () => pages[Number(token)] };
  };
  return { fetcher, calls };
}

test("business provider reads every page and spreads reviews to the right tours", async () => {
  const { fetcher, calls } = fakeGoogle([
    {
      averageRating: 4.9,
      totalReviewCount: 4,
      nextPageToken: "1",
      reviews: [
        review("a", "Ani Antik Kenti ve Çıldır Gölü muhteşemdi"),
        review("b", "Van turunda Akdamar Adası çok güzeldi"),
      ],
    },
    {
      averageRating: 4.9,
      totalReviewCount: 4,
      reviews: [
        review("c", "(Translated by Google) Batumi was great\n\n(Original)\nBatum turu harikaydı"),
        review("d", "", "FOUR"),
      ],
    },
  ]);
  const s = createReviewsService(env, fetcher, null);
  const all = await s.get();
  assert.equal(all.status, "connected");
  assert.equal(all.total, 4);
  assert.equal(all.reviews.length, 4);
  assert.ok(calls.some((u) => u.includes("accounts/111/locations/222/reviews")));
  assert.equal(all.reviews.find((r) => r.id === "c").text, "Batum turu harikaydı");

  const ani = await s.get({}, "ani-cildir");
  assert.equal(ani.scope, "tour");
  assert.deepEqual(ani.reviews.map((r) => r.id), ["a"]);
  const van = await s.get({}, "van-gunubirlik");
  assert.deepEqual(van.reviews.map((r) => r.id), ["b"]);
  const batum = await s.get({}, "batum");
  assert.deepEqual(batum.reviews.map((r) => r.id), ["c"]);
  const sarikamis = await s.get({}, "sarikamis");
  assert.equal(sarikamis.scope, "agency");
});

test("API failure (e.g. quota 0 before approval) falls back to snapshot", async () => {
  const s = createReviewsService(env, async () => ({ ok: false, status: 429 }));
  const r = await s.get();
  assert.equal(r.status, "snapshot");
  assert.ok(r.reviews.length > 0);
});

test("connect wizard keeps other .env settings and finds Rota Kars by Maps CID", () => {
  const before = "PORT=5173\nGOOGLE_REFRESH_TOKEN=\n# comment\nADMIN_PASSWORD=x\n";
  const after = updateEnv(before, {
    GOOGLE_REFRESH_TOKEN: "tok",
    GOOGLE_ACCOUNT_ID: "1",
  });
  assert.deepEqual(parseEnv(after), {
    PORT: "5173",
    GOOGLE_REFRESH_TOKEN: "tok",
    ADMIN_PASSWORD: "x",
    GOOGLE_ACCOUNT_ID: "1",
  });
  assert.match(after, /# comment/);
  const locations = [
    { name: "locations/9", title: "Başka İşletme", metadata: { mapsUri: "https://maps.google.com/?cid=1" } },
    { name: "locations/7", title: "Rota Kars Turizm", metadata: { mapsUri: "https://maps.google.com/maps?cid=1539703208462618989" } },
  ];
  assert.equal(pickLocation(locations).location.name, "locations/7");
  assert.equal(pickLocation(locations).reason, "cid");
  assert.equal(pickLocation([{ title: "A" }, { title: "B" }]).location, null);
  assert.match(explainGoogleError(429), /onaylanmadığı/);
});
