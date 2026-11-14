// Ücretsiz ön kayıt (talep toplama modundaki tur) ve "yer açılınca haber ver"
// (dolu sefer). Koltuk tutulmaz, ödeme alınmaz; kayıt panele düşer, müşteriye
// e-postayla onay ve listeden çıkma bağlantısı gider.
import { useState, type FormEvent } from "react";
import { BellRing, Check, LoaderCircle, ShieldCheck } from "lucide-react";
import { Modal } from "./Modal";
import { useTurnstile } from "./Turnstile";
import { post } from "../lib/api";
import { useLang } from "../lib/i18n";

export function InterestForm({
  kind,
  tourId,
  tourName,
  departureId,
  departureLabel,
  initialCount = 1,
  onClose,
}: {
  kind: "prereg" | "waitlist";
  tourId: string;
  tourName: string;
  departureId?: string;
  departureLabel?: string;
  initialCount?: number;
  onClose: () => void;
}) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState(""),
    human = useTurnstile("request");
  const waitlist = kind === "waitlist";
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const r = await post<{ reference: string }>("/interest", {
        kind,
        tourId,
        ...(departureId ? { departureId } : {}),
        ...(f.get("preferredDate") ? { preferredDate: f.get("preferredDate") } : {}),
        count: Number(f.get("count")),
        name: f.get("name"),
        email: f.get("email"),
        phone: f.get("phone"),
        notes: f.get("notes") || "",
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
    <Modal title={waitlist ? t("Yer açılınca haber ver") : t("Ücretsiz ön kayıt")} onClose={onClose}>
      {result ? (
        <div className="request-success">
          <div className="success-icon">
            <Check />
          </div>
          <h2>{waitlist ? t("Bekleme listesindesiniz.") : t("Ön kaydınız alındı.")}</h2>
          <p>{t("Referans numaranız")}</p>
          <strong className="reference">{result}</strong>
          <p>
            {waitlist
              ? t("Bu seferde yer açılınca size hemen e-posta göndereceğiz. Yer, ilk rezervasyonu tamamlayana ayrılır.")
              : t("Yeterli talep oluşunca tur kesinleşir; tarihleri ve rezervasyon bağlantısını e-postanıza göndeririz.")}
          </p>
          <button className="btn" onClick={onClose}>
            {t("Tamam")}
          </button>
        </div>
      ) : (
        <form className="request-form interest-form" onSubmit={submit}>
          <h2>{waitlist ? t("Bu seferde yer kalmadı.") : t("Bu tur yeterli talep olursa yapılacak.")}</h2>
          <p className="muted">
            {waitlist
              ? t("{tour} · {departure} için bekleme listesine katılın; yer açılınca sizi ilk haberdar edenlerden olalım.", {
                  tour: tourName,
                  departure: departureLabel || "",
                })
              : t("{tour} için ücretsiz ön kayıt bırakın. Ödeme alınmaz; tur kesinleşince size haber verip rezervasyonu açarız.", {
                  tour: tourName,
                })}
          </p>
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
              {t("Kişi sayısı")}
              <input name="count" type="number" min={1} max={50} defaultValue={initialCount} required />
            </label>
            {!waitlist && (
              <label className="field">
                {t("Tercih ettiğiniz dönem (isteğe bağlı)")}
                <input name="preferredDate" maxLength={60} placeholder={t("Örn. Mart 2027, hafta sonu")} />
              </label>
            )}
          </div>
          <label className="field">
            {t("Eklemek istedikleriniz")}
            <textarea name="notes" rows={2} maxLength={1000} />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" name="consent" required />
            <span>
              <a href="/bilgilendirme#kvkk" target="_blank">
                {t("Aydınlatma metnini")}
              </a>{" "}
              {t("okudum. Bilgilerimin bu tur için bana haber verilmesi amacıyla işleneceğini biliyorum.")}
            </span>
          </label>
          <div className="inline-note">
            <BellRing size={17} /> {t("Koltuk tutulmaz ve ödeme alınmaz; e-postadaki bağlantıyla istediğiniz an listeden çıkabilirsiniz.")}
          </div>
          {human.widget}
          {error && (
            <p className="error" role="alert">
              {t(error)}
            </p>
          )}
          <button className="btn block" disabled={busy || !human.ready}>
            {busy ? <LoaderCircle className="spin" size={17} /> : null}
            {waitlist ? t("Haber ver") : t("Ön kaydımı bırak")}
          </button>
          <small className="form-foot">
            <ShieldCheck size={14} /> {t("Bu aşamada ödeme alınmaz.")}
          </small>
        </form>
      )}
    </Modal>
  );
}
