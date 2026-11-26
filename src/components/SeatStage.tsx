import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Grid2x2, RotateCcw } from "lucide-react";
import { SeatMap } from "./SeatMap";
import { useLang } from "../lib/i18n";

// Rezervasyondaki koltuk seçimi: varsayılan yarı 3D plan, istenirse düz plan.
// Araç sınıfının fotoğrafı varsa harita ilk göründüğünde dış fotoğraftan kapıya
// dalınır, iç kabin görünür, plan aynı bakış açısından yerine oturur.
type View = "depth" | "flat";
type Phase = "cover" | "intro" | "done";
const KEY = "rota.seatView";
// Aynı sayfa ziyaretinde aynı araç için giriş bir kez oynar.
const played = new Set<string>();
const readView = (): View => {
  try {
    return localStorage.getItem(KEY) === "flat" ? "flat" : "depth";
  } catch {
    return "depth";
  }
};
const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const EASE_IN = "cubic-bezier(.55,0,.75,.3)",
  EASE_OUT = "cubic-bezier(.2,.8,.2,1)";

export function SeatStage(props: Parameters<typeof SeatMap>[0]) {
  const { vehicle } = props,
    { t } = useLang(),
    photos = vehicle.photos,
    [view, setView] = useState<View>(readView),
    stage = useRef<HTMLDivElement>(null),
    running = useRef<Animation[]>([]);
  const firstPhase = useCallback(
    (v: View): Phase =>
      photos && v === "depth" && !played.has(vehicle.id) && !reducedMotion() ? "cover" : "done",
    [photos, vehicle.id],
  );
  const [phase, setPhase] = useState<Phase>(() => firstPhase(view));

  const stop = useCallback(() => {
    running.current.forEach((a) => a.cancel());
    running.current = [];
  }, []);

  const play = useCallback(() => {
    const el = stage.current;
    if (!el) return;
    const dis = el.querySelector<HTMLElement>(".seat-stage-photo.dis"),
      ic = el.querySelector<HTMLElement>(".seat-stage-photo.ic"),
      map = el.querySelector<HTMLElement>(".seat-map"),
      body = el.querySelector<HTMLElement>(".vehicle-body");
    if (!dis || !ic || !map || !body || typeof el.animate !== "function") return setPhase("done");
    stop();
    played.add(vehicle.id);
    setPhase("intro");
    const tilt = getComputedStyle(map).getPropertyValue("--tilt").trim() || "40deg",
      go = (node: Element, frames: Keyframe[], o: KeyframeAnimationOptions) => {
        const a = node.animate(frames, { fill: "both", ...o });
        running.current.push(a);
        return a;
      };
    // 1) Kapıya doğru dalış
    go(
      dis,
      [
        { transform: "scale(1)", filter: "blur(0) brightness(1)", opacity: 1 },
        { transform: "scale(1.5)", filter: "blur(0) brightness(.95)", opacity: 1, offset: 0.45 },
        { transform: "scale(3.4)", filter: "blur(8px) brightness(.5)", opacity: 0 },
      ],
      { duration: 1300, easing: EASE_IN },
    );
    // 2) İç kabin (sınıf fotoğrafı plana uysun diye aynalı)
    go(
      ic,
      [
        { transform: "scaleX(-1) scale(1.7)", opacity: 0, filter: "blur(6px)" },
        { transform: "scaleX(-1) scale(1.12)", opacity: 1, filter: "blur(0)", offset: 0.45 },
        { transform: "scaleX(-1) scale(1.04)", opacity: 1, filter: "blur(0)", offset: 0.75 },
        { transform: "scaleX(-1) scale(1.2) translateY(-3%)", opacity: 0, filter: "blur(4px) brightness(.6)" },
      ],
      { duration: 2900, delay: 850, easing: "cubic-bezier(.2,.7,.3,1)" },
    );
    // 3) Plan aynı bakış açısından yükselir, koltuklar arkadan öne yerine oturur
    go(map, [{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 3000, easing: "ease-out" });
    go(
      body,
      [
        { transform: "translateY(18%) rotateX(68deg) scale(1.15)" },
        { transform: `rotateX(${tilt})` },
      ],
      { duration: 1100, delay: 2950, easing: EASE_OUT },
    );
    const rows = Number(getComputedStyle(body).getPropertyValue("--rows")) || 6;
    el.querySelectorAll<HTMLElement>(".passenger-row").forEach((row) => {
      const r = Number(row.style.getPropertyValue("--row")) || 0;
      row.querySelectorAll(".vehicle-seat").forEach((seat, i) => {
        go(
          seat,
          [{ transform: "translateZ(60px)" }, { transform: "translateZ(0)" }],
          {
            duration: 500,
            delay: 3300 + (rows - 1 - r) * 70 + i * 25,
            easing: "cubic-bezier(.2,.9,.3,1.2)",
          },
        );
      });
    });
    Promise.all(running.current.map((a) => a.finished))
      .then(() => {
        stop();
        setPhase("done");
      })
      .catch(() => {});
  }, [stop, vehicle.id]);

  // Araç ya da görünüm değişince giriş durumu baştan kurulur.
  useEffect(() => {
    stop();
    setPhase(firstPhase(view));
  }, [firstPhase, view, stop]);
  useEffect(() => stop, [stop]);

  // Harita yarıdan fazla göründüğünde giriş başlar.
  useEffect(() => {
    const el = stage.current;
    if (phase !== "cover" || !el) return;
    if (typeof IntersectionObserver === "undefined") return setPhase("done");
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          io.disconnect();
          play();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [phase, play]);

  const toggle = () => {
    const next: View = view === "depth" ? "flat" : "depth";
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* gizli sekme: tercih yalnız bu sayfada kalır */
    }
    setView(next);
  };
  const skip = () => {
    stop();
    setPhase("done");
  };
  // Fotoğraf katmanı yeniden kurulur; görünürse giriş hemen başlar.
  const replay = () => {
    played.delete(vehicle.id);
    setPhase("cover");
  };

  return (
    <div className={"seat-stage is-" + phase} ref={stage}>
      <div className="seat-stage-view">
        <SeatMap {...props} depth={view === "depth"} />
        {photos && view === "depth" && phase !== "done" && (
          <div className="seat-stage-photos">
            <img
              className="seat-stage-photo ic"
              src={photos.interior}
              alt={t("Aracın içi")}
              loading="lazy"
              decoding="async"
            />
            <img
              className="seat-stage-photo dis"
              src={photos.exterior}
              alt={t("Aracın dışı")}
              loading="lazy"
              decoding="async"
            />
            <button type="button" className="seat-stage-skip" onClick={skip}>
              {t("Atla")}
            </button>
          </div>
        )}
      </div>
      <div className="seat-stage-controls">
        <button type="button" className="seat-stage-chip" aria-pressed={view === "flat"} onClick={toggle}>
          {view === "depth" ? <Grid2x2 size={15} /> : <Box size={15} />}
          {view === "depth" ? t("Düz görünüm") : t("3D görünüm")}
        </button>
        {photos && view === "depth" && phase === "done" && (
          <button type="button" className="seat-stage-chip" onClick={replay}>
            <RotateCcw size={15} />
            {t("Baştan oynat")}
          </button>
        )}
      </div>
    </div>
  );
}
