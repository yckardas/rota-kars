import { useEffect } from "react";
import { api } from "./api";

type Meta = {
  title: string;
  description: string;
  index: boolean;
  canonical: string | null;
  image: string;
  jsonLd: unknown;
};

function setMeta(selector: string, create: () => HTMLElement, value: string | null) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (value === null) return el?.remove();
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  if (el instanceof HTMLLinkElement) el.href = value;
  else if (el instanceof HTMLScriptElement) el.textContent = value;
  else el.setAttribute("content", value);
}
const named = (attr: "name" | "property", key: string) => () => {
  const m = document.createElement("meta");
  m.setAttribute(attr, key);
  return m;
};

// Sunucu ilk HTML'i sayfaya özel meta ile gönderir; uygulama içi gezintide
// aynı bilgiyi /api/meta'dan alıp <head>'i günceller.
export function usePageMeta(pathname: string) {
  useEffect(() => {
    let alive = true;
    api<Meta>("/meta?path=" + encodeURIComponent(pathname))
      .then((m) => {
        if (!alive) return;
        document.title = m.title;
        setMeta('meta[name="description"]', named("name", "description"), m.description);
        setMeta(
          'meta[name="robots"]',
          named("name", "robots"),
          m.index ? "index, follow, max-image-preview:large" : "noindex, follow",
        );
        setMeta(
          'link[rel="canonical"]',
          () => Object.assign(document.createElement("link"), { rel: "canonical" }),
          m.canonical,
        );
        setMeta('meta[property="og:title"]', named("property", "og:title"), m.title);
        setMeta('meta[property="og:description"]', named("property", "og:description"), m.description);
        setMeta('meta[property="og:url"]', named("property", "og:url"), m.canonical || location.href);
        setMeta('meta[property="og:image"]', named("property", "og:image"), m.image);
        setMeta(
          'script[type="application/ld+json"]',
          () => Object.assign(document.createElement("script"), { type: "application/ld+json" }),
          JSON.stringify(m.jsonLd),
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname]);
}
