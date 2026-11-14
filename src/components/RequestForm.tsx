// Talep formu: konaklama, size özel tur ve araç kiralama. Konaklamada (otel sayfası ya
// da tur sayfasındaki "Konaklama da ayarlayalım") tarih, kişi, oda tercihi ve iletişim
// alınır; talep panele düşer, acente anlaşmalı otelle görüşüp müşteriye döner.
import { useState, type FormEvent } from "react";
import { Check, CalendarDays, ShieldCheck, LoaderCircle } from "lucide-react";
import { Modal } from "./Modal";
import { useTurnstile } from "./Turnstile";
import { post } from "../lib/api";
import { useLang } from "../lib/i18n";
import { today, type Hotel } from "../lib/types";

const ROOM_TYPES: [string, string][] = [
  ["single", "Tek kişilik"],
  ["double", "Çift kişilik (büyük yatak)"],
  ["twin", "İki ayrı yatak"],
  ["triple", "Üç kişilik"],
  ["family", "Aile odası"],
];
const BUDGETS: [string, string][] = [
  ["economy", "Ekonomik"],
  ["standard", "Orta"],
  ["premium", "Üst seviye"],
];

export function RequestForm({
  kind = "hotel",
  hotels = [],
  hotelId,
  tourId,
  tourName,
  initialCheckIn,
  initialGuests = 2,
  initialNotes = "",
  onClose,
}: {
  kind?: "hotel" | "private-tour" | "vehicle";
  hotels?: Hotel[];
  hotelId?: string;
  // Tur sayfasından gelen konaklama talebi hangi tura bağlı.
  tourId?: string;
  tourName?: string;
  initialCheckIn?: string;
  initialGuests?: number;
  initialNotes?: string;
  onClose: () => void;
}) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState(""),
    human = useTurnstile("request");
  const hotel = kind === "hotel";
  const title = hotel
    ? t("Konaklama talebi")
    : kind === "vehicle"
      ? t("Araç kiralama talebi")
      : t("Size özel tur talebi");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const num = (k: string) => (f.get(k) ? Number(f.get(k)) : undefined);
    setBusy(true);
    setError("");
    try {
      const r = await post<{ reference: string }>("/requests", {
        kind,
        name: f.get("name"),
        email: f.get("email"),
        phone: f.get("phone"),
        checkIn: f.get("checkIn"),
        guests: Number(f.get("guests")),
        notes: f.get("notes"),
        ...(hotel
          ? {
              checkOut: f.get("checkOut"),
              rooms: num("rooms"),
              ...(f.get("roomType") ? { roomType: f.get("roomType") } : {}),
              ...(num("children") ? { children: num("children") } : {}),
              ...(f.get("budget") ? { budget: f.get("budget") } : {}),
              ...(tourId ? { tourId } : {}),
            }
          : {}),
        ...(f.get("hotelId") ? { hotelId: f.get("hotelId") } : {}),
        consent: f.get("consent") === "on",
        turnstileToken: human.token,
      });
      setResult(r.reference);
    } catch (e) {
      setError((e as Error).message);
      human.reset();
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
          <h2>{t("Talebiniz kaydedildi.")}</h2>
          <p>{t("Referans numaranız")}</p>
          <strong className="reference">{result}</strong>
          <p>
            {hotel
              ? t(
                  "Bu bir kesin rezervasyon değildir. Anlaşmalı otellerimizle görüşüp müsaitlik ve fiyatla size en kısa sürede dönüyoruz; e-postanıza da bir özet gönderdik.",
                )
              : t("Bu bir kesin rezervasyon değildir. Müsaitlik ve fiyat, acente onayından sonra netleşir.")}
          </p>
          <button className="btn" onClick={onClose}>
            {t("Tamam")}
          </button>
        </div>
      ) : (
        <form className="request-form" onSubmit={submit}>
          <h2>{hotel ? t("Kars’ta kendinize bir yer ayırın.") : t("Birlikte güzel bir rota çizelim.")}</h2>
          <p className="muted">
            {hotel && tourName
              ? t(
                  "{tour} turunuz için konaklamayı da biz ayarlayalım. Tercihlerinizi paylaşın, anlaşmalı otellerimizle görüşüp size dönelim.",
                  { tour: tourName },
                )
              : hotel
                ? t("Tarihlerinizi paylaşın, anlaşmalı otellerimiz için konaklama seçeneklerinizi birlikte planlayalım.")
                : t("Tarihinizi ve grubunuzu paylaşın. Size uygun programı birlikte netleştirelim.")}
          </p>
          {hotels.length > 0 && (
            <label className="field">
              {t("Otel tercihi")}
              <select name="hotelId" defaultValue={hotelId || ""}>
                <option value="">{t("Öneri almak istiyorum")}</option>
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
              {t("Adınız soyadınız")}
              <input name="name" autoComplete="name" required minLength={2} maxLength={100} />
            </label>
            <label className="field">
              {t("Telefon numaranız")}
              <input name="phone" type="tel" autoComplete="tel" required minLength={10} maxLength={24} />
            </label>
          </div>
          <label className="field">
            {t("E-posta adresiniz")}
            <input type="email" name="email" autoComplete="email" required maxLength={254} />
          </label>
          <div className="form-grid">
            <label className="field">
              {hotel ? t("Giriş tarihi") : t("Planlanan tarih")}
              <input name="checkIn" type="date" min={today()} defaultValue={initialCheckIn} required />
            </label>
            {hotel ? (
              <label className="field">
                {t("Çıkış tarihi")}
                <input name="checkOut" type="date" min={today()} required />
              </label>
            ) : null}
            <label className="field">
              {t("Kişi sayısı")}
              <input name="guests" type="number" min={1} max={50} defaultValue={initialGuests} required />
            </label>
            {hotel && (
              <label className="field">
                {t("Bunlardan çocuk (isteğe bağlı)")}
                <input name="children" type="number" min={0} max={20} defaultValue={0} />
              </label>
            )}
          </div>
          {hotel && (
            <div className="form-grid request-rooms">
              <label className="field">
                {t("Oda sayısı")}
                <input name="rooms" type="number" min={1} max={20} defaultValue={1} required />
              </label>
              <label className="field">
                {t("Oda tercihi")}
                <select name="roomType" defaultValue="double">
                  {ROOM_TYPES.map(([id, label]) => (
                    <option key={id} value={id}>
                      {t(label)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                {t("Bütçe (isteğe bağlı)")}
                <select name="budget" defaultValue="">
                  <option value="">{t("Fark etmez")}</option>
                  {BUDGETS.map(([id, label]) => (
                    <option key={id} value={id}>
                      {t(label)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <label className="field">
            {t("Eklemek istedikleriniz")}
            <textarea
              name="notes"
              defaultValue={initialNotes}
              rows={3}
              maxLength={2000}
              placeholder={
                hotel ? t("Konum, kahvaltı, erken giriş gibi tercihleriniz…") : t("Oda, ulaşım veya tur tercihiniz…")
              }
            />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" name="consent" required />
            <span>
              <a href="/bilgilendirme#kvkk" target="_blank">
                {t("Aydınlatma metnini")}
              </a>{" "}
              {t(
                "okudum. Bilgilerimin talebimin değerlendirilmesi ve size dönüş yapılması için işleneceğini biliyorum.",
              )}
            </span>
          </label>
          <div className="inline-note">
            <CalendarDays size={17} /> {t("Kesin rezervasyon ve ödeme, müsaitlik teyidinden sonra yapılır.")}
          </div>
          {human.widget}
          {error && (
            <p className="error" role="alert">
              {t(error)}
            </p>
          )}
          <button className="btn block" disabled={busy || !human.ready}>
            {busy ? (
              <>
                <LoaderCircle className="spin" size={17} /> {t("Kaydediliyor")}
              </>
            ) : (
              t("Talebimi gönder")
            )}
          </button>
          <small className="form-foot">
            <ShieldCheck size={14} /> {t("Bu aşamada ödeme alınmaz.")}
          </small>
        </form>
      )}
    </Modal>
  );
}
