import { useEffect, useState, type RefObject } from "react";
// Hatıra kartının arama/eylem bandı görünürken sağ alttaki WhatsApp ve asistan
// düğmeleri geri çekilir; band ekrandan çıkınca geri gelir. Görünürlüğü döndürür.
export function useClearOfLaunchers(ref: RefObject<HTMLElement | null>) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting) document.body.dataset.ctaVisible = "";
        else delete document.body.dataset.ctaVisible;
      },
      { threshold: 0.01 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      delete document.body.dataset.ctaVisible;
    };
  }, [ref]);
  return visible;
}
