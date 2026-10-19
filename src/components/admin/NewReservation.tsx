import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, LoaderCircle, MessageCircle, Ticket } from "lucide-react";
import { api, post } from "../../lib/api";
import {
  currency,
  dateLabel,
  today,
  type Catalog,
  type Departure,
  type Reservation,
  type Seat,
  type Vehicle,
} from "../../lib/types";
import { Modal } from "../Modal";
import { SeatMap } from "../SeatMap";

const waNumber = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  const intl = digits.startsWith("90") ? digits : digits.replace(/^0/, "90");
  return intl.length >= 11 ? intl : "";
};

// Telefon/WhatsApp ile gelen müşteri için panelden rezervasyon.
export function NewReservation({
  catalog,
  onClose,
  onCreated,
}: {
  catalog: Catalog;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [departures, setDepartures] = useState<Departure[]>([]),
    [departureId, setDepartureId] = useState(""),
    [seatData, setSeatData] = useState<{ seats: Seat[]; vehicle: Vehicle } | null>(null),
    [selected, setSelected] = useState<number[]>([]),
    [name, setName] = useState(""),
    [passengers, setPassengers] = useState<string[]>([]),
    [paymentMode, setPaymentMode] = useState<"on_tour" | "deposit" | "full">("on_tour"),
    [paid, setPaid] = useState(false),
    [amount, setAmount] = useState(""),
    [method, setMethod] = useState<"cash" | "bank_transfer">("cash"),
    [confirm, setConfirm] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<Reservation | null>(null);
  useEffect(() => {
    api<Departure[]>("/admin/departures")
      .then((rows) => setDepartures(rows.filter((d) => d.date >= today())))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    setSelected([]);
    setSeatData(null);
    if (!departureId) return;
    api<{ seats: Seat[]; vehicle: Vehicle }>(`/admin/departures/${encodeURIComponent(departureId)}/seats`)
      .then(setSeatData)
      .catch((e) => setError(e.message));
  }, [departureId]);
  const departure = departures.find((d) => d.id === departureId),
    total = (departure?.price || 0) * selected.length,
    tourName = (id: string) => catalog.tours.find((t) => t.id === id)?.name || id;
  // Yolcu adı alanları koltuk sayısını izler; ilki iletişim kişisiyle dolar.
  const names = useMemo(
    () => selected.map((_, i) => passengers[i] ?? (i === 0 ? name : "")),
    [selected, passengers, name],
  );
  const toggleSeat = (n: number) =>
    setSelected((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n].sort((a, b) => a - b)));
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const amountKurus = Math.round(Number(String(amount).replace(",", ".")) * 100);
      const r = await post<Reservation>("/admin/reservations", {
        departureId,
        seats: selected,
        name: name.trim(),
        phone: String(f.get("phone") || "").trim(),
        email: String(f.get("email") || "").trim(),
        passengers: names.map((n) => n.trim()),
        paymentMode,
        notes: String(f.get("notes") || "").trim(),
        ...(paid && amountKurus > 0 ? { payment: { amount: amountKurus, method } } : {}),
        confirm,
      });
      setResult(r);
      onCreated();
    } catch (e) {
      setError((e as Error).message);
      if (departureId)
        api<{ seats: Seat[]; vehicle: Vehicle }>(`/admin/departures/${encodeURIComponent(departureId)}/seats`)
          .then(setSeatData)
          .catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  if (result) {
    const wa = waNumber(result.phone);
    const text = `Merhaba ${result.name}, Rota Kars rezervasyonunuz: ${result.reference} · ${tourName(result.tourId)} · ${dateLabel(result.date)} ${result.start_time || ""}. Koltuk: ${result.seats.join(", ")}. Biletiniz: ${result.ticketUrl}`;
    return (
      <Modal title="Rezervasyon eklendi" onClose={onClose}>
        <div className="request-success">
          <div className="success-icon">
            <Check />
          </div>
          <h2>{result.status === "confirmed" ? "Rezervasyon onaylandı." : "Ön rezervasyon kaydedildi."}</h2>
          <strong className="reference">{result.reference}</strong>
          <p>
            {tourName(result.tourId)} · {dateLabel(result.date)} · Koltuk {result.seats.join(", ")}
          </p>
          {result.qrDataUrl && <img src={result.qrDataUrl} alt="Bilet QR kodu" width={160} height={160} />}
          <div className="push-actions">
            {wa && (
              <a
                className="btn"
                href={`https://wa.me/${wa}?text=${encodeURIComponent(text)}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle size={16} /> Bileti WhatsApp'tan gönder
              </a>
            )}
            <button className="btn btn-outline" onClick={onClose}>
              Kapat
            </button>
          </div>
        </div>
      </Modal>
    );
  }
  return (
    <Modal title="Yeni rezervasyon" onClose={onClose} wide>
      <form className="admin-editor new-reservation" onSubmit={submit}>
        <p className="muted">
          Telefon veya WhatsApp ile gelen müşteriyi kaydedin. Online satışı kapanmış seferlere de eklenebilir.
        </p>
        <label className="field">
          Sefer
          <select value={departureId} onChange={(e) => setDepartureId(e.target.value)} required>
            <option value="">Sefer seçin</option>
            {departures.map((d) => (
              <option key={d.id} value={d.id}>
                {tourName(d.tour_id)} · {dateLabel(d.date)} {d.start_time} · {d.available} boş
                {d.active ? "" : " · satış kapalı"}
              </option>
            ))}
          </select>
        </label>
        {seatData && (
          <div className="new-reservation-seats">
            <SeatMap vehicle={seatData.vehicle} seats={seatData.seats} selected={selected} onSelect={toggleSeat} />
            <p className="muted">
              {selected.length ? `Seçilen koltuk: ${selected.join(", ")} · Tutar ${currency(total)}` : "Koltuk seçin."}
            </p>
          </div>
        )}
        <div className="form-grid">
          <label className="field">
            Ad soyad (iletişim kişisi)
            <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={100} autoComplete="off" />
          </label>
          <label className="field">
            Telefon
            <input name="phone" type="tel" inputMode="tel" required minLength={10} maxLength={24} autoComplete="off" />
          </label>
          <label className="field">
            E-posta (isteğe bağlı)
            <input name="email" type="email" maxLength={254} autoComplete="off" />
          </label>
        </div>
        {selected.length > 0 && (
          <fieldset className="passenger-fields">
            <legend>Yolcular</legend>
            {selected.map((seat, i) => (
              <label className="field" key={seat}>
                Koltuk {seat}
                <input
                  value={names[i]}
                  onChange={(e) => {
                    const next = [...names];
                    next[i] = e.target.value;
                    setPassengers(next);
                  }}
                  required
                  minLength={2}
                  maxLength={100}
                />
              </label>
            ))}
          </fieldset>
        )}
        <fieldset className="choice-row">
          <legend>Ödeme</legend>
          {(
            [
              ["on_tour", "Turda ödenecek"],
              ["deposit", "Kapora"],
              ["full", "Tam ödeme"],
            ] as const
          ).map(([id, label]) => (
            <label key={id} className="checkbox-label">
              <input type="radio" name="paymentMode" checked={paymentMode === id} onChange={() => setPaymentMode(id)} />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
        <label className="checkbox-label">
          <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
          <span>Ödeme alındı (tahsilat kaydı oluştur)</span>
        </label>
        {paid && (
          <div className="form-grid">
            <label className="field">
              Tahsil edilen tutar (TL)
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" required placeholder={total ? String(total / 100) : ""} />
            </label>
            <label className="field">
              Yöntem
              <select value={method} onChange={(e) => setMethod(e.target.value as "cash" | "bank_transfer")}>
                <option value="cash">Nakit</option>
                <option value="bank_transfer">Havale / EFT</option>
              </select>
            </label>
          </div>
        )}
        <label className="checkbox-label">
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
          <span>Hemen onayla (kapora/tam ödeme seçildiyse tahsilat gerekir)</span>
        </label>
        <label className="field">
          Not (isteğe bağlı)
          <textarea name="notes" maxLength={500} rows={2} placeholder="Ör. otelden alınacak, çocuk koltuğu" />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="btn block" disabled={busy || !departureId || !selected.length}>
          {busy ? <LoaderCircle className="spin" size={17} /> : <Ticket size={17} />}
          Rezervasyonu kaydet{total ? ` · ${currency(total)}` : ""}
        </button>
      </form>
    </Modal>
  );
}
