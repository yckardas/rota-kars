import React, { Suspense, lazy, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import "@fontsource/marcellus/latin-ext-400.css";
import "@fontsource/marcellus/latin-400.css";
import "@fontsource/onest/latin-ext-400.css";
import "@fontsource/onest/latin-400.css";
import "@fontsource/onest/latin-ext-500.css";
import "@fontsource/onest/latin-500.css";
import "@fontsource/onest/latin-ext-600.css";
import "@fontsource/onest/latin-600.css";
import "./styles.css";
import { api } from "./lib/api";
import { usePageMeta } from "./lib/seo";
import type { Catalog } from "./lib/types";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Tours } from "./pages/Tours";
import { TourDetail } from "./pages/TourDetail";
import {
  Hotels,
  Lookup,
  About,
  Contact,
  Information,
} from "./pages/OtherPages";
import { MemberProvider } from "./lib/member";
import { Services } from "./pages/Services";
// Müşterilerin çoğu bu sayfaları hiç açmaz: ayrı paketlerde, gerekince yüklenir.
const Admin = lazy(() =>
  import("./pages/Admin").then((m) => ({ default: m.Admin })),
);
const Booking = lazy(() =>
  import("./pages/Booking").then((m) => ({ default: m.Booking })),
);
const Membership = lazy(() =>
  import("./pages/Membership").then((m) => ({ default: m.Membership })),
);
const Account = lazy(() =>
  import("./pages/Membership").then((m) => ({ default: m.Account })),
);
const AccountSecurity = lazy(() =>
  import("./pages/AccountSecurity").then((m) => ({
    default: m.AccountSecurity,
  })),
);
const TicketVerification = lazy(() =>
  import("./pages/AccountSecurity").then((m) => ({
    default: m.TicketVerification,
  })),
);
const PageLoading = () => (
  <div className="app-loading" role="status">
    <p>Yükleniyor…</p>
  </div>
);
function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [error, setError] = useState(""),
    location = useLocation();
  useEffect(() => {
    api<Catalog>("/catalog")
      .then(setCatalog)
      .catch(() =>
        setError(
          "Siteye bağlanılamadı. Yerel sunucunun çalıştığından emin olun.",
        ),
      );
  }, []);
  usePageMeta(location.pathname);
  if (error)
    return (
      <div className="app-loading">
        <h1>Bir bağlantı molası.</h1>
        <p>{error}</p>
        <button className="btn" onClick={() => window.location.reload()}>
          Yeniden dene
        </button>
      </div>
    );
  if (!catalog)
    return (
      <div className="app-loading">
        <img src="/images/logo.png" alt="Rota Kars" />
        <p>Rotanız hazırlanıyor…</p>
      </div>
    );
  if (location.pathname === "/yonetim")
    return (
      <Suspense fallback={<PageLoading />}>
        <Admin
          catalog={catalog}
          refreshCatalog={() => api<Catalog>("/catalog").then(setCatalog)}
        />
      </Suspense>
    );
  return (
    <Layout catalog={catalog}>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/" element={<Home catalog={catalog} />} />
          <Route
            path="/gorsel-kaynaklari"
            element={
              <section className="container section photo-credits">
                <h1>Rotanın fotoğrafçıları.</h1>
                <p>
                  Bu rotaları görünür kılan fotoğrafçılara teşekkürler.
                  Görseller web için boyutlandırılmıştır; kartlarda kırpılarak
                  gösterilir.
                </p>
                {catalog.photoCredits.map((photo) => (
                  <article key={photo.id}>
                    <img src={photo.path} alt={photo.title} loading="lazy" />
                    <div>
                      <h2>{photo.title}</h2>
                      <p>{photo.author}</p>
                      <a href={photo.source} target="_blank" rel="noreferrer">
                        Özgün fotoğraf
                      </a>{" "}
                      ·{" "}
                      <a
                        href={photo.licenseUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {photo.license}
                      </a>
                    </div>
                  </article>
                ))}
              </section>
            }
          />
          <Route path="/hizmetler" element={<Services catalog={catalog} />} />
          <Route
            path="/hizmetler/:id"
            element={<Services catalog={catalog} />}
          />
          <Route path="/uyelik" element={<Membership />} />
          <Route
            path="/uyelik/eposta-dogrula"
            element={<AccountSecurity mode="verify" />}
          />
          <Route
            path="/uyelik/parola-yenile"
            element={<AccountSecurity mode="reset" />}
          />
          <Route
            path="/uyelik/parolami-unuttum"
            element={<AccountSecurity mode="forgot" />}
          />
          <Route path="/bilet/:token" element={<TicketVerification />} />
          <Route path="/hesabim" element={<Account />} />
          <Route path="/turlar" element={<Tours catalog={catalog} />} />
          <Route
            path="/turlar/:id"
            element={<TourDetail catalog={catalog} />}
          />
          <Route
            path="/rezervasyon/:tourId"
            element={<Booking catalog={catalog} />}
          />
          <Route path="/rezervasyonum" element={<Lookup catalog={catalog} />} />
          <Route path="/konaklama" element={<Hotels />} />
          <Route path="/hakkimizda" element={<About />} />
          <Route path="/iletisim" element={<Contact catalog={catalog} />} />
          <Route
            path="/bilgilendirme"
            element={<Information catalog={catalog} />}
          />
          <Route
            path="*"
            element={
              <div className="container empty-state">
                <h1>Bu yol bizi bir yere götürmedi.</h1>
                <p>Aradığınız sayfa bulunamadı.</p>
                <Link className="btn" to="/">
                  Ana sayfaya dön
                </Link>
              </div>
            }
          />
        </Routes>
      </Suspense>
    </Layout>
  );
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <MemberProvider>
        <App />
      </MemberProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
