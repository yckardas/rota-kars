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
