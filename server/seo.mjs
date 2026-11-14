// Sunucu tarafı SEO: her sayfa için başlık, açıklama, canonical, Open Graph,
// JSON-LD, robots.txt ve sitemap.xml. SPA olduğu için arama motorları ilk
// HTML'de doğru meta etiketlerini görsün diye şablona enjekte edilir.
import { publishedArticle, publishedArticles } from "./articles.mjs";
import { business, tours, services } from "./catalog.mjs";
import { currentEn } from "./content.mjs";
import { legacyRedirects } from "./legacy-redirects.mjs";

const SITE = "Rota Kars Turizm";
const DEFAULT_DESCRIPTION =
  "Kars merkezli TÜRSAB A grubu seyahat acentesi. Ani, Çıldır, Sarıkamış, Batum ve Van turları; 18+1 VIP midibüste online koltuk seçimi, şoförlü araç kiralama ve transfer.";
const DEFAULT_IMAGE = "/images/ani.webp";

const clip = (s, n = 158) => {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length <= n ? t : t.slice(0, n - 1).replace(/\s+\S*$/, "") + "…";
};
const tl = (kurus) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(kurus / 100);
const attr = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
// JSON-LD </script> ile kırılamasın.
const ld = (data) =>
  `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;

const lower = (s) => s.toLocaleLowerCase("tr-TR");
// "Konaklamalı Van Turu turu" veya "Günübirlik Batum · Günübirlik" gibi tekrarları önler.
export function tourTitle(t) {
  const name = /\btur/i.test(lower(t.name)) ? t.name : `${t.name} turu`;
  const duration = lower(t.name).includes(lower(t.duration)) ? "" : ` · ${t.duration}`;
  // Fiyatı henüz girilmemiş turda (price 0) başlığa tutar yazılmaz.
  return `${name}${duration}${t.price > 0 ? `, ${tl(t.price)}` : ""} | ${SITE}`;
}
export const DEFAULT_SITE_URL = "https://rotakarsturizm.com";
// Bağlantılarda kullanılan site adresi. Üretimde Host başlığına asla güvenilmez
// (e-postadaki parola sıfırlama/bilet bağlantıları saldırgan alan adına
// yönlendirilemez); adres ayarlı değilse resmi alan adı kullanılır.
export function siteBase(env, req) {
  const configured = env.PUBLIC_BASE_URL || env.SITE_URL;
  if (configured && /^https?:\/\/[^/\s]+/.test(configured))
    return configured.replace(/\/+$/, "");
  if (env.NODE_ENV === "production") return DEFAULT_SITE_URL;
  return `${req.protocol}://${req.headers.host}`;
}

const agency = (base) => ({
  "@type": "TravelAgency",
  "@id": base + "/#agency",
  name: business.name,
  url: base + "/",
  logo: base + "/images/logo.png",
  image: base + "/images/rota-bus.webp",
  description: DEFAULT_DESCRIPTION,
  telephone: "+90 474 223 65 44",
  email: business.email,
  foundingDate: String(business.founded),
  address: {
    "@type": "PostalAddress",
    streetAddress: "Yeni Mah. Cumhuriyet Cad. Köşk Apt. No:26 İç Kapı:13",
    addressLocality: "Kars",
    addressRegion: "Kars",
    postalCode: "36100",
    addressCountry: "TR",
  },
  geo: { "@type": "GeoCoordinates", latitude: 40.5969298, longitude: 43.0965837 },
  hasMap: business.mapsUrl,
  areaServed: ["Kars", "Ardahan", "Iğdır", "Van", "Batum"],
  priceRange: "₺₺",
  identifier: {
    "@type": "PropertyValue",
    name: "TÜRSAB belge no",
    value: business.tursabNo,
  },
  contactPoint: [
    {
      "@type": "ContactPoint",
      telephone: "+90 474 223 65 44",
      contactType: "customer service",
      availableLanguage: ["Turkish"],
    },
    {
      "@type": "ContactPoint",
      telephone: "+" + business.whatsapp,
      contactType: "reservations",
      availableLanguage: ["Turkish"],
    },
  ],
  sameAs: [business.instagram, business.facebook, business.mapsUrl],
});

const crumbs = (base, items) => ({
  "@type": "BreadcrumbList",
  itemListElement: [{ name: "Ana sayfa", path: "/" }, ...items].map(
    (c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: base + c.path,
    }),
  ),
});

const tourLd = (base, t) => ({
  "@type": "TouristTrip",
  "@id": `${base}/turlar/${t.id}#trip`,
  name: t.name,
  description: clip(t.summary, 500),
  url: `${base}/turlar/${t.id}`,
  image: [...new Set([t.image, ...(t.gallery || [])])].map((i) => base + i),
  touristType: t.category,
  provider: { "@id": base + "/#agency" },
  itinerary: t.itinerary?.length
    ? {
        "@type": "ItemList",
        itemListElement: t.itinerary.map((s, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: s.title,
          description: s.text,
        })),
      }
    : undefined,
  offers: t.price > 0 ? {
    "@type": "Offer",
    price: (t.price / 100).toFixed(2),
    priceCurrency: "TRY",
    url: t.inquiryOnly ? `${base}/turlar/${t.id}` : `${base}/rezervasyon/${t.id}`,
    availability: t.inquiryOnly
      ? "https://schema.org/PreOrder"
      : "https://schema.org/InStock",
    seller: { "@id": base + "/#agency" },
  } : undefined,
});

const STATIC = {
  "/": {
    title: `${SITE} | Kars turları, Ani ve Çıldır, VIP transfer`,
    description: DEFAULT_DESCRIPTION,
  },
  "/turlar": {
    title: `Kars, Ani, Sarıkamış, Batum ve Van turları | ${SITE}`,
    description:
      "Kars çıkışlı günübirlik ve konaklamalı turlar: Ani Antik Kenti ve Çıldır Gölü, Sarıkamış kayak, Batum, Van ve Van Havzası. Fiyatlar, programlar ve online koltuk seçimi.",
    crumb: "Turlarımız",
  },
  "/hizmetler": {
    title: `Hizmetlerimiz: transfer, VIP ve araç kiralama | ${SITE}`,
    description:
      "Turizm taşımacılığı, VIP transfer, kongre ve toplantı transferleri, express tur ve şoförlü araç kiralama. 4+1'den 46+1'e D2/B2 belgeli araç filosu.",
    crumb: "Hizmetlerimiz",
  },
  "/konaklama": {
    title: `Kars'ta konaklama | ${SITE}`,
    description:
      "Turunuzun öncesinde veya sonrasında Kars'ta konaklamanızı planlayalım. Tarih ve kişi sayınızla talep bırakın, acentemiz size dönsün.",
    crumb: "Konaklama",
  },
  "/hakkimizda": {
    title: `Hakkımızda | ${SITE}`,
    description: `${business.founded}'dan beri Kars'ta hizmet veren, TÜRSAB ${business.tursabNo} belge numaralı A grubu seyahat acentesi Rota Kars Turizm.`,
    crumb: "Hakkımızda",
  },
  "/iletisim": {
    title: `İletişim ve adres | ${SITE}`,
    description: `Rota Kars Turizm ofisi: ${business.address}. Telefon ${business.phone}, WhatsApp ${business.whatsappLabel}.`,
    crumb: "İletişim",
  },
  "/bilgilendirme": {
    title: `Yasal bilgilendirme: KVKK, çerez, iptal ve sözleşme | ${SITE}`,
    description:
      "Aydınlatma metni, çerez politikası, iptal ve iade koşulları, ön bilgilendirme formu ve tur hizmet sözleşmesi.",
    crumb: "Bilgilendirme",
  },
  "/rehber": {
    title: `Kars rehberi: aktiviteler, gezi notları ve öneriler | ${SITE}`,
    description:
      "Çıldır Gölü'nde atlı kızak, Sarıkamış'ta kar motoru, Ani'nin tarihi ve Kars kışına hazırlık: Rota Kars ekibinden gezi rehberleri ve öneriler.",
    crumb: "Rehber",
  },
  "/kesfet/ani": {
    title: `Ani Harabeleri: tarihi, yürüyüş rotası ve gezi ipuçları | ${SITE}`,
    description:
      "Bin bir kilise şehri Ani: Bagratlılardan Selçuklulara bin yıllık hikâye, Aslanlı Kapı'dan Ebu'l Menucehr Camii'ne örnek yürüyüş rotası ve gitmeden bilmeniz gerekenler.",
    crumb: "Ani'yi keşfet",
    image: "/images/tours/ani.webp",
  },
  "/gorsel-kaynaklari": {
    title: `Görsel kaynakları | ${SITE}`,
    description:
      "Sitede kullanılan fotoğrafların yazarları, lisansları ve kaynakları.",
    crumb: "Görsel kaynakları",
  },
};
// Kişisel veya işlem sayfaları: ziyaretçiye açık ama dizine eklenmez.
const PRIVATE = [
  [/^\/rezervasyon\/[^/]+$/, "Rezervasyon"],
  [/^\/rezervasyonum$/, "Rezervasyonum"],
  [/^\/uyelik(\/.*)?$/, "Üyelik"],
  [/^\/hesabim$/, "Hesabım"],
  [/^\/bilet\/[^/]+$/, "Bilet doğrulama"],
  [/^\/odeme\/(kart|sonuc|deneme)\/[a-f0-9]{48}$/, "Ödeme"],
  [/^\/odeme$/, "Online ödeme"],
  [/^\/yonetim$/, "Yönetim"],
];

// İngilizce sürüm (/en): başlık ve açıklamalar; turlar catalog-en.mjs'ten.
const EN_STATIC = {
  "/": {
    title: `${SITE} | Kars tours: Ani, Lake Çıldır and VIP transfers`,
    description:
      "Licensed travel agency in Kars since 2010. Day tours to Ani and Lake Çıldır, Sarıkamış, Batumi and Van with online seat selection in VIP minibuses.",
  },
  "/turlar": {
    title: `Kars, Ani, Sarıkamış, Batumi and Van tours | ${SITE}`,
    description:
      "Day trips and overnight tours from Kars: Ani and Lake Çıldır, Sarıkamış skiing, Batumi, Van and the Van basin. Prices, itineraries and online seat selection.",
  },
  "/hakkimizda": {
    title: `About us | ${SITE}`,
    description: `Rota Kars Turizm, a TÜRSAB-licensed (No. ${business.tursabNo}) group A travel agency serving Kars since ${business.founded}.`,
  },
  "/kesfet/ani": {
    title: `Ani ruins: history, walking route and travel tips | ${SITE}`,
    description:
      "Ani, the city of a thousand and one churches: a thousand-year story from the Bagratids to the Seljuks, a sample walking route from the Lion Gate to the Mosque of Manuchihr, and tips before you go.",
  },
  "/iletisim": {
    title: `Contact and address | ${SITE}`,
    description: `Rota Kars Turizm office: ${business.address}. Phone ${business.phone}.`,
  },
};
const EN_PRIVATE = {
  Rezervasyon: "Booking",
  Rezervasyonum: "My booking",
  Üyelik: "Membership",
  Hesabım: "My account",
  "Bilet doğrulama": "Ticket check",
  Ödeme: "Payment",
  "Online ödeme": "Online payment",
};
const isEn = (p) => p === "/en" || p.startsWith("/en/");
const stripEn = (p) => (p === "/en" ? "/" : p.slice(3));
// Bir yol için meta bilgisi. status 404 ise sayfa yoktur.
export function pageMeta(path, base) {
  if (isEn(path)) {
    const inner = pageMeta(stripEn(path), base);
    if (inner.status !== 200) return { ...inner, path: path };
    const tr = inner.path,
      tourId = tr.match(/^\/turlar\/([^/]+)$/)?.[1],
      tour = tourId && currentEn().tours[tourId],
      fixed = EN_STATIC[tr];
    return {
      ...inner,
      lang: "en",
      path: tr === "/" ? "/en" : "/en" + tr,
      alternate: tr,
      // Çevrilmemiş sayfalar İngilizce dizine girmez.
      index: inner.index && Boolean(fixed || tour),
      title:
        fixed?.title ||
        (tour
          ? `${tour.name}: ${tour.subtitle} | ${SITE}`
          : EN_PRIVATE[inner.title.split(" | ")[0]]
            ? `${EN_PRIVATE[inner.title.split(" | ")[0]]} | ${SITE}`
            : inner.title),
      description: fixed?.description || (tour ? clip(tour.summary) : inner.description),
    };
  }
  let end = Math.min(path.length, 512);
  while (end > 1 && path[end - 1] === "/") end--;
  const p = path.slice(0, end) || "/";
  const graph = [agency(base)];
  if (STATIC[p]) {
    const m = STATIC[p];
    if (p === "/")
      graph.push({
        "@type": "WebSite",
        "@id": base + "/#website",
        name: SITE,
        url: base + "/",
        inLanguage: "tr-TR",
        publisher: { "@id": base + "/#agency" },
      });
    if (m.crumb) graph.push(crumbs(base, [{ name: m.crumb, path: p }]));
    if (p === "/kesfet/ani")
      graph.push({
        "@type": "TouristAttraction",
        name: "Ani Arkeolojik Alanı",
        alternateName: "Ani Harabeleri",
        description: m.description,
        image: base + "/images/tours/ani.webp",
        url: base + p,
        geo: { "@type": "GeoCoordinates", latitude: 40.5075, longitude: 43.5728 },
        address: { "@type": "PostalAddress", addressLocality: "Ocaklı, Merkez", addressRegion: "Kars", addressCountry: "TR" },
        isAccessibleForFree: false,
      });
    if (p === "/turlar")
      graph.push({
        "@type": "ItemList",
        name: "Rota Kars turları",
        itemListElement: tours.map((t, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${base}/turlar/${t.id}`,
          name: t.name,
        })),
      });
    if (p === "/hizmetler")
      graph.push(
        ...services.map((s) => ({
          "@type": "Service",
          name: s.title,
          description: s.text,
          url: `${base}/hizmetler/${s.id}`,
          provider: { "@id": base + "/#agency" },
          areaServed: "Kars",
        })),
      );
    return {
      status: 200,
      index: true,
      path: p,
      alternate: EN_STATIC[p] ? "/en" + (p === "/" ? "" : p) : null,
      title: m.title,
      description: m.description,
      image: m.image || DEFAULT_IMAGE,
      lcp: p === "/" ? "/images/ani.webp" : m.image || null,
      graph,
    };
  }
  const tourMatch = p.match(/^\/turlar\/([^/]+)$/);
  const tour = tourMatch && tours.find((t) => t.id === tourMatch[1]);
  if (tour) {
    graph.push(
      tourLd(base, tour),
      crumbs(base, [
        { name: "Turlarımız", path: "/turlar" },
        { name: tour.name, path: p },
      ]),
    );
    return {
      status: 200,
      index: true,
      path: p,
      alternate: "/en" + p,
      type: "product",
      title: tourTitle(tour),
      description: clip(
        `${tour.name} (${tour.duration}, ${tour.location}): ${tour.summary}${tour.price > 0 ? ` Kişi başı ${tl(tour.price)}'den başlayan fiyatlarla.` : ""}`,
      ),
      image: tour.image,
      lcp: tour.image,
      graph,
    };
  }
  const articleMatch = p.match(/^\/rehber\/([a-z0-9-]+)$/);
  const article = articleMatch && publishedArticle(articleMatch[1]);
  if (article) {
    graph.push(
      {
        "@type": "BlogPosting",
        headline: article.title,
        description: article.summary,
        image: base + article.cover,
        url: base + p,
        inLanguage: "tr-TR",
        datePublished: new Date(article.publishedAt).toISOString(),
        dateModified: new Date(article.updatedAt).toISOString(),
        author: { "@id": base + "/#agency" },
        publisher: { "@id": base + "/#agency" },
      },
      crumbs(base, [
        { name: "Rehber", path: "/rehber" },
        { name: article.title, path: p },
      ]),
    );
    return {
      status: 200,
      index: true,
      path: p,
      type: "article",
      title: `${article.title} | ${SITE}`,
      description: clip(article.summary),
      image: article.cover,
      lcp: article.cover,
      graph,
    };
  }
  const serviceMatch = p.match(/^\/hizmetler\/([^/]+)$/);
  const service = serviceMatch && services.find((s) => s.id === serviceMatch[1]);
  if (service) {
    graph.push(
      {
        "@type": "Service",
        name: service.title,
        description: service.text,
        url: base + p,
        image: base + service.image,
        provider: { "@id": base + "/#agency" },
        areaServed: "Kars",
      },
      crumbs(base, [
        { name: "Hizmetlerimiz", path: "/hizmetler" },
        { name: service.title, path: p },
      ]),
    );
    return {
      status: 200,
      index: true,
      path: p,
      title: `${service.title} | ${SITE}`,
      description: clip(`${service.title}: ${service.text}`),
      image: service.image,
      graph,
    };
  }
  const priv = PRIVATE.find(([re]) => re.test(p));
  if (priv)
    return {
      status: 200,
      index: false,
      path: p,
      title: `${priv[1]} | ${SITE}`,
      description: DEFAULT_DESCRIPTION,
      image: DEFAULT_IMAGE,
      graph,
    };
  return {
    status: 404,
    index: false,
    path: p,
    title: `Sayfa bulunamadı | ${SITE}`,
    description: DEFAULT_DESCRIPTION,
    image: DEFAULT_IMAGE,
    graph,
  };
}

// Sayfanın en büyük görseli JS beklenmeden indirilmeye başlasın (LCP). İstemcideki
// srcset ile aynı varyantlar verilir; tarayıcı ikinci kez indirmez.
const RESPONSIVE = /^\/images\/((?:tours|rehber)\/[\w-]+|ani|rota-bus|stay)\.webp$/;
const preloadTag = (src) =>
  RESPONSIVE.test(src)
    ? `<link rel="preload" as="image" fetchpriority="high" href="${attr(src)}" imagesrcset="${attr(src.replace(/\.webp$/, "-800.webp"))} 800w, ${attr(src)} 1400w" imagesizes="100vw">`
    : `<link rel="preload" as="image" fetchpriority="high" href="${attr(src)}">`;
export function headTags(meta, base) {
  const url = base + meta.path;
  const image = /^https?:/.test(meta.image) ? meta.image : base + meta.image;
  return [
    meta.lcp ? preloadTag(meta.lcp) : "",
    `<title>${attr(meta.title)}</title>`,
    `<meta name="description" content="${attr(meta.description)}">`,
    `<meta name="robots" content="${meta.index ? "index, follow, max-image-preview:large" : "noindex, follow"}">`,
    meta.index ? `<link rel="canonical" href="${attr(url)}">` : "",
    // Türkçe ve İngilizce sürümler birbirini gösterir.
    meta.index && meta.alternate
      ? (meta.lang === "en"
          ? [["tr", meta.alternate], ["en", meta.path]]
          : [["tr", meta.path], ["en", meta.alternate]]
        )
          .map(([l, p]) => `<link rel="alternate" hreflang="${l}" href="${attr(base + p)}">`)
          .join("")
      : "",
    `<meta property="og:site_name" content="${SITE}">`,
    `<meta property="og:locale" content="${meta.lang === "en" ? "en_GB" : "tr_TR"}">`,
    `<meta property="og:type" content="${meta.type === "product" ? "product" : "website"}">`,
    `<meta property="og:title" content="${attr(meta.title)}">`,
    `<meta property="og:description" content="${attr(meta.description)}">`,
    `<meta property="og:url" content="${attr(url)}">`,
    `<meta property="og:image" content="${attr(image)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    // Yönetim paneli telefona/masaüstüne uygulama olarak yüklenebilir (PWA); site değil.
    meta.path === "/yonetim"
      ? '<link rel="manifest" href="/yonetim.webmanifest">' +
        '<link rel="apple-touch-icon" href="/images/app/apple-touch-icon.png">' +
        '<meta name="apple-mobile-web-app-title" content="Rota Yönetim">' +
        '<meta name="mobile-web-app-capable" content="yes">' +
        '<meta name="apple-mobile-web-app-status-bar-style" content="black">'
      : "",
    ld({ "@context": "https://schema.org", "@graph": meta.graph }),
  ]
    .filter(Boolean)
    .join("");
}

// index.html şablonundaki varsayılan başlık/açıklamayı sayfaya özel olanlarla değiştirir.
// JSON'u <script> içine güvenle gömer: "</script>" kaçışı ve satır ayırıcılar engellenir.
export const inlineJson = (value) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

export function renderHtml(template, meta, base, catalog = null) {
  const data = catalog
    ? `<script id="catalog-data" type="application/json">${inlineJson(catalog)}</script>`
    : "";
  return template
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\s+name="description"[^>]*>/i, "")
    // Fonksiyonla yerine koyma: içerikteki "$`" gibi diziler özel anlam kazanmaz.
    .replace("</head>", () => headTags(meta, base) + data + "</head>");
}

export function robotsTxt(base, env) {
  if (env.DEMO_MODE === "1") return "User-agent: *\nDisallow: /\n";
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /yonetim",
    "Disallow: /hesabim",
    "Disallow: /uyelik",
    "Disallow: /bilet/",
    "Disallow: /rezervasyon/",
    "Disallow: /rezervasyonum",
    "Disallow: /en/bilet/",
    "Disallow: /en/rezervasyon/",
    "Disallow: /en/rezervasyonum",
    "Disallow: /en/hesabim",
    "Disallow: /en/uyelik",
    "",
    `Sitemap: ${base}/sitemap.xml`,
    "",
  ].join("\n");
}

export function sitemapXml(base) {
  const paths = [
    ...Object.keys(STATIC),
    ...tours.map((t) => `/turlar/${t.id}`),
    ...services.map((s) => `/hizmetler/${s.id}`),
    ...publishedArticles().map((a) => `/rehber/${a.slug}`),
    // İngilizce sürüm: çevrilmiş sayfalar.
    ...Object.keys(EN_STATIC).map((p) => (p === "/" ? "/en" : "/en" + p)),
    ...tours.map((t) => `/en/turlar/${t.id}`),
  ];
  const images = (p) => {
    const t = tours.find((x) => `/turlar/${x.id}` === p.replace(/^\/en/, ""));
    return t
      ? [...new Set([t.image, ...(t.gallery || [])])]
          .map(
            (i) =>
              `<image:image><image:loc>${attr(base + i)}</image:loc></image:image>`,
          )
          .join("")
      : "";
  };
  const priority = (p) =>
    p === "/" ? "1.0" : p.startsWith("/turlar") ? "0.9" : "0.6";
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
    paths
      .map(
        (p) =>
          `<url><loc>${attr(base + p)}</loc><priority>${priority(p)}</priority>${images(p)}</url>`,
      )
      .join("\n") +
    `\n</urlset>\n`
  );
}

// robots.txt, sitemap.xml ve istemci tarafı gezinti için meta API'si.
export function attachSeoRoutes(app, env) {
  // Eski WordPress adresleri (Google'da hâlâ listelenen) yeni sayfalara 301 ile gider.
  app.use(legacyRedirects());
  app.get("/robots.txt", (q, r) =>
    r.type("text/plain").send(robotsTxt(siteBase(env, q), env)),
  );
  app.get("/sitemap.xml", (q, r) =>
    r.type("application/xml").send(sitemapXml(siteBase(env, q))),
  );
  app.get("/api/meta", (q, r) => {
    const path = typeof q.query.path === "string" ? q.query.path : "/";
    const base = siteBase(env, q);
    const m = pageMeta(path.slice(0, 200), base);
    r.json({
      status: m.status,
      title: m.title,
      description: m.description,
      index: m.index,
      canonical: m.index ? base + m.path : null,
      image: /^https?:/.test(m.image) ? m.image : base + m.image,
      jsonLd: { "@context": "https://schema.org", "@graph": m.graph },
    });
  });
}

// SPA HTML isteklerini sayfaya özel meta ile yanıtlar. getTemplate, o istek
// için index.html içeriğini döner (geliştirmede Vite dönüşümüyle).
export function seoHtmlHandler(env, getTemplate, getCatalog = null) {
  return async (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    // Aşırı uzun yollar (ör. binlerce "/") işlenmez: düzenli ifade yavaşlatmasını önler.
    if (req.path.length > 512) return res.status(414).type("text/plain").send("URI too long");
    if (
      req.path.startsWith("/api/") ||
      req.path.startsWith("/@") ||
      req.path.startsWith("/src/") ||
      req.path.startsWith("/node_modules/") ||
      /\.[a-z0-9]+$/i.test(req.path) ||
      !req.accepts("html")
    )
      return next();
    try {
      const base = siteBase(env, req);
      const meta = pageMeta(req.path, base);
      // Katalog alınamazsa sayfa yine döner; istemci /api/catalog'a düşer.
      const catalog = getCatalog ? await getCatalog().catch(() => null) : null;
      const html = renderHtml(await getTemplate(req.originalUrl), meta, base, catalog);
      res.status(meta.status).type("html").send(html);
    } catch (e) {
      next(e);
    }
  };
}
