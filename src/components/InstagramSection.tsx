import { useEffect, useRef, useState } from "react";
import {
  Instagram,
  Play,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  X,
} from "lucide-react";
import { api } from "../lib/api";
export type InstagramPost = {
  id: string;
  title: string;
  permalink: string;
  cover: string;
  position: number;
  active: number;
  videoSrc?: string | null;
};
type InstagramWindow = Window & {
  instgrm?: { Embeds: { process: () => void } };
};
let embedPromise: Promise<void> | null = null;
function loadInstagram() {
  if ((window as InstagramWindow).instgrm) return Promise.resolve();
  if (embedPromise) return embedPromise;
  embedPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://www.instagram.com/embed.js";
    script.async = true;
    script.dataset.rotaInstagram = "true";
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      embedPromise = null;
      reject(new Error("Instagram yüklenemedi."));
    };
    document.head.append(script);
  });
  return embedPromise;
}
function InstagramEmbed({ post }: { post: InstagramPost }) {
  const host = useRef<HTMLDivElement>(null),
    [status, setStatus] = useState<"loading" | "ready" | "unavailable">(
      "loading",
    );
  useEffect(() => {
    let active = true;
    const el = host.current!,
      quote = document.createElement("blockquote");
    quote.className = "instagram-media";
    quote.dataset.instgrmPermalink = post.permalink;
    quote.dataset.instgrmVersion = "14";
    const anchor = document.createElement("a");
    anchor.href = post.permalink;
    anchor.textContent = "Instagram’da görüntüle";
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    quote.append(anchor);
    el.replaceChildren(quote);
    let frame: HTMLIFrameElement | null = null;
    const loaded = () => {
      if (active) setStatus("ready");
    };
    const observer = new MutationObserver(() => {
      const next = el.querySelector("iframe");
      if (next && next !== frame) {
        frame?.removeEventListener("load", loaded);
        frame = next;
        frame.addEventListener("load", loaded);
      }
    });
    observer.observe(el, { childList: true, subtree: true });
    const timer = setTimeout(() => {
      if (active)
        setStatus((current) =>
          current === "loading" ? "unavailable" : current,
        );
    }, 10000);
    loadInstagram()
      .then(() => {
        if (active) (window as InstagramWindow).instgrm?.Embeds.process();
      })
      .catch(() => {
        if (active) setStatus("unavailable");
      });
    return () => {
      active = false;
      observer.disconnect();
      frame?.removeEventListener("load", loaded);
      clearTimeout(timer);
    };
  }, [post]);
  return (
    <div className="instagram-inline-player">
      {status === "loading" && (
        <p className="instagram-player-status" role="status">
          <LoaderCircle size={17} className="spin" /> Instagram yükleniyor…
        </p>
      )}
      {status === "unavailable" && (
        <p className="instagram-player-status" role="status">
          Oynatıcı yüklenemedi. Alttaki Instagram bağlantısını kullanın.
        </p>
      )}
      <div className="instagram-embed-host" ref={host} />
    </div>
  );
}
function NativePreview({ post }: { post: InstagramPost }) {
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = video.current!;
    el.muted = true;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!reduced) el.play().catch(() => {});
    return () => {
      el.pause();
    };
  }, [post.videoSrc]);
  return failed ? (
    <p className="instagram-player-status" role="status">
      Video yüklenemedi. Instagram bağlantısından izleyebilirsiniz.
    </p>
  ) : (
    <video
      ref={video}
      src={post.videoSrc!}
      poster={post.cover}
      muted
      loop
      playsInline
      controls
      preload="none"
      aria-label={post.title}
      onError={() => setFailed(true)}
    />
  );
}
function InstagramCard({
  post,
  active,
  activate,
  deactivate,
}: {
  post: InstagramPost;
  active: boolean;
  activate: () => void;
  deactivate: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const card = useRef<HTMLElement>(null);
  const [pinned, setPinned] = useState(false);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  useEffect(() => () => clear(), []);
  useEffect(() => {
    if (!active) {
      setPinned(false);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) {
        setPinned(false);
        deactivate();
      }
    });
    observer.observe(card.current!);
    return () => observer.disconnect();
  }, [active, deactivate]);
  return (
    <article
      ref={card}
      className={"instagram-post" + (active ? " is-playing" : "")}
      onPointerEnter={(e) => {
        if (
          e.pointerType !== "mouse" ||
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
        )
          return;
        clear();
        timer.current = setTimeout(activate, 180);
      }}
      onPointerLeave={() => {
        clear();
        if (!pinned) deactivate();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          clear();
          setPinned(false);
          deactivate();
          card.current
            ?.querySelector<HTMLButtonElement>(".instagram-cover")
            ?.focus();
        }
      }}
    >
      <div className="instagram-card-media">
        <button
          className="instagram-cover"
          aria-expanded={active}
          aria-controls={`instagram-player-${post.id}`}
          onClick={() => {
            clear();
            setPinned(true);
            activate();
          }}
          aria-label={`${post.title} videosunu kartta aç`}
        >
          <img
            src={post.cover}
            alt="Rota arşivinden temsili video kapağı"
            loading="lazy"
          />
          <span className="instagram-reel-icon">
            <Instagram size={18} />
          </span>
          <span className="instagram-play">
            <Play size={22} fill="currentColor" />
          </span>
          <span className="instagram-post-title">
            {post.title}
            <small>
              {post.videoSrc
                ? "Üzerine gelin, sessiz izleyin"
                : "Kartta izlemek için üzerine gelin"}
            </small>
          </span>
        </button>
        {active && (
          <div
            className="instagram-card-player"
            id={`instagram-player-${post.id}`}
          >
            {post.videoSrc ? (
              <NativePreview post={post} />
            ) : (
              <InstagramEmbed post={post} />
            )}
            <button
              className="instagram-player-close"
              aria-label="Önizlemeyi kapat"
              onClick={() => {
                clear();
                setPinned(false);
                deactivate();
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>
      <div className="instagram-card-caption">
        <span>{post.title}</span>
        <a href={post.permalink} target="_blank" rel="noreferrer">
          Instagram’da izle <ExternalLink size={12} />
        </a>
      </div>
    </article>
  );
}
export function InstagramSection({ profileUrl }: { profileUrl: string }) {
  const [posts, setPosts] = useState<InstagramPost[]>([]),
    [selected, setSelected] = useState<string | null>(null),
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
              {posts.map((post) => (
                <InstagramCard
                  key={post.id}
                  post={post}
                  active={selected === post.id}
                  activate={() => setSelected(post.id)}
                  deactivate={() =>
                    setSelected((current) =>
                      current === post.id ? null : current,
                    )
                  }
                />
              ))}
            </div>
            <div className="instagram-rail-footer">
              <small>
                Önizleme için üzerine gelin veya dokunun. Instagram videolarında
                ▶ düğmesine basmanız gerekebilir. Kapaklar temsilidir.
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
    </section>
  );
}
