import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Link, localPath, useLang, useLocalNavigate } from "../lib/i18n";
import { CreditCard, LoaderCircle, ShieldCheck } from "lucide-react";
import { api, post } from "../lib/api";
import { currency, type Catalog, type Reservation } from "../lib/types";
import { StatusStamp } from "../components/ReservationTicket";
type Session = {
  id: string;
  reference: string;
  amount: number;
  status: "pending" | "paid" | "failed";
  expired: boolean;
  reservationStatus: string;
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
  if (!catalog.payment.enabled || r.status !== "pending_agency" || !due)
    return null;
  async function pay() {
    setBusy(true);
    setError("");
    try {
      const s = await post<{ redirectUrl: string }>("/payments/start", {
        reference: r.reference,
        email,
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
      <small>
        <ShieldCheck size={14} />{" "}
        {t(
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
  const paid = s?.status === "paid";
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
