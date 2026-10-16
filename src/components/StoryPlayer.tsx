import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { Modal } from "./Modal";
import type { Story } from "../lib/types";
export function StoryPlayer({
  story,
  onClose,
}: {
  story: Story;
  onClose: () => void;
}) {
  const [i, setI] = useState(0);
  return (
    <Modal title={story.location} onClose={onClose}>
      <div
        className="story-player"
        style={{
          backgroundImage: `linear-gradient(0deg,rgba(13,35,46,.94),rgba(13,35,46,.05)),url(${story.image})`,
        }}
      >
        <div className="story-tracks">
          {story.scenes.map((_, n) => (
            <span key={n} className={n <= i ? "seen" : ""} />
          ))}
        </div>
        <div className="story-player-copy">
          <span>
            <MapPin size={14} /> {story.location}
          </span>
          <h2>{story.scenes[i].title}</h2>
          <p>{story.scenes[i].text}</p>
          <Link
            to={"/turlar/" + story.tourId}
            className="btn btn-white"
            onClick={onClose}
          >
            Bu rotayı incele
          </Link>
        </div>
        <div className="story-controls">
          <button
            className="icon-btn"
            onClick={() => setI(Math.max(0, i - 1))}
            disabled={i === 0}
            aria-label="Önceki sahne"
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
            aria-label="Sonraki sahne"
          >
            <ChevronRight />
          </button>
        </div>
      </div>
    </Modal>
  );
}
