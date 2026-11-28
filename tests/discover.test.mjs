// Keşif sayfası /kesfet/ani: sunucu kendi başlığı, açıklaması, TouristAttraction ve
// breadcrumb yapılandırılmış verisiyle döner; site haritasında ve İngilizce sürümde yer alır.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pageMeta, sitemapXml } from "../server/seo.mjs";

const BASE = "https://rotakarsturizm.com";

test("Ani discovery page has its own SEO, structured data and sitemap entry", () => {
  const m = pageMeta("/kesfet/ani", BASE);
  assert.equal(m.status, 200);
  assert.equal(m.index, true);
  assert.match(m.title, /^Ani Harabeleri: tarihi, yürüyüş rotası/);
  assert.equal(m.image, "/images/tours/ani.webp");
  assert.equal(m.lcp, "/images/tours/ani.webp");
  const place = m.graph.find((g) => g["@type"] === "TouristAttraction");
  assert.equal(place.name, "Ani Arkeolojik Alanı");
  assert.ok(m.graph.some((g) => g["@type"] === "BreadcrumbList"));
  const en = pageMeta("/en/kesfet/ani", BASE);
  assert.equal(en.status, 200);
  assert.equal(en.index, true, "çevrilmiş sayfa İngilizce dizine girer");
  assert.match(en.title, /^Ani ruins/);
  assert.equal(pageMeta("/kesfet/yok", BASE).status, 404);
  const sitemap = sitemapXml(BASE);
  assert.match(sitemap, /<loc>https:\/\/rotakarsturizm\.com\/kesfet\/ani<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/rotakarsturizm\.com\/en\/kesfet\/ani<\/loc>/);
});

test("Çıldır and Sarıkamış discovery pages: own SEO, place data, English and sitemap", () => {
  for (const [path, name, title, en] of [
    ["/kesfet/cildir", "Çıldır Gölü", /^Çıldır Gölü: atlı kızak/, /^Lake Çıldır: horse sleighs/],
    ["/kesfet/sarikamis", "Sarıkamış", /^Sarıkamış: kristal kar/, /^Sarıkamış: crystal snow/],
  ]) {
    const m = pageMeta(path, BASE);
    assert.equal(m.status, 200);
    assert.equal(m.index, true);
    assert.match(m.title, title);
    const place = m.graph.find((g) => g["@type"] === "TouristAttraction");
    assert.equal(place.name, name);
    assert.equal(place.geo["@type"], "GeoCoordinates");
    assert.equal(place.image, BASE + m.image);
    const e = pageMeta("/en" + path, BASE);
    assert.equal(e.index, true);
    assert.match(e.title, en);
    const sitemap = sitemapXml(BASE);
    assert.ok(sitemap.includes(`<loc>${BASE}${path}</loc>`));
    assert.ok(sitemap.includes(`<loc>${BASE}/en${path}</loc>`));
  }
});
