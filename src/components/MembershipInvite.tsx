import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Link, stripLang, useLang } from "../lib/i18n";
import { Gift, ArrowRight, Check } from "lucide-react";
import { Modal } from "./Modal";
import { useMember } from "../lib/member";
// Only invite on discovery pages, never mid-booking or on account/ticket pages.
const INVITE_PAGES = ["/", "/turlar", "/hizmetler", "/hakkimizda"];
export function MembershipInvite() {
  const { member, loading } = useMember(),
    location = useLocation(),
    [open, setOpen] = useState(false),
    { t } = useLang();
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
      seen = Boolean(localStorage.getItem("rota-membership-invite-v1"));
    } catch {}
    if (seen) return;
    let done = false;
    const show = () => {
      if (done) return;
      done = true;
      cleanup();
      setOpen(true);
      try {
        localStorage.setItem("rota-membership-invite-v1", "seen");
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
  return open && !member ? (
    <Modal title={t("Rota Kars’a hoş geldiniz")} onClose={() => setOpen(false)}>
      <div className="membership-invite">
        <div className="member-gift">
          <Gift size={32} />
        </div>
        <h2>
          {t("Bir sonraki rotanız")}
          <br />
          {t("bir sürprizle başlasın.")}
        </h2>
        <p>
          {t(
            "Ücretsiz üye olun, şans çarkında %5, %10 veya %15 tur indirimi kazanın.",
          )}
        </p>
        <div className="invite-benefit">
          <Check size={17} />
          {t("Arkadaşını davet et, ikinize de %10 indirim gelsin.")}
        </div>
        <Link className="btn block" to="/uyelik" onClick={() => setOpen(false)}>
          {t("Üye ol, çarkını çevir")} <ArrowRight size={17} />
        </Link>
        <button className="text-link" onClick={() => setOpen(false)}>
          {t("Şimdilik rotaları keşfedeyim")}
        </button>
        <small>
          {t(
            "Çark üyelik başına bir kez. Güncel oran, süre ve davet koşullarını hesabınızdan inceleyebilirsiniz.",
          )}
        </small>
      </div>
    </Modal>
  ) : null;
}
