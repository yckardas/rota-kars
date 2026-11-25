import { useEffect, useState } from "react";
import { Check, LoaderCircle, Lock } from "lucide-react";
import { SeatMap } from "../SeatMap";
import { api, post } from "../../lib/api";
import type { Departure, Seat, Vehicle } from "../../lib/types";
import { useFeedback } from "./feedback";

// Seferde online satışa kapalı koltuklar (ör. arka dörtlü). Müşteri bu koltukları dolu
// görür; acenta "Yeni rezervasyon" ekranından yine yazabilir.
export function ClosedSeats({ departure, onSaved }: { departure: Departure; onSaved: () => void }) {
  const feedback = useFeedback();
  const [data, setData] = useState<{ seats: Seat[]; vehicle: Vehicle } | null>(null),
    [draft, setDraft] = useState<number[]>(departure.closed_seats || []),
    // Sunucudaki son kayıtlı liste (kaydet düğmesi yalnız değişiklik varken açılır).
    [savedSeats, setSavedSeats] = useState<number[]>(departure.closed_seats || []),
    [busy, setBusy] = useState(false);
  const load = () =>
    api<{ seats: Seat[]; vehicle: Vehicle }>(`/admin/departures/${encodeURIComponent(departure.id)}/seats`)
      .then((d) => {
        setData(d);
        const current = d.seats
          .filter((s) => s.status === "closed")
          .map((s) => s.number)
          .concat(savedSeats.filter((n) => d.seats.find((s) => s.number === n)?.status === "occupied"));
        setDraft(current);
        setSavedSeats(current);
      })
      .catch(feedback.error);
  useEffect(() => {
    load();
  }, [departure.id]);
  if (!data) return null;
  // Dolu koltuk (kapalıyken acentanın yazdığı dahil) tıklanmaz; iptal olursa kapalıya döner.
  const sold = new Set(data.seats.filter((s) => s.status === "occupied").map((s) => s.number)),
    rows = data.vehicle.layout.slice(1),
    back = (rows[rows.length - 1] || []).filter((c): c is number => typeof c === "number"),
    backClosed = back.length > 0 && back.every((n) => draft.includes(n)),
    shown: Seat[] = data.seats.map((s) => ({
      number: s.number,
      status: sold.has(s.number) ? "occupied" : draft.includes(s.number) ? "closed" : "available",
    })),
    saved = [...savedSeats].sort((a, b) => a - b).join(","),
    dirty = [...draft].sort((a, b) => a - b).join(",") !== saved;
  const toggle = (n: number) =>
    setDraft((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n]));
  const toggleBack = () =>
    setDraft((cur) =>
      backClosed ? cur.filter((n) => !back.includes(n)) : [...new Set([...cur, ...back.filter((n) => !sold.has(n))])],
    );
  async function save() {
    setBusy(true);
    try {
      await post(`/admin/departures/${encodeURIComponent(departure.id)}/closed-seats`, {
        seats: [...draft].sort((a, b) => a - b),
      });
      feedback.ok(draft.length ? `${draft.length} koltuk online satışa kapalı.` : "Bütün koltuklar satışa açık.");
      setSavedSeats(draft);
      onSaved();
    } catch (e) {
      feedback.error(e);
      load();
    } finally {
      setBusy(false);
    }
  }
  return (
    <fieldset className="closed-seats">
      <legend>
        <Lock size={15} /> Satışa kapalı koltuklar
      </legend>
      <p className="muted">
        Koltuğa tıklayarak online satışa kapatın ya da açın. Müşteri kapalı koltuğu dolu görür; siz "Rezervasyon ekle"
        ekranından yine yazabilirsiniz. Satılmış koltuk kapatılamaz.
      </p>
      <SeatMap vehicle={data.vehicle} seats={shown} onSelect={toggle} />
      <ul className="seat-legend" aria-label="Renk açıklaması">
        <li><i className="legend-free" /> Boş</li>
        <li><i className="legend-sold" /> Dolu</li>
        <li><i className="legend-closed" /> Satışa kapalı</li>
      </ul>
      <div className="button-row">
        {back.length > 0 && (
          <button type="button" className="btn btn-outline" onClick={toggleBack}>
            {backClosed ? "Arka sırayı aç" : "Arka sırayı kapat"}
          </button>
        )}
        <button type="button" className="btn" onClick={save} disabled={busy || !dirty}>
          {busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}
          Kapalı koltukları kaydet
        </button>
      </div>
    </fieldset>
  );
}
