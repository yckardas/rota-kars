import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  Phone,
  Instagram,
  MapPin,
  Menu,
  X,
  Ticket,
  Mail,
  ExternalLink,
} from "lucide-react";
import type { Catalog } from "../lib/types";
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
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", f);
    return () => document.removeEventListener("keydown", f);
  }, [open]);
  const b = catalog.business;
  return (
    <>
      <a href="#main" className="skip-link">
        İçeriğe geç
      </a>
      <div className="topbar">
        <div className="container">
          <span>
            <MapPin size={12} /> Kars’tan başlayan güzel hikâyeler
          </span>
          <div>
            <a href="tel:+904742239163">
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
          <Link className="brand" to="/" aria-label="Rota Kars ana sayfa">
            <img
              src="/images/logo.png"
              width="154"
              height="56"
              alt="Rota Kars Tur"
            />
          </Link>
          <nav
            className={"main-nav " + (open ? "is-open" : "")}
            aria-label="Ana menü"
          >
            <NavLink to="/" end>
              Ana sayfa
            </NavLink>
            <NavLink to="/turlar">Turlarımız</NavLink>
            <NavLink to="/konaklama">Konaklama</NavLink>
            <NavLink to="/hakkimizda">Hakkımızda</NavLink>
            <NavLink to="/iletisim">İletişim</NavLink>
          </nav>
          <div className="header-actions">
            <Link to="/rezervasyonum" className="reservation-link">
              <Ticket size={18} />
              <span>Rezervasyonum</span>
            </Link>
            <a className="btn btn-small header-cta" href="tel:+905459353410">
              Birlikte planlayalım
            </a>
            <button
              aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
              aria-expanded={open}
              className="icon-btn mobile-menu"
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main id="main">{children}</main>
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
              Rotayı biz biliyoruz.
              <br />
              Hikâyeyi birlikte yazıyoruz.
            </p>
            <a
              href={b.instagram}
              target="_blank"
              rel="noreferrer"
              className="social-link"
            >
              <Instagram size={18} />
              <span>Yolculuğumuza katılın</span>
            </a>
          </div>
          <div>
            <h3>Bir rota seçin</h3>
            {catalog.tours.map((t) => (
              <Link key={t.id} to={"/turlar/" + t.id}>
                {t.name}
              </Link>
            ))}
          </div>
          <div>
            <h3>Yolculuğunuz için</h3>
            <Link to="/konaklama">Konaklama seçenekleri</Link>
            <Link to="/hakkimizda">Rota Kars hakkında</Link>
            <Link to="/rezervasyonum">Ön rezervasyon sorgulama</Link>
            <Link to="/bilgilendirme">Bilgilendirme ve gizlilik</Link>
          </div>
          <div className="footer-contact">
            <h3>Kars’tayız, bekleriz.</h3>
            <a href={b.mapsUrl} target="_blank" rel="noreferrer">
              <MapPin size={17} />
              <span>{b.address}</span>
            </a>
            <a href="tel:+904742239163">
              <Phone size={16} />
              {b.phone}
            </a>
            <a href={"mailto:" + b.email}>
              <Mail size={16} />
              {b.email}
            </a>
            <a href={b.mapsUrl} target="_blank" rel="noreferrer">
              Yol tarifi alın <ExternalLink size={13} />
            </a>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} Rota Kars Turizm</span>
          <span>Yerel önizleme. Fiyatlar ve sefer tarihleri örnektir.</span>
        </div>
      </footer>
    </>
  );
}
