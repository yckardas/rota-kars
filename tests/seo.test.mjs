import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app.mjs";
import { openStore } from "../server/store.mjs";
import {
  pageMeta,
  renderHtml,
  robotsTxt,
  sitemapXml,
  seoHtmlHandler,
} from "../server/seo.mjs";
import { tours } from "../server/catalog.mjs";

const BASE = "https://rotakarsturizm.com";
const TEMPLATE =
  '<!doctype html><html lang="tr"><head><meta name="description" content="eski"><title>Eski</title></head><body><div id="root"></div></body></html>';
const jsonLd = (html) =>
  JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);

test("tour pages get their own title, canonical and TouristTrip offer", () => {
  const m = pageMeta("/turlar/ani-cildir", BASE);
  assert.equal(m.status, 200);
  assert.equal(m.index, true);
  assert.match(m.title, /Ani, Çıldır ve Kars/);
  assert.ok(m.description.length <= 158);
  const html = renderHtml(TEMPLATE, m, BASE);
  assert.equal((html.match(/<title>/g) || []).length, 1);
  assert.ok(!html.includes("Eski") && !html.includes('content="eski"'));
  assert.match(html, /<link rel="canonical" href="https:\/\/rotakarsturizm\.com\/turlar\/ani-cildir">/);
  assert.match(html, /og:image" content="https:\/\/rotakarsturizm\.com\/images\//);
  const graph = jsonLd(html)["@graph"];
  const trip = graph.find((g) => g["@type"] === "TouristTrip");
  assert.equal(trip.offers.priceCurrency, "TRY");
  assert.equal(trip.offers.price, "1000.00");
  assert.equal(trip.provider["@id"], BASE + "/#agency");
  assert.ok(graph.some((g) => g["@type"] === "TravelAgency"));
  assert.ok(graph.some((g) => g["@type"] === "BreadcrumbList"));
});

test("private pages are noindex without canonical, unknown pages are 404", () => {
  for (const p of ["/rezervasyon/ani-cildir", "/uyelik", "/hesabim", "/yonetim", "/bilet/abc"]) {
    const m = pageMeta(p, BASE);
    assert.equal(m.status, 200, p);
    assert.equal(m.index, false, p);
    assert.ok(!renderHtml(TEMPLATE, m, BASE).includes("canonical"), p);
  }
  assert.equal(pageMeta("/turlar/olmayan-tur", BASE).status, 404);
  assert.equal(pageMeta("/rastgele", BASE).status, 404);
  assert.equal(pageMeta("/turlar/", BASE).status, 200);
});

test("JSON-LD cannot be broken out of with a script tag", () => {
  const m = pageMeta("/", BASE);
  m.graph.push({ name: "</script><script>alert(1)</script>" });
  const html = renderHtml(TEMPLATE, m, BASE);
  assert.equal((html.match(/<\/script>/g) || []).length, 1);
});

test("robots blocks private areas and demo mode, sitemap lists every tour", () => {
  const robots = robotsTxt(BASE, {});
  assert.match(robots, /Disallow: \/yonetim/);
  assert.match(robots, /Disallow: \/api\//);
  assert.match(robots, /Sitemap: https:\/\/rotakarsturizm\.com\/sitemap\.xml/);
  assert.equal(robotsTxt(BASE, { DEMO_MODE: "1" }), "User-agent: *\nDisallow: /\n");
  const xml = sitemapXml(BASE);
  for (const t of tours) assert.ok(xml.includes(`${BASE}/turlar/${t.id}</loc>`), t.id);
  assert.ok(!xml.includes("/yonetim") && !xml.includes("/rezervasyon/"));
  assert.match(xml, /<image:loc>/);
});

test("HTTP: robots, sitemap, meta API and HTML statuses", async (t) => {
  const store = await openStore(":memory:");
  const env = { SITE_URL: BASE };
  const app = createApp(store, {
    env,
    reviewsService: { get: async () => ({ status: "not_configured", reviews: [] }) },
  });
  app.use(seoHtmlHandler(env, async () => TEMPLATE));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await store.db.close();
  });
  const robots = await fetch(base + "/robots.txt");
  assert.equal(robots.status, 200);
  assert.match(robots.headers.get("content-type"), /text\/plain/);
  const sitemap = await fetch(base + "/sitemap.xml");
  assert.match(sitemap.headers.get("content-type"), /xml/);
  assert.match(await sitemap.text(), /<urlset/);
  const meta = await (await fetch(base + "/api/meta?path=/turlar/batum")).json();
  assert.match(meta.title, /Batum/);
  assert.equal(meta.canonical, BASE + "/turlar/batum");
  const html = await fetch(base + "/turlar/sarikamis", { headers: { Accept: "text/html" } });
  assert.equal(html.status, 200);
  assert.match(await html.text(), /<title>Sarıkamış/);
  const missing = await fetch(base + "/yok-boyle-sayfa", { headers: { Accept: "text/html" } });
  assert.equal(missing.status, 404);
  assert.match(await missing.text(), /noindex/);
});

test("HTML handler leaves assets and API paths alone", async () => {
  const handler = seoHtmlHandler({}, async () => TEMPLATE);
  for (const path of ["/src/main.tsx", "/images/ani.jpg", "/api/catalog", "/@vite/client"]) {
    let passed = false;
    await handler(
      { method: "GET", path, accepts: () => true, headers: {}, protocol: "http" },
      {},
      () => (passed = true),
    );
    assert.ok(passed, path);
  }
});

test("tour titles do not repeat 'tur' or the duration", async () => {
  const { tourTitle } = await import("../server/seo.mjs");
  for (const t of tours) {
    const title = tourTitle(t);
    assert.ok(!/turu turu|tur turu/i.test(title), title);
    assert.ok(title.split(t.duration).length <= 2, title);
  }
  assert.match(tourTitle(tours.find((t) => t.id === "ani-cildir")), /^Ani, Çıldır ve Kars turu · Günübirlik, ₺1\.000/);
});

test("very long paths are rejected quickly instead of stalling the server", async () => {
  const handler = seoHtmlHandler({}, async () => TEMPLATE);
  let status = 0;
  const started = Date.now();
  await handler(
    { method: "GET", path: "/" + "/".repeat(20000) + "x", originalUrl: "/", accepts: () => true, headers: { host: "x" }, protocol: "http" },
    { status: (s) => ((status = s), { type: () => ({ send: () => {} }) }) },
    () => {},
  );
  assert.equal(status, 414);
  assert.ok(Date.now() - started < 50);
  const t0 = Date.now();
  pageMeta("/" + "/".repeat(20000) + "x", BASE);
  assert.ok(Date.now() - t0 < 50, "pageMeta is linear");
});

test("catalog data is inlined into the HTML safely and matches /api/catalog", async (t) => {
  const { inlineJson } = await import("../server/seo.mjs");
  const evil = inlineJson({ x: "</script><script>alert(1)</script> &" });
  assert.ok(!evil.includes("<") && !evil.includes(">") && !evil.includes("&") && !evil.includes(" "));
  assert.deepEqual(JSON.parse(evil), { x: "</script><script>alert(1)</script> &" });

  const store = await openStore(":memory:");
  const env = { SITE_URL: BASE };
  const app = createApp(store, {
    env,
    reviewsService: { get: async () => ({ status: "not_configured", reviews: [] }) },
  });
  app.use(seoHtmlHandler(env, async () => TEMPLATE, app.locals.catalog));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await store.db.close();
  });
  const html = await (await fetch(base + "/", { headers: { Accept: "text/html" } })).text();
  const inline = JSON.parse(html.match(/<script id="catalog-data" type="application\/json">(.*?)<\/script>/)[1]);
  const api = await (await fetch(base + "/api/catalog")).json();
  assert.deepEqual(inline, api);
  assert.ok(inline.tours.length > 0);
});

test("production links never trust the Host header", async () => {
  const { siteBase } = await import("../server/seo.mjs");
  const evil = { protocol: "https", headers: { host: "evil.example" } };
  assert.equal(siteBase({ NODE_ENV: "production" }, evil), "https://rotakarsturizm.com");
  assert.equal(
    siteBase({ NODE_ENV: "production", PUBLIC_BASE_URL: "https://rotakars.up.railway.app/" }, evil),
    "https://rotakars.up.railway.app",
  );
  assert.equal(siteBase({ NODE_ENV: "production", PUBLIC_BASE_URL: "javascript:alert(1)" }, evil), "https://rotakarsturizm.com");
  assert.equal(siteBase({}, { protocol: "http", headers: { host: "localhost:5173" } }), "http://localhost:5173");
});
