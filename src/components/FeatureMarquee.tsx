// Ana sayfadaki güven bandı ("Kesintisiz iptal", "Türk Lirası ile ödeme"…) yavaşça
// sağdan sola kayar. Kesintisiz döngü için öğeler iki kez çizilir; ikinci kopya ekran
// okuyuculardan gizlenir. Fare üstündeyken ya da klavyeyle odaklanınca durur; ayrıca
// durdur/sürdür düğmesi vardır (WCAG 2.2.2). "Hareketi azalt" açıkken bant hiç kaymaz,
// eski sabit dörtlü düzende görünür (yalnız CSS ile; bkz. postcard.css).
import { useState } from "react";
import {
  Banknote,
  Compass,
  HeartHandshake,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useLang } from "../lib/i18n";
import type { Catalog } from "../lib/types";

const featureIcons: Record<string, typeof Compass> = {
  sparkles: Sparkles,
  shield: ShieldCheck,
  lira: Banknote,
  heart: HeartHandshake,
};

export function FeatureMarquee({ features }: { features: Catalog["features"] }) {
  const { t } = useLang(),
    [paused, setPaused] = useState(false);
  const items = (clone: boolean) =>
    features.map((f) => {
      const Icon = featureIcons[f.icon] || Compass;
      return (
        <div
          className={"feature" + (clone ? " is-clone" : "")}
          key={(clone ? "clone-" : "") + f.title}
          aria-hidden={clone || undefined}
        >
          <Icon size={24} strokeWidth={1.4} />
          <div>
            <strong>{f.title}</strong>
            <span>{f.text}</span>
          </div>
        </div>
      );
    });
  return (
    <div className={"container feature-strip is-marquee" + (paused ? " is-paused" : "")}>
      <div className="feature-viewport">
        <div className="feature-track">
          {items(false)}
          {items(true)}
        </div>
      </div>
      <button
        type="button"
        className="feature-toggle"
        onClick={() => setPaused(!paused)}
        aria-label={paused ? t("Kayan bandı sürdür") : t("Kayan bandı durdur")}
        aria-pressed={paused}
      >
        {paused ? <Play size={14} /> : <Pause size={14} />}
      </button>
    </div>
  );
}
