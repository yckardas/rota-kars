import { useState, type FormEvent } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ShieldCheck, LoaderCircle, Download, Trash2 } from "lucide-react";
import { api, post } from "../lib/api";
import { useMember } from "../lib/member";
import { useEffect } from "react";
import { dateLabel } from "../lib/types";
import { Postmark } from "../components/Postmark";
import { Link, useLang, useLocalNavigate } from "../lib/i18n";
import { StatusStamp, TicketBrand } from "../components/ReservationTicket";
export function AccountSecurity({
  mode,
}: {
  mode: "verify" | "forgot" | "reset";
}) {
  const [params] = useSearchParams(),
    { refresh } = useMember(),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [done, setDone] = useState(false),
    { t } = useLang();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      if (mode === "verify") {
        await post("/auth/verify", { token: params.get("token") });
        await refresh();
        setNotice(t("E-posta adresiniz doğrulandı."));
      } else if (mode === "forgot") {
        const r = await post<{ message: string }>("/auth/forgot-password", {
          email: f.get("email"),
        });
        setNotice(
          t(r.message) +
            t(
              " E-posta gelmezse spam klasörünü kontrol edin veya acenteyle iletişime geçin.",
            ),
        );
      } else {
        if (f.get("password") !== f.get("confirm"))
          throw new Error(t("Parolalar eşleşmiyor."));
        await post("/auth/reset-password", {
          token: params.get("token"),
          password: f.get("password"),
        });
        await refresh();
        setNotice(
          t("Parolanız yenilendi. Yeni parolanızla giriş yapabilirsiniz."),
        );
      }
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="container security-page">
      <ShieldCheck size={34} />
      <span className="section-note">{t("Hesap güvenliği")}</span>
      <h1>
        {mode === "verify"
          ? t("E-postanızı doğrulayın.")
          : mode === "forgot"
            ? t("Parolanızı mı unuttunuz?")
            : t("Yeni bir parola belirleyin.")}
      </h1>
      <p className="muted">
        {mode === "verify"
          ? t("Bağlantınızı aşağıdaki düğmeyle onaylayın.")
          : mode === "forgot"
            ? t(
                "Üyelik e-posta adresinize tek kullanımlık yenileme bağlantısı isteyin.",
              )
            : t("Bu bağlantı bir saat geçerlidir ve bir kez kullanılabilir.")}
      </p>
      {!done && (
        <form onSubmit={submit}>
          {mode === "forgot" ? (
            <label className="field">
              {t("E-posta")}
              <input name="email" type="email" required autoComplete="email" />
            </label>
          ) : mode === "reset" ? (
            <>
              <label className="field">
                {t("Yeni parola")}
                <input
                  type="password"
                  name="password"
                  minLength={10}
                  maxLength={128}
                  autoComplete="new-password"
                  required
                />
              </label>
              <label className="field">
                {t("Yeni parola tekrar")}
                <input
                  type="password"
                  name="confirm"
                  minLength={10}
                  maxLength={128}
                  autoComplete="new-password"
                  required
                />
              </label>
            </>
          ) : null}
          <button className="btn" disabled={busy}>
            {busy && <LoaderCircle className="spin" size={16} />}
            {mode === "verify"
              ? t("E-postamı doğrula")
              : mode === "forgot"
                ? t("Yenileme bağlantısı iste")
                : t("Parolamı yenile")}
          </button>
        </form>
      )}
      {error && (
        <p className="error" role="alert">
          {t(error)}
        </p>
      )}
      {notice && (
        <p className="notice-success" role="status">
          {notice}
        </p>
      )}
      <Link
        className="text-link"
        to={mode === "verify" ? "/hesabim" : "/uyelik?mode=login"}
      >
        {t("Hesabıma dön")}
      </Link>
    </section>
  );
}
type TicketInfo = {
  reference: string;
  tourName: string;
  date: string;
  startTime: string;
  pickup: string;
  seats: number[];
  status: string;
  valid: boolean;
  checkedIn: boolean;
};
export function TicketVerification() {
  const { token } = useParams(),
    [data, setData] = useState<TicketInfo | null>(null),
    [error, setError] = useState(""),
    [admin, setAdmin] = useState(false),
    { t } = useLang();
  useEffect(() => {
    api<TicketInfo>("/tickets/" + token)
      .then(setData)
      .catch((e) => setError(e.message));
    api("/admin/session")
      .then(() => setAdmin(true))
      .catch(() => {});
  }, [token]);
  // QR okutulunca açılan sayfa: hatıra kartının arka yüzü gibi damga, posta
  // damgası ve çizgili satırlar. Sonuç (geçerli / değil) başlıkta okunur.
  return (
    <section className="container ticket-verification">
      <article className="ticket-check" aria-busy={!data && !error}>
        <TicketBrand />
        <div className="ticket-check-head">
          {data && <StatusStamp status={data.status} />}
          {data && (
            <Postmark
              date={data.date}
              time={data.startTime}
              label={t("Tur tarihi {date}, {time}", {
                date: dateLabel(data.date),
                time: data.startTime,
              })}
            />
          )}
        </div>
        <h1>
          {data?.valid
            ? t("Rezervasyon doğrulandı.")
            : data
              ? t("Kesinleşmiş bilet değil.")
              : error
                ? t("Belge doğrulanamadı.")
                : t("Belgeniz kontrol ediliyor…")}
        </h1>
        {error && (
          <p className="error" role="alert">
            {t(error)}
          </p>
        )}
        {data && (
          <>
            <h2>{data.tourName}</h2>
            <div className="ticket-reference">
              <span>{t("Referans numarası")}</span>
              <strong>{data.reference}</strong>
            </div>
            <dl className="ticket-lines">
              <div>
                <dt>{t("Hareket")}</dt>
                <dd>
                  {dateLabel(data.date)} · {data.startTime}
                </dd>
              </div>
              <div>
                <dt>{t("Koltuklar")}</dt>
                <dd>{data.seats.join(", ")}</dd>
              </div>
              <div>
                <dt>{t("Buluşma")}</dt>
                <dd>{data.pickup}</dd>
              </div>
            </dl>
            <p className="ticket-check-note">
              {data.checkedIn
                ? t("Katılım kaydedildi.")
                : data.valid
                  ? t("Bu belge acente tarafından onaylanmış rezervasyona aittir.")
                  : t(
                      "Ödeme ve acente onayı tamamlanmadan kesin bilet olarak kullanılamaz.",
                    )}
            </p>
            {admin && data.status === "confirmed" && (
              <button
                className="btn"
                disabled={data.checkedIn}
                onClick={async () => {
                  try {
                    setData(
                      await post<TicketInfo>(
                        "/admin/tickets/" + token + "/check-in",
                        {},
                      ),
                    );
                    setError("");
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                {data.checkedIn
                  ? t("Katılım kaydedildi")
                  : t("Yönetici: katılımı kaydet")}
              </button>
            )}
          </>
        )}
      </article>
    </section>
  );
}
export function ProfileSettings() {
  const { member, refresh } = useMember(),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    { t } = useLang();
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await post("/member/profile", {
        name: f.get("name"),
        phone: f.get("phone"),
      });
      await refresh();
      setNotice(t("Profiliniz güncellendi."));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return member ? (
    <section className="profile-settings">
      <div>
        <span className="section-note">{t("Size nasıl ulaşalım?")}</span>
        <h2>{t("Profil bilgilerim")}</h2>
        <p>
          {member.email} ·{" "}
          {member.emailVerified
            ? t("Doğrulanmış e-posta")
            : t("E-posta doğrulaması bekliyor")}
        </p>
        {!member.emailVerified && (
          <button
            className="text-link"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await post<{
                  deliveryConfigured?: boolean;
                  verified?: boolean;
                }>("/auth/verification/request", {});
                setNotice(
                  r.verified
                    ? t("E-postanız zaten doğrulanmış.")
                    : r.deliveryConfigured
                      ? t("Doğrulama e-postası kuyruğa alındı.")
                      : t(
                          "Doğrulama talebiniz kaydedildi. E-posta gönderimi acente tarafından etkinleştirildiğinde iletilecek.",
                        ),
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("Doğrulama bağlantısı iste")}
          </button>
        )}
      </div>
      <form onSubmit={save}>
        <div className="form-grid">
          <label className="field">
            {t("Ad soyad")}
            <input
              name="name"
              defaultValue={member.name}
              minLength={2}
              maxLength={100}
              required
              autoComplete="name"
            />
          </label>
          <label className="field">
            {t("Telefon")}
            <input
              name="phone"
              type="tel"
              defaultValue={member.phone || ""}
              autoComplete="tel"
            />
          </label>
        </div>
        <button className="btn btn-outline btn-small" disabled={busy}>
          {t("Bilgilerimi kaydet")}
        </button>
        <Link className="text-link" to="/uyelik/parolami-unuttum">
          {t("Parolamı yenile")}
        </Link>
      </form>
      {notice && (
        <p className="notice-success" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {t(error)}
        </p>
      )}
    </section>
  ) : null;
}

export function MemberPrivacy() {
  const { member, refresh } = useMember(),
    navigate = useLocalNavigate(),
    { lang, t } = useLang(),
    // Sunucu her dilde "SİL" bekler; İngilizcede kullanıcı DELETE yazar.
    word = lang === "en" ? "DELETE" : "SİL",
    [confirming, setConfirming] = useState(false),
    [confirm, setConfirm] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function erase(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (confirm !== word) {
      setError(t("Onay için kutuya büyük harflerle SİL yazın."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await post("/member/delete", { confirm: "SİL" });
      await refresh().catch(() => {});
      navigate("/", { replace: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!member) return null;
  return (
    <section className="profile-settings member-privacy">
      <div>
        <span className="section-note">{t("KVKK md. 11")}</span>
        <h2>{t("Kişisel verilerim (KVKK)")}</h2>
        <p>
          {t(
            "Hakkınızda tuttuğumuz verilerin bir kopyasını indirebilir veya hesabınızın silinmesini isteyebilirsiniz.",
          )}{" "}
          <Link to="/bilgilendirme#haklar">{t("Haklarınız")}</Link>
        </p>
      </div>
      <div>
        <a
          className="btn btn-outline btn-small"
          href="/api/member/data-export"
          download="rota-kars-verilerim.json"
        >
          <Download size={15} />
          {t("Verilerimi indir (JSON)")}
        </a>
        {!confirming ? (
          <button
            type="button"
            className="text-link danger-link"
            onClick={() => {
              setConfirming(true);
              setError("");
            }}
          >
            <Trash2 size={15} />
            {t("Hesabımı sil")}
          </button>
        ) : (
          <form className="danger-zone" onSubmit={erase}>
            <p>
              {t(
                "Üyeliğiniz, kuponlarınız ve iletişim tercihleriniz silinir; oturumunuz kapanır. Ödemesiz rezervasyonlarınızdaki kişisel bilgiler anonimleştirilir. Ödemesi yapılmış rezervasyonlarınız vergi ve ticari mevzuat gereği 10 yıl saklanır ve bu sürenin sonunda anonimleştirilir. Yaklaşan bir yolculuğunuz varsa önce rezervasyonunuzu sonuçlandırmanız gerekir.",
              )}
            </p>
            <label className="field">
              {t("Onaylamak için {word} yazın", { word })}
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="off"
                autoFocus
                required
              />
            </label>
            <div className="danger-actions">
              <button
                className="btn btn-danger btn-small"
                disabled={busy || confirm !== word}
              >
                {busy ? <LoaderCircle size={15} className="spin" /> : null}
                {t("Hesabımı kalıcı olarak sil")}
              </button>
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  setConfirming(false);
                  setConfirm("");
                  setError("");
                }}
              >
                {t("Vazgeç")}
              </button>
            </div>
          </form>
        )}
        {error && (
          <p className="error" role="alert">
            {t(error)}
          </p>
        )}
      </div>
    </section>
  );
}
