import type { CSSProperties } from "react";
import { CircleCheck, QrCode, Users } from "lucide-react";
import type { Catalog, Departure } from "../../lib/types";
import { groupSizes, groupedOrder, vehicleTag } from "./vehicleGroup";

export type BoardingDeparture = Departure & {
  confirmedGuests: number;
  boardedGuests: number;
};

// Günlük operasyon, bugün: her sefer için biniş kartı. Rehber o seferin biletlerini
// okutur, kaç yolcunun bindiğini ve kaçının beklendiğini tek bakışta görür.
export function BoardingBoard({
  catalog,
  departures,
  onScan,
  onPassengers,
}: {
  catalog: Catalog;
  departures: BoardingDeparture[];
  onScan: (d: { id: string; label: string }) => void;
  onPassengers: (id: string) => void;
}) {
  const sizes = groupSizes(departures);
  return (
    <section className="boarding-board" aria-labelledby="boarding-title">
      <h2 id="boarding-title">Biniş</h2>
      <ul>
        {groupedOrder(departures).map((d) => {
          const tour = catalog.tours.find((t) => t.id === d.tour_id)?.name || d.tour_id,
            tag = vehicleTag(d, sizes),
            plate = tag && d.vehicle?.unit ? d.vehicle.unit.plate : "",
            label = [tour, d.start_time, tag].filter(Boolean).join(" · "),
            total = d.confirmedGuests,
            boarded = Math.min(d.boardedGuests || 0, total),
            waiting = total - boarded,
            done = total > 0 && waiting === 0;
          return (
            <li key={d.id} className={"boarding-card" + (done ? " is-done" : "")}>
              <div className="boarding-head">
                <strong>
                  {tour} · {d.start_time}
                </strong>
                <small>
                  {[tag, plate, d.pickup, d.guide_name || "Rehber atanmadı"].filter(Boolean).join(" · ")}
                </small>
              </div>
              {total > 0 ? (
                <>
                  <div
                    className="boarding-progress"
                    role="progressbar"
                    aria-label={`${label}: binen yolcu`}
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-valuenow={boarded}
                    style={{ "--done": `${(boarded / total) * 100}%` } as CSSProperties}
                  >
                    <span />
                  </div>
                  <p className="boarding-count">
                    {done ? (
                      <>
                        <CircleCheck size={16} aria-hidden="true" /> <strong>Herkes bindi</strong> · {total} yolcu
                      </>
                    ) : (
                      <>
                        <strong>
                          {boarded}/{total}
                        </strong>{" "}
                        bindi · {waiting} yolcu bekleniyor
                      </>
                    )}
                  </p>
                </>
              ) : (
                <p className="boarding-count muted">Bu seferde onaylı yolcu yok.</p>
              )}
              <div className="boarding-actions">
                {total > 0 && (
                  <button className="btn" onClick={() => onScan({ id: d.id, label })}>
                    <QrCode size={17} /> Bilet okut
                  </button>
                )}
                <button className="btn btn-outline" onClick={() => onPassengers(d.id)}>
                  <Users size={16} /> Yolcu listesi
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
