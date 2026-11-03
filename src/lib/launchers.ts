import { useEffect, useState, type RefObject } from "react";
// Hatıra kartının arama/eylem bandı görünürken sağ alttaki WhatsApp ve asistan
// düğmeleri geri çekilir; band ekrandan çıkınca geri gelir. Görünürlüğü döndürür.
// `flag` ayrı bir body data niteliğidir; CSS hangi ekran genişliğinde geri
// çekileceğine kendisi karar verir (ör. rezervasyon özeti yalnız masaüstünde).
export function useClearOfLaunchers(
  ref: RefObject<HTMLElement | null>,
  flag = "ctaVisible",
) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting) document.body.dataset[flag] = "";
        else delete document.body.dataset[flag];
      },
      { threshold: 0.01 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      delete document.body.dataset[flag];
    };
  }, [ref, flag]);
  return visible;
}
