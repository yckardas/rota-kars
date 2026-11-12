import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app.mjs";
import { openStore } from "../server/store.mjs";
import { pageMeta, seoHtmlHandler } from "../server/seo.mjs";
import { legacyTarget } from "../server/legacy-redirects.mjs";
import { tours } from "../server/catalog.mjs";

const BASE = "https://rotakarsturizm.com";

test("old tour URLs map to the matching new tour, others to the tour list", () => {
  assert.equal(legacyTarget("/tur/gunubirlik-batum-turu/"), "/turlar/batum");
  assert.equal(legacyTarget("/tur/gunubirlik-ani-antik-kenti-cildir-golu-ve-kars-sehir-turu"), "/turlar/ani-cildir");
  assert.equal(legacyTarget("/tur/konaklamali-van-turu-tuz-magarasi-ve-ishak-pasa-sarayi-dahil/"), "/turlar/van");
  assert.equal(legacyTarget("/tur/nahcivan-turu/"), "/turlar");
  assert.equal(legacyTarget("/tur/konaklamali-batum-turu/"), "/turlar");
});

test("old pages map to their new counterparts", () => {
  assert.equal(legacyTarget("/galeri/"), "/");
  assert.equal(legacyTarget("/hizmetlerimiz/"), "/hizmetler");
  assert.equal(legacyTarget("/arac-kiralama-hizmeti/"), "/hizmetler");
  assert.equal(legacyTarget("/kisisel-verilerin-korunmasi/"), "/bilgilendirme#kvkk");
  assert.equal(legacyTarget("/tur-iptali/"), "/bilgilendirme#iptal");
  assert.equal(legacyTarget("/sepet/"), "/turlar");
});

test("current site paths are never redirected", () => {
  for (const p of ["/", "/turlar", "/turlar/", "/hakkimizda/", "/iletisim", "/hesabim", "/odeme", "/hizmetler", "/bilgilendirme", "/en/turlar", "/turlar/batum", "/tur", "/tur/"])
    assert.equal(legacyTarget(p), null, p);
  for (const t of tours) assert.equal(legacyTarget(`/turlar/${t.id}`), null, t.id);
  // Prototip anahtarları eşleşme sayılmaz.
  assert.equal(legacyTarget("/tur/constructor"), "/turlar");
  assert.equal(legacyTarget("/constructor"), null);
});

test("every redirect target is a page that exists", () => {
  const targets = [
    "/tur/gunubirlik-batum-turu", "/tur/sarikamis-kayak-turu", "/tur/gunubirlik-van-turu",
    "/tur/van-havzasi-turu", "/tur/konaklamali-van-turu-tuz-magarasi-ve-ishak-pasa-sarayi-dahil",
    "/tur/gunubirlik-ani-antik-kenti-cildir-golu-ve-kars-sehir-turu", "/tur/kapadokya-turu",
    "/hizmetlerimiz", "/arac-kiralama-hizmeti", "/kisiye-ozel-tatil-turu", "/galeri", "/tur-iptali",
    "/kisisel-verilerin-korunmasi", "/gizlilik-politikasi", "/sepet", "/kategori/tur", "/feed",
  ].map(legacyTarget);
  for (const t of targets) assert.equal(pageMeta(t.split("#")[0], BASE).status, 200, t);
});

test("HTTP: old URLs answer 301 with the new location, new pages stay 200", async (t) => {
  const store = await openStore(":memory:");
  const env = { SITE_URL: BASE };
  const app = createApp(store, {
    env,
    reviewsService: { get: async () => ({ status: "not_configured", reviews: [] }) },
  });
  app.use(seoHtmlHandler(env, async () => "<!doctype html><html><head><title>x</title></head><body></body></html>"));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await store.db.close();
  });
  const get = (p, method = "GET") =>
    fetch(base + p, { method, redirect: "manual", headers: { Accept: "text/html" } });
  const old = await get("/tur/gunubirlik-batum-turu/");
  assert.equal(old.status, 301);
  assert.equal(old.headers.get("location"), "/turlar/batum");
  const head = await get("/galeri/", "HEAD");
  assert.equal(head.status, 301);
  assert.equal(head.headers.get("location"), "/");
  const kvkk = await get("/kisisel-verilerin-korunmasi/?utm_source=x");
  assert.equal(kvkk.headers.get("location"), "/bilgilendirme#kvkk");
  assert.equal((await get("/turlar/batum")).status, 200);
  assert.equal((await get("/hakkimizda")).status, 200);
  assert.equal((await get("/yok-boyle-sayfa")).status, 404);
  const post = await fetch(base + "/galeri/", { method: "POST", redirect: "manual" });
  assert.notEqual(post.status, 301);
});
