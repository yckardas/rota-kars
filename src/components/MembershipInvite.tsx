import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Link, stripLang, useLang } from "../lib/i18n";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Modal } from "./Modal";
import { useMember } from "../lib/member";
import { api, post } from "../lib/api";
import { useTurnstile } from "./Turnstile";
import {
  PrizeWheel,
  prizeLabel,
  sectorOdds,
  toSectors,
  type WheelSector,
} from "./PrizeWheel";
import { currency } from "../lib/types";
// Only invite on discovery pages, never mid-booking or on account/ticket pages.
const INVITE_PAGES = ["/", "/turlar", "/hizmetler", "/hakkimizda"];
const SEEN_KEY = "rota-membership-invite-v1";
// Kazanılan hediyenin özeti; üyelik sayfasında "hediyen bekliyor" yazmak için.
// Asıl hediye sunucuda, rota_wheel çereziyle eşlenmiş olarak durur.
export const WHEEL_PRIZE_KEY = "rota-wheel-prize-v1";
export type StoredPrize = { kind: WheelSector["kind"]; value: number; expiresAt: number };
export function readStoredPrize(): StoredPrize | null {
  try {
    const p = JSON.parse(localStorage.getItem(WHEEL_PRIZE_KEY) || "null");
    return p && p.expiresAt > Date.now() ? p : null;
  } catch {
    return null;
  }
}
type Campaign = { active: boolean; sectors: unknown; amountMinTotal?: number; validDays: number };
type SpinResult = {
  index: number;
  prize: WheelSector;
  sectors: unknown;
  expiresAt: number;
  repeated: boolean;
};
export function MembershipInvite() {
  const { member, loading } = useMember(),
    location = useLocation(),
    [open, setOpen] = useState(false),
    [campaign, setCampaign] = useState<Campaign | null>(null),
    [sectors, setSectors] = useState<WheelSector[]>([]),
    [landOn, setLandOn] = useState<number | null>(null),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<SpinResult | null>(null),
    [shown, setShown] = useState(false),
    [error, setError] = useState(""),
    human = useTurnstile("wheel"),
    { t, lang } = useLang();
  useEffect(() => {
    if (
      loading ||
      member ||
      !INVITE_PAGES.includes(
        stripLang(location.pathname.replace(/\/+$/, "") || "/"),
      )
    )
      return;
    let seen = false;
    try {
      seen = Boolean(localStorage.getItem(SEEN_KEY));
    } catch {}
    if (seen) return;
    let done = false;
    const show = () => {
      if (done) return;
      done = true;
      cleanup();
      setOpen(true);
      try {
        localStorage.setItem(SEEN_KEY, "seen");
      } catch {}
    };
    const onScroll = () => {
      const doc = document.documentElement,
        scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable > 0 && window.scrollY / scrollable >= 0.6) show();
    };
    const timer = window.setTimeout(show, 20000);
    window.addEventListener("scroll", onScroll, { passive: true });
    function cleanup() {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    }
    return () => {
      done = true;
      cleanup();
    };
  }, [loading, member, location.pathname]);
  useEffect(() => {
    if (!open || campaign) return;
    api<Campaign>("/campaigns")
      .then((c) => {
        setCampaign(c);
        setSectors(toSectors(c.sectors));
      })
      .catch(() => setError(t("Çark şu an yüklenemedi.")));
  }, [open]);
  async function spin() {
    if (busy || result) return;
    setBusy(true);
    setError("");
    try {
      const r = await post<SpinResult>("/wheel/spin", {
        turnstileToken: human.token,
      });
      setSectors(toSectors(r.sectors));
      setResult(r);
      setLandOn(r.index);
      try {
        localStorage.setItem(
          WHEEL_PRIZE_KEY,
          JSON.stringify({ kind: r.prize.kind, value: r.prize.value, expiresAt: r.expiresAt }),
        );
      } catch {}
    } catch (e) {
      setError((e as Error).message);
      human.reset();
      setBusy(false);
    }
  }
  if (!open || member) return null;
  const odds = sectorOdds(sectors),
    prize = result ? prizeLabel(result.prize, lang) : "";
  return (
    <Modal title={t("Rota Kars’a hoş geldiniz")} onClose={() => setOpen(false)}>
      <div className="membership-invite wheel-invite">
        <h2>
          {shown ? (
            <>
              {t("Tebrikler!")}
              <br />
              {t("{prize} indirim kazandınız.", { prize })}
            </>
          ) : (
            <>
              {t("Çarkı çevirin,")}
              <br />
              {t("ilk rotanıza indirim kazanın.")}
            </>
          )}
        </h2>
        {sectors.length > 0 && (
          <PrizeWheel
            sectors={sectors}
            landOn={landOn}
            animate={!result?.repeated}
            onSettled={() => {
              setShown(true);
              setBusy(false);
            }}
            lang={lang}
            label={t("Şans çarkı: {list}", {
              list: sectors.map((s) => prizeLabel(s, lang)).join(", "),
            })}
          />
        )}
        <p className="wheel-status" role="status" aria-live="polite">
          {shown
            ? t(
                "Ücretsiz üye olup e-postanızı doğrulayın; hediyeniz kupon olarak hesabınıza tanımlansın. Hediyeniz 7 gün boyunca sizin için ayrılır.",
              )
            : busy
              ? t("Çark dönüyor…")
              : t("Her dilim bir indirim. Sonuç hemen belli olur; kullanmak için üye olmanız yeterli.")}
        </p>
        {error && (
          <p className="error" role="alert">
            {t(error)}
          </p>
        )}
        {shown ? (
          <Link className="btn block" to="/uyelik" onClick={() => setOpen(false)}>
            {t("Üye olun, hediyenizi alın")} <ArrowRight size={17} />
          </Link>
        ) : (
          <>
            {human.widget}
            <button
              className="btn block"
              onClick={spin}
              disabled={busy || !human.ready || !campaign?.active || !sectors.length}
            >
              {busy && <LoaderCircle className="spin" size={17} />}
              {campaign && !campaign.active
                ? t("Kampanya şu anda kapalı")
                : t("Çarkı çevir")}
            </button>
          </>
        )}
        <button className="text-link" onClick={() => setOpen(false)}>
          {t("Şimdilik rotaları keşfedeyim")}
        </button>
        <details className="wheel-terms">
          <summary>{t("Şanslar ve koşullar")}</summary>
          <ul>
            {sectors.map((s, i) => (
              <li key={i}>
                <strong>{prizeLabel(s, lang)}</strong>
                <span>{t("%{p} şans", { p: odds[i] })}</span>
              </li>
            ))}
          </ul>
          <p>
            {t(
              "Hesap başına bir hediye. Kupon, e-posta doğrulandığında {days} gün geçerli olarak tanımlanır. TL indirimleri {min} ve üzeri rezervasyonlarda geçer; indirim tur bedelini aşmaz.",
              {
                days: campaign?.validDays ?? 30,
                min: currency(campaign?.amountMinTotal ?? 100000),
              },
            )}{" "}
            <Link to="/bilgilendirme#uyelik" onClick={() => setOpen(false)}>
              {t("Kampanya koşulları")}
            </Link>
          </p>
        </details>
      </div>
    </Modal>
  );
}
