// Talep formu: konaklama, tur bilgisi/fiyatı, size özel tur ve araç kiralama. Konaklamada (otel sayfası ya
// da tur sayfasındaki "Konaklama da ayarlayalım") tarih, kişi, oda tercihi ve iletişim
// alınır; talep panele düşer, acente anlaşmalı otelle görüşüp müşteriye döner. İletişim
// sayfasındaki "Bize yazın" (message) yalnız iletişim bilgisi ve mesaj alır.
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
// "2026-12-01" → "2026-12-02": çıkış en erken girişin ertesi günü olabilir.
const nextDay = (ymd: string) => {
  const d = new Date(ymd + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
const CHECKOUT_ERROR = "Çıkış tarihi giriş tarihinden sonra olmalıdır.";
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
  hours,
  onClose,
}: {
  kind?: "hotel" | "tour-info" | "private-tour" | "vehicle" | "message";
  hotels?: Hotel[];
  hotelId?: string;
  // Tur sayfasından gelen talep (konaklama, tur bilgisi) hangi tura bağlı.
  tourId?: string;
  tourName?: string;
  initialCheckIn?: string;
  initialGuests?: number;
  initialNotes?: string;
  // Sistemde kayıtlı çalışma saatleri; başarı ekranında yanıt süresi buna dayanır.
  hours?: string;
  onClose: () => void;
}) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState(""),
    // Konaklamada tarih hatası formun altında değil, çıkış tarihinin yanında görünür.
    [checkIn, setCheckIn] = useState(initialCheckIn || ""),
    [checkOut, setCheckOut] = useState(""),
    [dateError, setDateError] = useState(""),
    human = useTurnstile("request");
  const hotel = kind === "hotel",
    message = kind === "message",
    info = kind === "tour-info" && Boolean(tourName);
  const title = hotel
    ? t("Konaklama talebi")
    : message
      ? t("Bize yazın")
      : kind === "vehicle"
        ? t("Araç kiralama talebi")
        : info
          ? t("{tour} için bilgi ve fiyat", { tour: tourName! })
          : t("Size özel tur talebi");
  const checkDates = (from: string, to: string) =>
    setDateError(hotel && from && to && to <= from ? CHECKOUT_ERROR : "");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (hotel && checkIn && checkOut && checkOut <= checkIn) {
      setDateError(CHECKOUT_ERROR);
      e.currentTarget
        .querySelector<HTMLInputElement>('input[name="checkOut"]')
        ?.focus();
      return;
    }
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
        ...(message
          ? {}
          : { checkIn: f.get("checkIn"), guests: Number(f.get("guests")) }),
        notes: f.get("notes"),
        ...(hotel
          ? {
              checkOut: f.get("checkOut"),
              rooms: num("rooms"),
              ...(f.get("roomType") ? { roomType: f.get("roomType") } : {}),
              ...(num("children") ? { children: num("children") } : {}),
              ...(f.get("budget") ? { budget: f.get("budget") } : {}),
            }
          : {}),
        ...(tourId && (hotel || kind === "tour-info") ? { tourId } : {}),
        ...(f.get("hotelId") ? { hotelId: f.get("hotelId") } : {}),
        consent: f.get("consent") === "on",
        turnstileToken: human.token,
      });
      setResult(r.reference);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === CHECKOUT_ERROR) setDateError(msg);
      else setError(msg);
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
          <h2>
            {message ? t("Mesajınız bize ulaştı.") : t("Talebiniz kaydedildi.")}
          </h2>
          <p>{t("Referans numaranız")}</p>
          <strong className="reference">{result}</strong>
          <p>
            {message
              ? t("Size telefonla ya da e-postayla dönüyoruz.")
              : hotel
                ? hours
                  ? t(
                      "Bu bir kesin rezervasyon değildir. Anlaşmalı otellerimizle görüşüp müsaitlik ve fiyatı size iletiyoruz; e-postanıza da bir özet gönderdik.",
                    )
                  : t(
                      "Bu bir kesin rezervasyon değildir. Anlaşmalı otellerimizle görüşüp müsaitlik ve fiyatla size en kısa sürede dönüyoruz; e-postanıza da bir özet gönderdik.",
                    )
                : t(
                    "Bu bir kesin rezervasyon değildir. Müsaitlik ve fiyat, acente onayından sonra netleşir.",
                  )}
          </p>
          {hours && (
            <p className="muted">
              {t("Çalışma saatlerimiz: {hours}.", { hours })}{" "}
              {t(
                "Bu saatlerde gelen taleplere aynı gün, daha geç gelenlere ertesi gün dönüyoruz.",
              )}
            </p>
          )}
          <button className="btn" onClick={onClose}>
            {t("Tamam")}
          </button>
        </div>
      ) : (
        <form className="request-form" onSubmit={submit}>
          <h2>
            {hotel
              ? t("Kars’ta kendinize bir yer ayırın.")
              : message
                ? t("Sorunuzu kısaca yazın.")
                : info
                  ? t("Fiyat ve müsaitliği size iletelim.")
                  : t("Birlikte güzel bir rota çizelim.")}
          </h2>
          <p className="muted">
            {hotel && tourName
              ? t(
                  "{tour} turunuz için konaklamayı da biz ayarlayalım. Tercihlerinizi paylaşın, anlaşmalı otellerimizle görüşüp size dönelim.",
                  { tour: tourName },
                )
              : hotel
                ? t("Tarihlerinizi paylaşın, anlaşmalı otellerimiz için konaklama seçeneklerinizi birlikte planlayalım.")
                : message
                  ? t(
                      "Tur, transfer, konaklama ya da rezervasyonunuzla ilgili her şeyi sorabilirsiniz; ekibimiz size dönsün.",
                    )
                  : info
                    ? t(
                        "{tour} için düşündüğünüz tarihi ve kişi sayısını yazın; fiyat, program ve boş koltuk bilgisiyle size dönelim.",
                        { tour: tourName! },
                      )
                    : t(
                        "Tarihinizi ve grubunuzu paylaşın. Size uygun programı birlikte netleştirelim.",
                      )}
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
          {!message && (
            <div className="form-grid">
              <label className="field">
                {hotel ? t("Giriş tarihi") : t("Planlanan tarih")}
                <input
                  name="checkIn"
                  type="date"
                  min={today()}
                  value={checkIn}
                  onChange={(e) => {
                    setCheckIn(e.target.value);
                    checkDates(e.target.value, checkOut);
                  }}
                  required
                />
              </label>
              {hotel ? (
                <label className="field">
                  {t("Çıkış tarihi")}
                  <input
                    name="checkOut"
                    type="date"
                    min={checkIn ? nextDay(checkIn) : today()}
                    value={checkOut}
                    onChange={(e) => {
                      setCheckOut(e.target.value);
                      checkDates(checkIn, e.target.value);
                    }}
                    aria-invalid={dateError ? true : undefined}
                    aria-describedby={
                      dateError ? "request-checkout-error" : undefined
                    }
                    required
                  />
                  {dateError && (
                    <small
                      className="field-error"
                      id="request-checkout-error"
                      role="alert"
                    >
                      {t(dateError)}
                    </small>
                  )}
                </label>
              ) : null}
              <label className="field">
                {t("Kişi sayısı")}
                <input
                  name="guests"
                  type="number"
                  min={1}
                  max={50}
                  defaultValue={initialGuests}
                  required
                />
              </label>
              {hotel && (
                <label className="field">
                  {t("Bunlardan çocuk (isteğe bağlı)")}
                  <input
                    name="children"
                    type="number"
                    min={0}
                    max={20}
                    defaultValue={0}
                  />
                </label>
              )}
            </div>
          )}
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
            {message ? t("Mesajınız") : t("Eklemek istedikleriniz")}
            <textarea
              name="notes"
              defaultValue={initialNotes}
              rows={message ? 5 : 3}
              maxLength={2000}
              minLength={message ? 2 : undefined}
              required={message}
              placeholder={
                hotel
                  ? t("Konum, kahvaltı, erken giriş gibi tercihleriniz…")
                  : message
                    ? t("Sorunuzu ya da isteğinizi yazın…")
                    : info
                      ? t(
                          "Merak ettikleriniz: fiyat, kalkış noktası, çocuk indirimi…",
                        )
                      : t("Oda, ulaşım veya tur tercihiniz…")
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
          {!message && (
            <div className="inline-note">
              <CalendarDays size={17} />{" "}
              {t(
                "Kesin rezervasyon ve ödeme, müsaitlik teyidinden sonra yapılır.",
              )}
            </div>
          )}
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
            ) : message ? (
              t("Mesajımı gönder")
            ) : (
              t("Talebimi gönder")
            )}
          </button>
          {!message && (
            <small className="form-foot">
              <ShieldCheck size={14} /> {t("Bu aşamada ödeme alınmaz.")}
            </small>
          )}
        </form>
      )}
    </Modal>
  );
}
