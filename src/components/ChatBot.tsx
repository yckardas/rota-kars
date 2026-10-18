import { useEffect, useRef, useState, type FormEvent } from "react";
import { responsive } from "../lib/images";
import { Link, useLocation } from "react-router-dom";
import {
  MessageCircle,
  Send,
  X,
  Sparkles,
  RotateCcw,
  ArrowUpRight,
  Clock3,
} from "lucide-react";
import { api } from "../lib/api";
import { whatsappLink } from "../lib/whatsapp";
import { currency } from "../lib/types";
type Action = {
  kind: "link" | "prompt";
  label: string;
  href?: string;
  prompt?: string;
};
type Card = {
  id: string;
  name: string;
  image: string;
  price: number;
  duration: string;
  href: string;
};
type Message = {
  role: "user" | "assistant";
  content: string;
  handoff?: boolean;
  actions?: Action[];
  suggestions?: Action[];
  cards?: Card[];
  failed?: boolean;
  consentNeeded?: boolean;
};
type Reply = {
  text: string;
  handoff: boolean;
  provider: string;
  actions: Action[];
  suggestions: Action[];
  cards: Card[];
  consentNeeded?: boolean;
};
const CONSENT_KEY = "rota-chat-abroad-consent";
function readConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}
function writeConsent(value: boolean) {
  try {
    if (value) localStorage.setItem(CONSENT_KEY, "1");
    else localStorage.removeItem(CONSENT_KEY);
  } catch {}
}
const STORAGE = "rota-chat-session-v2";
const greeting: Message = {
  role: "assistant",
  content:
    "Merhaba! Kars yolculuğunuzu birlikte planlayalım. Tur seçimi, program, kişi sayısına göre örnek fiyat veya konaklama konusunda yardımcı olabilirim.",
};
const suggestions = [
  "Hangi turlar var?",
  "Ani turu için 2 kişi ne kadar?",
  "Koltuk düzeni nasıl?",
  "Konaklama istiyorum",
];
function readSession(): Message[] {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE) || "null");
    if (
      Array.isArray(value) &&
      value.length &&
      value.every(
        (m) =>
          ["user", "assistant"].includes(m.role) &&
          typeof m.content === "string",
      )
    ) {
      const restored: Message[] = value.slice(-30);
      if (restored.at(-1)?.role === "user")
        restored.push({
          role: "assistant",
          content:
            "Sayfa yenilendiği için yanıt tamamlanamadı. Sorunuzu yeniden gönderebilirsiniz.",
          suggestions: [
            {
              kind: "prompt",
              label: "Yeniden dene",
              prompt: restored.at(-1)!.content,
            },
          ],
        });
      return restored;
    }
  } catch {}
  return [greeting];
}
// Single source for internal links the assistant may render as clickable.
const LINK_SOURCE =
  "\\/(?:rezervasyonum|rezervasyon|turlar|konaklama|iletisim|hakkimizda|uyelik|hesabim|hizmetler)(?:\\/[a-z0-9-]+)?(?![a-z0-9/-])|\\/bilgilendirme(?:#iptal|#kvkk|#haklar)?(?![a-z0-9-])|\\/#(?:yorumlar|instagram|hizmetler)(?![a-z0-9-])";
const LINK_EXACT = new RegExp("^(?:" + LINK_SOURCE + ")$");
const LINK_SPLIT = new RegExp("(" + LINK_SOURCE + ")", "g");
function safeLink(href?: string) {
  return Boolean(href && LINK_EXACT.test(href));
}
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(LINK_SPLIT).map((part, i) =>
        i % 2 && safeLink(part) ? (
          <Link key={i} to={part}>
            {part.startsWith("/rezervasyon/")
              ? "Koltuk seç"
              : "İlgili sayfayı aç"}
          </Link>
        ) : (
          part
        ),
      )}
    </>
  );
}
export function ChatBot({ whatsapp }: { whatsapp: string }) {
  const [open, setOpen] = useState(false),
    [messages, setMessages] = useState<Message[]>(readSession),
    [input, setInput] = useState(""),
    [busy, setBusy] = useState(false),
    [abroadConsent, setAbroadConsent] = useState(readConsent),
    listRef = useRef<HTMLDivElement>(null),
    inputRef = useRef<HTMLInputElement>(null),
    launcher = useRef<HTMLButtonElement>(null),
    controller = useRef<AbortController | null>(null),
    version = useRef(0),
    location = useLocation();
  const pageTourId = location.pathname.match(
    /^\/(?:turlar|rezervasyon)\/([a-z0-9-]+)$/,
  )?.[1];
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, busy, open]);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE, JSON.stringify(messages.slice(-30)));
    } catch {}
  }, [messages]);
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        launcher.current?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [open]);
  useEffect(
    () => () => {
      version.current++;
      controller.current?.abort();
    },
    [],
  );
  function reset() {
    version.current++;
    controller.current?.abort();
    setMessages([greeting]);
    setBusy(false);
    setInput("");
    inputRef.current?.focus();
  }
  async function send(text: string) {
    const content = text.trim().slice(0, 1200);
    if (!content || busy) return;
    const next: Message[] = [...messages, { role: "user", content }];
    setInput("");
    await ask(next, abroadConsent);
  }
  // Yurt dışı aktarım onayı verildiğinde son soru, onay bilgisiyle yeniden sorulur.
  function approveAbroad() {
    if (busy) return;
    writeConsent(true);
    setAbroadConsent(true);
    let last = messages.length - 1;
    while (last >= 0 && messages[last].role !== "user") last--;
    if (last < 0) return;
    ask(messages.slice(0, last + 1), true);
  }
  async function ask(next: Message[], consent: boolean) {
    const content = next.at(-1)!.content;
    setMessages(next);
    setBusy(true);
    const id = ++version.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const timer = setTimeout(() => abort.abort(), 22000);
    try {
      let history = next
        .filter((m, i) => i > 0 || m.role === "user")
        .slice(-16)
        .map(({ role, content }) => ({
          role,
          content: content.slice(0, 4000),
        }));
      while (history[0]?.role !== "user") history.shift();
      while (history.reduce((n, m) => n + m.content.length, 0) > 12000) {
        history = history.slice(2);
        while (history[0]?.role !== "user") history.shift();
      }
      const r = await api<Reply>("/chat", {
        method: "POST",
        signal: abort.signal,
        body: JSON.stringify({
          messages: history,
          ...(consent ? { abroadConsent: true } : {}),
          ...(pageTourId ? { context: { tourId: pageTourId } } : {}),
        }),
      });
      if (id !== version.current) return;
      setMessages([
        ...next,
        {
          role: "assistant",
          content: r.text,
          handoff: r.handoff,
          actions: r.actions,
          suggestions: r.suggestions,
          cards: r.cards,
          consentNeeded: r.consentNeeded,
        },
      ]);
    } catch (e) {
      if (id !== version.current) return;
      setMessages([
        ...next,
        {
          role: "assistant",
          content: abort.signal.aborted
            ? "Yanıt biraz uzun sürdü. Yeniden deneyebilir veya ekibimize WhatsApp’tan ulaşabilirsiniz."
            : (e as Error).message ||
              "Bağlantı kurulamadı. Yeniden deneyebilirsiniz.",
          handoff: true,
          failed: true,
          suggestions: [
            { kind: "prompt", label: "Yeniden dene", prompt: content },
          ],
        },
      ]);
    } finally {
      clearTimeout(timer);
      if (id === version.current) setBusy(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }
  const lastQuestion = [...messages]
      .reverse()
      .find((m) => m.role === "user")?.content,
    waText =
      "Merhaba, Rota Kars web sitesinden yazıyorum." +
      (lastQuestion ? ` Sorum: ${lastQuestion}` : ""),
    lastAssistant =
      messages.at(-1)?.role === "assistant" ? messages.at(-1) : null;
  function renderAction(a: Action, i: number) {
    return a.kind === "link" && safeLink(a.href) ? (
      <Link
        key={i}
        to={a.href!}
        className="chat-action"
        onClick={() => setOpen(false)}
      >
        {a.label}
        <ArrowUpRight size={12} />
      </Link>
    ) : a.kind === "prompt" && a.prompt ? (
      <button key={i} disabled={busy} onClick={() => send(a.prompt!)}>
        {a.label}
      </button>
    ) : null;
  }
  return (
    <div className={"chatbot " + (open ? "is-open" : "")}>
      {open && (
        <section
          className="chat-panel"
          role="dialog"
          aria-label="Rota Kars asistanı"
        >
          <header className="chat-head">
            <span className="chat-avatar">
              <Sparkles size={18} />
            </span>
            <div>
              <strong>Rota Kars asistanı</strong>
              <small>Yolculuğunuzu birlikte planlayalım</small>
            </div>
            <div className="chat-head-actions">
              <button
                className="icon-btn"
                aria-label="Yeni sohbet başlat"
                onClick={reset}
              >
                <RotateCcw size={16} />
              </button>
              <button
                className="icon-btn"
                aria-label="Sohbeti kapat"
                onClick={() => {
                  setOpen(false);
                  launcher.current?.focus();
                }}
              >
                <X size={18} />
              </button>
            </div>
          </header>
          {pageTourId && (
            <div className="chat-page-context">
              <Clock3 size={12} />
              Bu tur sayfasını dikkate alıyorum.
              <button
                disabled={busy}
                onClick={() => send("Bu turun programı nasıl?")}
              >
                Programı sor
              </button>
            </div>
          )}
          <div
            className="chat-messages"
            ref={listRef}
            role="log"
            aria-live="polite"
            aria-label="Sohbet geçmişi"
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  "chat-msg " + m.role + (m.failed ? " chat-failed" : "")
                }
              >
                <p>
                  <Rich text={m.content} />
                </p>
                {Boolean(m.cards?.length) && (
                  <div className="chat-tour-cards">
                    {m.cards!.map((c) => (
                      <Link
                        key={c.id}
                        to={c.href}
                        onClick={() => setOpen(false)}
                        className="chat-tour-card"
                      >
                        <img
                          {...responsive(c.image, "120px")}
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
                        <span>
                          <strong>{c.name}</strong>
                          <small>{c.duration}</small>
                          <b>
                            {currency(c.price)}
                            <em> kişi başı</em>
                          </b>
                        </span>
                        <ArrowUpRight size={14} />
                      </Link>
                    ))}
                  </div>
                )}
                {Boolean(m.actions?.length) && (
                  <div className="chat-actions">
                    {m.actions!.map(renderAction)}
                  </div>
                )}
                {m.consentNeeded && !abroadConsent && (
                  <div className="chat-consent" role="note">
                    <p>
                      Bu soruyu yapay zekâ asistanımız (Anthropic, ABD)
                      yanıtlayabilir. Bunun için mesajınızın yurt dışına
                      aktarılmasına onay vermeniz gerekir.{" "}
                      <Link
                        to="/bilgilendirme#kvkk"
                        onClick={() => setOpen(false)}
                      >
                        Ayrıntılar
                      </Link>
                    </p>
                    <div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={approveAbroad}
                      >
                        Onaylıyorum
                      </button>
                      <a
                        href={whatsappLink(whatsapp, waText)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <WhatsAppIcon size={14} />
                        WhatsApp’tan sorayım
                      </a>
                    </div>
                  </div>
                )}
                {m.handoff && (
                  <a
                    className="chat-wa"
                    href={whatsappLink(whatsapp, waText)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <WhatsAppIcon />
                    Ekibimizle görüşün
                  </a>
                )}
              </div>
            ))}
            {busy && (
              <div
                className="chat-msg assistant typing"
                role="status"
                aria-label="Yanıt hazırlanıyor"
              >
                <span />
                <span />
                <span />
              </div>
            )}
            {!busy && (
              <div className="chat-suggestions">
                {messages.length === 1
                  ? (pageTourId
                      ? [
                          "Bu turun programı nasıl?",
                          "Fiyata neler dahil?",
                          "2 kişi için toplam ne kadar?",
                          "İptal nasıl yapılır?",
                        ]
                      : suggestions
                    ).map((s) => (
                      <button key={s} onClick={() => send(s)}>
                        {s}
                      </button>
                    ))
                  : lastAssistant?.suggestions?.map(renderAction)}
              </div>
            )}
          </div>
          <form className="chat-input" onSubmit={submit}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Yolculuğunuzla ilgili sorun…"
              aria-label="Mesajınız"
              maxLength={1200}
            />
            <button
              className="chat-send"
              type="submit"
              aria-label="Gönder"
              disabled={busy || !input.trim()}
            >
              <Send size={17} />
            </button>
          </form>
          <small className="chat-privacy">
            Kimlik ve kart bilgisi paylaşmayın. Fiyatlar acente teyidine
            tabidir.
            {abroadConsent && (
              <>
                {" "}
                <button
                  type="button"
                  className="chat-consent-revoke"
                  onClick={() => {
                    writeConsent(false);
                    setAbroadConsent(false);
                  }}
                >
                  Onayı geri al
                </button>
              </>
            )}
          </small>
          <a
            className="chat-wa-bar"
            href={whatsappLink(whatsapp, waText)}
            target="_blank"
            rel="noreferrer"
          >
            <WhatsAppIcon />
            Bir temsilciyle WhatsApp’ta görüşün
          </a>
        </section>
      )}
      <div className="chat-launchers">
        <a
          className="wa-fab"
          href={whatsappLink(whatsapp, waText)}
          target="_blank"
          rel="noreferrer"
          aria-label="WhatsApp ile yazın"
        >
          <WhatsAppIcon size={26} />
        </a>
        <button
          ref={launcher}
          className="chat-fab"
          aria-label={open ? "Asistanı kapat" : "Asistanla sohbet et"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={24} /> : <MessageCircle size={24} />}{" "}
          {!open && (
            <span className="chat-fab-label">
              Yolculuğunuzu birlikte planlayalım
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
export function WhatsAppIcon({ size = 17 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.62.71.23 1.36.2 1.87.12.57-.08 1.75-.71 2-1.4.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.56.93.95-3.47-.22-.36a9.4 9.4 0 0 1-1.44-5.01c0-5.2 4.24-9.43 9.44-9.43 2.52 0 4.89.98 6.67 2.77a9.37 9.37 0 0 1 2.76 6.67c0 5.2-4.23 9.43-9.45 9.43zm8.03-17.46A11.3 11.3 0 0 0 12.05.7C5.79.7.7 5.79.7 12.05c0 2 .52 3.95 1.52 5.67L.6 23.3l5.72-1.5a11.3 11.3 0 0 0 5.72 1.46h.01c6.26 0 11.35-5.1 11.35-11.36 0-3.03-1.18-5.88-3.32-8.02z" />
    </svg>
  );
}
