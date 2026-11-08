import { forwardRef, useCallback, useMemo } from "react";
import {
  Link as RouterLink,
  NavLink as RouterNavLink,
  useLocation,
  useNavigate,
  type LinkProps,
  type NavLinkProps,
  type NavigateOptions,
} from "react-router-dom";
import { en } from "./en";
// Sitenin İngilizce sürümü /en altında yaşar. Metinler Türkçe yazılır ve t() ile
// çevrilir; sözlükte karşılığı olmayan metin Türkçe kalır.
export type Lang = "tr" | "en";
export const langOf = (pathname: string): Lang =>
  pathname === "/en" || pathname.startsWith("/en/") ? "en" : "tr";
// Tarih ve sayı biçimleri için o anki dil (yardımcı işlevler bileşen dışında da çalışır).
let current: Lang =
  typeof location !== "undefined" ? langOf(location.pathname) : "tr";
export const currentLang = () => current;
export const localeOf = (lang: Lang = current) =>
  lang === "en" ? "en-GB" : "tr-TR";
const fill = (text: string, vars?: Record<string, string | number>) =>
  vars
    ? text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
    : text;
export function translate(
  lang: Lang,
  text: string,
  vars?: Record<string, string | number>,
) {
  return fill(lang === "en" ? (en[text] ?? text) : text, vars);
}
// Türkçe yolu dile göre önekler: "/turlar" -> "/en/turlar".
export const localPath = (lang: Lang, p: string) =>
  lang === "en" &&
  p.startsWith("/") &&
  !p.startsWith("/api") &&
  !p.startsWith("/en")
    ? p === "/"
      ? "/en"
      : "/en" + p
    : p;
// Dil önekini atar: "/en/turlar" -> "/turlar".
export const stripLang = (p: string) =>
  p === "/en" ? "/" : p.startsWith("/en/") ? p.slice(3) : p;
export function useLang() {
  const { pathname } = useLocation(),
    lang = langOf(pathname);
  current = lang;
  return useMemo(
    () => ({
      lang,
      locale: localeOf(lang),
      t: (text: string, vars?: Record<string, string | number>) =>
        translate(lang, text, vars),
      path: (p: string) => localPath(lang, p),
    }),
    [lang],
  );
}
const localTo = (lang: Lang, to: LinkProps["to"]) =>
  typeof to === "string" ? localPath(lang, to) : to;
// Dil önekini kendiliğinden ekleyen bağlantılar.
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(
  function Link(props, ref) {
    const { lang } = useLang();
    return <RouterLink ref={ref} {...props} to={localTo(lang, props.to)} />;
  },
);
export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  function NavLink(props, ref) {
    const { lang } = useLang();
    return <RouterNavLink ref={ref} {...props} to={localTo(lang, props.to)} />;
  },
);
// Kimliği sabit kalır; etki (useEffect) bağımlılığı olarak güvenle kullanılır.
export function useLocalNavigate() {
  const navigate = useNavigate(),
    { lang } = useLang();
  return useCallback(
    (to: string, options?: NavigateOptions) =>
      navigate(localPath(lang, to), options),
    [navigate, lang],
  );
}
