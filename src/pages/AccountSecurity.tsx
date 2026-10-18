import { useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ShieldCheck, Ticket, LoaderCircle } from "lucide-react";
import { api, post } from "../lib/api";
import { useMember } from "../lib/member";
import { useEffect } from "react";
import { dateLabel } from "../lib/types";
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
    [done, setDone] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      if (mode === "verify") {
        await post("/auth/verify", { token: params.get("token") });
        await refresh();
        setNotice("E-posta adresiniz doğrulandı.");
      } else if (mode === "forgot") {
        const r = await post<{ message: string }>("/auth/forgot-password", {
          email: f.get("email"),
        });
        setNotice(
          r.message +
            " E-posta gelmezse spam klasörünü kontrol edin veya acenteyle iletişime geçin.",
        );
      } else {
        if (f.get("password") !== f.get("confirm"))
          throw new Error("Parolalar eşleşmiyor.");
        await post("/auth/reset-password", {
          token: params.get("token"),
          password: f.get("password"),
        });
        await refresh();
        setNotice(
          "Parolanız yenilendi. Yeni parolanızla giriş yapabilirsiniz.",
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
      <span className="section-note">Hesap güvenliği</span>
      <h1>
        {mode === "verify"
          ? "E-postanızı doğrulayın."
          : mode === "forgot"
            ? "Parolanızı mı unuttunuz?"
            : "Yeni bir parola belirleyin."}
      </h1>
      <p className="muted">
        {mode === "verify"
          ? "Bağlantınızı aşağıdaki düğmeyle onaylayın."
          : mode === "forgot"
            ? "Üyelik e-posta adresinize tek kullanımlık yenileme bağlantısı isteyin."
            : "Bu bağlantı bir saat geçerlidir ve bir kez kullanılabilir."}
      </p>
      {!done && (
        <form onSubmit={submit}>
          {mode === "forgot" ? (
            <label className="field">
              E-posta
              <input name="email" type="email" required autoComplete="email" />
            </label>
          ) : mode === "reset" ? (
            <>
              <label className="field">
                Yeni parola
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
                Yeni parola tekrar
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
              ? "E-postamı doğrula"
              : mode === "forgot"
                ? "Yenileme bağlantısı iste"
                : "Parolamı yenile"}
          </button>
        </form>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
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
        Hesabıma dön
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
    [admin, setAdmin] = useState(false);
  useEffect(() => {
    api<TicketInfo>("/tickets/" + token)
      .then(setData)
      .catch((e) => setError(e.message));
    api("/admin/session")
      .then(() => setAdmin(true))
      .catch(() => {});
  }, [token]);
  return (
    <section className="container security-page ticket-verification">
      <Ticket size={34} />
      <span className="section-note">Rota Kars belge doğrulama</span>
      <h1>
        {data?.valid
          ? "Rezervasyon doğrulandı."
          : data
            ? "Kesinleşmiş bilet değil."
            : "Belgeniz kontrol ediliyor…"}
      </h1>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {data && (
        <>
          <h2>{data.tourName}</h2>
          <p>{data.reference}</p>
          <div className="ticket-data">
            <div>
              <span>Hareket</span>
              <strong>
                {dateLabel(data.date)} · {data.startTime}
              </strong>
            </div>
            <div>
              <span>Buluşma</span>
              <strong>{data.pickup}</strong>
            </div>
            <div>
              <span>Koltuklar</span>
              <strong>{data.seats.join(", ")}</strong>
            </div>
            <div>
              <span>Durum</span>
              <strong>
                {
                  (
                    {
                      pending_agency: "Acente onayı bekliyor",
                      confirmed: "Onaylı",
                      completed: "Tur tamamlandı",
                      cancelled: "İptal edildi",
                      expired: "Süresi doldu",
                    } as Record<string, string>
                  )[data.status]
                }
              </strong>
            </div>
          </div>
          <p className="muted">
            {data.checkedIn
              ? "Katılım kaydedildi."
              : data.valid
                ? "Bu belge acente tarafından onaylanmış rezervasyona aittir."
                : "Ödeme ve acente onayı tamamlanmadan kesin bilet olarak kullanılamaz."}
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
                ? "Katılım kaydedildi"
                : "Yönetici: katılımı kaydet"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
export function ProfileSettings() {
  const { member, refresh } = useMember(),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
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
      setNotice("Profiliniz güncellendi.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return member ? (
    <section className="profile-settings">
      <div>
        <span className="section-note">Size nasıl ulaşalım?</span>
        <h2>Profil bilgilerim</h2>
        <p>
          {member.email} ·{" "}
          {member.emailVerified
            ? "Doğrulanmış e-posta"
            : "E-posta doğrulaması bekliyor"}
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
                    ? "E-postanız zaten doğrulanmış."
                    : r.deliveryConfigured
                      ? "Doğrulama e-postası kuyruğa alındı."
                      : "Doğrulama talebiniz kaydedildi. E-posta gönderimi acente tarafından etkinleştirildiğinde iletilecek.",
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Doğrulama bağlantısı iste
          </button>
        )}
      </div>
      <form onSubmit={save}>
        <div className="form-grid">
          <label className="field">
            Ad soyad
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
            Telefon
            <input
              name="phone"
              type="tel"
              defaultValue={member.phone || ""}
              autoComplete="tel"
            />
          </label>
        </div>
        <button className="btn btn-outline btn-small" disabled={busy}>
          Bilgilerimi kaydet
        </button>
        <Link className="text-link" to="/uyelik/parolami-unuttum">
          Parolamı yenile
        </Link>
      </form>
      {notice && (
        <p className="notice-success" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  ) : null;
}
