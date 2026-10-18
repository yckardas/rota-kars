import { useEffect, useRef, useState } from "react";
import { responsive } from "../lib/images";
import {
  Instagram,
  Play,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Volume2,
  VolumeX,
} from "lucide-react";
import { api } from "../lib/api";
import { Modal } from "./Modal";
export type InstagramPost = {
  id: string;
  title: string;
  permalink: string;
  cover: string;
  position: number;
  active: number;
  videoSrc?: string | null;
};
// Instagram gönderisi doğrudan iframe ile gömülür: üçüncü taraf betik (embed.js)
// yüklenmez, CSP'de Instagram yalnız frame-src'de kalır.
export function instagramEmbedUrl(permalink: string) {
  try {
    const url = new URL(permalink);
    if (!/^(www\.)?instagram\.com$/.test(url.hostname)) return null;
    const match = url.pathname.match(/^\/(?:[\w.]+\/)?(p|reel|tv)\/([\w-]+)\/?$/);
    return match
      ? `https://www.instagram.com/${match[1] === "tv" ? "p" : match[1]}/${match[2]}/embed/`
      : null;
  } catch {
    return null;
  }
}
function InstagramEmbed({ post }: { post: InstagramPost }) {
  const src = instagramEmbedUrl(post.permalink),
    [status, setStatus] = useState<"loading" | "ready" | "unavailable">(
      src ? "loading" : "unavailable",
    );
  useEffect(() => {
    if (!src) return;
    setStatus("loading");
    const timer = setTimeout(
      () => setStatus((current) => (current === "loading" ? "unavailable" : current)),
      10000,
    );
    return () => clearTimeout(timer);
  }, [src]);
  return (
    <div className="instagram-inline-player">
      {status === "loading" && (
        <p className="instagram-player-status" role="status">
          <LoaderCircle size={17} className="spin" /> Instagram yükleniyor…
        </p>
      )}
      {status === "unavailable" && (
        <p className="instagram-player-status" role="status">
          Oynatıcı yüklenemedi.{" "}
          <a href={post.permalink} target="_blank" rel="noopener noreferrer">
            Instagram’da görüntüle
          </a>
        </p>
      )}
      {src && (
        <div className="instagram-embed-host">
          <iframe
            src={src}
            title={post.title || "Instagram gönderisi"}
            loading="lazy"
            allow="autoplay; encrypted-media; picture-in-picture; clipboard-write"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => setStatus("ready")}
          />
        </div>
      )}
    </div>
  );
}
const canHover = () =>
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// Videolu kart: <video> hazır bekler; masaüstünde üzerine gelince, dokunmatik
// cihazlarda kart ekranın ortasına gelince sessiz oynar. Sayfadan çıkılmaz.
function VideoCard({
  post,
  playing,
  setPlaying,
}: {
  post: InstagramPost;
  playing: boolean;
  setPlaying: (on: boolean) => void;
}) {
  const card = useRef<HTMLElement>(null),
    video = useRef<HTMLVideoElement>(null),
    [muted, setMuted] = useState(true),
    [failed, setFailed] = useState(false),
    [ready, setReady] = useState(false);
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (playing && !reducedMotion()) {
      el.play().catch(() => setPlaying(false));
    } else {
      el.pause();
      if (!playing) {
        el.muted = true;
        setMuted(true);
      }
    }
  }, [playing, setPlaying]);
  // Dokunmatik cihazlar: görünür alanın ortasındaki kart oynar.
  useEffect(() => {
    if (canHover()) return;
    const observer = new IntersectionObserver(
      ([entry]) => setPlaying(entry.intersectionRatio >= 0.75),
      { threshold: [0, 0.75, 1] },
    );
    observer.observe(card.current!);
    return () => observer.disconnect();
  }, [setPlaying]);
  return (
    <article
      ref={card}
      className={"instagram-post has-video" + (playing ? " is-playing" : "")}
      onPointerEnter={(e) => e.pointerType === "mouse" && setPlaying(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setPlaying(false)}
      onFocus={() => setPlaying(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node))
          setPlaying(false);
      }}
    >
      <div className="instagram-card-media">
        {failed ? (
          <img
            {...responsive(post.cover, "(max-width: 760px) 80vw, 25vw")}
            alt=""
            loading="lazy"
            decoding="async"
          />
        ) : (
          <video
            ref={video}
            src={post.videoSrc!}
            poster={post.cover || undefined}
            muted
            loop
            playsInline
            preload="metadata"
            aria-label={post.title}
            onCanPlay={() => setReady(true)}
            onError={() => setFailed(true)}
          />
        )}
        <span className="instagram-reel-icon">
          <Instagram size={18} />
        </span>
        {!playing && (
          <span className="instagram-play" aria-hidden="true">
            <Play size={22} fill="currentColor" />
          </span>
        )}
        {playing && !ready && !failed && (
          <span className="instagram-buffering" aria-hidden="true">
            <LoaderCircle size={22} className="spin" />
          </span>
        )}
        {!failed && (
          <button
            className="instagram-sound"
            aria-label={muted ? "Sesi aç" : "Sesi kapat"}
            aria-pressed={!muted}
            onClick={() => {
              const el = video.current!;
              el.muted = !el.muted;
              setMuted(el.muted);
              if (el.paused) setPlaying(true);
            }}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        )}
        <span className="instagram-post-title">
          {post.title}
          <small>
            {failed ? "Video şu an yüklenemedi" : "Üzerine gelin, izleyin"}
          </small>
        </span>
      </div>
      <div className="instagram-card-caption">
        <span>{post.title}</span>
        <a href={post.permalink} target="_blank" rel="noreferrer">
          Instagram’da aç <ExternalLink size={12} />
        </a>
      </div>
    </article>
  );
}
// Video dosyası olmayan paylaşım: tıklanınca Instagram'ın oynatıcısı pencerede açılır.
function EmbedCard({ post, open }: { post: InstagramPost; open: () => void }) {
  return (
    <article className="instagram-post">
      <div className="instagram-card-media">
        <button
          className="instagram-cover"
          onClick={open}
          aria-label={`${post.title} videosunu izle`}
        >
          <img
            {...responsive(post.cover, "(max-width: 760px) 80vw, 25vw")}
            alt=""
            loading="lazy"
            decoding="async"
          />
          <span className="instagram-reel-icon">
            <Instagram size={18} />
          </span>
          <span className="instagram-play">
            <Play size={22} fill="currentColor" />
          </span>
          <span className="instagram-post-title">
            {post.title}
            <small>İzlemek için tıklayın</small>
          </span>
        </button>
      </div>
      <div className="instagram-card-caption">
        <span>{post.title}</span>
        <a href={post.permalink} target="_blank" rel="noreferrer">
          Instagram’da aç <ExternalLink size={12} />
        </a>
      </div>
    </article>
  );
}
export function InstagramSection({ profileUrl }: { profileUrl: string }) {
  const [posts, setPosts] = useState<InstagramPost[]>([]),
    // Aynı anda tek video oynar.
    [playing, setPlaying] = useState<string | null>(null),
    [embed, setEmbed] = useState<InstagramPost | null>(null),
    rail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    api<{ posts: InstagramPost[] }>("/instagram")
      .then((r) => {
        if (alive) setPosts(r.posts);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return (
    <section id="instagram" className="instagram-section">
      <div className="container">
        <div className="section-heading">
          <div>
            <span className="section-note">
              <Instagram size={14} /> @rotakarstur
            </span>
            <h2>Instagram’da biz.</h2>
            <p className="muted">
              Yollardan, buluşmalardan, birlikte biriktirdiğimiz anlardan.
            </p>
          </div>
          <a
            className="text-link"
            href={profileUrl}
            target="_blank"
            rel="noreferrer"
          >
            Bizi Instagram’da takip edin <ExternalLink size={15} />
          </a>
        </div>
        {posts.length ? (
          <>
            <div className="instagram-rail" ref={rail}>
              {posts.map((post) =>
                post.videoSrc ? (
                  <VideoCard
                    key={post.id}
                    post={post}
                    playing={playing === post.id}
                    setPlaying={(on) =>
                      setPlaying((current) =>
                        on ? post.id : current === post.id ? null : current,
                      )
                    }
                  />
                ) : (
                  <EmbedCard
                    key={post.id}
                    post={post}
                    open={() => setEmbed(post)}
                  />
                ),
              )}
            </div>
            <div className="instagram-rail-footer">
              <small>
                {posts.some((p) => p.videoSrc)
                  ? "Videolar üzerine gelince sessiz oynar; sesi kartın köşesinden açabilirsiniz."
                  : "Videoyu izlemek için karta tıklayın."}
              </small>
              <div>
                <button
                  className="icon-btn"
                  onClick={() =>
                    rail.current?.scrollBy({ left: -350, behavior: "smooth" })
                  }
                  aria-label="Önceki Instagram videoları"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  className="icon-btn"
                  onClick={() =>
                    rail.current?.scrollBy({ left: 350, behavior: "smooth" })
                  }
                  aria-label="Sonraki Instagram videoları"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="instagram-empty">
            <Instagram size={35} />
            <div>
              <h3>Yolculuğumuz Instagram’da da devam ediyor.</h3>
              <p>
                Rotalarımızdan videolar için @rotakarstur hesabımızı ziyaret
                edin.
              </p>
            </div>
            <a
              className="btn"
              href={profileUrl}
              target="_blank"
              rel="noreferrer"
            >
              Reels’leri keşfedin <ExternalLink size={15} />
            </a>
          </div>
        )}
      </div>
      {embed && (
        <Modal title={embed.title} onClose={() => setEmbed(null)}>
          <InstagramEmbed post={embed} />
        </Modal>
      )}
    </section>
  );
}
