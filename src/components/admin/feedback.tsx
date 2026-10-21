import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, TriangleAlert, X } from "lucide-react";
// Panel genelinde tek bildirim (toast) ve onay penceresi.
// Bileşenler kendi hata/başarı paragraflarını tutmak yerine bunları kullanır.
type Toast = { id: number; kind: "ok" | "error"; text: string };
type ConfirmOptions = {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
};
type Feedback = {
  ok: (text: string) => void;
  error: (e: unknown) => void;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
};
const noop: Feedback = {
  ok: () => {},
  error: () => {},
  confirm: async (o) => window.confirm(o.title),
};
const Ctx = createContext<Feedback>(noop);
export const useFeedback = () => useContext(Ctx);
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]),
    [ask, setAsk] = useState<
      (ConfirmOptions & { resolve: (v: boolean) => void }) | null
    >(null),
    next = useRef(0),
    stack = useRef<HTMLDivElement>(null);
  // Açık bir <dialog> üst katmandadır; bildirimler popover olarak her seferinde onun üstüne alınır.
  useEffect(() => {
    const el = stack.current as
      | (HTMLDivElement & {
          showPopover?: () => void;
          hidePopover?: () => void;
        })
      | null;
    if (!el?.showPopover) return;
    try {
      if (el.matches(":popover-open")) el.hidePopover!();
      if (toasts.length) el.showPopover();
    } catch {}
  }, [toasts, ask]);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++next.current;
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      kind === "error" ? 7000 : 3500,
    );
  }, []);
  const api = useRef<Feedback>({
    ok: (text) => push("ok", text),
    error: (e) =>
      push(
        "error",
        e instanceof Error ? e.message : String(e || "İşlem tamamlanamadı."),
      ),
    confirm: (o) =>
      new Promise<boolean>((resolve) => setAsk({ ...o, resolve })),
  });
  const answer = (v: boolean) => {
    ask?.resolve(v);
    setAsk(null);
  };
  return (
    <Ctx.Provider value={api.current}>
      {children}
      <div
        className="toast-stack"
        aria-live="polite"
        ref={stack}
        {...{ popover: "manual" }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={"toast " + t.kind}
            role={t.kind === "error" ? "alert" : "status"}
          >
            {t.kind === "ok" ? (
              <Check size={17} />
            ) : (
              <TriangleAlert size={17} />
            )}
            <span>{t.text}</span>
            <button
              aria-label="Kapat"
              onClick={() =>
                setToasts((all) => all.filter((x) => x.id !== t.id))
              }
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
      {ask && <ConfirmDialog options={ask} answer={answer} />}
    </Ctx.Provider>
  );
}
function ConfirmDialog({
  options: o,
  answer,
}: {
  options: ConfirmOptions;
  answer: (v: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!,
      previous = document.activeElement as HTMLElement | null;
    el.showModal();
    const cancel = (e: Event) => {
      e.preventDefault();
      answer(false);
    };
    el.addEventListener("cancel", cancel);
    return () => {
      el.removeEventListener("cancel", cancel);
      el.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog ref={ref} className="modal confirm-dialog" aria-label={o.title}>
      <h2>{o.title}</h2>
      {o.body && <div className="muted">{o.body}</div>}
      <div className="button-row">
        <button
          className={"btn" + (o.danger ? " btn-danger" : "")}
          autoFocus
          onClick={() => answer(true)}
        >
          {o.confirmLabel || "Onayla"}
        </button>
        <button className="btn btn-outline" onClick={() => answer(false)}>
          Vazgeç
        </button>
      </div>
    </dialog>
  );
}
