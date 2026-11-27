// VIP transfer sayfasında turdan bağımsız online transfer rezervasyonu: güzergâh ve yön,
// tarih/saat ve uçuş no, kişi, bagaj, adres, iletişim. Fiyat tablodan anında gösterilir;
// kesin tutarı sunucu hesaplar. Sözleşmeler onaylanınca kayıt açılır ve mevcut kartla
// ödeme ekranına geçilir (tam ödeme; ödeme alınınca rezervasyon anında onaylanır).
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  BedDouble,
  Bus,
  CreditCard,
  LoaderCircle,
  Plane,
  ShieldCheck,
  TrainFront,
} from "lucide-react";
import { api, post } from "../lib/api";
import { Link, localPath, useLang } from "../lib/i18n";
import { currency, today, type Reservation } from "../lib/types";
import {
  TRANSFER_DESTINATIONS,
  TRANSFER_DIRECTIONS,
  TRANSFER_POINTS,
  destinationOffered,
  tierFor,
  transferPrice,
  transferRoute,
  type TransferDestinationId,
  type TransferDirection,
  type TransferPointId,
  type TransferService,
} from "../lib/transfer";
import {
  LegalConsents,
  consentsComplete,
  noConsents,
  type Consents,
} from "./LegalConsents";
import { useTurnstile } from "./Turnstile";
import "./TransferBooking.css";

const pointIcons = { airport: Plane, bus: Bus, train: TrainFront };
type Leg = { date: string; time: string; flight: string };
const emptyLeg: Leg = { date: "", time: "", flight: "" };
type Quote = {
  amount: number;
  tierLabel: string;
  lateBooking: boolean;
  freeCancelHours: number;
  preInfo: string;
  contract: string;
  cancellation: string[];
};
const CONSENT_MISSING =
  "Ödemeye geçmeden önce her sözleşmeyi okuyup ayrı ayrı onaylayın.";
const addDays = (ymd: string, n: number) => {
  const d = new Date(ymd + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const atOf = (l: Leg) => Date.parse(`${l.date}T${l.time}:00+03:00`);

export function TransferBooking() {
  const { t, lang, locale } = useLang();
  const [config, setConfig] = useState<TransferService | null>(null),
    [point, setPoint] = useState<TransferPointId>("airport"),
    [destination, setDestination] = useState<TransferDestinationId>("kars"),
    [direction, setDirection] = useState<TransferDirection>("arrival"),
    [arrival, setArrival] = useState<Leg>(emptyLeg),
    [departure, setDeparture] = useState<Leg>(emptyLeg),
    [pax, setPax] = useState(2),
    [bags, setBags] = useState(2),
    [address, setAddress] = useState(""),
    [contact, setContact] = useState({ name: "", email: "", phone: "" }),
    [notes, setNotes] = useState(""),
    [quote, setQuote] = useState<Quote | null>(null),
    [consents, setConsents] = useState<Consents>(noConsents),
    [consentError, setConsentError] = useState(""),
    [marketingConsent, setMarketingConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [unpaid, setUnpaid] = useState<Reservation | null>(null),
    human = useTurnstile("booking");
  useEffect(() => {
    api<TransferService>("/transfers/config")
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);
  const legs = useMemo(
    () =>
      (direction === "both"
        ? (["arrival", "departure"] as const)
        : [direction]
      ).map((type) => ({
        type,
        ...(type === "arrival" ? arrival : departure),
      })),
    [direction, arrival, departure],
  );
  // Seçim değişince onaylanan metinler (tutar, saat) eskir: onay adımı kapanır.
  useEffect(() => {
    setQuote(null);
    setConsents(noConsents);
  }, [
    point,
    destination,
    direction,
    arrival,
    departure,
    pax,
    bags,
    address,
    contact,
  ]);
  if (!config?.enabled) return null;
  const people = (n: number) =>
      n === 1 ? t("1 kişi") : t("{count} kişi", { count: n }),
    bagText = (n: number) =>
      n === 0
        ? t("Bagaj yok")
        : n === 1
          ? t("1 bagaj")
          : t("{count} bagaj", { count: n });
  const tier = tierFor(pax),
    price = transferPrice(config, destination, point, direction, pax),
    priceOf = (p: TransferPointId) =>
      transferPrice(config, destination, p, direction, pax),
    destinations = TRANSFER_DESTINATIONS.filter((d) =>
      destinationOffered(config, d.id),
    ),
    first = today(),
    last = addDays(first, config.maxAdvanceDays),
    airport = point === "airport",
    flightLabel = airport
      ? t("Uçuş numarası")
      : t("Otobüs / tren seferi (isteğe bağlı)");
  const dateText = (l: Leg) =>
    l.date
      ? new Intl.DateTimeFormat(locale, {
          day: "numeric",
          month: "long",
          weekday: "short",
          timeZone: "Europe/Istanbul",
        }).format(new Date(l.date + "T12:00:00+03:00")) +
        (l.time ? " · " + l.time : "")
      : "—";
  const trip = () => ({
    point,
    destination,
    direction,
    ...(direction !== "departure" ? { arrival } : {}),
    ...(direction !== "arrival" ? { departure } : {}),
    pax,
    bags,
    address,
  });
  // Sözleşmeler: fiyat ve metinler sunucudan (aynı seçimle) alınır.
  async function review(e: FormEvent) {
    e.preventDefault();
    setError("");
    const soon = Date.now() + config!.minLeadHours * 3600000;
    if (legs.some((l) => atOf(l) < Date.now()))
      return setError(t("Geçmiş bir tarih veya saat seçilemez."));
    if (legs.some((l) => atOf(l) < soon))
      return setError(
        t(
          "Online transfer alınış saatinden en az {n} saat önce ayrılabilir. Daha yakın bir saat için bizi arayın.",
          { n: config!.minLeadHours },
        ),
      );
    if (direction === "both" && atOf(departure) <= atOf(arrival))
      return setError(t("Dönüş transferi gelişten sonra olmalı."));
    setBusy(true);
    try {
      const q = await post<Quote>("/transfers/quote", {
        ...trip(),
        ...contact,
      });
      setQuote(q);
      setTimeout(
        () =>
          document
            .getElementById("transfer-consents")
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        50,
      );
    } catch (err) {
      setError(t((err as Error).message));
    } finally {
      setBusy(false);
    }
  }
  async function pay() {
    if (!consentsComplete(consents)) {
      setConsentError(CONSENT_MISSING);
      document
        .querySelector<HTMLInputElement>(
          "#transfer-consents .legal-consents input:not(:checked)",
        )
        ?.focus();
      return;
    }
    setConsentError("");
    setBusy(true);
    setError("");
    let created: Reservation | null = null;
    try {
      created = await post<Reservation>("/transfers/reservations", {
        ...trip(),
        ...contact,
        notes,
        consents,
        marketingConsent,
        lang,
        turnstileToken: human.token,
      });
      const s = await post<{ redirectUrl: string }>("/payments/start", {
        reference: created.reference,
        email: contact.email,
        lang,
      });
      window.location.assign(localPath(lang, s.redirectUrl));
    } catch (err) {
      human.reset();
      setBusy(false);
      // Kayıt açıldı ama ödeme başlatılamadı: Rezervasyonum'dan ödenebilir.
      if (created) setUnpaid(created);
      else setError(t((err as Error).message));
    }
  }
  if (unpaid)
    return (
      <section className="container transfer-booking" id="online-transfer">
        <div className="tb-done">
          <h2>{t("Kaydınız alındı, ödeme başlatılamadı.")}</h2>
          <p>
            {t(
              "{reference} numaralı transfer kaydınız ödeme bekliyor. Rezervasyonum sayfasından kartla ödeyebilirsiniz; ödeme alınınca rezervasyonunuz onaylanır.",
              { reference: unpaid.reference },
            )}
          </p>
          <Link
            className="btn"
            to={"/rezervasyonum?ref=" + encodeURIComponent(unpaid.reference)}
          >
            <CreditCard size={17} />
            {t("Rezervasyonuma git")}
          </Link>
        </div>
      </section>
    );
  const legFields = (type: "arrival" | "departure") => {
    const value = type === "arrival" ? arrival : departure,
      set = type === "arrival" ? setArrival : setDeparture;
    return (
      <div className="tb-leg" key={type}>
        <h4>
          {type === "arrival"
            ? t("Geliş · {point} → konaklama yeriniz", {
                point: t(TRANSFER_POINTS.find((p) => p.id === point)!.label),
              })
            : t("Dönüş · konaklama yeriniz → {point}", {
                point: t(TRANSFER_POINTS.find((p) => p.id === point)!.label),
              })}
        </h4>
        <div className="tb-leg-grid">
          <label className="field">
            {t("Tarih")}
            <input
              type="date"
              required
              min={
                type === "departure" && arrival.date && direction === "both"
                  ? arrival.date
                  : first
              }
              max={last}
              value={value.date}
              onChange={(e) => set({ ...value, date: e.target.value })}
            />
          </label>
          <label className="field">
            {type === "arrival"
              ? airport
                ? t("İniş saati")
                : t("Varış saati")
              : t("Alınış saati")}
            <input
              type="time"
              required
              step={300}
              value={value.time}
              onChange={(e) => set({ ...value, time: e.target.value })}
            />
          </label>
          <label className="field">
            {flightLabel}
            <input
              value={value.flight}
              required={airport}
              maxLength={40}
              autoCapitalize="characters"
              placeholder={airport ? t("Örn. TK2734") : t("Örn. Doğu Ekspresi")}
              onChange={(e) => set({ ...value, flight: e.target.value })}
            />
          </label>
        </div>
        {type === "departure" && airport && (
          <p className="form-hint">
            {t(
              "Alınış saati otelden çıkış saatinizdir; uçuşunuzdan en az 2 saat önceye planlamanızı öneririz.",
            )}
          </p>
        )}
      </div>
    );
  };
  return (
    <section
      className="container transfer-booking"
      id="online-transfer"
      aria-labelledby="online-transfer-title"
    >
      <header className="tb-head">
        <h2 id="online-transfer-title">{t("Transferinizi şimdi ayırın.")}</h2>
        <p>
          {t(
            "Güzergâhı seçin, fiyatı hemen görün, kartla ödeyin; rezervasyonunuz ödemeyle birlikte onaylansın.",
          )}
        </p>
      </header>
      <div className="tb-layout">
        <div className="tb-main">
          <form className="tb-form" onSubmit={review}>
            <fieldset className="tb-step">
              <legend>
                <span>1</span>
                {t("Güzergâh")}
              </legend>
              {destinations.length > 1 && (
                <div
                  className="transfer-directions"
                  role="radiogroup"
                  aria-label={t("Konaklama yeri")}
                >
                  {destinations.map((d) => (
                    <label key={d.id} className="transfer-direction">
                      <input
                        type="radio"
                        name="tb-destination"
                        checked={destination === d.id}
                        onChange={() => setDestination(d.id)}
                      />
                      <BedDouble size={16} strokeWidth={1.6} />
                      <span>{t(d.label)}</span>
                    </label>
                  ))}
                </div>
              )}
              <div
                className="transfer-points"
                role="radiogroup"
                aria-label={t("Karşılama noktası")}
              >
                {TRANSFER_POINTS.map((p) => {
                  const amount = priceOf(p.id),
                    Icon = pointIcons[p.id];
                  return (
                    <label
                      key={p.id}
                      className={
                        "transfer-point" + (amount ? "" : " is-unavailable")
                      }
                    >
                      <input
                        type="radio"
                        name="tb-point"
                        checked={point === p.id}
                        disabled={!amount}
                        onChange={() => setPoint(p.id)}
                      />
                      <Icon size={18} strokeWidth={1.6} />
                      <span>{t(p.label)}</span>
                      <b>{amount ? currency(amount) : t("Yok")}</b>
                    </label>
                  );
                })}
              </div>
              <div
                className="transfer-directions"
                role="radiogroup"
                aria-label={t("Transfer yönü")}
              >
                {TRANSFER_DIRECTIONS.map((d) => {
                  const amount = transferPrice(
                    config,
                    destination,
                    point,
                    d.id,
                    pax,
                  );
                  return (
                    <label
                      key={d.id}
                      className={
                        "transfer-direction" + (amount ? "" : " is-unavailable")
                      }
                    >
                      <input
                        type="radio"
                        name="tb-direction"
                        checked={direction === d.id}
                        disabled={!amount}
                        onChange={() => setDirection(d.id)}
                      />
                      <span>{t(d.label)}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <fieldset className="tb-step">
              <legend>
                <span>2</span>
                {airport ? t("Tarih, saat ve uçuş") : t("Tarih ve saat")}
              </legend>
              {legs.map((l) => legFields(l.type))}
              <p className="form-hint">
                {t(
                  "Online transfer alınış saatinden en az {n} saat önce ayrılabilir. Daha yakın bir saat için bizi arayın.",
                  { n: config.minLeadHours },
                )}
              </p>
            </fieldset>
            <fieldset className="tb-step">
              <legend>
                <span>3</span>
                {t("Yolcular ve adres")}
              </legend>
              <div className="tb-leg-grid">
                <label className="field">
                  {t("Kişi sayısı")}
                  <select
                    value={pax}
                    onChange={(e) => setPax(Number(e.target.value))}
                  >
                    {Array.from({ length: config.maxPax }, (_, i) => i + 1).map(
                      (n) => (
                        <option key={n} value={n}>
                          {people(n)}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label className="field">
                  {t("Bagaj")}
                  <select
                    value={bags}
                    onChange={(e) => setBags(Number(e.target.value))}
                  >
                    {Array.from({ length: 21 }, (_, i) => i).map((n) => (
                      <option key={n} value={n}>
                        {bagText(n)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="field">
                {destination === "kars"
                  ? t("Otel adı veya adres (Kars merkez)")
                  : t("Otel adı veya adres (Sarıkamış)")}
                <input
                  value={address}
                  required
                  minLength={3}
                  maxLength={200}
                  autoComplete="street-address"
                  placeholder={t("Örn. otel adı, mahalle ve cadde")}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </label>
              <p className="form-hint">
                {t(
                  "15 kişiden kalabalık gruplar ve Kars dışındaki adresler için bizi arayın; transferi birlikte planlayalım.",
                )}
              </p>
            </fieldset>
            <fieldset className="tb-step">
              <legend>
                <span>4</span>
                {t("İletişim")}
              </legend>
              <div className="tb-leg-grid tb-contact">
                <label className="field">
                  {t("Ad soyad")}
                  <input
                    value={contact.name}
                    required
                    minLength={2}
                    maxLength={100}
                    autoComplete="name"
                    onChange={(e) =>
                      setContact({ ...contact, name: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  {t("E-posta")}
                  <input
                    type="email"
                    value={contact.email}
                    required
                    maxLength={254}
                    autoComplete="email"
                    onChange={(e) =>
                      setContact({ ...contact, email: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  {t("Telefon")}
                  <input
                    type="tel"
                    value={contact.phone}
                    required
                    minLength={10}
                    maxLength={24}
                    pattern="[+0-9\s()\-]+"
                    autoComplete="tel"
                    onChange={(e) =>
                      setContact({ ...contact, phone: e.target.value })
                    }
                  />
                </label>
              </div>
              <label className="field">
                {t("Not (isteğe bağlı)")}
                <textarea
                  value={notes}
                  rows={2}
                  maxLength={500}
                  placeholder={t("Örn. çocuk koltuğu, ek bilgi")}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
            </fieldset>
            {error && !quote && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {!quote && (
              <button className="btn tb-next" disabled={busy || !price}>
                {busy ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <ShieldCheck size={17} />
                )}
                {t("Devam et: sözleşmeler ve ödeme")}
              </button>
            )}
          </form>
          {quote && (
            <section className="tb-step tb-confirm" id="transfer-consents">
              <h3>
                <span>5</span>
                {t("Onay ve ödeme")}
              </h3>
              {quote.lateBooking && (
                <p className="info-note" role="note">
                  {t(
                    "Alınış saatine {n} saatten az kaldı. Ödeme yaptıktan sonra iptal ederseniz bedelin %30'u iade edilmez.",
                    { n: quote.freeCancelHours },
                  )}
                </p>
              )}
              <LegalConsents
                service="transfer"
                value={consents}
                onChange={(next) => {
                  setConsents(next);
                  if (consentsComplete(next)) setConsentError("");
                }}
                documents={{
                  preInfo: quote.preInfo,
                  contract: quote.contract,
                  cancellation: quote.cancellation,
                }}
                error={consentError}
                disabled={busy}
              />
              <label className="checkbox-label optional-consent">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                />
                <span>
                  {t(
                    "İsteğe bağlı: Kampanya, indirim ve yeni rotalar hakkında bana e-posta ve SMS ile ticari elektronik ileti gönderilmesine ve bu amaçla ad, e-posta ve telefon bilgilerimin işlenmesine onay veriyorum. Onayımı dilediğim zaman ücretsiz geri alabilirim.",
                  )}
                </span>
              </label>
              {human.widget}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <div className="tb-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setQuote(null)}
                  disabled={busy}
                >
                  <ArrowLeft size={17} />
                  {t("Bilgileri düzenle")}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={pay}
                  disabled={busy || !human.ready}
                >
                  {busy ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <CreditCard size={17} />
                  )}
                  {t("Kartla öde · {amount}", {
                    amount: currency(quote.amount),
                  })}
                </button>
              </div>
            </section>
          )}
        </div>
        <aside className="tb-summary" aria-label={t("Transfer özeti")}>
          <h3>{t("Transfer özeti")}</h3>
          <p className="tb-route">
            {transferRoute({ point, destination, direction }, t)}
          </p>
          <dl>
            {legs.map((l) => (
              <div key={l.type}>
                <dt>{l.type === "arrival" ? t("Geliş") : t("Dönüş")}</dt>
                <dd>
                  {dateText(l)}
                  {l.flight ? ` · ${l.flight}` : ""}
                </dd>
              </div>
            ))}
            <div>
              <dt>{t("Yolcu")}</dt>
              <dd>
                {people(pax)} · {bagText(bags)}
              </dd>
            </div>
            {address && (
              <div>
                <dt>{t("Adres")}</dt>
                <dd>{address}</dd>
              </div>
            )}
          </dl>
          <div className="tb-price">
            <span>
              {tier
                ? t("{tier} grubunun toplamı · KDV dahil", {
                    tier: t(tier.label),
                  })
                : t("15 kişiden kalabalık gruplar için bizi arayın.")}
            </span>
            <strong>
              {quote ? currency(quote.amount) : price ? currency(price) : "—"}
            </strong>
          </div>
          <ul className="tb-facts">
            <li>
              {t(
                "Tam ödeme, kartla (3D Secure). Ödeme alınınca rezervasyonunuz anında onaylanır.",
              )}
            </li>
            <li>
              {t("Alınış saatinden {n} saat öncesine kadar ücretsiz iptal.", {
                n: config.freeCancelHours,
              })}
            </li>
          </ul>
        </aside>
      </div>
    </section>
  );
}
