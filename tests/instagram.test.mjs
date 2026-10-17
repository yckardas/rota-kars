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
