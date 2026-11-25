import { useMemo, useState } from "react";
import { groupSizes, soldSeats, vehicleTag } from "./vehicleGroup";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { today, type Catalog, type Departure } from "../../lib/types";

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const DAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
// Tur renkleri: 16 tur yan yana ayırt edilebilsin diye ton, açıklık ve doygunluk
// birbirinden uzak seçildi (ilk ikisi Ani taşının tüf ve okr rengi).
const COLORS = [
  "#7A5C43", "#C8871A", "#2E7D4F", "#2B5C8A", "#A23B5A", "#6E7F1E", "#1F8A8A", "#7B4FA0",
  "#C4502E", "#4A4A4A", "#3E8ED0", "#D1A400", "#8C6D9E", "#5B8C3A", "#B5654A", "#1C4E4E",
];
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
    for (const list of map.values())
      list.sort((a, b) => a.start_time.localeCompare(b.start_time) || (a.vehicle_no || 1) - (b.vehicle_no || 1));
    return map;
  }, [items]);
  const sizes = useMemo(() => groupSizes(items), [items]);
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
                  title={`${short(d.tour_id)} · ${d.start_time}${vehicleTag(d, sizes) ? " · " + vehicleTag(d, sizes) : ""} · ${d.available} boş koltuk${d.active ? "" : " · satışa kapalı"}`}
                >
                  <span className="chip-line">
                    <i className="tour-stone" style={{ background: color(d.tour_id) }} aria-hidden="true" />
                    <strong>{d.start_time}</strong> <span className="chip-name">{short(d.tour_id)}</span>
                    {vehicleTag(d, sizes) && <span className="chip-vehicle">{d.vehicle_no}. araç</span>}
                    {d.demand && <span className="chip-vehicle chip-demand">Talep</span>}
                    {!d.active && <span className="chip-vehicle chip-closed">Kapalı</span>}
                  </span>
                  {/* Doluluk okunur sayıyla: satılan / satılabilir koltuk. */}
                  <span className="chip-load">
                    <span className="chip-load-bar" aria-hidden="true">
                      <span style={{ width: (d.vehicle?.sellableSeats ? Math.min(100, (soldSeats(d) / d.vehicle.sellableSeats) * 100) : 0) + "%" }} />
                    </span>
                    <span>{d.available === 0 ? "Dolu" : `${soldSeats(d)}/${d.vehicle?.sellableSeats || 0}`}</span>
                  </span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <ul className="calendar-legend calendar-states" aria-label="Takvim işaretleri">
        <li>
          <strong>3/18</strong> satılan / satılabilir koltuk
        </li>
        <li>
          <span className="chip-vehicle chip-closed">Kapalı</span> online satışa kapalı sefer
        </li>
        <li>
          <span className="chip-vehicle chip-demand">Talep</span> ön kayıt toplanıyor, henüz satışta değil
        </li>
        <li>
          <strong className="legend-full">Dolu</strong> boş koltuk kalmadı
        </li>
        <li>Soluk günler geçmiş tarihtir.</li>
      </ul>
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
