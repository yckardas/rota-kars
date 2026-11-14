import { useEffect, useState, type FormEvent } from "react";
import { Download, LoaderCircle, Mail, MessageCircle, Phone } from "lucide-react";
import { api, post } from "../../lib/api";
import { dateLabel, type Hotel, type Tour } from "../../lib/types";
import { downloadCsv } from "../../lib/csv";
import { isNativeApp } from "../../lib/native";

export type RequestRecord = {
  id: string;
  kind: string;
  status: string;
  created_at: number;
  updated_at?: number;
  notes?: { at: number; by: string; text: string }[];
  body: {
    name: string;
    email: string;
    phone: string;
    checkIn: string;
    checkOut?: string;
    guests: number;
    notes: string;
    // Konaklama talebi ayrıntıları (tur sayfasından gelince tourId de olur).
    tourId?: string;
    hotelId?: string;
    rooms?: number;
    roomType?: string;
    children?: number;
    budget?: string;
  };
};
// Durum anahtarları sunucudaki REQUEST_STATUS ile aynı; konaklamada acente otelle
// görüşüp döndüğü için adlar o akışa göre okunur (server/requests.mjs).
const STATUS: Record<string, string> = {
  new: "Yeni",
  contacted: "Arandı",
  in_progress: "Görüşülüyor",
  offered: "Teklif verildi",
  won: "Rezervasyona döndü",
  lost: "Kapandı",
};
const HOTEL_STATUS: Record<string, string> = {
  ...STATUS,
  contacted: "Müşteri arandı",
  in_progress: "Otelle görüşülüyor",
  offered: "Teklif müşteriye iletildi",
  won: "Konaklama onaylandı",
  lost: "Olmadı",
};
export const requestStatus = (kind: string, status: string) =>
  (kind === "hotel" ? HOTEL_STATUS : STATUS)[status] || status;
const ROOM_TYPES: Record<string, string> = {
  single: "Tek kişilik",
  double: "Çift kişilik",
  twin: "İki ayrı yatak",
  triple: "Üç kişilik",
  family: "Aile odası",
};
const BUDGETS: Record<string, string> = { economy: "Ekonomik", standard: "Orta", premium: "Üst seviye" };
const KIND: Record<string, string> = {
  hotel: "Konaklama talebi",
  vehicle: "Araç kiralama talebi",
  "private-tour": "Özel tur talebi",
};
const wa = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  const intl = d.startsWith("90") ? d : d.replace(/^0/, "90");
  return intl.length >= 11 ? "https://wa.me/" + intl : "";
};

// Gelen talepler: durum takibi, not geçmişi, tek dokunuşla arama/WhatsApp.
export function RequestManager({ initialQuery = "", tours = [] }: { initialQuery?: string; tours?: Tour[] }) {
  const [items, setItems] = useState<RequestRecord[] | null>(null),
    [hotels, setHotels] = useState<Hotel[]>([]),
    [kind, setKind] = useState("all"),
    [filter, setFilter] = useState(initialQuery ? "all" : "open"),
    [search, setSearch] = useState(initialQuery),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    api<{ requests: RequestRecord[]; hotels: Hotel[] }>("/admin/dashboard")
      .then((d) => {
        setItems(d.requests);
        setHotels(d.hotels || []);
      })
      .catch((e) => setError(e.message));
  }, []);
  const text = search.trim().toLocaleLowerCase("tr-TR");
  const visible = (items || []).filter(
    (r) =>
      (filter === "open" ? !["won", "lost"].includes(r.status) : filter === "all" ? true : r.status === filter) &&
      (kind === "all" || r.kind === kind) &&
      (!text || JSON.stringify(r.body).toLocaleLowerCase("tr-TR").includes(text)),
  );
  const exportCsv = () =>
    downloadCsv("talepler.csv", [
      ["Tarih", "Tür", "Durum", "Ad", "Telefon", "E-posta", "Giriş", "Çıkış", "Kişi", "Oda", "Tur", "Otel", "Not"],
      ...visible.map((r) => [
        new Date(r.created_at).toLocaleDateString("tr-TR"),
        KIND[r.kind] || r.kind,
        requestStatus(r.kind, r.status),
        r.body.name,
        r.body.phone,
        r.body.email,
        r.body.checkIn,
        r.body.checkOut,
        r.body.guests,
        r.body.rooms ? `${r.body.rooms} × ${ROOM_TYPES[r.body.roomType || ""] || ""}` : "",
        tourName(r.body.tourId),
        hotelName(r.body.hotelId),
        r.body.notes,
      ]),
    ]);
  const tourName = (id?: string) => (id ? tours.find((t) => t.id === id)?.name || id : ""),
    hotelName = (id?: string) => (id ? hotels.find((h) => h.id === id)?.name || "" : "");
  async function update(id: string, body: { status?: string; note?: string }) {
    setBusy(id);
    setError("");
    try {
      const next = await post<RequestRecord>("/admin/requests/" + id, body);
      setItems((cur) => (cur || []).map((r) => (r.id === id ? next : r)));
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy("");
    }
  }
  async function addNote(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const form = e.currentTarget,
      note = String(new FormData(form).get("note") || "").trim();
    if (note && (await update(id, { note }))) form.reset();
  }
  return (
    <>
      <div className="desk-toolbar">
        <label className="field reservation-search">
          Ara
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ad, telefon, e-posta veya not"
          />
        </label>
        {!isNativeApp() && visible.length > 0 && (
          <button className="text-link" onClick={exportCsv}>
            <Download size={15} /> CSV
          </button>
        )}
      </div>
      <div className="status-filters" role="group" aria-label="Talep durumu">
        {[
          ["open", "Açık"],
          ["new", "Yeni"],
          ["contacted", "Arandı"],
          ["in_progress", "Görüşülüyor"],
          ["offered", "Teklif verildi"],
          ["all", "Tümü"],
        ].map(([id, label]) => (
          <button key={id} type="button" className={"chip" + (filter === id ? " active" : "")} aria-pressed={filter === id} onClick={() => setFilter(id)}>
            {label}
            {id === "new" ? ` (${(items || []).filter((r) => r.status === "new").length})` : ""}
          </button>
        ))}
      </div>
      <div className="status-filters" role="group" aria-label="Talep türü">
        {[["all", "Tüm türler"], ...Object.entries(KIND)].map(([id, label]) => (
          <button key={id} type="button" className={"chip" + (kind === id ? " active" : "")} aria-pressed={kind === id} onClick={() => setKind(id)}>
            {label}
          </button>
        ))}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-requests">
        {!items && !error && <p className="admin-empty">Yükleniyor…</p>}
        {items && visible.length === 0 && <p className="admin-empty">Bu filtrede talep yok.</p>}
        {visible.map((r) => (
          <article key={r.id} className={"request-card status-" + r.status}>
            <div className="section-heading">
              <h3>{KIND[r.kind] || "Talep"}</h3>
              <small>{new Date(r.created_at).toLocaleDateString("tr-TR")}</small>
            </div>
            <strong>{r.body.name}</strong>
            <p>
              {r.body.checkIn ? dateLabel(r.body.checkIn) : "Tarih belirtilmedi"}
              {r.body.checkOut ? " — " + dateLabel(r.body.checkOut) : ""} · {r.body.guests} kişi
              {r.body.children ? ` (${r.body.children} çocuk)` : ""}
            </p>
            {(r.body.tourId || r.body.rooms || r.body.hotelId || r.body.budget) && (
              <ul className="request-facts">
                {r.body.tourId && <li>Tur: {tourName(r.body.tourId)}</li>}
                {r.body.rooms && (
                  <li>
                    Oda: {r.body.rooms} × {ROOM_TYPES[r.body.roomType || ""] || "tercih yok"}
                  </li>
                )}
                {r.body.hotelId && <li>Otel tercihi: {hotelName(r.body.hotelId) || "—"}</li>}
                {r.body.budget && <li>Bütçe: {BUDGETS[r.body.budget]}</li>}
              </ul>
            )}
            <p className="muted">{r.body.notes || "Ek not yok."}</p>
            <div className="passenger-actions">
              {r.body.phone && (
                <a className="btn btn-outline btn-small" href={"tel:" + r.body.phone.replace(/[^\d+]/g, "")}>
                  <Phone size={15} /> Ara
                </a>
              )}
              {r.body.phone && wa(r.body.phone) && (
                <a className="btn btn-outline btn-small" href={wa(r.body.phone)} target="_blank" rel="noreferrer">
                  <MessageCircle size={15} /> WhatsApp
                </a>
              )}
              {r.body.email && (
                <a className="btn btn-outline btn-small" href={"mailto:" + r.body.email}>
                  <Mail size={15} /> E-posta
                </a>
              )}
            </div>
            <label className="field">
              Durum
              <select value={r.status} disabled={busy === r.id} onChange={(e) => update(r.id, { status: e.target.value })}>
                {Object.keys(STATUS).map((id) => (
                  <option key={id} value={id}>
                    {requestStatus(r.kind, id)}
                  </option>
                ))}
              </select>
            </label>
            {Boolean(r.notes?.length) && (
              <ul className="request-notes">
                {r.notes!.map((n, i) => (
                  <li key={i}>
                    <small>
                      {new Date(n.at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })} · {n.by}
                    </small>
                    {n.text}
                  </li>
                ))}
              </ul>
            )}
            <form className="request-note-form" onSubmit={(e) => addNote(e, r.id)}>
              <input name="note" maxLength={1000} placeholder="Not ekle (ör. fiyat gönderildi)" aria-label="Not" />
              <button className="btn btn-small" disabled={busy === r.id}>
                {busy === r.id ? <LoaderCircle className="spin" size={15} /> : null}
                Ekle
              </button>
            </form>
          </article>
        ))}
      </div>
    </>
  );
}
