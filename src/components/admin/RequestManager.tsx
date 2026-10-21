import { useEffect, useState, type FormEvent } from "react";
import { Download, LoaderCircle, Mail, MessageCircle, Phone } from "lucide-react";
import { api, post } from "../../lib/api";
import { dateLabel } from "../../lib/types";
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
  };
};
const STATUS: Record<string, string> = {
  new: "Yeni",
  contacted: "Arandı",
  offered: "Teklif verildi",
  won: "Rezervasyona döndü",
  lost: "Kapandı",
};
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
export function RequestManager({ initialQuery = "" }: { initialQuery?: string }) {
  const [items, setItems] = useState<RequestRecord[] | null>(null),
    [filter, setFilter] = useState(initialQuery ? "all" : "open"),
    [search, setSearch] = useState(initialQuery),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    api<{ requests: RequestRecord[] }>("/admin/dashboard")
      .then((d) => setItems(d.requests))
      .catch((e) => setError(e.message));
  }, []);
  const text = search.trim().toLocaleLowerCase("tr-TR");
  const visible = (items || []).filter(
    (r) =>
      (filter === "open" ? !["won", "lost"].includes(r.status) : filter === "all" ? true : r.status === filter) &&
      (!text || JSON.stringify(r.body).toLocaleLowerCase("tr-TR").includes(text)),
  );
  const exportCsv = () =>
    downloadCsv("talepler.csv", [
      ["Tarih", "Tür", "Durum", "Ad", "Telefon", "E-posta", "Giriş", "Çıkış", "Kişi", "Not"],
      ...visible.map((r) => [
        new Date(r.created_at).toLocaleDateString("tr-TR"),
        KIND[r.kind] || r.kind,
        STATUS[r.status] || r.status,
        r.body.name,
        r.body.phone,
        r.body.email,
        r.body.checkIn,
        r.body.checkOut,
        r.body.guests,
        r.body.notes,
      ]),
    ]);
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
          ["offered", "Teklif verildi"],
          ["all", "Tümü"],
        ].map(([id, label]) => (
          <button key={id} type="button" className={"chip" + (filter === id ? " active" : "")} aria-pressed={filter === id} onClick={() => setFilter(id)}>
            {label}
            {id === "new" ? ` (${(items || []).filter((r) => r.status === "new").length})` : ""}
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
            </p>
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
                {Object.entries(STATUS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
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
