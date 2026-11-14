import { useState } from "react";
import { useLang } from "../lib/i18n";
import { TourLink } from "../lib/tour-transition";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { isIllustrativePhoto, responsive } from "../lib/images";
import { Modal } from "./Modal";
import type { Story } from "../lib/types";
export function StoryPlayer({
  story,
  onClose,
}: {
  story: Story;
  onClose: () => void;
}) {
  const [i, setI] = useState(0),
    { t } = useLang();
  const scene = story.scenes[i];
  const image = scene.image ?? story.image;
  return (
    <Modal title={story.location} onClose={onClose}>
      <div className="story-player">
        <div className="story-tracks" aria-hidden="true">
          {story.scenes.map((_, n) => (
            <span key={n} className={n <= i ? "seen" : ""} />
          ))}
        </div>
        <div className={"story-media" + (scene.motion === "snow" ? " story-media-snow" : "")} key={i}>
          {scene.video ? (
            <video
              src={scene.video}
              poster={image}
              controls
              playsInline
              muted
              preload="none"
              aria-label={scene.title}
            />
          ) : (
            <img {...responsive(image, "(max-width: 600px) 100vw, 590px")} alt="" />
          )}
          {isIllustrativePhoto(image) && (
            <small className="kp-photo-disclosure">{t("Temsili · Yapay zekâ")}</small>
          )}
        </div>
        <div className="story-player-copy">
          <div aria-live="polite">
            <span className="story-location">
              <MapPin size={14} aria-hidden="true" /> {story.location}
            </span>
            <h2>{scene.title}</h2>
            <p>{scene.text}</p>
          </div>
          <TourLink
            tourId={story.tourId}
            className="btn"
          >
            {t("Bu rotayı incele")}
          </TourLink>
        </div>
        <div className="story-controls">
          <button
            className="icon-btn"
            onClick={() => setI(Math.max(0, i - 1))}
            disabled={i === 0}
            aria-label={t("Önceki sahne")}
          >
            <ChevronLeft />
          </button>
          <span>
            {i + 1} / {story.scenes.length}
          </span>
          <button
            className="icon-btn"
            onClick={() => setI(Math.min(story.scenes.length - 1, i + 1))}
            disabled={i === story.scenes.length - 1}
            aria-label={t("Sonraki sahne")}
          >
            <ChevronRight />
          </button>
        </div>
      </div>
    </Modal>
  );
}
