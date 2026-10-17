import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { Gift, ArrowRight, Check } from "lucide-react";
import { Modal } from "./Modal";
import { useMember } from "../lib/member";
export function MembershipInvite() {
  const { member, loading } = useMember(),
    location = useLocation(),
    [open, setOpen] = useState(false);
  useEffect(() => {
    if (
      location.pathname.startsWith("/uyelik/") ||
      location.pathname.startsWith("/bilet/") ||
      loading ||
      member ||
      ["/uyelik", "/hesabim", "/yonetim"].includes(location.pathname)
    )
      return;
    let seen = false;
    try {
      seen = Boolean(localStorage.getItem("rota-membership-invite-v1"));
    } catch {}
    if (seen) return;
    const timer = setTimeout(() => {
      setOpen(true);
      try {
        localStorage.setItem("rota-membership-invite-v1", "seen");
      } catch {}
    }, 1200);
    return () => clearTimeout(timer);
  }, [loading, member, location.pathname]);
  return open && !member ? (
    <Modal title="Rota Kars’a hoş geldiniz" onClose={() => setOpen(false)}>
      <div className="membership-invite">
        <div className="member-gift">
          <Gift size={32} />
        </div>
        <span className="section-note">Yol arkadaşlarımıza özel</span>
        <h2>
          Bir sonraki rotanız
          <br />
          bir sürprizle başlasın.
        </h2>
        <p>
          Ücretsiz üye olun, şans çarkında %5, %10 veya %15 tur indirimi
          kazanın.
        </p>
        <div className="invite-benefit">
          <Check size={17} />
          Arkadaşını davet et, ikinize de %10 indirim gelsin.
        </div>
        <Link className="btn block" to="/uyelik" onClick={() => setOpen(false)}>
          Üye ol, çarkını çevir <ArrowRight size={17} />
        </Link>
        <button className="text-link" onClick={() => setOpen(false)}>
          Şimdilik rotaları keşfedeyim
        </button>
        <small>
          Çark üyelik başına bir kez. Güncel oran, süre ve davet koşullarını
          hesabınızdan inceleyebilirsiniz.
        </small>
      </div>
    </Modal>
  ) : null;
}
