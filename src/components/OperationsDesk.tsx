import { useEffect, useState, type FormEvent } from "react";
import {
  Plus,
  Check,
  Download,
  LoaderCircle,
  RefreshCw,
  CalendarDays,
  Ticket,
  Mail,
} from "lucide-react";
import { api, post } from "../lib/api";
import {
  currency,
  dateLabel,
  today,
  type Catalog,
  type Departure,
  type Reservation,
} from "../lib/types";
import { SeatMap } from "./SeatMap";
export type Campaign = {
  active: boolean;
  sectors: number[];
  validDays: number;
  minTotal: number;
  tourIds: string[];
  referralTrigger: "paid" | "completed";
  requireVerified: boolean;
};
export function DepartureManager({ catalog }: { catalog: Catalog }) {
  const [items, setItems] = useState<Departure[]>([]),
    [editing, setEditing] = useState<Departure | null | false>(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [tourFilter, setTourFilter] = useState("");
  async function load() {
    setItems(
      await api<Departure[]>(
        "/admin/departures" + (tourFilter ? "?tourId=" + tourFilter : ""),
      ),
    );
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [tourFilter]);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await post("/admin/departures", {
        ...(editing ? { id: editing.id } : {}),
        tourId: f.get("tourId"),
        date: f.get("date"),
        startTime: f.get("startTime"),
        price: Math.round(Number(f.get("price")) * 100),
        pickup: f.get("pickup"),
        guideName: f.get("guideName"),
        guidePhone: f.get("guidePhone"),
        vehicleModel: f.get("vehicleModel"),
        passengerSeats: Number(f.get("passengerSeats")),
        active: f.get("active") === "on",
      });
      setEditing(false);
      setNotice("Sefer kaydedildi.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="muted">
        Aynı turun farklı günlerine farklı araç, fiyat ve rehber atayın.
        Ayrılmış koltuğu olan seferin tarih/fiyat/araç planı değiştirilemez;
        rezervasyonu başka sefere taşıyın.
      </p>
      <div className="desk-toolbar">
        <button className="btn" onClick={() => setEditing(null)}>
          <Plus size={17} />
          Sefer oluştur
        </button>
        <label className="field">
          Tur filtresi
          <select
            value={tourFilter}
            onChange={(e) => setTourFilter(e.target.value)}
          >
            <option value="">Bütün turlar</option>
            {catalog.tours.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice-success" role="status">
          {notice}
        </p>
      )}
      {editing !== false && (
        <DepartureEditor
          key={editing?.id || "new"}
          catalog={catalog}
          departure={editing}
          save={save}
          busy={busy}
          cancel={() => setEditing(false)}
        />
      )}
      <div className="desk-table-wrap">
        <table className="desk-table">
          <thead>
            <tr>
              <th>Tur / tarih</th>
              <th>Araç / kontenjan</th>
              <th>Fiyat</th>
              <th>Buluşma / rehber</th>
              <th>Durum</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.id}>
                <td>
                  <strong>
                    {catalog.tours.find((t) => t.id === d.tour_id)?.name}
                  </strong>
                  <small>
                    {dateLabel(d.date)} · {d.start_time}
                  </small>
                </td>
                <td>
                  {d.vehicle?.passengerSeats}+1 · {d.vehicle?.name}
                  <small>
                    {d.available} / {d.vehicle?.sellableSeats} koltuk boş
                  </small>
                </td>
                <td>{currency(d.price)}</td>
                <td>
                  {d.pickup}
                  <small>{d.guide_name || "Rehber atanmadı"}</small>
                </td>
                <td>
                  <span
                    className={
                      "operation-status " + (d.active ? "open" : "closed")
                    }
                  >
                    {d.active ? "Açık" : "Kapalı"}
                  </span>
                </td>
                <td>
                  <button
                    className="text-link"
                    onClick={() => {
                      setEditing(d);
                      setError("");
                    }}
                  >
                    Düzenle
                  </button>
                  <a
                    className="text-link"
                    href={"/api/admin/departures/" + d.id + "/passengers.csv"}
                  >
                    <Download size={14} />
                    Yolcu listesi
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
function DepartureEditor({
  catalog,
  departure: d,
  save,
  busy,
  cancel,
}: {
  catalog: Catalog;
  departure: Departure | null;
  save: (e: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  cancel: () => void;
}) {
  const [model, setModel] = useState(
      d?.vehicle?.modelId || catalog.vehicleModels[0].id,
    ),
    [capacity, setCapacity] = useState(
      d?.vehicle?.passengerSeats || catalog.vehicleModels[0].seats,
    ),
    m = catalog.vehicleModels.find((v) => v.id === model)!;
  return (
    <form className="admin-editor departure-editor" onSubmit={save}>
      <h2>{d ? "Seferi düzenle" : "Yeni sefer"}</h2>
      <div className="form-grid">
        <label className="field">
          Tur
          <select
            name="tourId"
            defaultValue={d?.tour_id || catalog.tours[0].id}
          >
            {catalog.tours.map((t) => (
              <option
                key={t.id}
                value={t.id}
                disabled={Boolean(d && t.id !== d.tour_id)}
              >
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Sefer tarihi
          <input
            name="date"
            type="date"
            defaultValue={d?.date || today()}
            required
          />
        </label>
        <label className="field">
          Hareket saati
          <input
            name="startTime"
            type="time"
            defaultValue={d?.start_time || "08:30"}
            required
          />
        </label>
        <label className="field">
          Kişi başı fiyat (TL)
          <input
            name="price"
            type="number"
            step="0.01"
            min="0.01"
            defaultValue={(d?.price || 100000) / 100}
            required
          />
        </label>
        <label className="field">
          Araç sınıfı
          <select
            name="vehicleModel"
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              setCapacity(
                catalog.vehicleModels.find((v) => v.id === e.target.value)!
                  .seats,
              );
            }}
          >
            {catalog.vehicleModels.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Rehber dahil yolcu kapasitesi
          <input
            name="passengerSeats"
            type="number"
            min={m.min}
            max={m.max}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            required
          />
          <small>{capacity - 1} misafir koltuğu</small>
        </label>
        <label className="field">
          Buluşma noktası
          <input
            name="pickup"
            defaultValue={d?.pickup || "Kars merkez · Acente buluşma noktası"}
            minLength={2}
            maxLength={100}
            required
          />
        </label>
        <label className="field">
          Rehber adı
          <input
            name="guideName"
            defaultValue={d?.guide_name || ""}
            maxLength={100}
          />
        </label>
        <label className="field">
          Rehber telefonu
          <input
            name="guidePhone"
            defaultValue={d?.guide_phone || ""}
            type="tel"
          />
        </label>
      </div>
      <label className="checkbox-label">
        <input
          type="checkbox"
          name="active"
          defaultChecked={d ? Boolean(d.active) : true}
        />
        <span>Sefer rezervasyona açık</span>
      </label>
      <div className="button-row">
        <button className="btn" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Check size={16} />
          )}
          Seferi kaydet
        </button>
        <button className="text-link" type="button" onClick={cancel}>
          Vazgeç
        </button>
      </div>
    </form>
  );
}
const statusLabels: Record<string, string> = {
  pending_agency: "Onay bekliyor",
  confirmed: "Onaylı",
  completed: "Tamamlandı",
  cancelled: "İptal",
  expired: "Süresi doldu",
};
export function ReservationManager({ catalog }: { catalog: Catalog }) {
  const [rows, setRows] = useState<Reservation[]>([]),
    [selected, setSelected] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [date, setDate] = useState("");
  async function load() {
    setRows(
      await api<Reservation[]>(
        "/admin/reservations" + (date ? "?date=" + date : ""),
      ),
    );
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [date]);
  async function action(ref: string, path: string, body: unknown = {}) {
    setBusy(true);
    setError("");
    try {
      await post("/admin/reservations/" + ref + "/" + path, body);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const booking = rows.find((r) => r.reference === selected);
  return (
    <>
      <div className="desk-toolbar">
        <p className="muted">
          Tahsilat kaydı, acente onayı, tarih/koltuk değişikliği ve katılım
          durumunu yönetin. Kart tahsilatı banka bağlantısı bekliyor.
        </p>
        <label className="field">
          Tur gününe göre filtre
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <button
          className="text-link"
          onClick={() => load().catch((e) => setError(e.message))}
        >
          <RefreshCw size={15} />
          Yenile
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="desk-table-wrap">
        <table className="desk-table">
          <thead>
            <tr>
              <th>Referans / yolcu</th>
              <th>Tur / koltuk</th>
              <th>Bedel / tahsilat</th>
              <th>Durum</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.reference}>
                <td>
                  <strong>{r.reference}</strong>
                  <small>
                    {r.name} · {r.phone}
                  </small>
                  <small>{r.passengers.join(", ")}</small>
                </td>
                <td>
                  {catalog.tours.find((t) => t.id === r.tourId)?.name}
                  <small>
                    {dateLabel(r.date)} · {r.start_time}
                  </small>
                  <small>Koltuk: {r.seats.join(", ")}</small>
                </td>
                <td>
                  {currency(r.total)}
                  <small>Net tahsilat: {currency(r.net_paid || 0)}</small>
                  <small>Kalan: {currency(r.balance_due || 0)}</small>
                </td>
                <td>
                  {statusLabels[r.status] || r.status}
                  {Boolean(r.cancellation_requested_at) &&
                    r.status !== "cancelled" && (
                      <small className="error">İptal talebi var</small>
                    )}
                  {r.status === "cancelled" && Number(r.net_paid) > 0 && (
                    <small>İade bekleyen: {currency(r.net_paid || 0)}</small>
                  )}
                </td>
                <td>
                  <button
                    className="btn btn-outline btn-small"
                    onClick={() => setSelected(r.reference)}
                  >
                    Yönet
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <p className="admin-empty">Bu filtrede rezervasyon yok.</p>
      )}
      {booking && (
        <BookingControls
          key={booking.reference}
          booking={booking}
          busy={busy}
          action={action}
          close={() => setSelected("")}
        />
      )}
    </>
  );
}
function BookingControls({
  booking: r,
  busy,
  action,
  close,
}: {
  booking: Reservation;
  busy: boolean;
  action: (ref: string, path: string, body?: unknown) => Promise<void>;
  close: () => void;
}) {
  const [mode, setMode] = useState<
      "payment" | "refund" | "move" | "passengers"
    >("payment"),
    [departures, setDepartures] = useState<Departure[]>([]),
    [target, setTarget] = useState(""),
    [selected, setSelected] = useState<number[]>([]),
    [seatData, setSeatData] = useState<{
      seats: { number: number; status: "occupied" | "available" }[];
      vehicle: NonNullable<Reservation["vehicle"]>;
    } | null>(null),
    [localError, setLocalError] = useState("");
  useEffect(() => {
    if (mode === "move")
      api<Departure[]>("/tours/" + r.tourId + "/departures")
        .then(setDepartures)
        .catch((e) => setLocalError(e.message));
  }, [mode, r.tourId]);
  useEffect(() => {
    setSelected([]);
    setSeatData(null);
    if (target)
      api<NonNullable<typeof seatData>>("/departures/" + target + "/seats")
        .then(setSeatData)
        .catch((e) => setLocalError(e.message));
  }, [target]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (mode === "move")
      await action(r.reference, "move", {
        departureId: target,
        seats: selected,
      });
    else if (mode === "passengers")
      await action(r.reference, "passengers", { names: f.getAll("passenger") });
    else
      await action(r.reference, mode === "payment" ? "payments" : "refunds", {
        amount: Math.round(Number(f.get("amount")) * 100),
        method: f.get("method"),
        externalReference: f.get("externalReference"),
        recordedExternally: f.get("recordedExternally") === "on",
      });
  }
  return (
    <section className="booking-desk-panel">
      <div className="section-heading">
        <div>
          <span className="section-note">{r.reference}</span>
          <h2>Rezervasyonu yönet</h2>
        </div>
        <button className="text-link" onClick={close}>
          Kapat
        </button>
      </div>
      <div className="desk-action-buttons">
        <button
          className="btn btn-small"
          disabled={busy || r.status !== "pending_agency"}
          onClick={() => action(r.reference, "confirm")}
        >
          Acente onayı ver
        </button>
        <button
          className="btn btn-outline btn-small"
          disabled={busy || !["pending_agency", "confirmed"].includes(r.status)}
          onClick={() => action(r.reference, "cancel")}
        >
          İptal et
        </button>
        <button
          className="btn btn-outline btn-small"
          disabled={busy || r.status !== "confirmed"}
          onClick={() => action(r.reference, "complete")}
        >
          Turu tamamlandı işaretle
        </button>
        <a
          className="text-link"
          href={"/bilet/" + r.ticket_token}
          target="_blank"
          rel="noreferrer"
        >
          <Ticket size={15} />
          QR belgeyi doğrula
        </a>
      </div>
      <p className="muted">
        Toplam {currency(r.total)} · Net tahsilat {currency(r.net_paid || 0)} ·
        İade {currency(r.refunded_total || 0)}. Acente onayı için en az{" "}
        {currency(r.deposit)} tahsilat gerekir.
      </p>
      <div className="desk-tabs">
        {[
          ["payment", "Tahsilat kaydı"],
          ["refund", "İade kaydı"],
          ["move", "Tarih / koltuk değiştir"],
          ["passengers", "Yolcu adları"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={mode === key ? "active" : ""}
            onClick={() => setMode(key as typeof mode)}
          >
            {label}
          </button>
        ))}
      </div>
      {localError && <p className="error">{localError}</p>}
      <form onSubmit={submit} className="admin-editor">
        {mode === "move" ? (
          <>
            <label className="field">
              Yeni sefer
              <select
                aria-label="Yeni sefer"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                required
              >
                <option value="">Tarih seçin</option>
                {departures.map((d) => (
                  <option key={d.id} value={d.id}>
                    {dateLabel(d.date)} · {d.start_time} · {currency(d.price)} ·{" "}
                    {d.vehicle?.passengerSeats}+1
                  </option>
                ))}
              </select>
            </label>
            {seatData && (
              <SeatMap
                vehicle={seatData.vehicle}
                seats={seatData.seats}
                selected={selected}
                onSelect={(n) =>
                  setSelected((current) =>
                    current.includes(n)
                      ? current.filter((x) => x !== n)
                      : current.length < r.passengers.length
                        ? [...current, n]
                        : current,
                  )
                }
              />
            )}
            <p>
              {selected.length}/{r.passengers.length} koltuk seçildi. Fiyat yeni
              sefere göre tekrar hesaplanır.
            </p>
          </>
        ) : mode === "passengers" ? (
          r.passengers.map((p, i) => (
            <label className="field" key={i}>
              {i + 1}. yolcu
              <input
                name="passenger"
                defaultValue={p}
                minLength={2}
                maxLength={100}
                required
              />
            </label>
          ))
        ) : (
          <>
            <p className="info-note">
              Bu form ödeme veya iade yapmaz. Acente tarafından banka/havale
              veya nakit olarak dışarıda gerçekleştirilen işlemi kaydeder.
            </p>
            <div className="form-grid">
              <label className="field">
                {mode === "payment" ? "Tahsil edilen" : "İade edilen"} tutar
                (TL)
                <input
                  type="number"
                  name="amount"
                  min="0.01"
                  step="0.01"
                  max={
                    (mode === "payment"
                      ? r.balance_due || 0
                      : r.net_paid || 0) / 100
                  }
                  required
                />
              </label>
              <label className="field">
                İşlem yöntemi
                <select name="method">
                  <option value="bank_transfer">Havale / EFT</option>
                  <option value="cash">Nakit</option>
                </select>
              </label>
            </div>
            <label className="field">
              Dekont / makbuz referansı
              <input
                name="externalReference"
                minLength={3}
                maxLength={100}
                required
              />
            </label>
            <label className="checkbox-label">
              <input name="recordedExternally" type="checkbox" required />
              <span>Bu işlemin dışarıda gerçekleştiğini doğruluyorum.</span>
            </label>
          </>
        )}
        <button
          className="btn btn-small"
          disabled={
            busy || (mode === "move" && selected.length !== r.passengers.length)
          }
        >
          {busy ? (
            <LoaderCircle size={15} className="spin" />
          ) : (
            <Check size={15} />
          )}
          Kaydet
        </button>
      </form>
      {r.ledger?.length ? (
        <div className="ledger-history">
          <h3>İşlem geçmişi</h3>
          {r.ledger.map((p) => (
            <p key={p.id}>
              {p.kind === "refund" ? "İade" : "Tahsilat"} · {currency(p.amount)}{" "}
              · {p.method === "cash" ? "Nakit" : "Havale"} ·{" "}
              {p.external_reference}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}
export function CampaignManager({ catalog }: { catalog: Catalog }) {
  const [data, setData] = useState<Campaign | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<Campaign>("/campaigns")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!data) return;
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const updated = await post<Campaign>("/admin/campaigns", {
        active: f.get("active") === "on",
        sectors: f.getAll("sector").map(Number),
        validDays: Number(f.get("validDays")),
        minTotal: Math.round(Number(f.get("minTotal")) * 100),
        tourIds: f.getAll("tourIds"),
        referralTrigger: f.get("referralTrigger"),
        requireVerified: f.get("requireVerified") === "on",
      });
      setData(updated);
      setNotice(
        "Kampanya ayarları kaydedildi. Yeni kuponlar bu koşullarla oluşturulur.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice-success" role="status">
          {notice}
        </p>
      )}
      {data && (
        <form className="admin-editor campaign-editor" onSubmit={save}>
          <label className="checkbox-label">
            <input type="checkbox" name="active" defaultChecked={data.active} />
            <span>Çark ve davet kampanyası aktif</span>
          </label>
          <h2>Çark dilimleri</h2>
          <p className="muted">
            Her dilim eşit olasılıklıdır. Aynı oranı birden çok dilime koyarak
            kazanma ağırlığını değiştirebilirsiniz.
          </p>
          <div className="campaign-sectors">
            {data.sectors.map((n, i) => (
              <label className="field" key={i}>
                {i + 1}. dilim
                <select name="sector" defaultValue={n}>
                  {[5, 10, 15].map((p) => (
                    <option key={p} value={p}>
                      %{p}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="form-grid">
            <label className="field">
              Kupon süresi (gün)
              <input
                type="number"
                name="validDays"
                defaultValue={data.validDays}
                min={1}
                max={365}
                required
              />
            </label>
            <label className="field">
              Minimum tur bedeli (TL)
              <input
                type="number"
                name="minTotal"
                defaultValue={data.minTotal / 100}
                min={0}
                step="0.01"
                required
              />
            </label>
            <label className="field">
              Davet ödülü ne zaman verilsin?
              <select
                name="referralTrigger"
                defaultValue={data.referralTrigger}
              >
                <option value="completed">
                  Arkadaşın turu tamamlandığında
                </option>
                <option value="paid">
                  Arkadaşın tam ödemesi kaydedildiğinde
                </option>
              </select>
            </label>
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="requireVerified"
              defaultChecked={data.requireVerified}
            />
            <span>Çark ve kupon kullanımı için doğrulanmış e-posta iste</span>
          </label>
          <h3>Kuponun geçerli olduğu turlar</h3>
          <p className="muted">
            Seçim yapmazsanız bütün turlarda geçerli olur. Mevcut kuponların
            süre ve tur koşulları korunur.
          </p>
          <div className="review-map-options">
            {catalog.tours.map((t) => (
              <label key={t.id}>
                <input
                  type="checkbox"
                  name="tourIds"
                  value={t.id}
                  defaultChecked={data.tourIds.includes(t.id)}
                />
                {t.name}
              </label>
            ))}
          </div>
          <button className="btn" disabled={busy}>
            Kampanyayı kaydet
          </button>
        </form>
      )}
    </>
  );
}
export function DailyReport({ catalog }: { catalog: Catalog }) {
  const [date, setDate] = useState(today()),
    [data, setData] = useState<{
      departures: (Departure & {
        confirmedGuests: number;
        reservations: number;
      })[];
      guests: number;
      reservations: number;
      netCollected: number;
      refunded: number;
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    api<NonNullable<typeof data>>("/admin/reports?date=" + date)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [date]);
  return (
    <>
      <label className="field report-date">
        Operasyon günü
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </label>
      {error && <p className="error">{error}</p>}
      {data && (
        <>
          <div className="admin-metrics">
            <div>
              <span>Sefer</span>
              <strong>{data.departures.length}</strong>
            </div>
            <div>
              <span>Rezervasyon / misafir</span>
              <strong>
                {data.reservations} / {data.guests}
              </strong>
            </div>
            <div>
              <span>Seçili seferlerin net tahsilatı</span>
              <strong>{currency(data.netCollected)}</strong>
            </div>
            <div>
              <span>İade kaydı</span>
              <strong>{currency(data.refunded)}</strong>
            </div>
          </div>
          <div className="desk-table-wrap">
            <table className="desk-table">
              <thead>
                <tr>
                  <th>Tur / saat</th>
                  <th>Buluşma / rehber</th>
                  <th>Kapasite / onaylı misafir</th>
                  <th>Liste</th>
                </tr>
              </thead>
              <tbody>
                {data.departures.map((d) => (
                  <tr key={d.id}>
                    <td>
                      {catalog.tours.find((t) => t.id === d.tour_id)?.name}
                      <small>{d.start_time}</small>
                    </td>
                    <td>
                      {d.pickup}
                      <small>{d.guide_name || "Rehber atanmadı"}</small>
                    </td>
                    <td>
                      {d.vehicle?.sellableSeats} / {d.confirmedGuests}
                      <small>{d.available} boş koltuk</small>
                    </td>
                    <td>
                      <a
                        className="text-link"
                        href={
                          "/api/admin/departures/" + d.id + "/passengers.csv"
                        }
                      >
                        <Download size={15} />
                        CSV indir
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
export function NotificationManager() {
  const [data, setData] = useState<{
      configured: boolean;
      preview: boolean;
      items: {
        id: string;
        recipient: string;
        subject: string;
        body: string;
        status: string;
        attempts: number;
        action_url: string | null;
        last_error: string | null;
      }[];
    } | null>(null),
    [error, setError] = useState("");
  async function load() {
    setData(await api<NonNullable<typeof data>>("/admin/notifications"));
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  return (
    <>
      {error && <p className="error">{error}</p>}
      {data && (
        <>
          <div className="info-note">
            <Mail size={21} />
            <p>
              {data.configured
                ? "SMTP bağlantısı tanımlı. Bekleyen mesajlar arka planda gönderilir."
                : "SMTP gönderimi tanımlı değil. Mesajlar kuyrukta tutulur; gönderilmiş sayılmaz."}
              {data.preview
                ? " Demo önizleme bağlantıları yalnız bu yönetim ekranında görünür."
                : ""}
            </p>
          </div>
          <div className="button-row">
            <button
              className="btn btn-small"
              onClick={async () => {
                try {
                  await post("/admin/notifications/process", {});
                  await load();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Hatırlatmaları ve kuyruğu işle
            </button>
            <button
              className="text-link"
              onClick={() => load().catch((e) => setError(e.message))}
            >
              Yenile
            </button>
          </div>
          <div className="notification-list">
            {data.items.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.subject}</strong>
                  <span>{item.recipient}</span>
                  <small>
                    {
                      (
                        {
                          queued: "Bekliyor",
                          sending: "Gönderiliyor",
                          sent: "Gönderildi",
                          failed: "Başarısız",
                        } as Record<string, string>
                      )[item.status]
                    }{" "}
                    · {item.attempts} deneme
                  </small>
                </div>
                <details>
                  <summary>Mesaj içeriği</summary>
                  <p>{item.body}</p>
                  {data.preview && item.action_url && (
                    <a
                      className="text-link"
                      href={item.action_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Demo bağlantısını aç
                    </a>
                  )}
                </details>
                {item.last_error && <p className="error">{item.last_error}</p>}
                {item.status === "failed" && (
                  <button
                    className="text-link"
                    onClick={async () => {
                      try {
                        await post(
                          "/admin/notifications/" + item.id + "/retry",
                          {},
                        );
                        await load();
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Yeniden kuyruğa al
                  </button>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}
