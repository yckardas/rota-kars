// Rehber yazıları: panelden yazılır; taslak sitede görünmez, yayına alınınca liste,
// yazı sayfası (SEO başlığı ve BlogPosting), site haritası ve tur sayfası ilişkisi açılır.
import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app.mjs";
import { openStore } from "../server/store.mjs";
import { seoHtmlHandler } from "../server/seo.mjs";
import { slugify } from "../server/articles.mjs";

const TEMPLATE = "<!doctype html><html><head><title>x</title></head><body></body></html>";
async function fixture(t) {
  const store = await openStore(":memory:", { seed: false });
  const env = { ADMIN_PASSWORD: "ilk-kurulum-parolasi", SITE_URL: "https://rotakarsturizm.com" };
  const app = createApp(store, { env, reviewsService: { get: async () => ({ status: "not_configured", reviews: [] }) } });
  app.use(seoHtmlHandler(env, async () => TEMPLATE, app.locals.catalog));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    for (const a of await store.articles.adminList()) if (a.status === "published") await store.articles.save({ ...a, status: "draft" });
    await new Promise((r) => server.close(r));
    await store.db.close();
  });
  const root = `http://127.0.0.1:${server.address().port}`;
  let cookie = "";
  const call = async (path, body, method) => {
    const r = await fetch(root + "/api" + path, {
      method: method || (body ? "POST" : "GET"),
      body: body ? JSON.stringify(body) : undefined,
      headers: { "Content-Type": "application/json", "X-Rota-Client": "web", ...(cookie ? { Cookie: cookie } : {}) },
    });
    if (path === "/admin/login") cookie = r.headers.get("set-cookie").split(";")[0];
    return { status: r.status, json: r.status === 204 ? null : await r.json().catch(() => null) };
  };
  const html = (path) => fetch(root + path, { headers: { Accept: "text/html" } });
  await call("/admin/login", { password: "ilk-kurulum-parolasi" });
  return { store, call, html, root };
}

test("Turkish titles become clean addresses", () => {
  assert.equal(slugify("Çıldır Gölü'nde atlı kızak: buzun üstünde"), "cildir-golunde-atli-kizak-buzun-ustunde");
  assert.equal(slugify("  Şile & Ağrı  "), "sile-agri");
});

test("the first three articles are published once; drafts stay hidden until published", async (t) => {
  const { store, call, html, root } = await fixture(t);
  const listed = (await call("/articles")).json;
  assert.equal(listed.length, 3, "acentenin isteğiyle ilk üç yazı yayında");
  assert.equal((await html("/rehber/cildir-golunde-atli-kizak")).status, 200);
  assert.equal((await call("/articles?tur=sarikamis")).json.length, 2);
  assert.equal((await call("/articles?kategori=rehber")).json.length, 1);

  // Panelde düzenlenmiş taslağa tek seferlik yayın dokunmaz.
  const { createArticles } = await import("../server/articles.mjs");
  const { articleSeed } = await import("../server/articles-seed.mjs");
  const kizak = (await call("/admin/articles")).json.find((a) => a.slug === "cildir-golunde-atli-kizak");
  await call("/admin/articles", { ...kizak, status: "draft", summary: kizak.summary + " Düzenlendi." });
  await store.db.remove("integration_settings", { _id: "articles_publish_2026_11" });
  await createArticles(store.db, { clock: () => Date.now() + 1000, seed: articleSeed });
  assert.equal((await call("/articles/cildir-golunde-atli-kizak")).status, 404, "düzenlenen taslak taslak kalır");
  assert.equal((await html("/rehber/cildir-golunde-atli-kizak")).status, 404, "taslak sayfa dizine girmez");
  assert.doesNotMatch(await (await fetch(root + "/sitemap.xml")).text(), /cildir-golunde-atli-kizak/);
  assert.equal((await html("/rehber")).status, 200);

  const published = await call("/admin/articles", { ...kizak, status: "published" });
  assert.equal(published.status, 200, JSON.stringify(published.json));
  assert.ok(published.json.publishedAt);
  assert.equal((await call("/articles?tur=ani-cildir")).json.length, 2);
  const full = (await call("/articles/cildir-golunde-atli-kizak")).json;
  assert.match(full.body, /## Ne zaman gidilir\?/);

  const page = await html("/rehber/cildir-golunde-atli-kizak");
  assert.equal(page.status, 200);
  const text = await page.text();
  assert.match(text, /<title>Çıldır Gölü&#39;nde atlı kızak|<title>Çıldır Gölü'nde atlı kızak/);
  assert.match(text, /"@type":"BlogPosting"/);
  const sitemap = await (await fetch(root + "/sitemap.xml")).text();
  assert.match(sitemap, /\/rehber\/cildir-golunde-atli-kizak/);
  assert.match(sitemap, /\/rehber<\/loc>/);

  // Taslağa çekilince kaybolur; ilk yayın tarihi korunur.
  const back = await call("/admin/articles", { ...kizak, status: "draft" });
  assert.equal(back.json.publishedAt, published.json.publishedAt);
  assert.equal((await html("/rehber/cildir-golunde-atli-kizak")).status, 404);
});

test("panel validates articles and keeps addresses unique", async (t) => {
  const { call } = await fixture(t);
  const base = {
    title: "Kars kalesinden gün batımı",
    summary: "Kars Kalesi'nden şehre ve Kars Çayı'na bakan bir akşam yürüyüşü için kısa notlar.",
    category: "kultur",
    cover: "/images/kars.webp",
    body: "Kars Kalesi'ne akşamüstü çıkın.\n\n## Yol\n\n- Merkezden yürüyerek\n- Taş köprüden geçerek",
    tourIds: ["ani-cildir"],
    status: "published",
  };
  const created = await call("/admin/articles", base);
  assert.equal(created.status, 200, JSON.stringify(created.json));
  assert.equal(created.json.slug, "kars-kalesinden-gun-batimi");
  assert.equal((await call("/admin/articles", base)).status, 409, "aynı adres ikinci kez kullanılamaz");
  for (const bad of [
    { cover: "https://evil.example/x.jpg" },
    { slug: "Büyük Harf" },
    { category: "reklam" },
    { tourIds: ["yok"] },
    { body: "kısa" },
  ])
    assert.equal((await call("/admin/articles", { ...base, title: "Başka bir yazı başlığı", ...bad })).status, 400, JSON.stringify(bad));
  assert.equal((await call("/admin/articles/" + created.json.id, null, "DELETE")).status, 204);
  assert.equal((await call("/articles/kars-kalesinden-gun-batimi")).status, 404);
});
