import { Armchair, CircleGauge, UserRound, Check } from "lucide-react";
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
  return (
    <div className="seat-map">
      <div className="vehicle-roof">
        <span>VIP</span>
        <span>Ön taraf</span>
      </div>
      <div className="vehicle-body">
        <div className="windshield" />
        <div className="seat-row cockpit">
          <div className="crew-seat">
            <CircleGauge size={26} />
            <span>Şoför</span>
          </div>
          <div className="cockpit-gap" />
          <button
            className="crew-seat guide"
            disabled
            aria-label="Rehber koltuğu, seçilemez"
          >
            <UserRound size={24} />
            <span>Rehber</span>
            <small>Ayrılmış</small>
          </button>
        </div>
        <div className="vehicle-divider">
          <span>Yolcu bölümü</span>
        </div>
        {[
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, null],
        ].map((row, i) => (
          <div className="seat-row passenger-row" key={i}>
            {row.map((n, j) =>
              n ? (
                <button
                  key={n}
                  disabled={
                    !interactive ||
                    seats.find((s) => s.number === n)?.status === "occupied"
                  }
                  onClick={() => onSelect?.(n)}
                  className={
                    "vehicle-seat " +
                    (selected.includes(n)
                      ? "selected "
                      : seats.find((s) => s.number === n)?.status === "occupied"
                        ? "occupied "
                        : "") +
                    (j === 2 ? "single" : "")
                  }
                  aria-label={`${n} numaralı koltuk${selected.includes(n) ? ", seçili" : seats.find((s) => s.number === n)?.status === "occupied" ? ", dolu" : ", boş"}`}
                  aria-pressed={selected.includes(n)}
                >
                  <Armchair size={31} strokeWidth={1.3} />
                  <span>{n}</span>
                  {selected.includes(n) && (
                    <Check size={12} className="seat-check" />
                  )}
                </button>
              ) : (
                <div key="empty" className="seat-empty" />
              ),
            )}
          </div>
        ))}
        <div className="vehicle-rear" />
      </div>
      <div className="seat-caption">
        {vehicle.passengerSeats}+{vehicle.driverSeats} VIP minibüs{" "}
        <span>8 misafir + 1 rehber + 1 şoför</span>
      </div>
    </div>
  );
}
