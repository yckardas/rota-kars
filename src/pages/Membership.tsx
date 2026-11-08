import { ProfileSettings, MemberPrivacy } from "./AccountSecurity";
import { CompanionsSection } from "../components/Companions";
import { useTurnstile } from "../components/Turnstile";
import type { Campaign } from "../components/OperationsDesk";
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Link, useLang, useLocalNavigate } from "../lib/i18n";
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
import { safeNextPath } from "../lib/phone";
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
    navigate = useLocalNavigate(),
    { lang, t, path } = useLang(),
    [params] = useSearchParams();
  const [mode, setMode] = useState<"register" | "login">(
      params.get("mode") === "login" ? "login" : "register",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [providers, setProviders] = useState<{ id: string; enabled: boolean }[]>(
      [],
    ),
    [ref, setRef] = useState(params.get("ref") || ""),
    human = useTurnstile(mode === "register" ? "register" : "login"),
    destination = safeNextPath(params.get("next")) || "/hesabim";
  useEffect(() => {
    api<{ id: string; enabled: boolean }[]>("/auth/providers")
      .then(setProviders)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (member) navigate(destination, { replace: true });
  }, [member, navigate, destination]);
  useEffect(() => {
    if (params.has("error"))
      setError(
        params.get("error") === "existing_account"
          ? t(
              "Bu e-posta zaten kayıtlı. E-posta ve parolanızla giriş yapın, ardından sosyal hesabınızı bağlayın.",
            )
          : t(
              "Sosyal giriş tamamlanamadı. Yeniden deneyebilir veya e-postayla giriş yapabilirsiniz.",
            ),
      );
  }, [params, t]);
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
              marketingConsent: f.get("marketingConsent") === "on",
              ...(ref.trim() ? { referralCode: ref.trim().toUpperCase() } : {}),
            }
          : {}),
        turnstileToken: human.token,
      });
      await refresh();
      navigate(destination, { replace: true });
    } catch (e) {
      setError((e as Error).message);
      human.reset();
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <div className="container empty-state">{t("Üyelik hazırlanıyor…")}</div>
    );
  return (
    <section className="container membership-layout">
      <div className="membership-story">
        <img src="/images/kars.webp" alt={t("Kars rotasından bir görünüm")} />
        <div>
          <span className="section-note">{t("Rota Kars yol arkadaşlığı")}</span>
          <h1>
            {t("Güzel yolculuklar,")}
            <br />
            {t("güzel ayrıcalıklar.")}
          </h1>
          <p>
            {t(
              "Birlikte keşfedelim. Size özel fırsatlar, yeni rotalar ve yol arkadaşlarınızla paylaşacağınız anılar.",
            )}
          </p>
          <div>
            <Gift />
            {t("Üyelere özel şans çarkı")}
          </div>
          <div>
            <Users />
            {t("Arkadaşınla ikinize de %10 indirim")}
          </div>
        </div>
      </div>
      <div className="membership-form-panel">
        <div
          className="membership-tabs"
          role="tablist"
          aria-label={t("Üyelik")}
          onKeyDown={(e) => {
            // Sol/sağ ok tuşlarıyla sekmeler arasında geçiş.
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            const next = mode === "register" ? "login" : "register";
            setMode(next);
            setError("");
            document.getElementById("membership-tab-" + next)?.focus();
          }}
        >
          {(
            [
              ["register", "Üye ol"],
              ["login", "Giriş yap"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              id={"membership-tab-" + id}
              role="tab"
              type="button"
              aria-selected={mode === id}
              aria-controls="membership-panel"
              tabIndex={mode === id ? 0 : -1}
              className={mode === id ? "active" : ""}
              onClick={() => {
                setMode(id);
                setError("");
              }}
            >
              {t(label)}
            </button>
          ))}
        </div>
        <h2>
          {mode === "register"
            ? t("Yol arkadaşımız olun.")
            : t("Yeniden hoş geldiniz.")}
        </h2>
        <p className="muted">
          {mode === "register"
            ? t(
                "Üyeliğiniz ücretsiz. Bir sonraki rotanız için avantajlarınızı keşfedin.",
              )
            : t("Kuponlarınız ve yolculuklarınız sizi bekliyor.")}
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
                  ready ? undefined : t("Firma hesabı bağlantısı hazırlanıyor")
                }
                onClick={() =>
                  window.location.assign(
                    "/api/auth/start/" +
                      id +
                      "?" +
                      new URLSearchParams({
                        ...(ref ? { ref } : {}),
                        ...(destination !== "/hesabim" || lang !== "tr"
                          ? { next: path(destination) }
                          : {}),
                      }).toString(),
                  )
                }
              >
                <Mark />
                {t("{provider} ile devam et", { provider: label as string })}
                {!ready && <small>{t("Yakında")}</small>}
              </button>
            );
          })}
        </div>
        {providers.some((p) => !p.enabled) && (
          <small className="social-setup-note">
            {t(
              "Sosyal girişler hesap bağlantısı tamamlandığında açılacak. Şimdi e-postanızla üye olabilirsiniz.",
            )}
          </small>
        )}
        <div className="auth-divider">
          <span>{t("veya e-postayla")}</span>
        </div>
        {mode === "login" && (
          <Link className="text-link" to="/uyelik/parolami-unuttum">
            {t("Parolamı unuttum")}
          </Link>
        )}
        <form
          key={mode}
          onSubmit={submit}
          id="membership-panel"
          role="tabpanel"
          aria-labelledby={"membership-tab-" + mode}
        >
          {mode === "register" && (
            <label className="field">
              {t("Adınız soyadınız")}
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
            {t("E-posta adresiniz")}
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
            />
          </label>
          <label className="field">
            {t("Parolanız")}
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
            {mode === "register" && <small>{t("En az 10 karakter kullanın.")}</small>}
          </label>
          {mode === "register" && (
            <>
              <details
                className="referral-field"
                open={Boolean(params.get("ref"))}
              >
                <summary>{t("Davet kodunuz var mı?")}</summary>
                <label className="field">
                  {t("Arkadaşınızın davet kodu")}
                  <input
                    name="referralCode"
                    value={ref}
                    onChange={(e) => setRef(e.target.value.toUpperCase())}
                    maxLength={10}
                    placeholder={t("İsteğe bağlı")}
                  />
                </label>
              </details>
              <label className="checkbox-label">
                <input type="checkbox" name="consent" required />
                <span>
                  {/* Bağlantılar cümlenin içinde; sıra dile göre değişebilir. */}
                  {t("{terms} ve {notice} okudum, kabul ediyorum.")
                    .split(/(\{terms\}|\{notice\})/)
                    .map((part, k) =>
                      part === "{terms}" ? (
                        <Link key={k} to="/bilgilendirme#uyelik" target="_blank">
                          {t("Üyelik ve kampanya koşullarını")}
                        </Link>
                      ) : part === "{notice}" ? (
                        <Link key={k} to="/bilgilendirme#kvkk" target="_blank">
                          {t("kişisel veri aydınlatma metnini")}
                        </Link>
                      ) : (
                        part
                      ),
                    )}
                </span>
              </label>
              <label className="checkbox-label optional-consent">
                <input type="checkbox" name="marketingConsent" />
                <span>
                  {t(
                    "Kampanya ve yeni rotalardan e-posta/SMS ile haberdar olmak istiyorum (isteğe bağlı).",
                  )}
                </span>
              </label>
            </>
          )}
          {error && (
            <p className="error" role="alert">
              {t(error)}
            </p>
          )}
          {human.widget}
          <button
            className="btn block"
            disabled={busy || !human.ready}
          >
            {busy ? <LoaderCircle className="spin" size={17} /> : null}
            {mode === "register"
              ? t("Üye ol, ayrıcalıkları keşfet")
              : t("Giriş yap")}
            <ArrowRight size={17} />
          </button>
        </form>
      </div>
    </section>
  );
}
export function Account() {
  const { member, loading, logout } = useMember(),
    navigate = useLocalNavigate(),
    { lang, t, path, locale } = useLang(),
    // Yüzde işareti Türkçede önde, İngilizcede sonda yazılır.
    pct = (n: number) => (lang === "en" ? `${n}%` : `%${n}`),
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
        location.origin + path("/uyelik") + "?ref=" + member!.referralCode,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(
        t(
          "Bağlantıyı kopyalayamadık. Aşağıdaki davet bağlantısını seçip kopyalayabilirsiniz.",
        ),
      );
    }
  }
  if (!member || !data)
    return (
      <div className="container empty-state">
        {t("Hesabınız hazırlanıyor…")}
        {error && <p role="alert">{t(error)}</p>}
      </div>
    );
  const usable = data.coupons.filter(
    (c) => !c.used_reservation && c.expires_at > Date.now(),
  );
  return (
    <div className="container account-page">
      <div className="account-heading">
        <div>
          <span className="section-note">{t("Rota Kars üyeliği")}</span>
          <h1>{t("Merhaba, {name}.", { name: member.name.split(" ")[0] })}</h1>
          <p className="muted">
            {t("Yolculuklarınız ve size özel fırsatlar, tek bir yerde.")}
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
          {t("Çıkış yap")}
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {t(error)}
        </p>
      )}
      <ProfileSettings />
      <MemberPrivacy />
      <div className="member-perks-grid">
        <section className="wheel-panel">
          <span className="section-note">{t("İlk yolculuğa bir sürpriz")}</span>
          <h2>{t("Şansını rotana kat.")}</h2>
          <p>
            {t(
              "Çarkı bir kez çevir; aşağıdaki dilimlerden bir tur indirimi kazan.",
            )}
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
                  {pct(n)}
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
                {t("Çark dönüyor…")}
              </>
            ) : data.spin ? (
              t("Çark hakkınız kullanıldı")
            ) : (
              t("Çarkı çevir")
            )}
          </button>
          {prize && (
            <p className="wheel-result" role="status">
              {t("Tebrikler! %{percent} indirim kuponunuz hesabınızda.", {
                percent: prize.percent,
              })}
            </p>
          )}
          <small>
            {t("Hesap başına bir hak. Yeni kuponlar {days} gün geçerli.", {
              days: campaign?.validDays ?? "",
            })}{" "}
            {campaign?.minTotal
              ? t("Minimum tur bedeli: {amount}.", {
                  amount: currency(campaign.minTotal),
                })
              : ""}{" "}
            {campaign?.tourIds.length
              ? t("Yalnız kampanyaya dahil turlarda geçerli.")
              : t("Bütün turlarda geçerli.")}{" "}
            {!campaign?.active && t("Kampanya şu anda kapalı.")}
          </small>
        </section>
        <section className="referral-panel">
          <Users size={34} />
          <span className="section-note">
            {t("Güzel rotalar paylaşınca çoğalır")}
          </span>
          <h2>
            {t("Arkadaşını getir,")}
            <br />
            {t("ikinize de %10.")}
          </h2>
          <p>
            {campaign?.referralTrigger === "paid"
              ? t(
                  "Davet bağlantını paylaş. Arkadaşın bu bağlantıyla üye olup turunun tam ödemesi kaydedildiğinde, ikiniz de sonraki turunuz için %10 kupon kazanın. Aynı arkadaş için bir kez ödül verilir.",
                )
              : t(
                  "Davet bağlantını paylaş. Arkadaşın bu bağlantıyla üye olup turunu tamamladığında, ikiniz de sonraki turunuz için %10 kupon kazanın. Aynı arkadaş için bir kez ödül verilir.",
                )}
          </p>
          <div className="referral-code">
            <small>{t("Davet kodunuz")}</small>
            <strong>{member.referralCode}</strong>
          </div>
          <label className="field">
            {t("Davet bağlantınız")}
            <input
              readOnly
              value={
                location.origin + path("/uyelik") + "?ref=" + member.referralCode
              }
              onFocus={(e) => e.target.select()}
            />
          </label>
          <button className="btn btn-outline" onClick={copy}>
            {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
            {copied ? t("Bağlantı kopyalandı") : t("Davet bağlantısını kopyala")}
          </button>
          <div className="referral-stats">
            <span>
              <strong>{data.referrals.total}</strong> {t("davetle katılan")}
            </span>
            <span>
              <strong>{data.referrals.rewarded}</strong> {t("kazanılan ödül")}
            </span>
          </div>
        </section>
      </div>
      <section className="member-coupons">
        <div className="section-heading">
          <div>
            <span className="section-note">
              {t("Bir sonraki yolculuğunuz için")}
            </span>
            <h2>{t("İndirim kuponlarım")}</h2>
          </div>
          <Link className="text-link" to="/turlar">
            {t("Rotanı seç")} <ArrowRight size={16} />
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
                <strong>{pct(c.percent)}</strong>
                <div>
                  <h3>
                    {c.source === "wheel"
                      ? t("Şans çarkı hediyeniz")
                      : t("Arkadaş daveti hediyeniz")}
                  </h3>
                  <p>
                    {c.used_reservation
                      ? t("Kullanıldı")
                      : c.expires_at <= Date.now()
                        ? t("Süresi doldu")
                        : t("Rezervasyonda seçebilirsiniz")}
                  </p>
                  {c.policy_json && (
                    <small>
                      {(() => {
                        const p = JSON.parse(c.policy_json!);
                        return (
                          (p.minTotal
                            ? t("Minimum {amount}.", {
                                amount: currency(p.minTotal),
                              }) + " "
                            : "") +
                          (p.tourIds?.length
                            ? t("Seçili turlarda geçerli.")
                            : t("Tüm turlarda geçerli."))
                        );
                      })()}
                    </small>
                  )}
                  <small>
                    {t("Son gün: {date}", {
                      date: new Date(c.expires_at).toLocaleDateString(locale),
                    })}
                  </small>
                </div>
                <Ticket size={23} />
              </article>
            ))}
          </div>
        ) : (
          <p className="member-empty">
            {t("İlk kuponunuz için şans çarkını çevirin.")}
          </p>
        )}
        <p className="campaign-terms">
          {t(
            "Kuponlar üzerlerinde belirtilen tarihe kadar geçerli, tek kullanımlı ve yalnız üye hesabınıza aittir. Aynı rezervasyonda bir kupon kullanılabilir; indirimler birleştirilmez. Tur bedeline uygulanır; ekstra hizmet ve konaklamayı kapsamaz.",
          )}
        </p>
      </section>
      <CompanionsSection />
      <section className="member-social-links">
        <h2>{t("Giriş seçeneklerim")}</h2>
        <p className="muted">
          {t(
            "Aynı e-posta adresine sahip sosyal hesabınızı bağlayarak sonraki girişlerinizi kolaylaştırabilirsiniz.",
          )}
        </p>
        <div>
          {providers.map((p) => (
            <button
              className="btn btn-outline btn-small"
              key={p.id}
              disabled={!p.enabled}
              onClick={() =>
                window.location.assign(
                  "/api/auth/start/" +
                    p.id +
                    "?" +
                    new URLSearchParams({ next: path("/hesabim") }).toString(),
                )
              }
            >
              {t(
                p.enabled
                  ? "{provider} hesabını bağla"
                  : "{provider} · Bağlantı hazırlanıyor",
                {
                  provider:
                    p.id === "google"
                      ? "Google"
                      : p.id === "apple"
                        ? "Apple"
                        : "Facebook",
                },
              )}
            </button>
          ))}
        </div>
      </section>
      <section className="member-reservations">
        <h2>{t("Ön rezervasyonlarım")}</h2>
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
                {t("Sorgula")} <ArrowRight size={14} />
              </Link>
            </article>
          ))
        ) : (
          <p className="member-empty">
            {t("İlk yolculuğunuz henüz burada değil.")}{" "}
            <Link to="/turlar">{t("Rotaları keşfedin.")}</Link>
          </p>
        )}
      </section>
    </div>
  );
}
