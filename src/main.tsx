import React, { useEffect, useState } from "react";
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
import "@fontsource/onest/latin-ext-700.css";
import "@fontsource/onest/latin-700.css";
import "./styles.css";
import { api } from "./lib/api";
import type { Catalog } from "./lib/types";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Tours } from "./pages/Tours";
import { TourDetail } from "./pages/TourDetail";
import { Booking } from "./pages/Booking";
import {
  Hotels,
  Lookup,
  About,
  Contact,
  Information,
} from "./pages/OtherPages";
import { Admin } from "./pages/Admin";
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
  useEffect(() => {
    const name =
      location.pathname === "/turlar"
        ? "Turlarımız"
        : location.pathname === "/konaklama"
          ? "Konaklama"
          : location.pathname.startsWith("/rezervasyon")
            ? "Rezervasyon"
            : location.pathname === "/iletisim"
              ? "İletişim"
              : location.pathname === "/hakkimizda"
                ? "Hakkımızda"
                : catalog?.tours.find(
                    (t) => location.pathname === "/turlar/" + t.id,
                  )?.name;
    document.title = (name ? name + " | " : "") + "Rota Kars Turizm";
  }, [location.pathname, catalog]);
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
  if (location.pathname === "/yonetim") return <Admin catalog={catalog} />;
  return (
    <Layout catalog={catalog}>
      <Routes>
        <Route path="/" element={<Home catalog={catalog} />} />
        <Route path="/turlar" element={<Tours catalog={catalog} />} />
        <Route path="/turlar/:id" element={<TourDetail catalog={catalog} />} />
        <Route
          path="/rezervasyon/:tourId"
          element={<Booking catalog={catalog} />}
        />
        <Route path="/rezervasyonum" element={<Lookup catalog={catalog} />} />
        <Route path="/konaklama" element={<Hotels />} />
        <Route path="/hakkimizda" element={<About />} />
        <Route path="/iletisim" element={<Contact catalog={catalog} />} />
        <Route path="/bilgilendirme" element={<Information />} />
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
    </Layout>
  );
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
