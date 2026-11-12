// Eski WordPress sitesinin (2022–2025) adresleri. Google'da hâlâ bu adresler
// listelendiği için ziyaretçi 404 yerine yeni sitedeki karşılığına kalıcı (301)
// yönlendirilir; Google da zamanla listesini yeni adreslerle günceller.
// Liste: docs/eski-site-arsivi/turlar.json ve eski wp-sitemap kayıtları.

// Yeni katalogda birebir karşılığı olan turlar. Diğer /tur/... adresleri /turlar'a gider:
// başka bir ürüne (ör. konaklamalı turu günübirliğe) yönlendirmek yanıltıcı olur.
const TOURS = {
  "gunubirlik-ani-antik-kenti-cildir-golu-ve-kars-sehir-turu": "/turlar/ani-cildir",
  "sarikamis-kayak-turu": "/turlar/sarikamis",
  "gunubirlik-batum-turu": "/turlar/batum",
  "gunubirlik-van-turu": "/turlar/van-gunubirlik",
  "konaklamali-van-turu-tuz-magarasi-ve-ishak-pasa-sarayi-dahil": "/turlar/van",
  "van-havzasi-turu": "/turlar/van-havzasi",
};

const PAGES = {
  "/hizmetlerimiz": "/hizmetler",
  "/arac-kiralama-hizmeti": "/hizmetler",
  "/kisiye-ozel-tatil-turu": "/iletisim",
  "/galeri": "/",
  "/tur-iptali": "/bilgilendirme#iptal",
  "/kisisel-verilerin-korunmasi": "/bilgilendirme#kvkk",
  "/gizlilik-politikasi": "/bilgilendirme#kvkk",
  "/sepet": "/turlar",
  "/kategori/tur": "/turlar",
  "/feed": "/",
  "/comments/feed": "/",
};

// Eski adres için yeni adres; eski sitede olmayan bir yolsa null.
export function legacyTarget(path) {
  if (typeof path !== "string" || path.length > 300) return null;
  const p = path.replace(/\/+$/, "") || "/";
  if (Object.hasOwn(PAGES, p)) return PAGES[p];
  const tour = /^\/tur\/([a-z0-9-]+)$/.exec(p);
  if (tour) return Object.hasOwn(TOURS, tour[1]) ? TOURS[tour[1]] : "/turlar";
  return null;
}

export function legacyRedirects() {
  return (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const target = legacyTarget(req.path);
    if (!target) return next();
    res.set("Cache-Control", "public, max-age=86400");
    res.redirect(301, target);
  };
}
