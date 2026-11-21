// Tur fotoğraflarını tam ekranda gösteren görüntüleyici. Yerel <dialog> kullanır: odak
// içeride kalır, Escape kapatır, kapanınca odak açan düğmeye döner. Oklar ve klavyedeki
// sol/sağ tuşları fotoğraf değiştirir; telefonda parmakla sola/sağa kaydırılır.
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useLang } from "../lib/i18n";
import { isIllustrativePhoto, responsive } from "../lib/images";

export function Lightbox({
  images,
  start,
  alt,
  onClose,
}: {
  images: string[];
  start: number;
  alt: string;
  onClose: () => void;
}) {
  const { t } = useLang();
  const ref = useRef<HTMLDialogElement>(null),
    close = useRef(onClose),
    swipe = useRef<number | null>(null);
  close.current = onClose;
  const n = images.length,
    [index, setIndex] = useState(Math.min(Math.max(start, 0), n - 1));
  const go = (d: number) => setIndex((x) => (x + d + n) % n);
  useEffect(() => {
    const el = ref.current!,
      previous = document.activeElement as HTMLElement | null;
    el.showModal();
    document.body.style.overflow = "hidden";
    const cancel = (e: Event) => {
      e.preventDefault();
      close.current();
    };
    el.addEventListener("cancel", cancel);
    return () => {
      el.removeEventListener("cancel", cancel);
      el.close();
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, []);
  const src = images[index];
  return (
    <dialog
      ref={ref}
      className="rk-lightbox"
      aria-label={t("Fotoğraflar")}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      onKeyDown={(e) => {
        if (n < 2) return;
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
    >
      <figure
        onPointerDown={(e) => (swipe.current = e.clientX)}
        onPointerUp={(e) => {
          if (swipe.current === null || n < 2) return;
          const dx = e.clientX - swipe.current;
          swipe.current = null;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        }}
        onClick={(e) => {
          // Fotoğrafın dışındaki boşluğa tıklanınca kapanır.
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <img
          key={src}
          {...responsive(src, "100vw")}
          alt={t("{name}, fotoğraf {n} / {total}", {
            name: alt,
            n: index + 1,
            total: n,
          })}
          draggable={false}
        />
        {isIllustrativePhoto(src) && (
          <small className="kp-photo-disclosure">
            {t("Temsili · Yapay zekâ")}
          </small>
        )}
      </figure>
      <button
        type="button"
        className="rk-lightbox-close"
        onClick={onClose}
        aria-label={t("Kapat")}
        autoFocus
      >
        <X size={22} />
      </button>
      {n > 1 && (
        <>
          <button
            type="button"
            className="rk-lightbox-nav is-prev"
            onClick={() => go(-1)}
            aria-label={t("Önceki fotoğraf")}
          >
            <ChevronLeft size={26} />
          </button>
          <button
            type="button"
            className="rk-lightbox-nav is-next"
            onClick={() => go(1)}
            aria-label={t("Sonraki fotoğraf")}
          >
            <ChevronRight size={26} />
          </button>
          <div className="rk-lightbox-thumbs">
            <span aria-live="polite">
              {index + 1} / {n}
            </span>
            {images.map((img, i) => (
              <button
                type="button"
                key={img}
                aria-label={t("{n}. fotoğrafı göster", { n: i + 1 })}
                aria-current={i === index || undefined}
                onClick={() => setIndex(i)}
              >
                <img
                  {...responsive(img, "96px")}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              </button>
            ))}
          </div>
        </>
      )}
    </dialog>
  );
}
