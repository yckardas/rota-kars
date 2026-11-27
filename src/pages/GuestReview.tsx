// Tur sonrası yorum sayfası (/yorum/:token). Bağlantı e-postayla yalnız katılımcıya gider,
// tek kullanımlıktır. Sayfa yalnız ad, tur ve tarihi gösterir; yorum acente onayından
// sonra tur sayfasında ad ve soyadın baş harfiyle yayımlanır.
import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import {
  ExternalLink,
  LoaderCircle,
  MessageSquareHeart,
  Star,
} from "lucide-react";
import { api, post } from "../lib/api";
import { Link, useLang } from "../lib/i18n";
import { dateLabel } from "../lib/types";
type RequestInfo = {
  state: "open" | "used" | "expired";
  tourId: string;
  tourName: string;
  date: string;
  firstName: string;
  displayName: string;
  optedOut: boolean;
  googleUrl: string | null;
};
const GOOGLE_FALLBACK = "https://www.google.com/maps?cid=1539703208462618989";
export function GuestReview() {
  const { token = "" } = useParams(),
    { t } = useLang();
  const [info, setInfo] = useState<RequestInfo | null>(null),
    [error, setError] = useState(""),
    [rating, setRating] = useState(0),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false),
    [optedOut, setOptedOut] = useState(false);
  useEffect(() => {
    api<RequestInfo>("/guest-reviews/" + token)
      .then((r) => {
        setInfo(r);
        setOptedOut(r.optedOut);
      })
      .catch((e) => setError((e as Error).message));
  }, [token]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!rating) return setError(t("Lütfen 1 ile 5 arasında bir puan seçin."));
    const consent = new FormData(e.currentTarget).get("consent") === "on";
    setBusy(true);
    try {
      await post("/guest-reviews/" + token, { rating, text, consent });
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function optOut() {
    setBusy(true);
    try {
      await post("/guest-reviews/" + token + "/opt-out", {});
      setOptedOut(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const google = info?.googleUrl || GOOGLE_FALLBACK;
  if (!info)
    return (
      <section className="container security-page guest-review-page">
        {error ? (
          <>
            <h1>{t("Bu bağlantı açılamadı.")}</h1>
            <p className="error" role="alert">
              {t(error)}
            </p>
            <Link className="text-link" to="/turlar">
              {t("Turlara göz atın")}
            </Link>
          </>
        ) : (
          <p className="quiet">{t("Yükleniyor…")}</p>
        )}
      </section>
    );
  return (
    <section className="container security-page guest-review-page">
      <MessageSquareHeart size={34} />
      <p className="guest-review-tour">
        <strong>{t(info.tourName)}</strong> · {dateLabel(info.date)}
      </p>
      {sent ? (
        <>
          <h1>{t("Teşekkür ederiz!")}</h1>
          <p className="muted">
            {t(
              "Yorumunuz bize ulaştı. Acentemiz onayladıktan sonra tur sayfasında “Doğrulanmış katılımcı” etiketiyle yayımlanır.",
            )}
          </p>
          <GoogleNote url={google} />
        </>
      ) : info.state !== "open" ? (
        <>
          <h1>
            {info.state === "used"
              ? t("Bu bağlantıyla yorum gönderildi.")
              : t("Bu bağlantının süresi doldu.")}
          </h1>
          <p className="muted">
            {t(
              "Deneyiminizi yine de paylaşmak isterseniz Google işletme sayfamıza yorum yazabilirsiniz.",
            )}
          </p>
          <GoogleNote url={google} />
        </>
      ) : (
        <>
          <h1>{t("Turunuz nasıl geçti, {name}?", { name: info.firstName })}</h1>
          <p className="muted">
            {t(
              "Puanınız ve birkaç cümleniz, bu rotayı düşünen misafirlerimize yol gösterir.",
            )}
          </p>
          <form onSubmit={submit} className="guest-review-form">
            <fieldset className="rating-input">
              <legend>{t("Puanınız")}</legend>
              <div>
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} className={n <= rating ? "is-on" : ""}>
                    <input
                      type="radio"
                      name="rating"
                      value={n}
                      checked={rating === n}
                      onChange={() => setRating(n)}
                    />
                    <Star
                      size={30}
                      fill={n <= rating ? "currentColor" : "none"}
                      aria-hidden="true"
                    />
                    <span className="sr-only">
                      {t("{n} / 5 yıldız", { n })}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="field">
              {t("Kısa yorumunuz (isteğe bağlı)")}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={1000}
                rows={5}
                placeholder={t("Rehber, araç, program… Neyi beğendiniz?")}
              />
              <small className="muted">{text.length}/1000</small>
            </label>
            <label className="checkbox-label">
              <input type="checkbox" name="consent" required />
              <span>
                {t(
                  "Yorumumun ve puanımın, adım ve soyadımın baş harfiyle ({name}) sitede yayımlanmasına izin veriyorum.",
                  { name: info.displayName },
                )}
              </span>
            </label>
            {error && (
              <p className="error" role="alert">
                {t(error)}
              </p>
            )}
            <button className="btn" disabled={busy}>
              {busy && <LoaderCircle className="spin" size={16} />}
              {t("Yorumu gönder")}
            </button>
          </form>
          <GoogleNote url={google} />
        </>
      )}
      <p className="guest-review-optout">
        {optedOut ? (
          t("Bu adrese bir daha yorum isteği göndermeyeceğiz.")
        ) : (
          <>
            {t("Bu tür e-postaları almak istemiyor musunuz?")}{" "}
            <button
              type="button"
              className="text-link"
              onClick={optOut}
              disabled={busy}
            >
              {t("Listeden çık")}
            </button>
          </>
        )}
      </p>
    </section>
  );
}
function GoogleNote({ url }: { url: string }) {
  const { t } = useLang();
  return (
    <p className="guest-review-google">
      {t("Dilerseniz deneyiminizi Google’da da paylaşabilirsiniz.")}{" "}
      <a className="text-link" href={url} target="_blank" rel="noreferrer">
        {t("Google’da yorum yazın")} <ExternalLink size={14} />
      </a>
    </p>
  );
}
