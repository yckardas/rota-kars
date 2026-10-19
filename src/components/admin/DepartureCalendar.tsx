import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { today, type Catalog, type Departure } from "../../lib/types";

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const DAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const COLORS = ["#2f6b8f", "#a8642a", "#3f8a52", "#7a4f9a", "#b5462f", "#5f6b2a", "#2a7a78"];
const ymd = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// Seferlerin ay takvimi: her günde saat, tur ve boş koltuk; dokununca düzenleme.
export function DepartureCalendar({
  items,
  catalog,
  onPick,
}: {
  items: Departure[];
  catalog: Catalog;
  onPick: (d: Departure) => void;
}) {
  const now = today(),
    [cursor, setCursor] = useState(() => ({ y: Number(now.slice(0, 4)), m: Number(now.slice(5, 7)) - 1 }));
  const byDate = useMemo(() => {
    const map = new Map<string, Departure[]>();
    for (const d of items) map.set(d.date, [...(map.get(d.date) || []), d]);
    for (const list of map.values()) list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    return map;
  }, [items]);
  const first = new Date(Date.UTC(cursor.y, cursor.m, 1)),
    offset = (first.getUTCDay() + 6) % 7,
    days = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate(),
    cells = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const shift = (n: number) =>
    setCursor(({ y, m }) => {
      const t = new Date(Date.UTC(y, m + n, 1));
      return { y: t.getUTCFullYear(), m: t.getUTCMonth() };
    });
  const short = (id: string) => catalog.tours.find((t) => t.id === id)?.name.split(/[,·]/)[0] || id;
  const color = (id: string) => COLORS[Math.max(0, catalog.tours.findIndex((t) => t.id === id)) % COLORS.length];
  const shown = catalog.tours.filter((t) => items.some((d) => d.tour_id === t.id));
  return (
    <div className="departure-calendar">
      <div className="calendar-head">
        <button type="button" className="icon-btn" aria-label="Önceki ay" onClick={() => shift(-1)}>
          <ChevronLeft size={18} />
        </button>
        <h3>
          {MONTHS[cursor.m]} {cursor.y}
        </h3>
        <button type="button" className="icon-btn" aria-label="Sonraki ay" onClick={() => shift(1)}>
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="calendar-grid" role="grid">
        {DAYS.map((d) => (
          <span key={d} className="calendar-dow" role="columnheader">
            {d}
          </span>
        ))}
        {cells.map((day, i) => {
          if (!day) return <span key={"e" + i} className="calendar-cell empty" />;
          const date = ymd(cursor.y, cursor.m, day),
            list = byDate.get(date) || [];
          return (
            <div key={date} className={"calendar-cell" + (date === now ? " today" : "") + (date < now ? " past" : "")} role="gridcell">
              <span className="calendar-day">{day}</span>
              {list.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={"calendar-chip" + (d.active ? "" : " closed") + (d.available === 0 ? " full" : "")}
                  onClick={() => onPick(d)}
                  style={{ borderLeftColor: color(d.tour_id) }}
                  title={`${short(d.tour_id)} · ${d.start_time} · ${d.available} boş koltuk`}
                >
                  <strong>{d.start_time}</strong> <span className="chip-name">{short(d.tour_id)}</span>
                  <small>{d.available === 0 ? "dolu" : d.available + " boş"}</small>
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <ul className="calendar-legend">
        {shown.map((t) => (
          <li key={t.id}>
            <span style={{ background: color(t.id) }} aria-hidden="true" />
            {t.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
