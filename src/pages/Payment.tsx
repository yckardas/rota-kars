import {
  useEffect,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { useParams } from "react-router-dom";
import {
  Link,
  localeOf,
  localPath,
  useLang,
  useLocalNavigate,
} from "../lib/i18n";
import { CreditCard, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { api, post } from "../lib/api";
import { currency, type Catalog, type Reservation } from "../lib/types";
import { StatusStamp } from "../components/ReservationTicket";
import {
  CONSENT_MISSING,
  LegalConsents,
  allConsents,
  consentsComplete,
  noConsents,
  type Consents,
  type LegalDocuments,
} from "../components/LegalConsents";
import {
  CardMarks,
  CardVisual,
  cardProblems,
  emptyCard,
  formatExpiry,
  formatPan,
  type CardField,
  type CardValues,
} from "../components/PaymentCard";
type Session = {
  id: string;
  reference: string;
  amount: number;
  status: "pending" | "paid" | "failed" | "unverified";
  expired: boolean;
  reservationStatus: string;
  provider?: string;
  message?: string | null;
  card?: { masked: string; brand: string } | null;
  summary?: {
    tourName: string;
    date: string;
    startTime: string;
    pickup: string;
    count: number;
    seats: number[];
    paymentMode: "deposit" | "full";
    total: number;
    deposit: number;
    paid: number;
  };
  consented?: boolean;
  documents?: LegalDocuments | null;
};
// Rezervasyon sonrası ve "Rezervasyonum"da: kalan kaporayı kartla ödeme kartı.
export function PayDeposit({
  catalog,
  reservation: r,
  email,
}: {
  catalog: Catalog;
  reservation: Reservation;
  email: string;
}) {
  const { t, lang } = useLang();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const due = Math.max(0, r.deposit - (r.net_paid || 0));
  const preview = !catalog.payment.enabled && catalog.payment.preview;
  if (
    !(catalog.payment.enabled || preview) ||
    r.status !== "pending_agency" ||
    !due
  )
    return null;
  async function pay() {
    setBusy(true);
    setError("");
    try {
      const s = await post<{ redirectUrl: string }>("/payments/start", {
        reference: r.reference,
        email,
        lang,
      });
      // Sitenin kendi deneme sayfası dil önekini korur; dış sağlayıcı adresi olduğu gibi.
      window.location.assign(localPath(lang, s.redirectUrl));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <section className="pay-deposit" aria-labelledby="pay-title">
      <div>
        {/* Önizleme (banka incelemesi): kart ekranı görünür ama çekim yapılmaz; başlık bunu söyler. */}
        <h2 id="pay-title">
          {preview ? t("Kartla ödeme yakında") : t("Kaporanızı şimdi ödeyin.")}
        </h2>
        <p>
          {r.deposit < r.total ? t("%30 kapora") : t("Tur bedeli")}{" "}
          <strong>{currency(due)}</strong>.{" "}
          {preview
            ? t(
                "Banka onayının ardından bu tutarı buradan kartla ödeyebileceksiniz. Şimdilik kartınızdan çekim yapılmaz; acentemiz ödeme için sizinle iletişime geçecek.",
              )
            : t(
                "Ödeme alınınca rezervasyonunuz anında onaylanır ve QR kodlu biletiniz geçerli olur.",
              )}
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
      <button className="btn" onClick={pay} disabled={busy}>
        {busy ? (
          <LoaderCircle className="spin" size={17} />
        ) : (
          <CreditCard size={17} />
        )}
        {preview ? t("Kart ekranını görüntüle") : t("Kartla öde")}
      </button>
      <small>
        <ShieldCheck size={14} />{" "}
        {catalog.payment.cardForm
          ? t(
              "Ödeme Vakıfbank sanal POS ile alınır; kartınız 3D Secure (SMS onayı) ile doğrulanır ve kart bilgileriniz saklanmaz.",
            )
          : t(
              "Kart bilgileriniz ödeme kuruluşunun güvenli sayfasında girilir; bizim sunucularımıza ulaşmaz.",
            )}
      </small>
    </section>
  );
}
// Deneme ödeme sayfası: gerçek sağlayıcı bağlanana kadar akışı uçtan uca denemek
// için. Gerçek para çekilmez; sonuç sunucuya imzalı bildirim gibi işlenir.
export function TestPayment() {
  const { t } = useLang();
  const { id } = useParams(),
    navigate = useLocalNavigate(),
    [s, setS] = useState<Session | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    api<Session>("/payments/sessions/" + id)
      .then(setS)
      .catch((e) => setError(e.message));
  }, [id]);
  async function finish(result: "paid" | "failed") {
    setBusy(true);
    try {
      await post("/payments/test/" + id + "/result", { result });
      navigate("/odeme/sonuc/" + id, { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <section className="container payment-page">
      <article className="ticket-check payment-card">
        <p className="payment-test-flag">
          {t("Deneme ödeme sayfası · gerçek para çekilmez")}
        </p>
        <h1>{s ? currency(s.amount) : "…"}</h1>
        <p className="muted">
          {s
            ? t("{reference} numaralı rezervasyonun kaporası", {
                reference: s.reference,
              })
            : t("Ödeme yükleniyor…")}
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {s && s.status === "pending" && !s.expired && (
          <div className="button-row">
            <button
              className="btn"
              disabled={busy}
              onClick={() => finish("paid")}
            >
              {t("Ödemeyi tamamla")}
            </button>
            <button
              className="btn btn-outline"
              disabled={busy}
              onClick={() => finish("failed")}
            >
              {t("Başarısız ödeme dene")}
            </button>
          </div>
        )}
        {s && (s.status !== "pending" || s.expired) && (
          <Link className="btn" to={"/odeme/sonuc/" + s.id}>
            {t("Sonucu gör")}
          </Link>
        )}
      </article>
    </section>
  );
}
// Kart formu: canlı kart görseli, alan doğrulaması ve öde düğmesi. Rezervasyon
// ödemesi (/odeme/kart/:id) ve herkese açık /odeme sayfası aynı formu kullanır.
function CardForm({
  catalog,
  amountLabel,
  busy,
  onPay,
  beforePay,
  children,
  footer,
}: {
  catalog: Catalog;
  // Düğmede gösterilecek biçimlenmiş tutar ("₺1.250"); yoksa yalnız "Öde".
  amountLabel: string | null;
  busy: boolean;
  // Kart geçerliyse çağrılır; reset formu temizler.
  onPay: (card: CardValues, reset: () => void) => void;
  // Kart alanlarından önceki alanlar için; false dönerse ödeme başlamaz.
  beforePay?: (form: HTMLFormElement) => boolean;
  children?: ReactNode;
  // Kart alanlarından sonra, öde düğmesinden önce (onay kutuları).
  footer?: ReactNode;
}) {
  const { t } = useLang();
  const [card, setCard] = useState<CardValues>(emptyCard),
    [focused, setFocused] = useState<CardField | null>(null),
    [problems, setProblems] = useState<Partial<Record<CardField, string>>>({});
  // Hatalı gösterilen alan düzeltildikçe mesajı kalkar.
  const change = (field: CardField, value: string) => {
    const next = { ...card, [field]: value };
    setCard(next);
    if (problems[field])
      setProblems((p) => ({ ...p, [field]: cardProblems(next)[field] }));
  };
  const blur = (field: CardField) => {
    setFocused((f) => (f === field ? null : f));
    if (card[field])
      setProblems((p) => ({ ...p, [field]: cardProblems(card)[field] }));
  };
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (beforePay && !beforePay(form)) return;
    const found = cardProblems(card);
    setProblems(found);
    const first = (["holder", "pan", "expiry", "cvv"] as CardField[]).find(
      (f) => found[f],
    );
    if (first) {
      form.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
      return;
    }
    onPay(card, () => {
      (document.activeElement as HTMLElement | null)?.blur();
      setFocused(null);
      setCard(emptyCard);
    });
  }
  const field = (
    name: CardField,
    label: string,
    props: InputHTMLAttributes<HTMLInputElement>,
    format: (v: string) => string = (v) => v,
  ) => (
    <label className="field">
      {t(label)}
      <input
        name={name}
        value={card[name]}
        onChange={(e) => change(name, format(e.target.value))}
        onFocus={() => setFocused(name)}
        onBlur={() => blur(name)}
        aria-invalid={problems[name] ? true : undefined}
        aria-describedby={problems[name] ? "card-err-" + name : undefined}
        spellCheck={false}
        {...props}
      />
      {problems[name] && (
        <small className="field-error" id={"card-err-" + name}>
          {t(problems[name]!)}
        </small>
      )}
    </label>
  );
  return (
    <form className="card-form" onSubmit={submit} autoComplete="on" noValidate>
      {children}
      <CardVisual card={card} focused={focused} t={t} />
      {field("holder", "Kart üzerindeki isim", {
        autoComplete: "cc-name",
        maxLength: 60,
        autoCapitalize: "characters",
      })}
      {field(
        "pan",
        "Kart numarası",
        {
          inputMode: "numeric",
          autoComplete: "cc-number",
          placeholder: "0000 0000 0000 0000",
          maxLength: 19,
        },
        formatPan,
      )}
      <div className="card-form-row">
        {field("expiry", "Son kullanma (AA/YY)", {
          inputMode: "numeric",
          autoComplete: "cc-exp",
          placeholder: t("AA/YY"),
          maxLength: 5,
          onChange: (e) =>
            change("expiry", formatExpiry(e.target.value, card.expiry)),
        })}
        {field(
          "cvv",
          "Güvenlik kodu (CVV)",
          {
            inputMode: "numeric",
            autoComplete: "cc-csc",
            placeholder: "•••",
            maxLength: 3,
          },
          (v) => v.replace(/\D/g, "").slice(0, 3),
        )}
      </div>
      {footer}
      <button className="btn" disabled={busy}>
        {busy ? (
          <LoaderCircle className="spin" size={17} />
        ) : (
          <LockKeyhole size={17} />
        )}
        {busy
          ? t("Bankanıza bağlanılıyor…")
          : amountLabel
            ? t("{amount} öde", { amount: amountLabel })
            : t("Öde")}
      </button>
      <p className="card-form-note">
        <ShieldCheck size={15} />
        <span>
          {t(
            "Bir sonraki adımda bankanızın 3D Secure sayfasında SMS koduyla onaylayacaksınız. Visa, Mastercard ve Troy kabul edilir. Kart bilgileriniz saklanmaz.",
          )}
        </span>
      </p>
      <CardMarks />
      {catalog.payment.simulator && (
        <p className="card-form-note">
          {t(
            "Simülasyon kartı: 4111 1111 1111 1111, ileri bir tarih, herhangi bir CVV. 0002 ile biten kart reddedilir.",
          )}
        </p>
      )}
    </form>
  );
}
// Ödeme ekranının altındaki satıcı künyesi (banka incelemesinde aranan bilgiler).
function MerchantInfo({ catalog }: { catalog: Catalog }) {
  const { t } = useLang();
  const b = catalog.business;
  return (
    <footer className="merchant-info">
      <strong>{b.legalName || b.name}</strong>
      <span>{b.address}</span>
      <span>
        {b.phone} · {b.email}
      </span>
      {b.tursabNo && (
        <span>
          {t("TÜRSAB belge no {no}", { no: b.tursabNo })}
          {b.mersis ? " · MERSİS " + b.mersis : ""}
        </span>
      )}
      <nav aria-label={t("Yasal metinler")}>
        <Link to="/iletisim#kunye" target="_blank">
          {t("Künye")}
        </Link>
        <Link to="/bilgilendirme#sozlesme" target="_blank">
          {t("Ön bilgilendirme ve hizmet sözleşmesi")}
        </Link>
        <Link to="/bilgilendirme#iptal" target="_blank">
          {t("İptal ve iade koşulları")}
        </Link>
        <Link to="/bilgilendirme#kvkk" target="_blank">
          {t("KVKK aydınlatma metni")}
        </Link>
      </nav>
    </footer>
  );
}
// Vakıfbank kart ödemesi: önce ödenen rezervasyonun özeti ve zorunlu onay
// kutuları, sonra canlı kart görseli eşliğinde kart bilgisi; 3D Secure için
// bankaya geçilir. Onaylar kart bilgisi gönderilmeden önce sunucuya kaydedilir.
export function CardPayment({ catalog }: { catalog: Catalog }) {
  const { t, locale } = useLang();
  const { id } = useParams(),
    [s, setS] = useState<Session | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [consents, setConsents] = useState<Consents>(noConsents),
    [consentError, setConsentError] = useState("");
  useEffect(() => {
    api<Session>("/payments/sessions/" + id)
      .then((x) => {
        setS(x);
        if (x.message) setError(x.message);
        // Reddedilen karttan sonra aynı oturuma dönülürse onaylar kayıtlıdır.
        if (x.consented) setConsents(allConsents);
      })
      .catch((e) => setError(e.message));
  }, [id]);
  const preview = s?.provider === "preview";
  function checkConsents(form: HTMLFormElement) {
    if (consentsComplete(consents)) return true;
    setConsentError(CONSENT_MISSING);
    form
      .querySelector<HTMLInputElement>(".legal-consents input:not(:checked)")
      ?.focus();
    return false;
  }
  async function pay(card: CardValues, reset: () => void) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      // Onaylar her ödeme denemesinden önce oturuma yazılır (önizlemede de).
      await post("/payments/consent/" + id, consents);
      // Önizleme: kart bilgisi hiçbir yere gönderilmez, form temizlenir.
      if (preview) {
        reset();
        setNotice(
          "Onaylarınız kaydedildi. Kartla ödeme, banka onayının ardından açılacak. Kartınızdan çekim yapılmadı; ön rezervasyonunuz kayıtlı, acentemiz sizinle iletişime geçecek.",
        );
        setBusy(false);
        return;
      }
      const res = await post<{ redirect: string }>("/payments/card/" + id, card);
      reset();
      // Bankaya yönlendiren sayfa sunucudadır; dil öneki eklenmez.
      window.location.assign(res.redirect);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }
  const open = s && s.status === "pending" && !s.expired,
    sum = s?.summary;
  const day = sum
    ? new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
        weekday: "long",
        timeZone: "Europe/Istanbul",
      }).format(new Date(sum.date + "T12:00:00+03:00"))
    : "";
  return (
    <section className="container payment-page">
      <article className="ticket-check payment-card">
        <ol className="payment-steps" aria-label={t("Rezervasyon adımları")}>
          <li className="is-done">{t("Tur seçimi")}</li>
          <li className="is-done">{t("Rezervasyon")}</li>
          <li className="is-current" aria-current="step">
            {t("Ödeme")}
          </li>
        </ol>
        {catalog.payment.simulator && (
          <p className="payment-test-flag">
            {t("Banka simülasyonu · gerçek para çekilmez")}
          </p>
        )}
        {preview && (
          <p className="payment-test-flag">
            {t("Önizleme · kartla ödeme banka onayından sonra açılacak")}
          </p>
        )}
        <h1>{s ? currency(s.amount) : "…"}</h1>
        <p className="muted">
          {s
            ? t("{reference} numaralı rezervasyonun ödemesi", {
                reference: s.reference,
              })
            : t("Ödeme yükleniyor…")}
        </p>
        {sum && (
          <dl className="payment-summary">
            <div>
              <dt>{t("Tur")}</dt>
              <dd>{sum.tourName}</dd>
            </div>
            <div>
              <dt>{t("Tarih")}</dt>
              <dd>
                {day} · {sum.startTime}
              </dd>
            </div>
            <div>
              <dt>{t("Yolcu")}</dt>
              <dd>
                {t("{count} kişi", { count: sum.count })} ·{" "}
                {t("Koltuk {n}", { n: sum.seats.join(", ") })}
              </dd>
            </div>
            <div>
              <dt>{t("Toplam tur bedeli")}</dt>
              <dd>{currency(sum.total)}</dd>
            </div>
            <div className="is-due">
              <dt>
                {sum.paymentMode === "deposit"
                  ? t("Şimdi ödenecek kapora (%{pct})", {
                      pct: catalog.payment.depositPercent ?? 30,
                    })
                  : t("Şimdi ödenecek tutar (tamamı)")}
              </dt>
              <dd>{currency(s!.amount)}</dd>
            </div>
            {sum.paymentMode === "deposit" && (
              <p className="payment-summary-note">
                {t(
                  "Kalan {rest} tur günü hareketten önce ödenir.",
                  { rest: currency(Math.max(0, sum.total - sum.paid - s!.amount)) },
                )}
              </p>
            )}
          </dl>
        )}
        {error && (
          <p className="error" role="alert">
            {t(error)}
          </p>
        )}
        {notice && (
          <p className="card-form-notice" role="status">
            {t(notice)}
          </p>
        )}
        {open && (
          <CardForm
            catalog={catalog}
            amountLabel={currency(s.amount)}
            busy={busy}
            onPay={pay}
            beforePay={checkConsents}
            footer={
              <LegalConsents
                value={consents}
                onChange={(next) => {
                  setConsents(next);
                  if (consentsComplete(next)) setConsentError("");
                }}
                documents={s.documents}
                error={consentError}
                disabled={busy}
              />
            }
          />
        )}
        {s && s.status === "paid" && (
          <Link className="btn" to={"/odeme/sonuc/" + s.id}>
            {t("Sonucu gör")}
          </Link>
        )}
        {s && !open && s.status !== "paid" && (
          <>
            <p className="muted">
              {t(
                "Bu ödeme bağlantısının süresi doldu. Rezervasyonum sayfasından yeniden ödeme başlatabilirsiniz.",
              )}
            </p>
            <Link
              className="btn"
              to={"/rezervasyonum?ref=" + encodeURIComponent(s.reference)}
            >
              {t("Rezervasyonuma dön")}
            </Link>
          </>
        )}
        <MerchantInfo catalog={catalog} />
      </article>
    </section>
  );
}
// "1.250,50", "1250.5" ve "1250" gibi yazımları kuruşa çevirir (currency ile aynı birim).
export function parseAmount(raw: string) {
  let v = raw.replace(/[\s₺TL]/gi, "");
  if (v.includes(",")) v = v.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
  const n = Math.round(Number(v) * 100);
  return n >= 100 && n <= 100_000_000 ? n : null;
}
// Kuruşlu tutarı yuvarlamadan gösterir ("₺1.250,50").
const exactCurrency = (kurus: number) =>
  new Intl.NumberFormat(localeOf(), {
    style: "currency",
    currency: "TRY",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: kurus % 100 ? 2 : 0,
  }).format(kurus / 100);
// Herkese açık ödeme sayfası (/odeme): rezervasyon gerekmeden kart ekranını
// gösterir (banka incelemesi için). Kart bilgisi hiçbir yere gönderilmez.
export function OpenPayment({ catalog }: { catalog: Catalog }) {
  const { t } = useLang();
  const [amountText, setAmountText] = useState(""),
    [reference, setReference] = useState(""),
    [amountError, setAmountError] = useState(""),
    [notice, setNotice] = useState(""),
    [consents, setConsents] = useState<Consents>(noConsents),
    [consentError, setConsentError] = useState("");
  const amount = parseAmount(amountText);
  function checkAmount(form: HTMLFormElement) {
    if (!amount) {
      setAmountError("Ödenecek tutarı TL olarak yazın (ör. 1.250).");
      form.querySelector<HTMLInputElement>('[name="amount"]')?.focus();
      return false;
    }
    if (consentsComplete(consents)) return true;
    setConsentError(CONSENT_MISSING);
    form
      .querySelector<HTMLInputElement>(".legal-consents input:not(:checked)")
      ?.focus();
    return false;
  }
  return (
    <section className="container payment-page">
      <article className="ticket-check payment-card">
        <p className="payment-test-flag">
          {t("Önizleme · kartla ödeme banka onayından sonra açılacak")}
        </p>
        <h1>{t("Online ödeme")}</h1>
        <p className="muted">
          {t(
            "Rota Kars Turizm tur ve transfer ödemeleri. Rezervasyon numaranızı ve acentemizin bildirdiği tutarı yazıp kartınızla ödeyin.",
          )}
        </p>
        {notice && (
          <p className="card-form-notice" role="status">
            {t(notice)}
          </p>
        )}
        <CardForm
          catalog={catalog}
          amountLabel={amount ? exactCurrency(amount) : null}
          busy={false}
          beforePay={checkAmount}
          footer={
            <LegalConsents
              value={consents}
              onChange={(next) => {
                setConsents(next);
                if (consentsComplete(next)) setConsentError("");
              }}
              error={consentError}
            />
          }
          onPay={(_card, reset) => {
            reset();
            setNotice(
              "Kartla ödeme, banka onayının ardından açılacak. Kartınızdan çekim yapılmadı ve kart bilgileriniz hiçbir yere gönderilmedi.",
            );
          }}
        >
          <div className="card-form-row">
            <label className="field">
              {t("Ödenecek tutar (TL)")}
              <input
                name="amount"
                inputMode="decimal"
                placeholder="0,00"
                maxLength={14}
                value={amountText}
                onChange={(e) => {
                  setAmountText(e.target.value);
                  if (amountError && parseAmount(e.target.value))
                    setAmountError("");
                }}
                aria-invalid={amountError ? true : undefined}
                aria-describedby={amountError ? "pay-err-amount" : undefined}
              />
              {amountError && (
                <small className="field-error" id="pay-err-amount">
                  {t(amountError)}
                </small>
              )}
            </label>
            <label className="field">
              {t("Rezervasyon no (varsa)")}
              <input
                name="reference"
                maxLength={20}
                autoCapitalize="characters"
                spellCheck={false}
                value={reference}
                onChange={(e) => setReference(e.target.value.toUpperCase())}
              />
            </label>
          </div>
        </CardForm>
        <MerchantInfo catalog={catalog} />
      </article>
    </section>
  );
}
// Ödeme dönüşü: sonuç sunucudaki oturumdan okunur (tarayıcı yönlendirmesi
// ödemeyi onaylamaz).
export function PaymentResult() {
  const { t } = useLang();
  const { id } = useParams(),
    [s, setS] = useState<Session | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true,
      tries = 0;
    const load = () =>
      api<Session>("/payments/sessions/" + id)
        .then((x) => {
          if (!alive) return;
          setS(x);
          // Sağlayıcı bildirimi birkaç saniye gecikebilir.
          if (x.status === "pending" && !x.expired && tries++ < 10)
            setTimeout(load, 1500);
        })
        .catch((e) => setError(e.message));
    load();
    return () => {
      alive = false;
    };
  }, [id]);
  const paid = s?.status === "paid",
    unverified = s?.status === "unverified";
  return (
    <section className="container payment-page">
      <article className="ticket-check payment-card">
        <div className="ticket-check-head">
          {s && (
            <StatusStamp
              status={
                paid
                  ? s.reservationStatus
                  : s.status === "failed"
                    ? "expired"
                    : "pending_agency"
              }
            />
          )}
        </div>
        <h1>
          {!s
            ? t("Ödemeniz kontrol ediliyor…")
            : paid
              ? t("Ödemeniz alındı.")
              : unverified
                ? t("Ödemeniz kontrol ediliyor.")
                : s.status === "failed" || s.expired
                ? t("Ödeme tamamlanamadı.")
                : t("Ödemeniz bekleniyor…")}
        </h1>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {s && (
          <p className="muted">
            {paid
              ? t(
                  "{amount} tahsil edildi. {reference} numaralı rezervasyonunuz onaylandı; QR kodlu biletiniz artık geçerli.",
                  { amount: currency(s.amount), reference: s.reference },
                )
              : unverified
                ? t(
                    "Bankadan ödemenizin sonucu alınamadı. Kartınızdan çekim yapıldıysa rezervasyonunuz korunuyor; ekibimiz kontrol edip sizi arayacak.",
                  )
                : s.status === "failed" || s.expired
                ? t(
                    "Kartınızdan para çekilmedi. Rezervasyonum sayfasından yeniden deneyebilir ya da bizi arayabilirsiniz.",
                  )
                : t(
                    "Ödeme kuruluşundan onay bekleniyor; bu sayfa kendiliğinden yenilenir.",
                  )}
          </p>
        )}
        {s && (
          <Link
            className="btn"
            to={"/rezervasyonum?ref=" + encodeURIComponent(s.reference)}
          >
            {paid ? t("Biletimi göster") : t("Rezervasyonuma dön")}
          </Link>
        )}
      </article>
    </section>
  );
}
