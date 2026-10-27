import { isNativeApp } from "../../lib/native";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  LockKeyhole,
  LoaderCircle,
  LogOut,
  ShieldCheck,
  KeyRound,
} from "lucide-react";
import { post, ApiError } from "../../lib/api";
export type AdminRole = "owner" | "operations" | "guide";
export type AdminUser = {
  id: string;
  email: string | null;
  name: string;
  role: AdminRole;
  roleLabel?: string;
  totpEnabled?: boolean;
  disabled?: boolean;
  createdAt?: number;
  lastLoginAt?: number | null;
};
export type AdminMe = {
  user: AdminUser;
  bootstrap: boolean;
  needs2faSetup: boolean;
  require2fa: boolean;
};
export const ROLE_LABELS: Record<AdminRole, string> = {
  owner: "Sahip",
  operations: "Operasyon",
  guide: "Rehber",
};
const message = (e: unknown) => (e as Error).message;
// E-posta + parola (+ iki adımlı kod) girişi; altta ilk kurulum parolası.
export function AdminLogin({
  onLoggedIn,
  initialNotice = "",
}: {
  onLoggedIn: () => Promise<void> | void;
  initialNotice?: string;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [needsCode, setNeedsCode] = useState(false),
    [remember, setRemember] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(initialNotice),
    [busy, setBusy] = useState(false),
    codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (needsCode) codeRef.current?.focus();
  }, [needsCode]);
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await post<{ ok: boolean; needsCode?: boolean }>(
        "/admin/login",
        {
          email: email.trim(),
          password,
          remember,
          ...(needsCode && code ? { code: code.trim() } : {}),
        },
      );
      if (r.needsCode) {
        setNeedsCode(true);
        return;
      }
      await onLoggedIn();
    } catch (e) {
      setError(message(e));
      if (needsCode) setCode("");
    } finally {
      setBusy(false);
    }
  }
  async function bootstrap(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await post("/admin/login", { password: f.get("bootstrapPassword") });
      await onLoggedIn();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admin-login">
      <SiteLogo />
      <LockKeyhole size={27} />
      <h1>Acente yönetimi</h1>
      <p>Rezervasyonlar, seferler, talepler ve günlük operasyon.</p>
      {notice && (
        <p className="notice-success" role="status">
          {notice}
        </p>
      )}
      <form onSubmit={login}>
        <label className="field">
          E-posta adresi
          <input
            type="email"
            name="email"
            autoComplete="username"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setNeedsCode(false);
            }}
            maxLength={254}
            required
          />
        </label>
        <label className="field">
          Parola
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {needsCode && (
          <label className="field">
            Doğrulama kodu
            <input
              ref={codeRef}
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
            />
            <small>Doğrulama uygulamanızdaki 6 haneli kodu girin.</small>
          </label>
        )}
        <label className="checkbox-label">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span>
            Bu cihazı 14 gün hatırla
            <small> · yalnız iki adımlı doğrulama açık hesaplarda; ortak cihazda seçmeyin</small>
          </span>
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="btn block" disabled={busy}>
          {busy ? <LoaderCircle size={17} className="spin" /> : null}
          {needsCode ? "Doğrula ve giriş yap" : "Giriş yap"}
        </button>
      </form>
      <details className="admin-bootstrap">
        <summary>İlk kurulum (paylaşılan parola)</summary>
        <p>
          Henüz hiçbir yönetici hesabı yoksa .env dosyasındaki ADMIN_PASSWORD
          ile giriş yapıp ilk sahip hesabını oluşturun. İlk hesap açıldığında
          bu parola kapanır.
        </p>
        <form onSubmit={bootstrap}>
          <label className="field">
            Paylaşılan parola
            <input
              type="password"
              name="bootstrapPassword"
              autoComplete="off"
              required
            />
          </label>
          <button className="btn btn-outline btn-small" disabled={busy}>
            Kurulum için giriş yap
          </button>
        </form>
      </details>
    </div>
  );
}
// İlk kurulum oturumunda ilk sahip hesabının oluşturulması.
export function FirstOwnerSetup({ onCreated }: { onCreated: () => void }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("password") !== f.get("repeat")) {
      setError("Parolalar eşleşmiyor.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await post("/admin/users", {
        name: f.get("name"),
        email: f.get("email"),
        role: "owner",
        password: f.get("password"),
      });
      onCreated();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-card">
      <h2>İlk sahip hesabını oluşturun</h2>
      <p className="muted">
        Bu hesapla kullanıcıları, denetim kaydını ve KVKK araçlarını
        yönetebilirsiniz. Hesap oluşturulduğunda doğrudan bu hesapla oturum
        açılır.
      </p>
      <form onSubmit={submit}>
        <div className="form-grid">
          <label className="field">
            Ad soyad
            <input name="name" autoComplete="name" minLength={2} required />
          </label>
          <label className="field">
            E-posta adresi
            <input
              name="email"
              type="email"
              autoComplete="username"
              maxLength={254}
              required
            />
          </label>
          <label className="field">
            Parola
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={200}
              required
            />
            <small>En az 12 karakter.</small>
          </label>
          <label className="field">
            Parola (tekrar)
            <input
              name="repeat"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={200}
              required
            />
          </label>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="btn" disabled={busy}>
          {busy ? <LoaderCircle size={17} className="spin" /> : null}
          Sahip hesabını oluştur
        </button>
      </form>
    </section>
  );
}
// İki adımlı doğrulama kurulumu: QR kod, elle girilecek anahtar ve kod onayı.
export function TwoFactorSetup({
  autoStart = false,
  onEnabled,
}: {
  autoStart?: boolean;
  onEnabled: () => void;
}) {
  const [setup, setSetup] = useState<{
      secret: string;
      otpauthUrl: string;
      qrDataUrl: string;
    } | null>(null),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    started = useRef(false),
    codeRef = useRef<HTMLInputElement>(null);
  async function start() {
    setBusy(true);
    setError("");
    try {
      setSetup(await post("/admin/me/2fa/setup", {}));
      setCode("");
      setTimeout(() => codeRef.current?.focus());
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      start();
    }
  }, [autoStart]);
  async function enable(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post("/admin/me/2fa/enable", { code: code.trim() });
      onEnabled();
    } catch (e) {
      setError(message(e));
      setCode("");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="totp-setup">
      {!setup ? (
        <button
          type="button"
          className="btn btn-outline btn-small"
          disabled={busy}
          onClick={start}
        >
          {busy ? (
            <LoaderCircle size={15} className="spin" />
          ) : (
            <ShieldCheck size={15} />
          )}
          İki adımlı doğrulamayı kur
        </button>
      ) : (
        <>
          <ol>
            <li>
              Google Authenticator, Microsoft Authenticator veya benzeri bir
              doğrulama uygulamasıyla QR kodu okutun.
            </li>
            <li>Uygulamanın ürettiği 6 haneli kodu girin.</li>
          </ol>
          <div className="totp-qr">
            <img
              src={setup.qrDataUrl}
              alt="İki adımlı doğrulama QR kodu"
              width={220}
              height={220}
            />
            <div>
              <small>QR okutamıyorsanız bu anahtarı elle girin:</small>
              <code>{setup.secret}</code>
            </div>
          </div>
          <form onSubmit={enable}>
            <label className="field">
              Doğrulama kodu
              <input
                ref={codeRef}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
              />
            </label>
            <button className="btn btn-small" disabled={busy}>
              {busy ? <LoaderCircle size={15} className="spin" /> : null}
              Doğrula ve etkinleştir
            </button>
          </form>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
// 2FA zorunluyken ve kullanıcı henüz kurmadıysa gösterilen tek ekran.
export function ForcedTwoFactor({
  me,
  onEnabled,
  onLogout,
}: {
  me: AdminMe;
  onEnabled: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="admin-login admin-2fa-gate">
      <SiteLogo />
      <ShieldCheck size={27} />
      <h1>İki adımlı doğrulama</h1>
      <p>
        Merhaba {me.user.name}. Yönetim paneline devam etmek için hesabınızda
        iki adımlı doğrulamayı açmanız gerekiyor.
      </p>
      <TwoFactorSetup autoStart onEnabled={onEnabled} />
      <button className="text-link" onClick={onLogout}>
        <LogOut size={16} />
        Çıkış yap
      </button>
    </div>
  );
}
// Hesabım: parola değiştirme ve iki adımlı doğrulama.
export function AdminAccount({
  me,
  onChanged,
  onPasswordChanged,
}: {
  me: AdminMe;
  onChanged: () => void;
  onPasswordChanged: (message: string) => void;
}) {
  const [error, setError] = useState(""),
    [twoFaError, setTwoFaError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  if (me.bootstrap)
    return (
      <div className="info-note">
        <KeyRound size={22} />
        <div>
          <strong>Paylaşılan parola ile giriş yaptınız.</strong>
          <p>
            Parola ve iki adımlı doğrulama ayarları, kendi sahip hesabınızı
            oluşturduktan sonra kullanılabilir.
          </p>
        </div>
      </div>
    );
  async function changePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form);
    if (f.get("next") !== f.get("repeat")) {
      setError("Yeni parolalar eşleşmiyor.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await post<{ message?: string }>("/admin/me/password", {
        current: f.get("current"),
        next: f.get("next"),
      });
      onPasswordChanged(
        r.message || "Parola değişti. Yeni parolanızla tekrar giriş yapın.",
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function disable2fa(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setTwoFaError("");
    try {
      await post("/admin/me/2fa/disable", {
        password: f.get("password"),
        code: String(f.get("code") || "").trim(),
      });
      setNotice("İki adımlı doğrulama kapatıldı.");
      onChanged();
    } catch (e) {
      setTwoFaError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const u = me.user;
  return (
    <div className="admin-account">
      <section className="admin-card">
        <h2>Hesap bilgileri</h2>
        <dl className="admin-facts">
          <div>
            <dt>Ad</dt>
            <dd>{u.name}</dd>
          </div>
          <div>
            <dt>E-posta</dt>
            <dd>{u.email}</dd>
          </div>
          <div>
            <dt>Rol</dt>
            <dd>{u.roleLabel || ROLE_LABELS[u.role]}</dd>
          </div>
          {u.lastLoginAt ? (
            <div>
              <dt>Son giriş</dt>
              <dd>{new Date(u.lastLoginAt).toLocaleString("tr-TR")}</dd>
            </div>
          ) : null}
        </dl>
      </section>
      <section className="admin-card">
        <h2>Parolayı değiştir</h2>
        <p className="muted">
          Parola değiştiğinde bütün oturumlarınız kapanır; yeni parolanızla
          tekrar giriş yaparsınız.
        </p>
        <form onSubmit={changePassword}>
          <label className="field">
            Mevcut parola
            <input
              name="current"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <div className="form-grid">
            <label className="field">
              Yeni parola
              <input
                name="next"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={200}
                required
              />
              <small>En az 12 karakter.</small>
            </label>
            <label className="field">
              Yeni parola (tekrar)
              <input
                name="repeat"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={200}
                required
              />
            </label>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-small" disabled={busy}>
            Parolayı değiştir
          </button>
        </form>
      </section>
      <section className="admin-card">
        <h2>İki adımlı doğrulama</h2>
        {notice && (
          <p className="notice-success" role="status">
            {notice}
          </p>
        )}
        {u.totpEnabled ? (
          <>
            <p>
              <span className="status-tag">Açık</span> Girişlerde doğrulama
              uygulamanızdaki kod istenir.
            </p>
            {me.require2fa ? (
              <p className="muted">
                Bu sunucuda iki adımlı doğrulama zorunlu olduğu için
                kapatılamaz.
              </p>
            ) : (
              <form onSubmit={disable2fa}>
                <div className="form-grid">
                  <label className="field">
                    Parolanız
                    <input
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                    />
                  </label>
                  <label className="field">
                    Doğrulama kodu
                    <input
                      name="code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="\d{6}"
                      maxLength={6}
                      required
                    />
                  </label>
                </div>
                <button
                  className="btn btn-outline btn-small"
                  disabled={busy}
                >
                  İki adımlı doğrulamayı kapat
                </button>
              </form>
            )}
          </>
        ) : (
          <>
            <p className="muted">
              Hesabınızı parolanın ele geçirilmesine karşı korumak için
              doğrulama uygulamasıyla ikinci bir adım ekleyin.
            </p>
            <TwoFactorSetup
              onEnabled={() => {
                setNotice("İki adımlı doğrulama açıldı.");
                onChanged();
              }}
            />
          </>
        )}
        {twoFaError && (
          <p className="error" role="alert">
            {twoFaError}
          </p>
        )}
      </section>
    </div>
  );
}
export const isTwoFactorRequired = (e: unknown) =>
  e instanceof ApiError && e.status === 403 && e.code === "2FA_REQUIRED";
// Logo tarayıcıda siteye götürür; yönetim uygulamasında panelde kalınır.
function SiteLogo() {
  const img = <img src="/images/logo.png" alt="Rota Kars" />;
  return isNativeApp() ? <span className="admin-login-logo">{img}</span> : <Link to="/">{img}</Link>;
}
