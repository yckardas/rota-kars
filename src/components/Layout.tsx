import { useEffect, useState, type ReactNode } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import {
  Phone,
  Instagram,
  MapPin,
  Menu,
  X,
  Ticket,
  Mail,
  ExternalLink,
  MessageCircle,
  Facebook,
  UserRound,
} from "lucide-react";
import type { Catalog } from "../lib/types";
import { MembershipInvite } from "./MembershipInvite";
import { useMember } from "../lib/member";
import { ChatBot } from "./ChatBot";
import { whatsappLink } from "../lib/whatsapp";
import { telHref } from "../lib/phone";
import {
  Link,
  NavLink,
  localPath,
  stripLang,
  useLang,
  type Lang,
} from "../lib/i18n";
// Aynı sayfanın öbür dildeki karşılığına giden TR / EN bağlantıları.
function LangSwitch({ className }: { className: string }) {
  const { lang, t } = useLang(),
    { pathname, search, hash } = useLocation(),
    base = stripLang(pathname);
  const item = (code: Lang, label: string, name: string) => (
    <RouterLink
      to={{ pathname: localPath(code, base), search, hash }}
      lang={code}
      hrefLang={code}
      title={name}
      aria-current={lang === code ? "true" : undefined}
    >
      {label}
    </RouterLink>
  );
  return (
    <div
      className={"lang-switch " + className}
      role="group"
      aria-label={t("Dil")}
    >
      {item("tr", "TR", "Türkçe")}
      {item("en", "EN", "English")}
    </div>
  );
}
export function Layout({
  catalog,
  children,
}: {
  catalog: Catalog;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false),
    location = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    let id = "";
    try {
      id = decodeURIComponent(location.hash.slice(1));
    } catch {
      id = location.hash.slice(1);
    }
    if (!id) {
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    // Content (reviews, Instagram, catalog sections) may render async, so retry briefly.
    const deadline = Date.now() + 1500;
    let timer = 0;
    const tryScroll = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (Date.now() < deadline) timer = window.setTimeout(tryScroll, 100);
    };
    const frame = requestAnimationFrame(tryScroll);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [location.pathname, location.hash, location.key]);
  useEffect(() => {
    if (!open) return;
    // Menü açılınca odak ilk bağlantıya gider; Escape menüyü kapatıp odağı düğmeye verir.
    document.querySelector<HTMLAnchorElement>("#main-nav a")?.focus();
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        document.querySelector<HTMLButtonElement>(".mobile-menu")?.focus();
      }
    };
    document.addEventListener("keydown", f);
    return () => document.removeEventListener("keydown", f);
  }, [open]);
  const b = catalog.business;
  const { member } = useMember();
  const { t } = useLang();
  return (
    <div className="kp">
      <a href="#main" className="skip-link">
        {t("İçeriğe geç")}
      </a>
      <div className="topbar">
        <div className="container">
          <span>
            <MapPin size={12} />{" "}
            {catalog.demo
              ? t("Canlı demo · Örnek tarihler ve fiyatlar")
              : t("Kars’tan başlayan güzel hikâyeler")}
          </span>
          <div>
            <a href={telHref(b.phone)}>
              <Phone size={12} />
              {b.phone}
            </a>
            <a href={b.instagram} target="_blank" rel="noreferrer">
              <Instagram size={13} />
              <span>@rotakarstur</span>
            </a>
          </div>
        </div>
      </div>
      <header className="site-header">
        <div className="container header-inner">
          <Link className="brand" to="/" aria-label={t("Rota Kars ana sayfa")}>
            <img
              src="/images/logo.png"
              width="154"
              height="56"
              alt="Rota Kars Tur"
            />
          </Link>
          <nav
            id="main-nav"
            className={"main-nav " + (open ? "is-open" : "")}
            aria-label={t("Ana menü")}
          >
            <NavLink to="/" end>
              {t("Ana sayfa")}
            </NavLink>
            <NavLink to="/turlar">{t("Turlarımız")}</NavLink>
            <NavLink to="/hizmetler">{t("Hizmetler")}</NavLink>
            <NavLink to="/konaklama">{t("Konaklama")}</NavLink>
            <NavLink to="/hakkimizda">{t("Hakkımızda")}</NavLink>
            <NavLink to="/iletisim">{t("İletişim")}</NavLink>
            <LangSwitch className="lang-switch-menu" />
          </nav>
          <div className="header-actions">
            <LangSwitch className="lang-switch-header" />
            <Link
              to={member ? "/hesabim" : "/uyelik"}
              className="member-header-link"
              aria-label={member ? t("Hesabım") : t("Üye ol / Giriş")}
            >
              <UserRound size={18} />
              <span>{member ? t("Hesabım") : t("Üye ol / Giriş")}</span>
            </Link>
            <Link
              to="/rezervasyonum"
              className="reservation-link"
              aria-label={t("Rezervasyonum")}
            >
              <Ticket size={18} />
              <span>{t("Rezervasyonum")}</span>
            </Link>
            <a
              className="btn btn-small header-cta"
              href={whatsappLink(
                b.whatsapp,
                t("Merhaba, rotakarsturizm.com sitesinden yazıyorum."),
              )}
              target="_blank"
              rel="noreferrer"
            >
              {t("Birlikte planlayalım")}
            </a>
            <button
              aria-label={open ? t("Menüyü kapat") : t("Menüyü aç")}
              aria-expanded={open}
              aria-controls="main-nav"
              className="icon-btn mobile-menu"
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main id="main">{children}</main>
      <ChatBot whatsapp={b.whatsapp} />
      <MembershipInvite />
      <footer className="footer">
        <div className="container footer-main">
          <div className="footer-brand">
            <Link to="/">
              <img
                src="/images/logo.png"
                width="168"
                height="61"
                alt="Rota Kars Turizm"
              />
            </Link>
            <p>
              {t("Rotayı biz biliyoruz.")}
              <br />
              {t("Hikâyeyi birlikte yazıyoruz.")}
            </p>
            <a
              href={b.instagram}
              target="_blank"
              rel="noreferrer"
              className="social-link"
            >
              <Instagram size={18} />
              <span>{t("Yolculuğumuza katılın")}</span>
            </a>
            <a
              href={b.facebook}
              target="_blank"
              rel="noreferrer"
              className="social-link"
            >
              <Facebook size={18} />
              <span>Facebook</span>
            </a>
            <a
              href="https://www.tursab.org.tr/tr/ddsv"
              target="_blank"
              rel="noreferrer"
              className="tursab-badge"
            >
              <img
                src="/images/tursab.png"
                width="145"
                height="66"
                alt={t("TÜRSAB üyesi, belge no {no}", { no: b.tursabNo })}
                loading="lazy"
              />
            </a>
          </div>
          <div>
            <h3>{t("Bir rota seçin")}</h3>
            {catalog.tours.map((t) => (
              <Link key={t.id} to={"/turlar/" + t.id}>
                {t.name}
              </Link>
            ))}
          </div>
          <div>
            <h3>{t("Yolculuğunuz için")}</h3>
            <Link to="/konaklama">{t("Konaklama seçenekleri")}</Link>
            <Link to="/hakkimizda">{t("Rota Kars hakkında")}</Link>
            <Link to="/rezervasyonum">{t("Ön rezervasyon sorgulama")}</Link>
            <Link to="/bilgilendirme#iptal">{t("İptal ve iade koşulları")}</Link>
            <Link to="/bilgilendirme#sozlesme">
              {t("Ön bilgilendirme ve sözleşme")}
            </Link>
            <Link to="/bilgilendirme#kvkk">{t("Aydınlatma metni")}</Link>
            <Link to="/bilgilendirme#cerez">{t("Çerez politikası")}</Link>
            <Link to="/gorsel-kaynaklari">{t("Fotoğraf kaynakları")}</Link>
          </div>
          <div className="footer-contact">
            <h3>{t("Kars’tayız, bekleriz.")}</h3>
            <a href={b.mapsUrl} target="_blank" rel="noreferrer">
              <MapPin size={17} />
              <span>{b.address}</span>
            </a>
            <a href={telHref(b.phone)}>
              <Phone size={16} />
              {b.phone}
            </a>
            <a href={telHref(b.mobile)}>
              <Phone size={16} />
              {b.mobile}
            </a>
            <a href={whatsappLink(b.whatsapp)} target="_blank" rel="noreferrer">
              <MessageCircle size={16} />
              WhatsApp {b.whatsappLabel}
            </a>
            <a href={"mailto:" + b.email}>
              <Mail size={16} />
              {b.email}
            </a>
            <a href={b.mapsUrl} target="_blank" rel="noreferrer">
              {t("Yol tarifi alın")} <ExternalLink size={13} />
            </a>
          </div>
        </div>
        <div className="container footer-bottom footer-legal">
          <p>
            © {new Date().getFullYear()} {b.legalNameShort} ·{" "}
            {t(
              "T.C. Kültür ve Turizm Bakanlığı {group} Grubu Seyahat Acentası · Belge No {no} · TÜRSAB üyesidir · {year}’dan beri",
              { group: b.licenseGroup, no: b.tursabNo, year: b.founded },
            )}
          </p>
          <p>
            MERSİS {b.mersis} · {t("{office} V.D.", { office: b.taxOffice })}{" "}
            {b.taxNo} · {t("Kars Ticaret Sicili")} {b.tradeRegistryNo} · KEP{" "}
            {b.kep} · <Link to="/iletisim#kunye">{t("Yasal bilgiler")}</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
