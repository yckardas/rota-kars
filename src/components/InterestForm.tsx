// Ücretsiz ön kayıt (talep toplama modundaki tur), "yer açılınca haber ver"
// (dolu sefer) ve "tarih açılınca haber ver" (satışa kapalı tur). Koltuk tutulmaz,
// ödeme alınmaz; kayıt panele düşer, müşteriye e-postayla onay ve listeden çıkma
// bağlantısı gider.
import { useState, type FormEvent } from "react";
import { BellRing, Check, LoaderCircle, ShieldCheck } from "lucide-react";
import { Modal } from "./Modal";
import { useTurnstile } from "./Turnstile";
import { post } from "../lib/api";
import { useLang } from "../lib/i18n";
import { dateLabel, type DemandDate } from "../lib/types";

export function InterestForm({
  kind,
  tourId,
  tourName,
  departureId,
  departureLabel,
  initialCount = 1,
  available,
  dates = [],
  initialDateId,
  threshold,
  count,
  onClose,
}: {
  kind: "prereg" | "waitlist" | "notify";
  tourId: string;
  tourName: string;
  departureId?: string;
  departureLabel?: string;
  initialCount?: number;
  // Bekleme listesi: seferde kalan yer. Birkaç yer kaldıysa başlık "yer kalmadı" demez.
  available?: number;
  // Ön kayıt: talep toplayan tarihler; müşteri yalnız bunlardan birini seçer ve kayıt o tarihe
  // bağlanır. Tarih yoksa (talep turu) serbest "Tercih ettiğiniz dönem" kutusu görünür.
  dates?: DemandDate[];
  initialDateId?: string;
  // Ön kayıt: kesinleşme eşiği ve (ilerleme açıksa) tarihsiz kayıtlı kişi sayısı.
  threshold?: number;
  count?: number;
  onClose: () => void;
}) {
  const { t, lang } = useLang();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState(""),
    human = useTurnstile("request");
  const waitlist = kind === "waitlist",
    notify = kind === "notify";
  const pickDate = kind === "prereg" && dates.length > 0;
  const [dateId, setDateId] = useState(
    initialDateId && dates.some((d) => d.id === initialDateId) ? initialDateId : dates[0]?.id || "",
  );
  const picked = dates.find((d) => d.id === dateId),
    // Kaç kişi hazır: seçili tarihin ya da (tarihsiz ön kayıtta) turun sayacı; ilerleme kapalıysa yok.
    ready = picked ? picked.count : pickDate ? undefined : count;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const r = await post<{ reference: string }>("/interest", {
        kind,
        lang,
        tourId,
        ...(departureId ? { departureId } : pickDate && dateId ? { departureId: dateId } : {}),
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
    <Modal
      title={
        notify
          ? t("Tarih açılınca haber ver")
          : waitlist
            ? t("Yer açılınca haber ver")
            : t("Ücretsiz ön kayıt")
      }
      onClose={onClose}
    >
      {result ? (
        <div className="request-success">
          <div className="success-icon">
            <Check />
          </div>
          <h2>
            {notify
              ? t("Listeye eklendiniz.")
              : waitlist
                ? t("Bekleme listesindesiniz.")
                : t("Ön kaydınız alındı.")}
          </h2>
          <p>{t("Referans numaranız")}</p>
          <strong className="reference">{result}</strong>
          <p>
            {notify
              ? t(
                  "Bu tura yeni tarih açılınca ya da ön kayıt başlayınca size e-posta göndereceğiz.",
                )
              : waitlist
              ? t("Bu seferde yer açılınca size hemen e-posta göndereceğiz. Yer, ilk rezervasyonu tamamlayana ayrılır.")
              : t("Yeterli talep oluşunca tur kesinleşir; tarihleri ve rezervasyon bağlantısını e-postanıza göndeririz.")}
          </p>
          <p className="muted">
            {t(
              "Bu numara bir rezervasyon değildir. Kaydınızın durumunu Rezervasyonum sayfasında bu numara ve e-posta adresinizle görebilirsiniz.",
            )}
          </p>
          <button className="btn" onClick={onClose}>
            {t("Tamam")}
          </button>
        </div>
      ) : (
        <form className="request-form interest-form" onSubmit={submit}>
          <h2>
            {notify
              ? t("Bu tur şu an satışa kapalı.")
              : waitlist
                ? available && available > 0
                  ? t("Bu seferde {n} kişilik yer kaldı.", { n: available })
                  : t("Bu seferde yer kalmadı.")
                : t("Bu tur yeterli talep olursa yapılacak.")}
          </h2>
          <p className="muted">
            {notify
              ? t(
                  "{tour} için yeni tarih açılınca ya da ön kayıt başlayınca size e-postayla haber verelim. Kayıt ücretsizdir.",
                  {
                    tour: tourName,
                  },
                )
              : waitlist
              ? t("{tour} · {departure} için bekleme listesine katılın; yer açılınca sizi ilk haberdar edenlerden olalım.", {
                  tour: tourName,
                  departure: departureLabel || "",
                })
              : picked
                ? t("{tour} · {date} için ücretsiz ön kayıt bırakın. Ödeme alınmaz; tarih kesinleşince size haber verip rezervasyonu açarız.", {
                    tour: tourName,
                    date: dateLabel(picked.date),
                  })
                : t("{tour} için ücretsiz ön kayıt bırakın. Ödeme alınmaz; tur kesinleşince size haber verip rezervasyonu açarız.", {
                    tour: tourName,
                  })}
          </p>
          {/* Tur ne zaman kesinleşir: kaç kişi gerekli, kaç kişi hazır, karar en geç ne zaman. */}
          {kind === "prereg" && threshold !== undefined && (
            <div className="interest-goal">
              <p>
                {picked?.decisionDate
                  ? t(
                      "Bu tarih {threshold} kişiye ulaşınca kesinleşir; kararı en geç {date} e-postayla bildiririz.",
                      {
                        threshold,
                        date: dateLabel(picked.decisionDate),
                      },
                    )
                  : t("Tur {threshold} kişiye ulaşınca kesinleşir.", {
                      threshold,
                    })}
              </p>
              {ready !== undefined && (
                <div className="demand-progress">
                  <span>
                    {t("{count} / {threshold} kişi hazır", {
                      count: Math.min(ready, threshold),
                      threshold,
                    })}
                  </span>
                  <progress
                    max={threshold}
                    value={Math.min(ready, threshold)}
                  />
                </div>
              )}
            </div>
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
              {t("Kişi sayısı")}
              <input name="count" type="number" min={1} max={50} defaultValue={initialCount} required />
            </label>
            {pickDate && (
              <label className="field">
                {t("Tarih")}
                <select value={dateId} onChange={(e) => setDateId(e.target.value)}>
                  {dates.map((d) => (
                    <option key={d.id} value={d.id}>
                      {dateLabel(d.date)} · {d.start_time}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!waitlist && !pickDate && (
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
            {waitlist || notify ? t("Haber ver") : t("Ön kaydımı bırak")}
          </button>
          <small className="form-foot">
            <ShieldCheck size={14} /> {t("Bu aşamada ödeme alınmaz.")}
          </small>
        </form>
      )}
    </Modal>
  );
}
