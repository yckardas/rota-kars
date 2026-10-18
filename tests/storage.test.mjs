import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app.mjs";
import { openStore } from "../server/store.mjs";
import { createStorage, sniffMedia, storageConfiguration } from "../server/storage.mjs";

const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100)]);
const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from("ftypisom"), Buffer.alloc(100)]);
const fakeS3 = () => {
  const objects = new Map();
  return {
    objects,
    async send(cmd) {
      const { Key, Body } = cmd.input;
      if (cmd.constructor.name === "PutObjectCommand") objects.set(Key, Body);
      if (cmd.constructor.name === "DeleteObjectCommand") objects.delete(Key);
      return {};
    },
    sign: async (cmd) => `https://bucket.example/${cmd.input.Key}?X-Amz-Signature=test`,
  };
};

test("Railway bucket variables are read; unresolved references are rejected", () => {
  const c = storageConfiguration({
    ENDPOINT: "https://t3.storageapi.dev",
    REGION: "auto",
    ACCESS_KEY_ID: "id",
    SECRET_ACCESS_KEY: "secret",
    BUCKET: "rota-abc123",
  });
  assert.equal(c.configured, true);
  assert.equal(c.bucket, "rota-abc123");
  assert.equal(storageConfiguration({}).configured, false);
  assert.throws(() => storageConfiguration({ BUCKET: "${{buffered-basket.BUCKET}}" }), /çözülmemiş/);
});

test("file type comes from content bytes, not from the name", () => {
  assert.equal(sniffMedia(jpg).type, "image/jpeg");
  assert.equal(sniffMedia(mp4).type, "video/mp4");
  assert.equal(sniffMedia(Buffer.from("<svg onload=alert(1)>")), null);
  assert.equal(sniffMedia(Buffer.from("<!doctype html><script>")), null);
});

test("admin uploads go to the bucket and are served via short-lived signed redirect", async (t) => {
  const store = await openStore(":memory:");
  const s3 = fakeS3();
  const password = "test-admin-only-password";
  const app = createApp(store, {
    env: { ADMIN_PASSWORD: password },
    reviewsService: { get: async () => ({ status: "not_configured", reviews: [] }) },
    storage: createStorage({ db: store.db, client: s3, env: { BUCKET: "b" } }),
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await store.db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const upload = (body, cookie = "") =>
    fetch(base + "/api/admin/uploads", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/octet-stream", "X-Rota-Client": "web", "X-File-Name": encodeURIComponent("ani kapak.jpg"), cookie },
    });
  assert.equal((await upload(jpg)).status, 401, "admin required");
  const login = await fetch(base + "/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ password }),
    headers: { "Content-Type": "application/json", "X-Rota-Client": "web" },
  });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  assert.equal((await upload(Buffer.from("<svg/>"), cookie)).status, 415);
  const ok = await upload(jpg, cookie);
  assert.equal(ok.status, 201);
  const media = await ok.json();
  assert.match(media.url, /^\/media\/[a-f0-9-]{36}\.jpg$/);
  assert.equal(s3.objects.size, 1);
  const redirect = await fetch(base + media.url, { redirect: "manual" });
  assert.equal(redirect.status, 302);
  assert.match(redirect.headers.get("location"), /^https:\/\/bucket\.example\/uploads\/\d{4}\/\d{2}\/.+\.jpg\?X-Amz-Signature=/);
  assert.equal((await fetch(base + media.url.replace(".jpg", ".png"), { redirect: "manual" })).status, 404);
  // Yüklenen görsel Instagram kapağı olarak kabul edilir.
  const post = await fetch(base + "/api/admin/instagram", {
    method: "POST",
    body: JSON.stringify({ title: "Kapak", permalink: "https://www.instagram.com/reel/ABCDE12345/", cover: media.url, position: 9, active: true }),
    headers: { "Content-Type": "application/json", "X-Rota-Client": "web", cookie },
  });
  assert.equal(post.status, 200);
  const del = await fetch(base + "/api/admin/uploads/" + media.id, { method: "DELETE", headers: { "X-Rota-Client": "web", cookie } });
  assert.equal(del.status, 204);
  assert.equal(s3.objects.size, 0);
});

test("without bucket settings uploads explain what is missing", async () => {
  const store = await openStore(":memory:");
  try {
    const storage = createStorage({ db: store.db, env: {} });
    assert.equal(storage.configured, false);
    await assert.rejects(() => storage.upload(jpg), (e) => e.status === 503 && /ENDPOINT/.test(e.message));
  } finally {
    await store.db.close();
  }
});
