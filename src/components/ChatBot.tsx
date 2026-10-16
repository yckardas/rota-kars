import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Send, X, Sparkles } from "lucide-react";
import { post } from "../lib/api";
import { whatsappLink } from "../lib/whatsapp";

type Message = { role: "user" | "assistant"; content: string; handoff?: boolean };
type Reply = { text: string; handoff: boolean; provider: string };

const suggestions = [
  "Hangi turlar var?",
  "Ani ve Çıldır turu ne kadar?",
  "Koltuk düzeni nasıl?",
  "İptal koşulları neler?",
  "Araç kiralamak istiyorum",
];
const greeting: Message = {
  role: "assistant",
  content:
    "Merhaba! Ben Rota Kars asistanıyım. Turlar, fiyatlar, koltuk seçimi veya araç kiralama hakkında sorabilirsiniz.",
};

// "/turlar/ani-cildir" gibi site yollarını tıklanabilir bağlantıya çevirir.
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\/(?:turlar|rezervasyon|rezervasyonum|konaklama|iletisim)(?:\/[a-z0-9-]+)?)/g).map(
        (part, i) =>
          i % 2 ? (
            <Link key={i} to={part}>
              {part.startsWith("/rezervasyon/") ? "Koltuk seç" : part}
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
    [messages, setMessages] = useState<Message[]>([greeting]),
    [input, setInput] = useState(""),
    [busy, setBusy] = useState(false),
    listRef = useRef<HTMLDivElement>(null),
    inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, busy, open]);
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const f = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", f);
    return () => document.removeEventListener("keydown", f);
  }, [open]);

  async function send(text: string) {
    const content = text.trim().slice(0, 1200);
    if (!content || busy) return;
    const next: Message[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const history = next
        .filter((m, i) => i > 0 || m.role === "user")
        .slice(-20)
        .map(({ role, content }) => ({ role, content }));
      while (history[0]?.role !== "user") history.shift();
      const r = await post<Reply>("/chat", { messages: history });
      setMessages([...next, { role: "assistant", content: r.text, handoff: r.handoff }]);
    } catch {
      setMessages([
        ...next,
        {
          role: "assistant",
          content: "Şu an yanıt veremiyorum. WhatsApp'tan yazarsanız ekibimiz hemen dönüş yapar.",
          handoff: true,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }
  const lastQuestion = [...messages].reverse().find((m) => m.role === "user")?.content;
  const waText =
    "Merhaba, rotakarsturizm.com sitesinden yazıyorum." +
    (lastQuestion ? ` Sorum: ${lastQuestion}` : "");

  return (
    <div className={"chatbot " + (open ? "is-open" : "")}>
      {open && (
        <section className="chat-panel" role="dialog" aria-label="Rota Kars asistanı">
          <header className="chat-head">
            <span className="chat-avatar">
              <Sparkles size={18} />
            </span>
            <div>
              <strong>Rota Kars asistanı</strong>
              <small>Genelde anında yanıtlar</small>
            </div>
            <button className="icon-btn" aria-label="Sohbeti kapat" onClick={() => setOpen(false)}>
              <X size={18} />
            </button>
          </header>
          <div className="chat-messages" ref={listRef} aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={"chat-msg " + m.role}>
                <p>
                  <Rich text={m.content} />
                </p>
                {m.handoff && (
                  <a
                    className="chat-wa"
                    href={whatsappLink(whatsapp, waText)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <WhatsAppIcon /> WhatsApp'tan devam et
                  </a>
                )}
              </div>
            ))}
            {busy && (
              <div className="chat-msg assistant typing" aria-label="Yazıyor">
                <span />
                <span />
                <span />
              </div>
            )}
            {messages.length === 1 && (
              <div className="chat-suggestions">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <form className="chat-input" onSubmit={submit}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Sorunuzu yazın…"
              aria-label="Mesajınız"
              maxLength={1200}
            />
            <button className="chat-send" type="submit" aria-label="Gönder" disabled={busy || !input.trim()}>
              <Send size={17} />
            </button>
          </form>
          <a
            className="chat-wa-bar"
            href={whatsappLink(whatsapp, waText)}
            target="_blank"
            rel="noreferrer"
          >
            <WhatsAppIcon /> Bir temsilciyle WhatsApp'ta görüşün
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
          className="chat-fab"
          aria-label={open ? "Asistanı kapat" : "Asistanla sohbet et"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={24} /> : <MessageCircle size={24} />}
          {!open && <span className="chat-fab-label">Size nasıl yardımcı olabiliriz?</span>}
        </button>
      </div>
    </div>
  );
}

export function WhatsAppIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.62.71.23 1.36.2 1.87.12.57-.08 1.75-.71 2-1.4.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.56.93.95-3.47-.22-.36a9.4 9.4 0 0 1-1.44-5.01c0-5.2 4.24-9.43 9.44-9.43 2.52 0 4.89.98 6.67 2.77a9.37 9.37 0 0 1 2.76 6.67c0 5.2-4.23 9.43-9.45 9.43zm8.03-17.46A11.3 11.3 0 0 0 12.05.7C5.79.7.7 5.79.7 12.05c0 2 .52 3.95 1.52 5.67L.6 23.3l5.72-1.5a11.3 11.3 0 0 0 5.72 1.46h.01c6.26 0 11.35-5.1 11.35-11.36 0-3.03-1.18-5.88-3.32-8.02z" />
    </svg>
  );
}
