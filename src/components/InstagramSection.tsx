import { useEffect, useRef, useState } from "react";
import { responsive } from "../lib/images";
import { Play, LoaderCircle, Volume2, VolumeX } from "lucide-react";
import { api } from "../lib/api";
import { useLang } from "../lib/i18n";
export type InstagramPost = {
  id: string;
  title: string;
  permalink: string;
  cover: string;
  position: number;
  active: number;
  videoSrc?: string | null;
};
// Bölüm, firmanın Instagram profilinin görünümünü taşır. Takipçi ve gönderi sayıları
// bilerek yok: kopyalanan sayılar eskir ve uydurma gibi okunur. Biyografi
// @rotakarstur profilinden alınmıştır (Kasım 2026).
const PROFILE = {
  name: "ROTA KARS TURİZM A-13948",
  category: "Seyahat acentesi",
  bio: [
    "🌇 Batum, Tiflis, Nahçıvan Turları",
    "🏛 Bakü Azerbaycan Turu",
    "🏞 GAP, Karadeniz Turları",
    "🛖 Kars Çıkışlı Turlar",
    "🏘 Ani ve Çıldır Turu",
    "⛷️ Sarıkamış Kayak Turu",
  ],
  avatar: "/images/logo.png",
};
// Sitede en fazla 6 video, Instagram'ın üçlü ızgarası gibi iki satır.
const MAX_REELS = 6;
export function instagramHandle(profileUrl: string) {
  try {
    return new URL(profileUrl).pathname.split("/").filter(Boolean)[0] || "rotakarstur";
  } catch {
    return "rotakarstur";
  }
}
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
const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// Videolu kart: ekrana girince sessiz oynar, çıkınca durur; üstte hikâye ilerleme
// çubuğu. Ses aynı anda yalnız bir kartta açık olur. Hareket azaltmayı seçen
// ziyaretçi videoyu kendisi başlatır.
function VideoReel({
  post,
  soundOn,
  setSoundOn,
  onFail,
}: {
  post: InstagramPost;
  soundOn: boolean;
  setSoundOn: (on: boolean) => void;
  onFail: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null),
    bar = useRef<HTMLElement>(null),
    [paused, setPaused] = useState(true),
    [waiting, setWaiting] = useState(false),
    { t } = useLang();
  const play = () => {
    const el = video.current;
    if (!el) return;
    el.preload = "auto";
    el.play().catch(() => setPaused(true));
  };
  useEffect(() => {
    const el = video.current;
    if (!el || reducedMotion() || !("IntersectionObserver" in window)) return;
    const watcher = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? play() : el.pause()),
      { threshold: 0.5 },
    );
    watcher.observe(el);
    return () => watcher.disconnect();
  }, []);
  useEffect(() => {
    if (video.current) video.current.muted = !soundOn;
  }, [soundOn]);
  return (
    <>
      <video
        ref={video}
        src={post.videoSrc!}
        poster={post.cover || undefined}
        muted
        loop
        playsInline
        preload="none"
        aria-label={post.title}
        onClick={() => (video.current?.paused ? play() : video.current?.pause())}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (el.duration && bar.current)
            bar.current.style.transform = `scaleX(${el.currentTime / el.duration})`;
        }}
        onError={onFail}
      />
      <span className="ig-progress" aria-hidden="true">
        <i ref={bar} />
      </span>
      {waiting && !paused && (
        <span className="ig-buffering" aria-hidden="true">
          <LoaderCircle size={26} className="spin" />
        </span>
      )}
      {paused && (
        <button
          type="button"
          className="ig-play"
          onClick={play}
          aria-label={t("{title} videosunu izle", { title: post.title })}
        >
          <Play size={26} fill="currentColor" />
        </button>
      )}
      <button
        type="button"
        className="ig-sound"
        aria-pressed={soundOn}
        aria-label={soundOn ? t("Sesi kapat") : t("Sesi aç")}
        onClick={() => {
          setSoundOn(!soundOn);
          if (!soundOn && video.current?.paused) play();
        }}
      >
        {soundOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
      </button>
    </>
  );
}
// Video dosyası olmayan paylaşım: kapak görünür, ziyaretçi isteyince Instagram
// oynatıcısı kartın içinde açılır. Instagram kendiliğinden çağrılmaz.
function EmbedReel({ post }: { post: InstagramPost }) {
  const src = instagramEmbedUrl(post.permalink),
    [open, setOpen] = useState(false),
    [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading"),
    { t } = useLang();
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(
      () => setStatus((s) => (s === "loading" ? "unavailable" : s)),
      10000,
    );
    return () => clearTimeout(timer);
  }, [open]);
  if (open && src)
    return (
      <>
        <iframe
          src={src}
          title={post.title || t("Instagram gönderisi")}
          loading="lazy"
          allow="autoplay; encrypted-media; picture-in-picture; clipboard-write"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setStatus("ready")}
        />
        {status !== "ready" && (
          <p className="ig-status" role="status">
            {status === "loading" ? (
              <>
                <LoaderCircle size={17} className="spin" /> {t("Instagram yükleniyor…")}
              </>
            ) : (
              <>
                {t("Oynatıcı yüklenemedi.")}{" "}
                <a href={post.permalink} target="_blank" rel="noopener noreferrer">
                  {t("Instagram’da görüntüle")}
                </a>
              </>
            )}
          </p>
        )}
      </>
    );
  return (
    <>
      {post.cover && (
        <img
          {...responsive(post.cover, "(max-width: 640px) 84vw, 33vw")}
          alt=""
          loading="lazy"
          decoding="async"
        />
      )}
      {src && (
        <button
          type="button"
          className="ig-play"
          onClick={() => setOpen(true)}
          aria-label={t("{title} videosunu izle", { title: post.title })}
        >
          <Play size={26} fill="currentColor" />
        </button>
      )}
    </>
  );
}
function Reel({
  post,
  handle,
  soundOn,
  setSoundOn,
}: {
  post: InstagramPost;
  handle: string;
  soundOn: boolean;
  setSoundOn: (on: boolean) => void;
}) {
  const [videoFailed, setVideoFailed] = useState(false),
    { t } = useLang();
  return (
    <article className="ig-reel">
      <div className="ig-player">
        {post.videoSrc && !videoFailed ? (
          <VideoReel
            post={post}
            soundOn={soundOn}
            setSoundOn={setSoundOn}
            onFail={() => setVideoFailed(true)}
          />
        ) : (
          <EmbedReel post={post} />
        )}
      </div>
      <p className="ig-caption">
        <strong>{handle}</strong> {post.title}
      </p>
      <a
        className="ig-open"
        href={post.permalink}
        target="_blank"
        rel="noopener noreferrer"
      >
        {t("Instagram’da aç")} ↗
      </a>
    </article>
  );
}
export function InstagramSection({ profileUrl }: { profileUrl: string }) {
  const [posts, setPosts] = useState<InstagramPost[]>([]),
    // Ses aynı anda yalnız bir videoda açık olur.
    [soundId, setSoundId] = useState<string | null>(null),
    { t } = useLang(),
    handle = instagramHandle(profileUrl);
  useEffect(() => {
    let alive = true;
    api<{ posts: InstagramPost[] }>("/instagram")
      .then((r) => {
        if (alive) setPosts(r.posts.slice(0, MAX_REELS));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return (
    <section
      id="instagram"
      className="instagram-section ig-profile"
      aria-labelledby="ig-handle"
    >
      <div className="container">
        <div className="ig-head">
          <a
            className="ig-avatar"
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("Instagram’da {name}", { name: "Rota Kars Turizm" })}
          >
            <img src={PROFILE.avatar} alt="" width="96" height="96" loading="lazy" />
          </a>
          <div className="ig-meta">
            <div className="ig-row">
              <h2 id="ig-handle" className="ig-handle">
                {handle}
              </h2>
              <a
                className="ig-follow"
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("Takip et")}
              </a>
            </div>
            <p className="ig-name">{PROFILE.name}</p>
            <p className="ig-category">{t(PROFILE.category)}</p>
            <p className="ig-bio">
              {PROFILE.bio.map((line, i) => (
                <span key={i}>
                  {t(line)}
                  <br />
                </span>
              ))}
            </p>
          </div>
        </div>
        <div className="ig-tabs" aria-hidden="true">
          <span>
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <path d="M3 9h18M9 3l3 6M15 3l3 6M10 13v5l4-2.5z" />
            </svg>
            REELS
          </span>
        </div>
        {posts.length ? (
          <div className="ig-reels">
            {posts.map((post) => (
              <Reel
                key={post.id}
                post={post}
                handle={handle}
                soundOn={soundId === post.id}
                setSoundOn={(on) => setSoundId(on ? post.id : null)}
              />
            ))}
          </div>
        ) : (
          <div className="ig-empty">
            <p>{t("Rotalarımızdan videolar Instagram’da.")}</p>
            <a
              className="ig-follow"
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("Reels’leri keşfedin")}
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
