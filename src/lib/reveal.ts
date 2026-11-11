import { useEffect, useRef } from "react";
// Ekrana girince oynayan hareketler. Öğe ilk kez görünür olduğunda "is-in" sınıfı
// alır ve bir daha bırakmaz. CSS bekleme hâlini yalnız <html class="js-motion">
// varken uygular: betik çalışmazsa içerik hiçbir zaman gizli kalmaz.
let io: IntersectionObserver | null = null;
const observer = () =>
  (io ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries)
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          io!.unobserve(e.target);
        }
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
  ));
// Öğeyi izlemeye alır; temizleme işlevi döner.
export function watchReveal(el: Element | null) {
  if (!el) return () => {};
  if (typeof IntersectionObserver === "undefined") {
    el.classList.add("is-in");
    return () => {};
  }
  observer().observe(el);
  return () => io?.unobserve(el);
}
export function useReveal<T extends Element>() {
  const ref = useRef<T>(null);
  useEffect(() => watchReveal(ref.current), []);
  return ref;
}
// Fotoğraf yüklenince "banyo olur" gibi belirir (kp-develop).
export const develop = {
  className: "kp-develop",
  onLoad: (e: { currentTarget: HTMLImageElement }) =>
    e.currentTarget.classList.add("is-loaded"),
};
