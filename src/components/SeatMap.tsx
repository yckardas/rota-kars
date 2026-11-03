import {
  Armchair,
  CircleGauge,
  UserRound,
  Check,
  DoorOpen,
} from "lucide-react";
import { useEffect, useRef, type CSSProperties } from "react";
import type { Seat, Vehicle } from "../lib/types";
// Ekranda görünen etkileşimli koltuk haritası sayısı: mobilde sohbet/WhatsApp
// düğmeleri koltukların üstüne binmesin diye gövdeye işaret konur.
let visibleMaps = 0;
const markVisible = (delta: number) => {
  visibleMaps = Math.max(0, visibleMaps + delta);
  if (visibleMaps) document.body.dataset.seatmapVisible = "true";
  else delete document.body.dataset.seatmapVisible;
};
export function SeatMap({
  vehicle,
  seats = [],
  selected = [],
  onSelect,
  interactive = true,
}: {
  vehicle: Vehicle;
  seats?: Seat[];
  selected?: number[];
  onSelect?: (n: number) => void;
  interactive?: boolean;
}) {
  const [cockpit, ...rows] = vehicle.layout,
    root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!interactive || !el || typeof IntersectionObserver === "undefined") return;
    let shown = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting !== shown) {
        shown = entry.isIntersecting;
        markVisible(shown ? 1 : -1);
      }
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (shown) markVisible(-1);
    };
  }, [interactive]);
  const status = (n: number) =>
    selected.includes(n)
      ? "selected"
      : seats.find((s) => s.number === n)?.status === "occupied"
        ? "occupied"
        : "available";
  const shape = vehicle.shape || "midibus",
    cols = cockpit.length;
  // Kapı iki sütun kaplıyorsa tek parça çizilir.
  const cells = (row: (string | number | null)[]) =>
    row.flatMap((cell, j) =>
      cell === "door" && row[j - 1] === "door"
        ? []
        : [{ cell, j, span: cell === "door" && row[j + 1] === "door" ? 2 : 1 }],
    );
  return (
    <div className={"seat-map shape-" + shape} ref={root}>
      <div className="vehicle-roof">
        <span>VIP</span>
        <span>Ön taraf</span>
      </div>
      {/* Araç değişince gövde yeniden kurulur: giriş animasyonu baştan oynar. */}
      <div
        className="vehicle-body"
        key={vehicle.id + (vehicle.unit?.id || "")}
        style={{ "--cols": cols } as CSSProperties}
      >
        <span className="vehicle-mirror left" aria-hidden="true" />
        <span className="vehicle-mirror right" aria-hidden="true" />
        <span className="vehicle-wheel front left" aria-hidden="true" />
        <span className="vehicle-wheel front right" aria-hidden="true" />
        <span className="vehicle-wheel rear left" aria-hidden="true" />
        <span className="vehicle-wheel rear right" aria-hidden="true" />
        <div className="windshield" />
        <div
          className="seat-row cockpit"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {cockpit.map((cell, i) =>
            cell === "driver" ? (
              <div className="crew-seat driver" key={i}>
                <CircleGauge size={24} />
                <i className="steering" aria-hidden="true" />
                <span>Şoför</span>
              </div>
            ) : cell === "guide" ? (
              <button
                type="button"
                key={i}
                className="crew-seat guide"
                disabled
                aria-label="Rehber koltuğu, seçilemez"
              >
                <UserRound size={22} />
                <span>Rehber</span>
                <small>Ayrılmış</small>
              </button>
            ) : (
              <div key={i} className="cockpit-gap" />
            ),
          )}
        </div>
        <div className="vehicle-divider">
          <span>Yolcu bölümü</span>
        </div>
        {rows.map((row, i) => (
          <div
            className="seat-row passenger-row"
            key={i}
            style={
              {
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                "--row": i,
              } as CSSProperties
            }
          >
            {cells(row).map(({ cell, j, span }) => {
              if (typeof cell !== "number")
                return cell === "door" ? (
                  <div
                    key={"x" + j}
                    className="seat-door"
                    aria-label="Kapı"
                    style={span > 1 ? { gridColumn: "span 2" } : undefined}
                  >
                    <DoorOpen size={18} strokeWidth={1.4} />
                    <small>Kapı</small>
                  </div>
                ) : (
                  <div key={"x" + j} className="seat-empty" />
                );
              const st = status(cell);
              return (
                <button
                  type="button"
                  key={"s" + cell}
                  disabled={!interactive || st === "occupied"}
                  onClick={() => onSelect?.(cell)}
                  className={"vehicle-seat " + (st !== "available" ? st : "")}
                  aria-label={`${cell} numaralı koltuk, ${st === "selected" ? "seçili" : st === "occupied" ? "dolu" : "boş"}`}
                  aria-pressed={st === "selected"}
                >
                  <Armchair size={26} strokeWidth={1.3} />
                  <span>{cell}</span>
                  {st === "selected" && (
                    <Check size={12} className="seat-check" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
        <div className="vehicle-rear" />
      </div>
      <div className="seat-caption">
        {vehicle.passengerSeats}+{vehicle.driverSeats} ·{" "}
        {vehicle.unit
          ? `${vehicle.unit.name} (${vehicle.unit.year})`
          : vehicle.name}{" "}
        <span>
          {vehicle.sellableSeats} misafir + {vehicle.guideSeats} rehber +{" "}
          {vehicle.driverSeats} şoför
        </span>
      </div>
    </div>
  );
}
