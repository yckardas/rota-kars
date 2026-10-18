import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeInstagramUrl } from "../server/instagram.mjs";
import { openStore } from "../server/store.mjs";
test("Reels URLs drop tracking and use the trusted canonical host", () => {
  assert.equal(
    normalizeInstagramUrl(
      "https://www.instagram.com/reel/DJ9cqtzI9EE/?mdxt=test",
    ),
    "https://www.instagram.com/reel/DJ9cqtzI9EE/",
  );
  assert.equal(
    normalizeInstagramUrl("https://instagram.com/p/Cy0fU7io4jF"),
    "https://www.instagram.com/p/Cy0fU7io4jF/",
  );
});
test("rejects executable URLs, arbitrary hosts and non-post URLs", () => {
  for (const u of [
    "javascript:alert(1)",
    "https://instagram.com.evil.test/reel/ABCDE/",
    "https://user:password@instagram.com/reel/ABCDE/",
    "http://instagram.com/reel/ABCDE/",
    "https://instagram.com/rotakarstur/",
    "https://www.instagram.com:999/reel/ABCDE/",
    "https://www.instagram.com/reel/ABCDE/embed/",
  ])
    assert.equal(normalizeInstagramUrl(u), null, u);
});
test("user-selected five reels are seeded and can be unpublished", async () => {
  const s = await openStore(":memory:");
  try {
    assert.equal((await s.instagramPosts()).length, 5);
    assert.equal(
      (await s.instagramPosts())[0].permalink,
      "https://www.instagram.com/reel/DJ9cqtzI9EE/",
    );
    const p = (await s.instagramPosts())[0];
    await s.upsertInstagramPost({
      ...p,
      active: false,
    });
    assert.equal((await s.instagramPosts()).length, 4);
    assert.equal((await s.instagramPosts(true)).length, 5);
  } finally {
    await s.db.close();
  }
});
test("duplicate posts are rejected and sort order is stable", async () => {
  const s = await openStore(":memory:", {
    seed: false,
  });
  try {
    const p = {
      title: "Test paylaşımı",
      permalink: "https://www.instagram.com/reel/ABCDE1/",
      cover: "/images/ani.jpg",
      position: 2,
      active: true,
    };
    await s.upsertInstagramPost(p);
    await assert.rejects(
      async () => await s.upsertInstagramPost(p),
      (e) => e.status === 409,
    );
    await s.upsertInstagramPost({
      ...p,
      permalink: "https://www.instagram.com/reel/ABCDE2/",
      position: 0,
    });
    assert.equal((await s.instagramPosts())[0].position, 0);
  } finally {
    await s.db.close();
  }
});

test("Instagram API feed returns only videos with playable files and refreshes the token once a day", async () => {
  const { createInstagramFeed } = await import("../server/instagram.mjs");
  let now = Date.parse("2026-10-18T10:00:00Z");
  const saved = new Map();
  const settings = {
    get: async (id) => saved.get(id) || null,
    set: async (id, body) => saved.set(id, body),
  };
  const calls = [];
  const fetcher = async (url) => {
    calls.push(url.pathname);
    if (url.pathname === "/refresh_access_token")
      return { ok: true, json: async () => ({ access_token: "fresh", expires_in: 5184000 }) };
    assert.equal(url.searchParams.get("access_token"), "fresh");
    return {
      ok: true,
      json: async () => ({
        data: [
          { id: "1", media_type: "VIDEO", media_url: "https://cdn.example/1.mp4", thumbnail_url: "https://cdn.example/1.jpg", permalink: "https://www.instagram.com/reel/ABCDE12345/", caption: "Ani'de kış sabahı #kars #ani\nikinci satır" },
          { id: "2", media_type: "IMAGE", media_url: "https://cdn.example/2.jpg", permalink: "https://www.instagram.com/p/FGHIJ12345/" },
          { id: "3", media_type: "VIDEO", media_url: null, permalink: "https://www.instagram.com/reel/KLMNO12345/" },
        ],
      }),
    };
  };
  const feed = createInstagramFeed({
    env: { INSTAGRAM_ACCESS_TOKEN: "initial" },
    fetcher,
    clock: () => now,
    settings,
  });
  const posts = await feed.posts();
  assert.equal(posts.length, 1);
  assert.equal(posts[0].videoSrc, "https://cdn.example/1.mp4");
  assert.equal(posts[0].title, "Ani'de kış sabahı");
  assert.equal(posts[0].permalink, "https://www.instagram.com/reel/ABCDE12345/");
  assert.equal(saved.get("instagram_token").token, "fresh");
  await feed.posts();
  assert.equal(calls.filter((p) => p === "/me/media").length, 1, "cached");
  now += 31 * 60 * 1000;
  await feed.posts();
  assert.equal(calls.filter((p) => p === "/refresh_access_token").length, 1, "refresh once a day");
});

test("without a token, or when Instagram fails, the API serves admin-entered posts", async (t) => {
  const { once } = await import("node:events");
  const { createApp } = await import("../server/app.mjs");
  const { openStore } = await import("../server/store.mjs");
  const store = await openStore(":memory:");
  const app = createApp(store, {
    env: {},
    reviewsService: { get: async () => ({ status: "not_configured", reviews: [] }) },
    instagramFeed: { posts: async () => null },
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await store.db.close();
  });
  const r = await (await fetch(`http://127.0.0.1:${server.address().port}/api/instagram`)).json();
  assert.equal(r.source, "manual");
  assert.ok(r.posts.length > 0);
});
