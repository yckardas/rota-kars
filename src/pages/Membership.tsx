import { ProfileSettings } from "./AccountSecurity";
import type { Campaign } from "../components/OperationsDesk";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Gift,
  ArrowRight,
  LoaderCircle,
  Copy,
  Check,
  LogOut,
  Users,
  Ticket,
  RotateCcw,
  Apple,
  Facebook,
} from "lucide-react";
import { api, post } from "../lib/api";
import { currency, dateLabel } from "../lib/types";
import { useMember, type MemberDashboard, type Coupon } from "../lib/member";
function GoogleMark() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.06.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.41 13.92A6 6 0 0 1 6.1 12c0-.67.11-1.32.31-1.92V7.49H3.07A10 10 0 0 0 2 12c0 1.61.39 3.14 1.07 4.51l3.34-2.59Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.96c1.47 0 2.79.5 3.83 1.5l2.88-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z"
      />
    </svg>
  );
}
export function Membership() {
  const { member, loading, refresh } = useMember(),
    navigate = useNavigate(),
    [params] = useSearchParams();
  const [mode, setMode] = useState<"register" | "login">(
      params.get("mode") === "login" ? "login" : "register",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [providers, setProviders] = useState<{ id: string; enabled: boolean }[]>(
      [],
    ),
    [ref, setRef] = useState(params.get("ref") || "");
  useEffect(() => {
    api<{ id: string; enabled: boolean }[]>("/auth/providers")
      .then(setProviders)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (member) navigate("/hesabim", { replace: true });
  }, [member, navigate]);
  useEffect(() => {
    if (params.has("error"))
      setError(
        params.get("error") === "existing_account"
          ? "Bu e-posta zaten kayıtlı. E-posta ve parolanızla giriş yapın, ardından sosyal hesabınızı bağlayın."
          : "Sosyal giriş tamamlanamadı. Yeniden deneyebilir veya e-postayla giriş yapabilirsiniz.",
      );
  }, [params]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await post("/auth/" + mode, {
        email: f.get("email"),
        password: f.get("password"),
        ...(mode === "register"
          ? {
              name: f.get("name"),
              consent: f.get("consent") === "on",
              ...(ref.trim() ? { referralCode: ref.trim().toUpperCase() } : {}),
            }
          : {}),
      });
      await refresh();
      navigate("/hesabim");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return <div className="container empty-state">Üyelik hazırlanıyor…</div>;
  return (
    <section className="container membership-layout">
      <div className="membership-story">
        <img src="/images/kars.webp" alt="Kars rotasından bir görünüm" />
        <div>
          <span className="section-note">Rota Kars yol arkadaşlığı</span>
          <h1>
            Güzel yolculuklar,
            <br />
            güzel ayrıcalıklar.
          </h1>
          <p>
            Birlikte keşfedelim. Size özel fırsatlar, yeni rotalar ve yol
            arkadaşlarınızla paylaşacağınız anılar.
          </p>
          <div>
            <Gift />
            Üyelere özel şans çarkı
          </div>
          <div>
            <Users />
            Arkadaşınla ikinize de %10 indirim
          </div>
        </div>
      </div>
      <div className="membership-form-panel">
        <div className="membership-tabs">
          <button
            className={mode === "register" ? "active" : ""}
            onClick={() => {
              setMode("register");
              setError("");
            }}
          >
            Üye ol
          </button>
          <button
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setError("");
            }}
          >
            Giriş yap
          </button>
        </div>
        <h2>
          {mode === "register"
            ? "Yol arkadaşımız olun."
            : "Yeniden hoş geldiniz."}
        </h2>
        <p className="muted">
          {mode === "register"
            ? "Üyeliğiniz ücretsiz. Bir sonraki rotanız için avantajlarınızı keşfedin."
            : "Kuponlarınız ve yolculuklarınız sizi bekliyor."}
        </p>
        <div className="social-signins">
          {[
            ["google", "Google", GoogleMark],
            ["apple", "Apple", Apple],
            ["facebook", "Facebook", Facebook],
          ].map(([id, label, Icon]) => {
            const ready = providers.find((p) => p.id === id)?.enabled;
            const Mark = Icon as typeof GoogleMark;
            return (
              <button
                type="button"
                key={id as string}
                className="social-signin"
                disabled={!ready}
                title={
                  ready ? undefined : "Firma hesabı bağlantısı hazırlanıyor"
                }
                onClick={() =>
                  window.location.assign(
                    "/api/auth/start/" +
                      id +
                      (ref ? "?ref=" + encodeURIComponent(ref) : ""),
                  )
                }
              >
                <Mark />
                {label as string} ile devam et{!ready && <small>Yakında</small>}
              </button>
            );
          })}
        </div>
        {providers.some((p) => !p.enabled) && (
          <small className="social-setup-note">
            Sosyal girişler hesap bağlantısı tamamlandığında açılacak. Şimdi
            e-postanızla üye olabilirsiniz.
          </small>
        )}
        <div className="auth-divider">
          <span>veya e-postayla</span>
        </div>
        {mode === "login" && (
          <Link className="text-link" to="/uyelik/parolami-unuttum">
            Parolamı unuttum
          </Link>
        )}
        <form key={mode} onSubmit={submit}>
          {mode === "register" && (
            <label className="field">
              Adınız soyadınız
              <input
                name="name"
                autoComplete="name"
                minLength={2}
                maxLength={100}
                required
              />
            </label>
          )}
          <label className="field">
            E-posta adresiniz
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
            />
          </label>
          <label className="field">
            Parolanız
            <input
              name="password"
              type="password"
              minLength={mode === "register" ? 10 : 1}
              maxLength={128}
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
              required
            />
            {mode === "register" && <small>En az 10 karakter kullanın.</small>}
          </label>
          {mode === "register" && (
            <>
              <details
                className="referral-field"
                open={Boolean(params.get("ref"))}
              >
                <summary>Davet kodunuz var mı?</summary>
                <label className="field">
                  Arkadaşınızın davet kodu
                  <input
                    name="referralCode"
                    value={ref}
                    onChange={(e) => setRef(e.target.value.toUpperCase())}
                    maxLength={10}
                    placeholder="İsteğe bağlı"
                  />
                </label>
              </details>
              <label className="checkbox-label">
                <input type="checkbox" name="consent" required />
                <span>
                  <Link to="/bilgilendirme#uyelik" target="_blank">
                    Üyelik ve kampanya koşullarını
                  </Link>{" "}
                  ve veri bilgilendirmesini okudum, kabul ediyorum.
                </span>
              </label>
            </>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="btn block" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={17} /> : null}
            {mode === "register" ? "Üye ol, ayrıcalıkları keşfet" : "Giriş yap"}
            <ArrowRight size={17} />
          </button>
        </form>
      </div>
    </section>
  );
}
export function Account() {
  const { member, loading, logout } = useMember(),
    navigate = useNavigate(),
    [data, setData] = useState<MemberDashboard | null>(null),
    [error, setError] = useState(""),
    [spinning, setSpinning] = useState(false),
    [angle, setAngle] = useState(0),
    [campaign, setCampaign] = useState<Campaign | null>(null),
    [sectors, setSectors] = useState([5, 10, 5, 15, 10, 5]),
    [prize, setPrize] = useState<Coupon | null>(null),
    [copied, setCopied] = useState(false),
    [providers, setProviders] = useState<{ id: string; enabled: boolean }[]>(
      [],
    );
  useEffect(() => {
    api<{ id: string; enabled: boolean }[]>("/auth/providers")
      .then(setProviders)
      .catch(() => {});
  }, []);
  const reduceMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  async function load() {
    const [dashboard, c] = await Promise.all([
      api<MemberDashboard>("/member/dashboard"),
      api<Campaign>("/campaigns"),
    ]);
    setData(dashboard);
    setCampaign(c);
    setSectors(
      dashboard.spin?.sectors_json
        ? JSON.parse(dashboard.spin.sectors_json)
        : c.sectors,
    );
  }
  useEffect(() => {
    if (!loading && !member) navigate("/uyelik?mode=login", { replace: true });
    if (member) load().catch((e) => setError(e.message));
  }, [member, loading, navigate]);
  useEffect(() => {
    if (data?.spin && !spinning)
      setAngle(360 - ((data.spin.prize_index * 60 + 30) % 360));
  }, [data?.spin]);
  async function spin() {
    if (spinning) return;
    setSpinning(true);
    setError("");
    try {
      const r = await post<{
        index: number;
        coupon: Coupon;
        sectors: number[];
      }>("/member/spin", {});
      setSectors(r.sectors);
      setAngle(360 * 6 + 360 - (r.index * 60 + 30));
      await new Promise((resolve) =>
        setTimeout(resolve, reduceMotion() ? 0 : 4200),
      );
      setPrize(r.coupon);
      await load();
    } catch (e) {
      setError((e as Error).message);
      await load().catch(() => {});
    } finally {
      setSpinning(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        location.origin + "/uyelik?ref=" + member!.referralCode,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(
        "Bağlantıyı kopyalayamadık. Aşağıdaki davet bağlantısını seçip kopyalayabilirsiniz.",
      );
    }
  }
  if (!member || !data)
    return (
      <div className="container empty-state">
        Hesabınız hazırlanıyor…{error && <p role="alert">{error}</p>}
      </div>
    );
  const usable = data.coupons.filter(
    (c) => !c.used_reservation && c.expires_at > Date.now(),
  );
  return (
    <div className="container account-page">
      <div className="account-heading">
        <div>
          <span className="section-note">Rota Kars üyeliği</span>
          <h1>Merhaba, {member.name.split(" ")[0]}.</h1>
          <p className="muted">
            Yolculuklarınız ve size özel fırsatlar, tek bir yerde.
          </p>
        </div>
        <button
          className="text-link"
          onClick={async () => {
            try {
              await logout();
              navigate("/");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <LogOut size={16} />
          Çıkış yap
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <ProfileSettings />
      <div className="member-perks-grid">
        <section className="wheel-panel">
          <span className="section-note">İlk yolculuğa bir sürpriz</span>
          <h2>Şansını rotana kat.</h2>
          <p>
            Çarkı bir kez çevir; aşağıdaki dilimlerden bir tur indirimi kazan.
          </p>
          <div className="wheel-wrap">
            <div className="wheel-pointer" />
            <div
              className="prize-wheel"
              style={{ transform: `rotate(${angle}deg)` }}
            >
              {sectors.map((n, i) => (
                <span
                  key={i}
                  style={{
                    transform: `translate(-50%, -50%) rotate(${i * 60 + 30}deg) translateY(-91px) rotate(-${i * 60 + 30}deg)`,
                  }}
                >
                  %{n}
                </span>
              ))}
            </div>
            <div className="wheel-center">
              <Gift size={24} />
            </div>
          </div>
          <button
            className="btn"
            disabled={spinning || Boolean(data.spin) || !campaign?.active}
            onClick={spin}
          >
            {spinning ? (
              <>
                <RotateCcw size={17} className="spin" />
                Çark dönüyor…
              </>
            ) : data.spin ? (
              "Çark hakkınız kullanıldı"
            ) : (
              "Çarkı çevir"
            )}
          </button>
          {prize && (
            <p className="wheel-result" role="status">
              Tebrikler! %{prize.percent} indirim kuponunuz hesabınızda.
            </p>
          )}
          <small>
            Hesap başına bir hak. Yeni kuponlar {campaign?.validDays} gün
            geçerli.{" "}
            {campaign?.minTotal
              ? `Minimum tur bedeli: ${currency(campaign.minTotal)}.`
              : ""}{" "}
            {campaign?.tourIds.length
              ? "Yalnız kampanyaya dahil turlarda geçerli."
              : "Bütün turlarda geçerli."}{" "}
            {!campaign?.active && "Kampanya şu anda kapalı."}
          </small>
        </section>
        <section className="referral-panel">
          <Users size={34} />
          <span className="section-note">Güzel rotalar paylaşınca çoğalır</span>
          <h2>
            Arkadaşını getir,
            <br />
            ikinize de %10.
          </h2>
          <p>
            Davet bağlantını paylaş. Arkadaşın bu bağlantıyla üye olup{" "}
            {campaign?.referralTrigger === "paid"
              ? "turunun tam ödemesi kaydedildiğinde"
              : "turunu tamamladığında"}
            , ikiniz de sonraki turunuz için %10 kupon kazanın. Aynı arkadaş
            için bir kez ödül verilir.
          </p>
          <div className="referral-code">
            <small>Davet kodunuz</small>
            <strong>{member.referralCode}</strong>
          </div>
          <label className="field">
            Davet bağlantınız
            <input
              readOnly
              value={location.origin + "/uyelik?ref=" + member.referralCode}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <button className="btn btn-outline" onClick={copy}>
            {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
            {copied ? "Bağlantı kopyalandı" : "Davet bağlantısını kopyala"}
          </button>
          <div className="referral-stats">
            <span>
              <strong>{data.referrals.total}</strong> davetle katılan
            </span>
            <span>
              <strong>{data.referrals.rewarded}</strong> kazanılan ödül
            </span>
          </div>
        </section>
      </div>
      <section className="member-coupons">
        <div className="section-heading">
          <div>
            <span className="section-note">Bir sonraki yolculuğunuz için</span>
            <h2>İndirim kuponlarım</h2>
          </div>
          <Link className="text-link" to="/turlar">
            Rotanı seç <ArrowRight size={16} />
          </Link>
        </div>
        {data.coupons.length ? (
          <div className="coupon-grid">
            {data.coupons.map((c) => (
              <article
                className={
                  "coupon-card " +
                  (!usable.some((u) => u.id === c.id) ? "inactive" : "")
                }
                key={c.id}
              >
                <strong>%{c.percent}</strong>
                <div>
                  <h3>
                    {c.source === "wheel"
                      ? "Şans çarkı hediyeniz"
                      : "Arkadaş daveti hediyeniz"}
                  </h3>
                  <p>
                    {c.used_reservation
                      ? "Kullanıldı"
                      : c.expires_at <= Date.now()
                        ? "Süresi doldu"
                        : "Rezervasyonda seçebilirsiniz"}
                  </p>
                  {c.policy_json && (
                    <small>
                      {(() => {
                        const p = JSON.parse(c.policy_json!);
                        return (
                          (p.minTotal
                            ? `Minimum ${currency(p.minTotal)}. `
                            : "") +
                          (p.tourIds?.length
                            ? "Seçili turlarda geçerli."
                            : "Tüm turlarda geçerli.")
                        );
                      })()}
                    </small>
                  )}
                  <small>
                    Son gün:{" "}
                    {new Date(c.expires_at).toLocaleDateString("tr-TR")}
                  </small>
                </div>
                <Ticket size={23} />
              </article>
            ))}
          </div>
        ) : (
          <p className="member-empty">
            İlk kuponunuz için şans çarkını çevirin.
          </p>
        )}
        <p className="campaign-terms">
          Kuponlar üzerlerinde belirtilen tarihe kadar geçerli, tek kullanımlı
          ve yalnız üye hesabınıza aittir. Aynı rezervasyonda bir kupon
          kullanılabilir; indirimler birleştirilmez. Tur bedeline uygulanır;
          ekstra hizmet ve konaklamayı kapsamaz.
        </p>
      </section>
      <section className="member-social-links">
        <h2>Giriş seçeneklerim</h2>
        <p className="muted">
          Aynı e-posta adresine sahip sosyal hesabınızı bağlayarak sonraki
          girişlerinizi kolaylaştırabilirsiniz.
        </p>
        <div>
          {providers.map((p) => (
            <button
              className="btn btn-outline btn-small"
              key={p.id}
              disabled={!p.enabled}
              onClick={() => window.location.assign("/api/auth/start/" + p.id)}
            >
              {p.id === "google"
                ? "Google"
                : p.id === "apple"
                  ? "Apple"
                  : "Facebook"}{" "}
              {p.enabled ? "hesabını bağla" : "· Bağlantı hazırlanıyor"}
            </button>
          ))}
        </div>
      </section>
      <section className="member-reservations">
        <h2>Ön rezervasyonlarım</h2>
        {data.reservations.length ? (
          data.reservations.map((r) => (
            <article key={r.reference}>
              <div>
                <strong>{r.reference}</strong>
                <span>{dateLabel(r.date)}</span>
              </div>
              <span>{currency(r.total)}</span>
              <Link
                className="text-link"
                to={"/rezervasyonum?ref=" + r.reference}
              >
                Sorgula <ArrowRight size={14} />
              </Link>
            </article>
          ))
        ) : (
          <p className="member-empty">
            İlk yolculuğunuz henüz burada değil.{" "}
            <Link to="/turlar">Rotaları keşfedin.</Link>
          </p>
        )}
      </section>
    </div>
  );
}
