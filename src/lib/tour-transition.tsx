// Tur sayfasına giden her yol aynı geçişi kullanır: sayfa yumuşakça yer değiştirir,
// tıklanan kartın fotoğrafı (varsa) tur sayfasının büyük görüntüsüne akar.
// Uygulama bildirimsel BrowserRouter kullandığı için View Transition elle başlatılır.
// Desteklemeyen tarayıcıda ve "hareketi azalt"ta normal bağlantı gibi çalışır;
// o zaman tur sayfası kendi giriş hareketini (kartın oturması) oynatır.
import { forwardRef, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { useLocation } from "react-router-dom";
import { Link, useLocalNavigate } from "./i18n";
import type { LinkProps } from "react-router-dom";

const ENTRY_FLAG = "tourEntry";
// Tur sayfası ilk çizimde bunu okur: geçişle gelindiyse giriş animasyonları
// oynamaz (fotoğraf akışının üstüne ikinci bir hareket binmesin).
export const enteredViaTransition = () =>
  typeof document !== "undefined" &&
  Boolean(document.documentElement.dataset[ENTRY_FLAG]);
let seq = 0;
let tourReturn: { key: string; top: number } | undefined;

export function takeTourReturnScroll(key: string) {
  if (tourReturn?.key !== key) return;
  const { top } = tourReturn;
  tourReturn = undefined;
  return top;
}

const opensInCurrentTab = (e: MouseEvent<HTMLAnchorElement>) =>
  !(
    e.defaultPrevented ||
    e.button !== 0 ||
    e.metaKey ||
    e.ctrlKey ||
    e.shiftKey ||
    e.altKey ||
    (e.currentTarget.target && e.currentTarget.target !== "_self")
  );

export function useOpenTour() {
  const navigate = useLocalNavigate();
  const { key } = useLocation();
  return (
    e: MouseEvent<HTMLAnchorElement>,
    tourId: string,
    photo?: HTMLImageElement | null,
    ribbon?: HTMLElement | null,
  ) => {
    if (!opensInCurrentTab(e)) return;
    if (photo) tourReturn = { key, top: window.scrollY };
    if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    e.preventDefault();
    const root = document.documentElement;
    // Paylaşılan ad yalnız tıklanan karta verilir; sayfadaki öteki kartlar
    // ayrı katman olarak sönmez, sayfayla birlikte yer değiştirir.
    if (photo?.complete && photo.naturalWidth) photo.style.viewTransitionName = "tour-photo";
    if (ribbon) ribbon.style.viewTransitionName = "tour-title";
    // Her geçişin kendi işareti olur: üst üste tıklamada önceki geçişin
    // temizliği yenisinin işaretini silmesin.
    const token = "vt" + ++seq;
    root.dataset[ENTRY_FLAG] = token;
    const transition = document.startViewTransition(() => {
      if (photo) photo.style.viewTransitionName = "";
      if (ribbon) ribbon.style.viewTransitionName = "";
      flushSync(() => navigate("/turlar/" + tourId));
      // Yeni sayfanın görüntüsü en üstten alınsın; fotoğraf doğru yere aksın.
      window.scrollTo({ top: 0, behavior: "instant" });
    });
    // Yeni bir geçiş öncekini atlatırsa "ready" reddedilir; bu beklenen bir durum.
    transition.ready.catch(() => {});
    transition.finished
      .catch(() => {})
      .then(() => {
        if (root.dataset[ENTRY_FLAG] === token) delete root.dataset[ENTRY_FLAG];
      });
  };
}

type TourLinkProps = Omit<LinkProps, "to"> & { tourId: string };
// Tur sayfasına giden düz bağlantılar (alt bilgi, hikâyeler, rezervasyondan dönüş).
export const TourLink = forwardRef<HTMLAnchorElement, TourLinkProps>(
  function TourLink({ tourId, onClick, ...props }, ref) {
    const open = useOpenTour();
    return (
      <Link
        ref={ref}
        {...props}
        to={"/turlar/" + tourId}
        onClick={(e) => {
          onClick?.(e);
          open(e, tourId);
        }}
      />
    );
  },
);
