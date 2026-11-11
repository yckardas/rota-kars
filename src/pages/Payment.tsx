import { useEffect, useState, type FormEvent, type InputHTMLAttributes } from "react";
import { useParams } from "react-router-dom";
import { Link, localPath, useLang, useLocalNavigate } from "../lib/i18n";
import { CreditCard, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { api, post } from "../lib/api";
import { currency, type Catalog, type Reservation } from "../lib/types";
import { StatusStamp } from "../components/ReservationTicket";
import {
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
// Vakıfbank kart ödemesi: canlı kart görseli eşliğinde kart bilgisi alınır,
// 3D Secure için bankaya geçilir.
export function CardPayment({ catalog }: { catalog: Catalog }) {
  const { t } = useLang();
  const { id } = useParams(),
    [s, setS] = useState<Session | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [card, setCard] = useState<CardValues>(emptyCard),
    [focused, setFocused] = useState<CardField | null>(null),
    [problems, setProblems] = useState<Partial<Record<CardField, string>>>({}),
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
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const found = cardProblems(card);
    setProblems(found);
    const first = (["holder", "pan", "expiry", "cvv"] as CardField[]).find(
      (f) => found[f],
    );
    if (first) {
      e.currentTarget.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setError("");
    // Önizleme: kart bilgisi hiçbir yere gönderilmez, form temizlenir.
    if (preview) {
      (document.activeElement as HTMLElement | null)?.blur();
      setFocused(null);
      setCard(emptyCard);
      setNotice(
        "Kartla ödeme, banka onayının ardından açılacak. Kartınızdan çekim yapılmadı; ön rezervasyonunuz kayıtlı, acentemiz sizinle iletişime geçecek.",
      );
      return;
    }
    setBusy(true);
    try {
      const res = await post<{ redirect: string }>("/payments/card/" + id, card);
      setCard(emptyCard);
      // Bankaya yönlendiren sayfa sunucudadır; dil öneki eklenmez.
      window.location.assign(res.redirect);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }
  const open = s && s.status === "pending" && !s.expired;
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
          <form className="card-form" onSubmit={submit} autoComplete="on" noValidate>
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
            <button className="btn" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <LockKeyhole size={17} />
              )}
              {busy
                ? t("Bankanıza bağlanılıyor…")
                : t("{amount} öde", { amount: currency(s.amount) })}
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
