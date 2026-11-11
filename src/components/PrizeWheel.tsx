import { useEffect, useRef, useState } from "react";
import { currency } from "../lib/types";
import type { Lang } from "../lib/i18n";
// Şans çarkı. Sonuç her zaman sunucuda seçilir; bu bileşen yalnız çarkı o
// dilimde durdurur. Dilimler eşit genişlikte çizilir; kazanma payları
// (weight) ayrıca yazılı olarak gösterilir.
export type WheelSector = {
  kind: "percent" | "amount";
  value: number;
  weight: number;
};
// Eski kayıtlarda dilimler düz yüzde sayısı ya da JSON metni olabilir.
export function toSectors(raw: unknown): WheelSector[] {
  const list = typeof raw === "string" ? safeParse(raw) : raw;
  return Array.isArray(list)
    ? list.map((s) =>
        typeof s === "number"
          ? { kind: "percent", value: s, weight: 1 }
          : (s as WheelSector),
      )
    : [];
}
const safeParse = (s: string) => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};
export const prizeLabel = (
  p: Pick<WheelSector, "kind" | "value">,
  lang: Lang,
) =>
  p.kind === "amount"
    ? currency(p.value)
    : lang === "en"
      ? `${p.value}%`
      : `%${p.value}`;
// Kazanma paylarını yüzde olarak yazar: "%5 · %30 şans".
export const sectorOdds = (sectors: WheelSector[]) => {
  const total = sectors.reduce((n, s) => n + s.weight, 0) || 1;
  return sectors.map((s) => Math.round((s.weight / total) * 1000) / 10);
};
const FILLS = ["ink", "card", "red"] as const;
const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export function PrizeWheel({
  sectors,
  landOn,
  animate = true,
  onSettled,
  lang,
  label,
}: {
  sectors: WheelSector[];
  // Durulacak dilim; null iken çark beklemede.
  landOn: number | null;
  animate?: boolean;
  onSettled?: () => void;
  lang: Lang;
  label: string;
}) {
  const n = Math.max(1, sectors.length),
    slice = 360 / n,
    [rotation, setRotation] = useState(0),
    [moving, setMoving] = useState(false),
    settled = useRef(onSettled);
  settled.current = onSettled;
  useEffect(() => {
    if (landOn == null) return;
    // Seçilen dilimin ortası en üstteki işaretin altına gelir.
    const target = (360 - (landOn * slice + slice / 2)) % 360;
    if (!animate || reducedMotion()) {
      setMoving(false);
      setRotation(target);
      settled.current?.();
      return;
    }
    setMoving(true);
    setRotation((prev) => {
      const base = prev - (prev % 360);
      return base + 360 * 5 + target;
    });
    // transitionend her zaman gelmeyebilir (sekme arka planda); süre dolunca da biter.
    const timer = window.setTimeout(() => {
      setMoving(false);
      settled.current?.();
    }, 4300);
    return () => clearTimeout(timer);
  }, [landOn, animate, slice]);
  const R = 140,
    C = 150,
    point = (deg: number, r: number) => {
      const rad = ((deg - 90) * Math.PI) / 180;
      return [C + r * Math.cos(rad), C + r * Math.sin(rad)];
    };
  return (
    <div className="prize-wheel-box">
      <svg
        className="prize-wheel-svg"
        viewBox="0 0 300 300"
        role="img"
        aria-label={label}
      >
        {/* Uçak postası şeridi: kırmızı, kâğıt, mürekkep */}
        <circle className="wheel-rim" cx={C} cy={C} r={R + 6} />
        <circle className="wheel-rim-red" cx={C} cy={C} r={R + 6} />
        <circle className="wheel-rim-ink" cx={C} cy={C} r={R + 6} />
        <g
          className={"wheel-face" + (moving ? " moving" : "")}
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          {sectors.map((s, i) => {
            const [x1, y1] = point(i * slice, R),
              [x2, y2] = point((i + 1) * slice, R),
              mid = i * slice + slice / 2,
              [tx, ty] = point(mid, R * 0.64),
              fill = FILLS[i % 3];
            return (
              <g key={i}>
                <path
                  className={"wheel-slice " + fill}
                  d={`M${C},${C} L${x1},${y1} A${R},${R} 0 ${slice > 180 ? 1 : 0} 1 ${x2},${y2} Z`}
                />
                <text
                  className={"wheel-label " + fill}
                  x={tx}
                  y={ty}
                  transform={`rotate(${mid} ${tx} ${ty})`}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {prizeLabel(s, lang)}
                </text>
              </g>
            );
          })}
        </g>
        <circle className="wheel-hub" cx={C} cy={C} r={30} />
        <text
          className="wheel-hub-text"
          x={C}
          y={C}
          textAnchor="middle"
          dominantBaseline="central"
        >
          ROTA
        </text>
        <path
          className="wheel-pointer-svg"
          d={`M${C - 11},4 L${C + 11},4 L${C},30 Z`}
        />
      </svg>
    </div>
  );
}
