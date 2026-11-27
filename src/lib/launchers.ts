import { useEffect, useState, type RefObject } from "react";
// Hatıra kartının arama/eylem bandı görünürken sağ alttaki WhatsApp ve asistan
// düğmeleri geri çekilir; band ekrandan çıkınca geri gelir. Görünürlüğü döndürür.
// `flag` ayrı bir body data niteliğidir; CSS hangi ekran genişliğinde geri
// çekileceğine kendisi karar verir (ör. rezervasyon özeti yalnız masaüstünde).
// Birden çok öğe verilirse (sabit bir dizi) herhangi biri görünürken geri çekilir.
export function useClearOfLaunchers(
  ref: RefObject<HTMLElement | null> | readonly RefObject<HTMLElement | null>[],
  flag = "ctaVisible",
) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const els = (Array.isArray(ref) ? ref : [ref])
      .map((r: RefObject<HTMLElement | null>) => r.current)
      .filter((el): el is HTMLElement => Boolean(el));
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const shown = new Set<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) shown.add(e.target);
          else shown.delete(e.target);
        }
        setVisible(shown.size > 0);
        if (shown.size) document.body.dataset[flag] = "";
        else delete document.body.dataset[flag];
      },
      { threshold: 0.01 },
    );
    els.forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      delete document.body.dataset[flag];
    };
  }, [ref, flag]);
  return visible;
}
