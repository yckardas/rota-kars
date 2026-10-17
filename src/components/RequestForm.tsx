import { useState, type FormEvent } from "react";
import { Check, CalendarDays, ShieldCheck, LoaderCircle } from "lucide-react";
import { Modal } from "./Modal";
import { post } from "../lib/api";
import { today, type Hotel } from "../lib/types";
export function RequestForm({
  kind = "hotel",
  hotels = [],
  hotelId,
  initialNotes = "",
  onClose,
}: {
  kind?: "hotel" | "private-tour" | "vehicle";
  hotels?: Hotel[];
  hotelId?: string;
  initialNotes?: string;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState("");
  const title =
    kind === "hotel"
      ? "Konaklama talebi"
      : kind === "vehicle"
        ? "Araç kiralama talebi"
        : "Size özel tur talebi";
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const r = await post<{ reference: string }>("/requests", {
        kind,
        name: f.get("name"),
        email: f.get("email"),
        phone: f.get("phone"),
        checkIn: f.get("checkIn"),
        ...(kind === "hotel" ? { checkOut: f.get("checkOut") } : {}),
        guests: Number(f.get("guests")),
        notes: f.get("notes"),
        ...(f.get("hotelId") ? { hotelId: f.get("hotelId") } : {}),
        consent: f.get("consent") === "on",
      });
      setResult(r.reference);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={title} onClose={onClose}>
      {result ? (
        <div className="request-success">
          <div className="success-icon">
            <Check />
          </div>
          <h2>Talebiniz kaydedildi.</h2>
          <p>Referans numaranız</p>
          <strong className="reference">{result}</strong>
          <p>
            Bu bir kesin rezervasyon değildir. Müsaitlik ve fiyat, acente
            onayından sonra netleşir.
          </p>
          <button className="btn" onClick={onClose}>
            Tamam
          </button>
        </div>
      ) : (
        <form className="request-form" onSubmit={submit}>
          <h2>
            {kind === "hotel"
              ? "Kars’ta kendinize bir yer ayırın."
              : "Birlikte güzel bir rota çizelim."}
          </h2>
          <p className="muted">
            {kind === "hotel"
              ? "Tarihlerinizi paylaşın, anlaşmalı otellerimiz için konaklama seçeneklerinizi birlikte planlayalım."
              : "Tarihinizi ve grubunuzu paylaşın. Size uygun programı birlikte netleştirelim."}
          </p>
          {hotels.length > 0 && (
            <label className="field">
              Otel tercihi
              <select name="hotelId" defaultValue={hotelId || ""}>
                <option value="">Öneri almak istiyorum</option>
                {hotels.map((h) => (
                  <option value={h.id} key={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="form-grid">
            <label className="field">
              Adınız soyadınız
              <input
                name="name"
                autoComplete="name"
                required
                minLength={2}
                maxLength={100}
              />
            </label>
            <label className="field">
              Telefon numaranız
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                required
                minLength={10}
                maxLength={24}
              />
            </label>
          </div>
          <label className="field">
            E-posta adresiniz
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </label>
          <div className="form-grid">
            <label className="field">
              {kind === "hotel" ? "Giriş tarihi" : "Planlanan tarih"}
              <input name="checkIn" type="date" min={today()} required />
            </label>
            {kind === "hotel" ? (
              <label className="field">
                Çıkış tarihi
                <input name="checkOut" type="date" min={today()} required />
              </label>
            ) : null}
            <label className="field">
              Kişi sayısı
              <input
                name="guests"
                type="number"
                min={1}
                max={50}
                defaultValue={2}
                required
              />
            </label>
          </div>
          <label className="field">
            Eklemek istedikleriniz
            <textarea
              name="notes"
              defaultValue={initialNotes}
              rows={3}
              maxLength={2000}
              placeholder="Oda, ulaşım veya tur tercihiniz…"
            />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" name="consent" required />
            <span>
              <a href="/bilgilendirme" target="_blank">
                Aydınlatma metnini
              </a>{" "}
              okudum. Talebimin değerlendirilmesi için bilgilerimin işlenmesini
              kabul ediyorum.
            </span>
          </label>
          <div className="inline-note">
            <CalendarDays size={17} /> Kesin rezervasyon ve ödeme, müsaitlik
            teyidinden sonra yapılır.
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="btn block" disabled={busy}>
            {busy ? (
              <>
                <LoaderCircle className="spin" size={17} /> Kaydediliyor
              </>
            ) : (
              "Talebimi gönder"
            )}
          </button>
          <small className="form-foot">
            <ShieldCheck size={14} /> Bu aşamada ödeme alınmaz.
          </small>
        </form>
      )}
    </Modal>
  );
}
