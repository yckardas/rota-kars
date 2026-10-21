import { useEffect, useRef, useState, type ComponentType } from "react";
import { ClipboardList, Search, Ticket } from "lucide-react";
import { api } from "../../lib/api";
import { dateLabel, type Reservation } from "../../lib/types";
import type { RequestRecord } from "./RequestManager";

type Item = {
  key: string;
  icon: ComponentType<{ size?: number }>;
  title: string;
  hint: string;
  run: () => void;
};
// Ctrl+K / ⌘K: sekmeye geç, rezervasyon veya talep bul.
export function CommandPalette({
  tabs,
  canSearch,
  onTab,
  onReservation,
  onRequests,
  onClose,
}: {
  tabs: {
    id: string;
    label: string;
    icon: ComponentType<{ size?: number }>;
    group: string;
  }[];
  canSearch: boolean;
  onTab: (id: string) => void;
  onReservation: (ref: string) => void;
  onRequests: (q: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    [q, setQ] = useState(""),
    [active, setActive] = useState(0),
    [reservations, setReservations] = useState<Reservation[]>([]),
    [requests, setRequests] = useState<RequestRecord[] | null>(null),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    const cancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener("cancel", cancel);
    return () => {
      el.removeEventListener("cancel", cancel);
      el.close();
    };
  }, []);
  // Talepler küçük bir liste: ilk aramada bir kez alınır, tarayıcıda süzülür.
  useEffect(() => {
    const text = q.trim();
    if (!canSearch || text.length < 2) {
      setReservations([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      api<Reservation[]>("/admin/reservations?q=" + encodeURIComponent(text))
        .then((rows) => setReservations(rows.slice(0, 6)))
        .catch(() => setReservations([]))
        .finally(() => setLoading(false));
      if (!requests)
        api<{ requests: RequestRecord[] }>("/admin/dashboard")
          .then((d) => setRequests(d.requests))
          .catch(() => setRequests([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const norm = (s: string) => s.toLocaleLowerCase("tr-TR");
  const text = norm(q.trim());
  const items: Item[] = [
    ...tabs
      .filter(
        (t) =>
          !text || norm(t.label).includes(text) || norm(t.group).includes(text),
      )
      .map((t) => ({
        key: "tab:" + t.id,
        icon: t.icon,
        title: t.label,
        hint: t.group,
        run: () => onTab(t.id),
      })),
    ...reservations.map((r) => ({
      key: "res:" + r.reference,
      icon: Ticket,
      title: `${r.reference} · ${r.name}`,
      hint: `Rezervasyon · ${dateLabel(r.date)} · ${r.phone}`,
      run: () => onReservation(r.reference),
    })),
    ...(text.length >= 2 && requests
      ? requests
          .filter((r) => norm(JSON.stringify(r.body)).includes(text))
          .slice(0, 5)
          .map((r) => ({
            key: "req:" + r.id,
            icon: ClipboardList,
            title: String(r.body.name || r.body.email || "Talep"),
            hint: "Gelen talep · " + String(r.body.phone || r.body.email || ""),
            run: () => onRequests(q.trim()),
          }))
      : []),
  ];
  const current = Math.min(active, Math.max(items.length - 1, 0));
  return (
    <dialog
      ref={ref}
      className="modal command-palette"
      aria-label="Hızlı arama"
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <label className="command-input">
        <Search size={18} />
        <input
          autoFocus
          value={q}
          placeholder={
            canSearch
              ? "Sekme, referans, müşteri adı veya telefon…"
              : "Sekme ara…"
          }
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && items[current]) {
              e.preventDefault();
              items[current].run();
            }
          }}
          aria-controls="command-results"
          aria-activedescendant={items[current] ? "cmd-" + current : undefined}
        />
        <kbd>Esc</kbd>
      </label>
      <ul id="command-results" role="listbox">
        {items.map((item, i) => (
          <li
            key={item.key}
            id={"cmd-" + i}
            role="option"
            aria-selected={i === current}
            className={i === current ? "active" : ""}
            onMouseEnter={() => setActive(i)}
            onClick={item.run}
          >
            <item.icon size={17} />
            <span>
              <strong>{item.title}</strong>
              <small>{item.hint}</small>
            </span>
          </li>
        ))}
        {!items.length && (
          <li className="command-empty">
            {loading ? "Aranıyor…" : "Sonuç bulunamadı."}
          </li>
        )}
      </ul>
    </dialog>
  );
}
