import { useEffect, useState, type FormEvent } from "react";
import { responsive } from "../lib/images";
import { Bus, Check, LoaderCircle } from "lucide-react";
import { api, post } from "../lib/api";
import { SeatMap } from "./SeatMap";
import type { Catalog, Tour, VehicleModel } from "../lib/types";
export function TourOperations({ onChange }: { onChange: () => void }) {
  const [tours, setTours] = useState<Tour[]>([]),
    [models, setModels] = useState<VehicleModel[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState("");
  async function load() {
    const data = await api<{ tours: Tour[]; vehicleModels: VehicleModel[] }>(
      "/admin/operations",
    );
    setTours(data.tours);
    setModels(data.vehicleModels);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function save(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(id);
    setError("");
    setNotice("");
    try {
      await post("/admin/operations/" + id, {
        salesOpen: Boolean(tours.find((t) => t.id === id)?.salesOpen),
        vehicleModel: f.get("vehicleModel"),
        passengerSeats: Number(f.get("passengerSeats")),
      });
      await load();
      onChange();
      setNotice("Araç planı güncellendi.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  // Tek dokunuşla satışı aç/kapat (araç düzeni aynen kalır).
  async function toggle(t: Tour) {
    setBusy(t.id);
    setError("");
    setNotice("");
    try {
      await post("/admin/operations/" + t.id, {
        salesOpen: !t.salesOpen,
        vehicleModel: t.vehicle.modelId || "vip-midibus",
        passengerSeats: t.vehicle.passengerSeats,
      });
      await load();
      onChange();
      setNotice(`${t.name} ${t.salesOpen ? "satışa kapatıldı" : "satışa açıldı"}.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <div className="operations-intro">
        <Bus size={23} />
        <p>
          Her turun satış durumunu ve seferlerde kullanılacak araç düzenini
          belirleyin. Yolcu kapasitesine rehber dahildir; şoför ayrıdır. Ön
          koltuk rehbere ayrılır. Ayrılmış koltuk bulunan turların araç düzeni
          değiştirilemez.
        </p>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice-success" role="status">
          <Check size={17} />
          {notice}
        </p>
      )}
      <div className="tour-operations-list">
        {tours.map((t) => (
          <OperationRow
            key={t.id + "-" + t.vehicle.id + "-" + t.salesOpen}
            tour={t}
            models={models}
            busy={busy === t.id}
            save={save}
            toggle={() => toggle(t)}
          />
        ))}
      </div>
    </>
  );
}
function OperationRow({
  tour: t,
  models,
  busy,
  save,
  toggle,
}: {
  tour: Tour;
  models: VehicleModel[];
  busy: boolean;
  save: (e: FormEvent<HTMLFormElement>, id: string) => void;
  toggle: () => void;
}) {
  const [modelId, setModelId] = useState(t.vehicle.modelId || "vip-midibus"),
    [capacity, setCapacity] = useState(t.vehicle.passengerSeats),
    model = models.find((m) => m.id === modelId);
  return (
    <form className="tour-operation" onSubmit={(e) => save(e, t.id)}>
      <div className="operation-tour">
        <img {...responsive(t.image, "160px")} alt="" loading="lazy" />
        <div>
          <h3>{t.name}</h3>
          <span
            className={"operation-status " + (t.salesOpen ? "open" : "closed")}
          >
            {t.salesOpen ? "Satışa açık" : "Satışa kapalı"}
          </span>
          <button
            type="button"
            className={"sales-switch" + (t.salesOpen ? " on" : "")}
            role="switch"
            aria-checked={t.salesOpen}
            aria-label={t.name + " satış durumu"}
            onClick={toggle}
            disabled={busy}
          >
            <span />
            Satış
          </button>
        </div>
      </div>
      <div className="operation-fields">
        <label className="field">
          Araç modeli
          <select
            name="vehicleModel"
            value={modelId}
            onChange={(e) => {
              setModelId(e.target.value);
              setCapacity(models.find((m) => m.id === e.target.value)!.seats);
            }}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Yolcu kapasitesi (rehber dahil)
          <input
            name="passengerSeats"
            type="number"
            min={model?.min}
            max={model?.max}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            required
          />
          <small>
            {capacity}+1 araç · {Math.max(0, capacity - 1)} satılabilir koltuk
          </small>
        </label>
        <button className="btn btn-small" disabled={busy}>
          {busy ? (
            <LoaderCircle size={15} className="spin" />
          ) : (
            <Check size={15} />
          )}
          Planı kaydet
        </button>
      </div>
      <details className="operation-map">
        <summary>Kayıtlı koltuk yerleşimini gör</summary>
        <SeatMap vehicle={t.vehicle} interactive={false} />
      </details>
    </form>
  );
}
