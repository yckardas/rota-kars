import {
  Armchair,
  CircleGauge,
  UserRound,
  Check,
  DoorOpen,
} from "lucide-react";
import type { Seat, Vehicle } from "../lib/types";
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
  const [cockpit, ...rows] = vehicle.layout;
  const status = (n: number) =>
    selected.includes(n)
      ? "selected"
      : seats.find((s) => s.number === n)?.status === "occupied"
        ? "occupied"
        : "available";
  return (
    <div className="seat-map">
      <div className="vehicle-roof">
        <span>VIP</span>
        <span>Ön taraf</span>
      </div>
      <div className="vehicle-body">
        <div className="windshield" />
        <div
          className="seat-row cockpit"
          style={{ gridTemplateColumns: `repeat(${cockpit.length}, 1fr)` }}
        >
          {cockpit.map((cell, i) =>
            cell === "driver" ? (
              <div className="crew-seat" key={i}>
                <CircleGauge size={24} />
                <span>Şoför</span>
              </div>
            ) : cell === "guide" ? (
              <button
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
            style={{ gridTemplateColumns: `repeat(${cockpit.length}, 1fr)` }}
          >
            {row.map((cell, j) => {
              if (typeof cell !== "number")
                return cell === "door" ? (
                  <div key={"x" + j} className="seat-door" aria-label="Kapı">
                    <DoorOpen size={18} strokeWidth={1.4} />
                    <small>Kapı</small>
                  </div>
                ) : (
                  <div key={"x" + j} className="seat-empty" />
                );
              const st = status(cell);
              return (
                <button
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
        {vehicle.passengerSeats}+{vehicle.driverSeats} · {vehicle.name}{" "}
        <span>
          {vehicle.sellableSeats} misafir + {vehicle.guideSeats} rehber +{" "}
          {vehicle.driverSeats} şoför
        </span>
      </div>
    </div>
  );
}
