import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { Link, localPath, useLang, useLocalNavigate } from "../lib/i18n";
import { CreditCard, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { api, post } from "../lib/api";
import { currency, type Catalog, type Reservation } from "../lib/types";
import { StatusStamp } from "../components/ReservationTicket";
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
        <h2 id="pay-title">{t("Kaporanızı şimdi ödeyin.")}</h2>
        <p>
          {r.deposit < r.total ? t("%30 kapora") : t("Tur bedeli")}{" "}
          <strong>{currency(due)}</strong>.{" "}
          {t(
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
        {t("Kartla öde")}
      </button>
      {preview && (
        <small>
          {t(
            "Kartla ödeme banka onayının ardından açılacak; şimdilik ödeme alınmaz.",
          )}
        </small>
      )}
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
// Kart numarasını dörtlü gruplar, son kullanmayı AA/YY biçiminde gösterir.
const groupPan = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
const formatExpiry = (v: string, previous: string) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  // Silerken "/" işaretine takılmasın.
  if (v.length < previous.length && previous.endsWith("/") && d.length === 2)
    return d.slice(0, 1);
  return d.length >= 2 ? d.slice(0, 2) + "/" + d.slice(2) : d;
};
const brandOf = (pan: string) =>
  /^4/.test(pan)
    ? "Visa"
    : /^(5[1-5]|2[2-7])/.test(pan)
      ? "Mastercard"
      : /^(9792|65)/.test(pan)
        ? "Troy"
        : "";
// Vakıfbank kart ödemesi: kart bilgisi alınır, 3D Secure için bankaya geçilir.
export function CardPayment({ catalog }: { catalog: Catalog }) {
  const { t } = useLang();
  const { id } = useParams(),
    [s, setS] = useState<Session | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [pan, setPan] = useState(""),
    [expiry, setExpiry] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    api<Session>("/payments/sessions/" + id)
      .then((x) => {
        setS(x);
        if (x.message) setError(x.message);
      })
      .catch((e) => setError(e.message));
  }, [id]);
  const preview = s?.provider === "preview";
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Önizleme: kart bilgisi hiçbir yere gönderilmez, form temizlenir.
    if (preview) {
      e.currentTarget.reset();
      setPan("");
      setExpiry("");
      setError("");
      setNotice(
        "Kartla ödeme, banka onayının ardından açılacak. Kartınızdan çekim yapılmadı; ön rezervasyonunuz kayıtlı, acentemiz sizinle iletişime geçecek.",
      );
      return;
    }
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const res = await post<{ redirect: string }>("/payments/card/" + id, {
        holder: String(form.get("holder") || ""),
        pan,
        expiry,
        cvv: String(form.get("cvv") || ""),
      });
      // Bankaya yönlendiren sayfa sunucudadır; dil öneki eklenmez.
      window.location.assign(res.redirect);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }
  const open = s && s.status === "pending" && !s.expired,
    brand = brandOf(pan.replace(/\s/g, ""));
  return (
    <section className="container payment-page">
      <article className="ticket-check payment-card">
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
          <form className="card-form" onSubmit={submit} autoComplete="on">
            <label className="field">
              {t("Kart üzerindeki isim")}
              <input
                name="holder"
                autoComplete="cc-name"
                minLength={3}
                maxLength={60}
                required
              />
            </label>
            <label className="field">
              <span className="card-number-label">
                {t("Kart numarası")}
                {brand && <em>{brand}</em>}
              </span>
              <input
                name="cardnumber"
                inputMode="numeric"
                autoComplete="cc-number"
                value={pan}
                onChange={(e) => setPan(groupPan(e.target.value))}
                placeholder="0000 0000 0000 0000"
                minLength={15}
                maxLength={23}
                required
              />
            </label>
            <div className="card-form-row">
              <label className="field">
                {t("Son kullanma (AA/YY)")}
                <input
                  name="exp"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  value={expiry}
                  onChange={(e) =>
                    setExpiry(formatExpiry(e.target.value, expiry))
                  }
                  placeholder={t("AA/YY")}
                  minLength={5}
                  maxLength={5}
                  required
                />
              </label>
              <label className="field">
                {t("Güvenlik kodu (CVV)")}
                <input
                  name="cvv"
                  type="password"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  pattern="[0-9]{3,4}"
                  minLength={3}
                  maxLength={4}
                  required
                />
              </label>
            </div>
            <button className="btn" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <LockKeyhole size={17} />
              )}
              {t("{amount} öde", { amount: currency(s.amount) })}
            </button>
            <p className="card-form-note">
              <ShieldCheck size={15} />
              <span>
                {t(
                  "Bir sonraki adımda bankanızın 3D Secure sayfasında SMS koduyla onaylayacaksınız. Visa, Mastercard ve Troy kabul edilir. Kart bilgileriniz saklanmaz.",
                )}
              </span>
            </p>
            {catalog.payment.simulator && (
              <p className="card-form-note">
                {t(
                  "Simülasyon kartı: 4111 1111 1111 1111, ileri bir tarih, herhangi bir CVV. 0002 ile biten kart reddedilir.",
                )}
              </p>
            )}
          </form>
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
