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
  Users,
  QrCode,
  Phone,
  MessageCircle,
  UserX,
  Trash2,
} from "lucide-react";
import { TicketScanner } from "./admin/TicketScanner";
import { useFeedback } from "./admin/feedback";
import { SeatCourse } from "./admin/SeatCourse";
import { Modal } from "./Modal";
import { downloadCsv } from "../lib/csv";
import { telHref, waNumber } from "../lib/phone";
import { whatsappLink } from "../lib/whatsapp";
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
import { PassengerList } from "./admin/MobileApp";
import { NewReservation } from "./admin/NewReservation";
import { DepartureCalendar } from "./admin/DepartureCalendar";
import { isNativeApp } from "../lib/native";
export type Campaign = {
  active: boolean;
  sectors: number[];
  validDays: number;
  minTotal: number;
  tourIds: string[];
  referralTrigger: "paid" | "completed";
  requireVerified: boolean;
};
const WEEKDAYS = [
  [1, "Pzt"],
  [2, "Sal"],
  [3, "Çar"],
  [4, "Per"],
  [5, "Cum"],
  [6, "Cmt"],
  [0, "Paz"],
] as const;
export function DepartureManager({
  catalog,
  startCreating = false,
}: {
  catalog: Catalog;
  startCreating?: boolean;
}) {
  const feedback = useFeedback();
  const [items, setItems] = useState<Departure[]>([]),
    [editing, setEditing] = useState<Departure | null | false>(startCreating ? null : false),
    [busy, setBusy] = useState(false),
    [tourFilter, setTourFilter] = useState(""),
    [passengers, setPassengers] = useState(""),
    [showPast, setShowPast] = useState(false),
    [view, setView] = useState<"calendar" | "list">("calendar");
  async function load() {
    setItems(
      await api<Departure[]>(
        "/admin/departures" + (tourFilter ? "?tourId=" + tourFilter : ""),
      ),
    );
  }
  useEffect(() => {
    load().catch(feedback.error);
  }, [tourFilter]);
  async function remove(d: Departure) {
    const ok = await feedback.confirm({
      title: "Sefer silinsin mi?",
      body: `${dateLabel(d.date)} · ${d.start_time}. Rezervasyonu olan sefer silinmez; onu satışa kapatın.`,
      confirmLabel: "Seferi sil",
      danger: true,
    });
    if (!ok) return;
    try {
      await api("/admin/departures/" + encodeURIComponent(d.id), { method: "DELETE" });
      setEditing(false);
      feedback.ok("Sefer silindi.");
      await load();
    } catch (e) {
      feedback.error(e);
    }
  }
  const listed = showPast ? items : items.filter((d) => d.date >= today());
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      // Yeni seferde "tekrarlayan" seçildiyse tarih aralığına toplu sefer açılır.
      if (!editing && f.get("repeat") === "on") {
        const r = await post<{ created: number; skipped: number }>("/admin/departures/bulk", {
          tourId: f.get("tourId"),
          from: f.get("from"),
          to: f.get("to"),
          weekdays: f.getAll("weekdays").map(Number),
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
        feedback.ok(
          `${r.created} sefer açıldı` + (r.skipped ? `; ${r.skipped} tarihte aynı saatte sefer zaten vardı, atlandı.` : "."),
        );
        await load();
        return;
      }
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
      feedback.ok("Sefer kaydedildi.");
      await load();
    } catch (e) {
      feedback.error(e);
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
        <div className="status-filters" role="group" aria-label="Görünüm">
          {(
            [
              ["calendar", "Takvim"],
              ["list", "Liste"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" className={"chip" + (view === id ? " active" : "")} aria-pressed={view === id} onClick={() => setView(id)}>
              {label}
            </button>
          ))}
        </div>
        {view === "list" && (
          <label className="checkbox-label">
            <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
            <span>Geçmiş seferleri de göster</span>
          </label>
        )}
      </div>
      {editing !== false && (
        <DepartureEditor
          key={editing?.id || "new"}
          catalog={catalog}
          departure={editing}
          save={save}
          busy={busy}
          cancel={() => setEditing(false)}
          remove={editing ? () => remove(editing) : undefined}
        />
      )}
      {passengers && (
        <PassengerList departureId={passengers} onClose={() => setPassengers("")} />
      )}
      {view === "calendar" && (
        <DepartureCalendar
          items={items}
          catalog={catalog}
          onPick={(d) => {
            setEditing(d);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}
      <div className="desk-table-wrap" hidden={view !== "list"}>
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
            {listed.map((d) => (
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
                  <SeatCourse sold={(d.vehicle?.sellableSeats || 0) - d.available} total={d.vehicle?.sellableSeats || 0} size="sm" />
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
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    Düzenle
                  </button>
                  <button className="text-link" onClick={() => setPassengers(d.id)}>
                    <Users size={14} />
                    Yolcu listesi
                  </button>
                  {!isNativeApp() && (
                    <a
                      className="text-link"
                      href={"/api/admin/departures/" + d.id + "/passengers.csv"}
                    >
                      <Download size={14} />
                      CSV
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!listed.length && <p className="admin-empty">Gösterilecek sefer yok.</p>}
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
  remove,
}: {
  catalog: Catalog;
  departure: Departure | null;
  save: (e: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  cancel: () => void;
  remove?: () => void;
}) {
  const [model, setModel] = useState(
      d?.vehicle?.modelId || catalog.vehicleModels[0].id,
    ),
    [capacity, setCapacity] = useState(
      d?.vehicle?.passengerSeats || catalog.vehicleModels[0].seats,
    ),
    m = catalog.vehicleModels.find((v) => v.id === model)!,
    [repeat, setRepeat] = useState(false);
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
        {!d && (
          <label className="checkbox-label departure-repeat">
            <input type="checkbox" name="repeat" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
            <span>Tekrarlayan sefer (tarih aralığına toplu aç)</span>
          </label>
        )}
        {repeat && !d ? (
          <>
            <label className="field">
              Başlangıç
              <input name="from" type="date" defaultValue={today()} min={today()} required />
            </label>
            <label className="field">
              Bitiş
              <input name="to" type="date" required min={today()} />
            </label>
            <fieldset className="choice-row weekday-picker">
              <legend>Günler</legend>
              {WEEKDAYS.map(([n, label]) => (
                <label key={n} className="checkbox-label">
                  <input type="checkbox" name="weekdays" value={n} defaultChecked />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
          </>
        ) : (
          <label className="field">
            Sefer tarihi
            <input
              name="date"
              type="date"
              defaultValue={d?.date || today()}
              required
            />
          </label>
        )}
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
        {remove && (
          <button className="text-link danger-text push-right" type="button" onClick={remove}>
            <Trash2 size={15} /> Seferi sil
          </button>
        )}
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
  no_show: "Gelmedi",
};
// Durum ve hızlı filtreler tek sırada: "flag:" ile başlayanlar sunucuda ayrı süzülür.
const STATUS_FILTERS = [
  ["", "Tümü"],
  ["pending_agency", "Onay bekleyen"],
  ["flag:cancel_request", "İptal talebi"],
  ["flag:balance", "Bakiyesi kalan"],
  ["confirmed", "Onaylı"],
  ["completed", "Tamamlandı"],
  ["no_show", "Gelmedi"],
  ["cancelled", "İptal"],
] as const;
const PAGE = 50;
const AUDIT_LABELS: Record<string, string> = {
  created: "Kayıt oluşturuldu",
  confirmed: "Acente onayı verildi",
  payment: "Tahsilat kaydedildi",
  refund: "İade kaydedildi",
  cancellation_requested: "Müşteri iptal talep etti",
  cancelled: "İptal edildi",
  moved: "Tarih/koltuk değiştirildi",
  passengers_updated: "Yolcu adları güncellendi",
  completed: "Tur tamamlandı",
  checked_in: "Bilet okutuldu (bindi)",
  no_show: "Gelmedi olarak işaretlendi",
};
const stamp = (ms?: number) =>
  ms
    ? new Date(ms).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "";
export function ReservationManager({
  catalog,
  initialStatus = "",
  initialFlag = "",
  openRef = "",
  canCreate = true,
  startCreating = false,
}: {
  catalog: Catalog;
  initialStatus?: string;
  initialFlag?: string;
  openRef?: string;
  canCreate?: boolean;
  startCreating?: boolean;
}) {
  const feedback = useFeedback();
  const [rows, setRows] = useState<Reservation[]>([]),
    [loading, setLoading] = useState(true),
    [selected, setSelected] = useState(openRef.toUpperCase()),
    [busy, setBusy] = useState(false),
    [date, setDate] = useState(""),
    [filter, setFilter] = useState(initialFlag ? "flag:" + initialFlag : initialStatus),
    [search, setSearch] = useState(openRef),
    [query, setQuery] = useState(openRef),
    [shown, setShown] = useState(PAGE),
    [creating, setCreating] = useState(startCreating);
  // Arama yazarken her tuşta değil, kısa bir duraksamadan sonra sorgulanır.
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  async function load() {
    const params = new URLSearchParams();
    if (date) params.set("date", date);
    if (filter.startsWith("flag:")) params.set("flag", filter.slice(5));
    else if (filter) params.set("status", filter);
    if (query) params.set("q", query);
    try {
      setRows(await api<Reservation[]>("/admin/reservations" + (params.size ? "?" + params : "")));
    } catch (e) {
      feedback.error(e);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    setShown(PAGE);
    load();
  }, [date, filter, query]);
  async function action(ref: string, path: string, body: unknown = {}, done = "Kaydedildi.") {
    setBusy(true);
    try {
      await post("/admin/reservations/" + ref + "/" + path, body);
      await load();
      feedback.ok(done);
      return true;
    } catch (e) {
      feedback.error(e);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const tourName = (id: string) => catalog.tours.find((t) => t.id === id)?.name || id;
  function exportCsv() {
    downloadCsv("rezervasyonlar-" + today() + ".csv", [
      ["Referans", "Durum", "Tur", "Tarih", "Saat", "Koltuk", "Müşteri", "Telefon", "E-posta", "Yolcular", "Toplam", "Net tahsilat", "Kalan", "Not"],
      ...rows.map((r) => [
        r.reference,
        statusLabels[r.status] || r.status,
        tourName(r.tourId),
        r.date,
        r.start_time,
        r.seats.join(" "),
        r.name,
        r.phone,
        r.email,
        r.passengers.join("; "),
        (r.total / 100).toFixed(2),
        ((r.net_paid || 0) / 100).toFixed(2),
        ((r.balance_due || 0) / 100).toFixed(2),
        r.notes,
      ]),
    ]);
  }
  const booking = rows.find((r) => r.reference === selected);
  return (
    <>
      <div className="desk-toolbar">
        {canCreate && (
          <button className="btn" onClick={() => setCreating(true)}>
            <Plus size={16} />
            Yeni rezervasyon
          </button>
        )}
        <label className="field reservation-search">
          Ara
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Referans, ad, telefon veya e-posta"
            maxLength={80}
          />
        </label>
        <label className="field">
          Tur günü
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className="desk-toolbar-actions">
          <button className="text-link" onClick={load}>
            <RefreshCw size={15} />
            Yenile
          </button>
          {!isNativeApp() && rows.length > 0 && (
            <button className="text-link" onClick={exportCsv}>
              <Download size={15} />
              CSV
            </button>
          )}
        </div>
        <div className="status-filters" role="group" aria-label="Duruma göre filtre">
          {STATUS_FILTERS.map(([id, label]) => (
            <button
              key={id || "all"}
              type="button"
              className={"chip" + (filter === id ? " active" : "")}
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
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
            {rows.slice(0, shown).map((r) => {
              const wa = waNumber(r.phone);
              return (
                <tr key={r.reference} className="clickable-row" onClick={() => setSelected(r.reference)}>
                  <td>
                    <strong>{r.reference}</strong>
                    <small>
                      {r.name} ·{" "}
                      <a href={telHref(r.phone)} onClick={(e) => e.stopPropagation()}>
                        {r.phone}
                      </a>
                      {wa && (
                        <>
                          {" · "}
                          <a
                            href={"https://wa.me/" + wa}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            WhatsApp
                          </a>
                        </>
                      )}
                    </small>
                    <small>{r.passengers.join(", ")}</small>
                    {r.notes && <small className="row-note">Not: {r.notes}</small>}
                  </td>
                  <td>
                    {tourName(r.tourId)}
                    <small>
                      {dateLabel(r.date)} · {r.start_time}
                    </small>
                    <small>Koltuk: {r.seats.join(", ")}</small>
                  </td>
                  <td>
                    {currency(r.total)}
                    <small>Net tahsilat: {currency(r.net_paid || 0)}</small>
                    {Number(r.balance_due) > 0 && <small>Kalan: {currency(r.balance_due || 0)}</small>}
                  </td>
                  <td>
                    <span className={"status-tag status-" + r.status}>{statusLabels[r.status] || r.status}</span>
                    {Boolean(r.cancellation_requested_at) && r.status !== "cancelled" && (
                      <small className="error">İptal talebi var</small>
                    )}
                    {r.status === "cancelled" && Number(r.net_paid) > 0 && (
                      <small>İade bekleyen: {currency(r.net_paid || 0)}</small>
                    )}
                  </td>
                  <td>
                    <button className="btn btn-outline btn-small">Yönet</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {loading && <p className="admin-empty">Yükleniyor…</p>}
      {!loading && !rows.length && <p className="admin-empty">Bu filtrede rezervasyon yok.</p>}
      {rows.length > shown && (
        <button className="btn btn-outline load-more" onClick={() => setShown((n) => n + PAGE)}>
          Daha fazla göster ({rows.length - shown} kayıt daha)
        </button>
      )}
      {creating && (
        <NewReservation catalog={catalog} onClose={() => setCreating(false)} onCreated={load} />
      )}
      {booking && (
        <BookingControls
          key={booking.reference}
          booking={booking}
          tourName={tourName(booking.tourId)}
          busy={busy}
          action={action}
          close={() => setSelected("")}
        />
      )}
    </>
  );
}
type AuditRow = { id: string; event: string; details: Record<string, unknown>; created_at: number };
function BookingControls({
  booking: r,
  tourName,
  busy,
  action,
  close,
}: {
  booking: Reservation;
  tourName: string;
  busy: boolean;
  action: (ref: string, path: string, body?: unknown, done?: string) => Promise<boolean>;
  close: () => void;
}) {
  const feedback = useFeedback();
  const [mode, setMode] = useState<"payment" | "refund" | "move" | "passengers" | "history">(
      r.status === "cancelled" && Number(r.net_paid) > 0 ? "refund" : "payment",
    ),
    [departures, setDepartures] = useState<Departure[]>([]),
    [target, setTarget] = useState(""),
    [selected, setSelected] = useState<number[]>([]),
    [seatData, setSeatData] = useState<{
      seats: { number: number; status: "occupied" | "available" }[];
      vehicle: NonNullable<Reservation["vehicle"]>;
    } | null>(null),
    [history, setHistory] = useState<AuditRow[] | null>(null);
  useEffect(() => {
    if (mode === "move")
      api<Departure[]>("/tours/" + r.tourId + "/departures")
        .then(setDepartures)
        .catch(feedback.error);
    if (mode === "history")
      api<AuditRow[]>("/admin/reservations/" + r.reference + "/audit")
        .then(setHistory)
        .catch(feedback.error);
  }, [mode, r.tourId]);
  useEffect(() => {
    setSelected([]);
    setSeatData(null);
    if (target)
      api<NonNullable<typeof seatData>>("/departures/" + target + "/seats")
        .then(setSeatData)
        .catch(feedback.error);
  }, [target]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form);
    if (current === "move") {
      if (await action(r.reference, "move", { departureId: target, seats: selected }, "Rezervasyon yeni sefere taşındı."))
        setTarget("");
    } else if (current === "passengers")
      await action(r.reference, "passengers", { names: f.getAll("passenger") }, "Yolcu adları kaydedildi.");
    else if (
      await action(
        r.reference,
        current === "payment" ? "payments" : "refunds",
        {
          amount: Math.round(Number(f.get("amount")) * 100),
          method: f.get("method"),
          externalReference: f.get("externalReference"),
          recordedExternally: f.get("recordedExternally") === "on",
        },
        current === "payment" ? "Tahsilat kaydedildi." : "İade kaydedildi.",
      )
    )
      form.reset();
  }
  // Geri alınamayan durum değişiklikleri önce onay ister.
  async function guarded(path: string, title: string, body: string, label: string, done: string) {
    if (await feedback.confirm({ title, body, confirmLabel: label, danger: true }))
      await action(r.reference, path, {}, done);
  }
  const wa = waNumber(r.phone),
    pastOrToday = r.date <= today(),
    activeBooking = ["pending_agency", "confirmed"].includes(r.status),
    modes = (
      [
        ["payment", "Tahsilat", activeBooking && Number(r.balance_due) > 0],
        ["refund", "İade", Number(r.net_paid) > 0],
        ["move", "Tarih / koltuk", activeBooking],
        ["passengers", "Yolcu adları", activeBooking],
        ["history", "Geçmiş", true],
      ] as const
    ).filter((m) => m[2]),
    current = modes.some((m) => m[0] === mode) ? mode : modes[0][0];
  return (
    <Modal title={r.reference + " · " + tourName} onClose={close} wide>
      <section className="booking-desk-panel">
        <div className="booking-head">
          <div>
            <h2>
              {r.name} <span className={"status-tag status-" + r.status}>{statusLabels[r.status] || r.status}</span>
            </h2>
            <p className="muted">
              {dateLabel(r.date)} · {r.start_time} · Koltuk {r.seats.join(", ")} · {r.passengers.length} kişi
            </p>
            {r.notes && <p className="row-note">Not: {r.notes}</p>}
            {Boolean(r.cancellation_requested_at) && r.status !== "cancelled" && (
              <p className="error">Müşteri iptal talep etti ({stamp(r.cancellation_requested_at)}).</p>
            )}
          </div>
          <div className="booking-contact">
            <a className="btn btn-outline btn-small" href={telHref(r.phone)}>
              <Phone size={15} /> Ara
            </a>
            {wa && (
              <a
                className="btn btn-outline btn-small"
                href={whatsappLink(wa, `Merhaba ${r.name}, ${r.reference} numaralı ${tourName} rezervasyonunuz hakkında yazıyoruz.`)}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle size={15} /> WhatsApp
              </a>
            )}
            {r.email && (
              <a className="btn btn-outline btn-small" href={"mailto:" + r.email}>
                <Mail size={15} /> E-posta
              </a>
            )}
          </div>
        </div>
        <div className="booking-money">
          <div>
            <span>Toplam</span>
            <strong>{currency(r.total)}</strong>
          </div>
          <div>
            <span>Net tahsilat</span>
            <strong>{currency(r.net_paid || 0)}</strong>
          </div>
          <div>
            <span>Kalan</span>
            <strong>{currency(r.balance_due || 0)}</strong>
          </div>
          <div>
            <span>Onay için kapora</span>
            <strong>{currency(r.deposit)}</strong>
          </div>
        </div>
        <div className="desk-action-buttons">
          {r.status === "pending_agency" && (
            <button
              className="btn btn-small"
              disabled={busy}
              onClick={() => action(r.reference, "confirm", {}, "Acente onayı verildi.")}
            >
              <Check size={15} /> Acente onayı ver
            </button>
          )}
          {r.status === "confirmed" && pastOrToday && (
            <button
              className="btn btn-small"
              disabled={busy}
              onClick={() =>
                guarded("complete", "Tur tamamlandı olarak işaretlensin mi?", "Bu işlem geri alınamaz. Müşteriye yorum daveti gönderilir.", "Tamamlandı", "Tur tamamlandı.")
              }
            >
              Turu tamamlandı işaretle
            </button>
          )}
          {r.status === "confirmed" && pastOrToday && !r.checked_in_at && (
            <button
              className="btn btn-outline btn-small"
              disabled={busy}
              onClick={() =>
                guarded("no-show", "Müşteri gelmedi olarak işaretlensin mi?", "Bilet okutulmamış kayıt 'Gelmedi' durumuna geçer. Bu işlem geri alınamaz.", "Gelmedi", "Gelmedi olarak işaretlendi.")
              }
            >
              <UserX size={15} /> Gelmedi
            </button>
          )}
          {["pending_agency", "confirmed"].includes(r.status) && (
            <button
              className="btn btn-outline btn-small danger-text"
              disabled={busy}
              onClick={() =>
                guarded(
                  "cancel",
                  r.reference + " iptal edilsin mi?",
                  "Koltuklar boşa çıkar ve müşteriye iptal e-postası gider." +
                    (Number(r.net_paid) > 0 ? ` ${currency(r.net_paid || 0)} tahsilatın iadesini ayrıca kaydetmeniz gerekir.` : ""),
                  "Rezervasyonu iptal et",
                  "Rezervasyon iptal edildi.",
                )
              }
            >
              İptal et
            </button>
          )}
          <a className="btn btn-outline btn-small" href={"/bilet/" + r.ticket_token} target="_blank" rel="noreferrer">
            <Ticket size={15} />
            QR belge
          </a>
        </div>
        <div className="desk-tabs">
          {modes.map(([key, label]) => (
            <button key={key} className={current === key ? "active" : ""} onClick={() => setMode(key)}>
              {label}
            </button>
          ))}
        </div>
        {current === "history" ? (
          <div className="ledger-history">
            {!history && <p className="muted">Yükleniyor…</p>}
            {history && !history.length && <p className="muted">Kayıt yok.</p>}
            <ol className="audit-timeline">
              {history?.map((a) => (
                <li key={a.id}>
                  <time>{stamp(a.created_at)}</time>
                  <span>
                    {AUDIT_LABELS[a.event] || a.event}
                    {typeof a.details?.amount === "number" && " · " + currency(a.details.amount)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <form onSubmit={submit} className="admin-editor">
            {current === "move" ? (
              <>
                <label className="field">
                  Yeni sefer
                  <select aria-label="Yeni sefer" value={target} onChange={(e) => setTarget(e.target.value)} required>
                    <option value="">Tarih seçin</option>
                    {departures.map((d) => (
                      <option key={d.id} value={d.id}>
                        {dateLabel(d.date)} · {d.start_time} · {currency(d.price)} · {d.vehicle?.passengerSeats}+1
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
                  {selected.length}/{r.passengers.length} koltuk seçildi. Fiyat yeni sefere göre tekrar hesaplanır.
                </p>
              </>
            ) : current === "passengers" ? (
              r.passengers.map((p, i) => (
                <label className="field" key={i}>
                  {i + 1}. yolcu
                  <input name="passenger" defaultValue={p} minLength={2} maxLength={100} required />
                </label>
              ))
            ) : (
              <>
                <p className="form-hint">
                  Bu form ödeme veya iade yapmaz. Banka/havale veya nakit olarak dışarıda gerçekleşen işlemi kaydeder.
                </p>
                <div className="form-grid">
                  <label className="field">
                    {current === "payment" ? "Tahsil edilen" : "İade edilen"} tutar (TL)
                    <input
                      type="number"
                      name="amount"
                      min="0.01"
                      step="0.01"
                      max={(current === "payment" ? r.balance_due || 0 : r.net_paid || 0) / 100}
                      defaultValue={current === "payment" && r.balance_due ? r.balance_due / 100 : undefined}
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
                  <input name="externalReference" minLength={3} maxLength={100} required />
                </label>
                <label className="checkbox-label">
                  <input name="recordedExternally" type="checkbox" required />
                  <span>Bu işlemin dışarıda gerçekleştiğini doğruluyorum.</span>
                </label>
              </>
            )}
            <button className="btn btn-small" disabled={busy || (current === "move" && selected.length !== r.passengers.length)}>
              {busy ? <LoaderCircle size={15} className="spin" /> : <Check size={15} />}
              Kaydet
            </button>
          </form>
        )}
        {r.ledger?.length ? (
          <div className="ledger-history">
            <h3>Tahsilat / iade kayıtları</h3>
            {r.ledger.map((p) => (
              <p key={p.id}>
                {stamp(p.created_at)} · {p.kind === "refund" ? "İade" : "Tahsilat"} · {currency(p.amount)} ·{" "}
                {p.method === "cash" ? "Nakit" : "Havale"} · {p.external_reference}
              </p>
            ))}
          </div>
        ) : null}
      </section>
    </Modal>
  );
}
export function CampaignManager({ catalog }: { catalog: Catalog }) {
  const feedback = useFeedback();
  const [data, setData] = useState<Campaign | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<Campaign>("/campaigns").then(setData).catch(feedback.error);
  }, []);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!data) return;
    const f = new FormData(e.currentTarget);
    setBusy(true);
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
      feedback.ok("Kampanya ayarları kaydedildi. Yeni kuponlar bu koşullarla oluşturulur.");
    } catch (e) {
      feedback.error(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {!data && <p className="admin-empty">Yükleniyor…</p>}
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
    [error, setError] = useState(""),
    [passengers, setPassengers] = useState(""),
    [scanning, setScanning] = useState(false);
  useEffect(() => {
    setError("");
    api<NonNullable<typeof data>>("/admin/reports?date=" + date)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [date]);
  return (
    <>
      <button className="btn scan-button" onClick={() => setScanning(true)}>
        <QrCode size={17} /> Bilet okut
      </button>
      {scanning && <TicketScanner onClose={() => setScanning(false)} />}
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
      {passengers && (
        <PassengerList departureId={passengers} onClose={() => setPassengers("")} />
      )}
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
                      <SeatCourse sold={(d.vehicle?.sellableSeats || 0) - d.available} total={d.vehicle?.sellableSeats || 0} size="sm" />
                      <small>
                        {d.confirmedGuests} onaylı misafir · {d.available} boş koltuk
                      </small>
                    </td>
                    <td>
                      <button className="text-link" onClick={() => setPassengers(d.id)}>
                        <Users size={15} />
                        Yolcu listesi
                      </button>
                      {!isNativeApp() && (
                        <a
                          className="text-link"
                          href={
                            "/api/admin/departures/" + d.id + "/passengers.csv"
                          }
                        >
                          <Download size={15} />
                          CSV indir
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.departures.length && <p className="admin-empty">Bu gün için sefer yok.</p>}
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
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
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
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await post("/admin/notifications/process", {});
                  await load();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy && <LoaderCircle size={15} className="spin" />}
              Hatırlatmaları ve kuyruğu işle
            </button>
            <button
              className="text-link"
              onClick={() => load().catch((e) => setError(e.message))}
            >
              Yenile
            </button>
          </div>
          {!data.items.length && <p className="admin-empty">Kuyrukta mesaj yok.</p>}
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
