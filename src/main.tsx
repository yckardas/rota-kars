import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";
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
import "./postcard.css";
import { api } from "./lib/api";
import { langOf, translate, useLang } from "./lib/i18n";
import { localizeCatalog } from "./lib/localize";
import { usePageMeta } from "./lib/seo";
import type { Catalog } from "./lib/types";
import { configureTurnstile } from "./components/Turnstile";
import { Layout } from "./components/Layout";
import { NativeReturnBar } from "./components/NativeReturnBar";
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
const Guide = lazy(() => import("./pages/Guide").then((m) => ({ default: m.Guide })));
const ArticlePage = lazy(() => import("./pages/Guide").then((m) => ({ default: m.ArticlePage })));
const Discover = lazy(() => import("./pages/Discover").then((m) => ({ default: m.Discover })));
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
const TestPayment = lazy(() =>
  import("./pages/Payment").then((m) => ({ default: m.TestPayment })),
);
const CardPayment = lazy(() =>
  import("./pages/Payment").then((m) => ({ default: m.CardPayment })),
);
const OpenPayment = lazy(() =>
  import("./pages/Payment").then((m) => ({ default: m.OpenPayment })),
);
const PaymentResult = lazy(() =>
  import("./pages/Payment").then((m) => ({ default: m.PaymentResult })),
);
const PageLoading = () => {
  const { t } = useLang();
  return (
    <div className="app-loading" role="status">
      <p>{t("Yükleniyor…")}</p>
    </div>
  );
};
// Sunucu, katalog verisini HTML'e gömer; ilk boyama ek istek beklemez.
const inlineCatalog = (): Catalog | null => {
  try {
    const text = document.getElementById("catalog-data")?.textContent;
    return text ? (JSON.parse(text) as Catalog) : null;
  } catch {
    return null;
  }
};
function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(inlineCatalog),
    [error, setError] = useState(""),
    location = useLocation();
  useEffect(() => {
    if (catalog) return;
    api<Catalog>("/catalog")
      .then(setCatalog)
      .catch(() =>
        setError(
          "Siteye bağlanılamadı. Yerel sunucunun çalıştığından emin olun.",
        ),
      );
  }, []);
  usePageMeta(location.pathname);
  const lang = langOf(location.pathname);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  // İngilizce sürümde katalog metinleri çevrilir; yönetim her zaman Türkçe görür.
  const shown = useMemo(
    () => (catalog && lang === "en" ? localizeCatalog(catalog) : catalog),
    [catalog, lang],
  );
  configureTurnstile(catalog?.turnstileSiteKey);
  if (error)
    return (
      <div className="app-loading">
        <h1>{translate(lang, "Bir bağlantı molası.")}</h1>
        <p>{error}</p>
        <button className="btn" onClick={() => window.location.reload()}>
          {translate(lang, "Yeniden dene")}
        </button>
      </div>
    );
  if (!catalog)
    return (
      <div className="app-loading">
        <img src="/images/logo.png" alt="Rota Kars" />
        <p>{translate(lang, "Rotanız hazırlanıyor…")}</p>
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
  const pages = (
    <>
          <Route index element={<Home catalog={shown!} />} />
          <Route
            path="gorsel-kaynaklari"
            element={
              <section className="container section photo-credits">
                <h1>Rotanın fotoğrafçıları.</h1>
                <p>
                  Bu rotaları görünür kılan fotoğrafçılara teşekkürler.
                  Görseller web için boyutlandırılmıştır; kartlarda kırpılarak
                  gösterilir.
                </p>
                {shown!.photoCredits.map((photo) => (
                  <article key={photo.id}>
                    <img src={photo.path} alt={photo.title} loading="lazy" />
                    <div>
                      <h2>{photo.title}</h2>
                      <p>{photo.author}</p>
                      {photo.source && (
                        <a href={photo.source} target="_blank" rel="noreferrer">
                          Özgün fotoğraf
                        </a>
                      )}
                      {photo.source && photo.licenseUrl && " · "}
                      {photo.licenseUrl && (
                        <a href={photo.licenseUrl} target="_blank" rel="noreferrer">
                          {photo.license}
                        </a>
                      )}
                      {photo.changes && <p>{photo.changes}</p>}
                    </div>
                  </article>
                ))}
              </section>
            }
          />
          <Route path="hizmetler" element={<Services catalog={shown!} />} />
          <Route
            path="hizmetler/:id"
            element={<Services catalog={shown!} />}
          />
          <Route path="uyelik" element={<Membership />} />
          <Route
            path="uyelik/eposta-dogrula"
            element={<AccountSecurity mode="verify" />}
          />
          <Route
            path="uyelik/parola-yenile"
            element={<AccountSecurity mode="reset" />}
          />
          <Route
            path="uyelik/parolami-unuttum"
            element={<AccountSecurity mode="forgot" />}
          />
          <Route path="bilet/:token" element={<TicketVerification />} />
          <Route path="odeme" element={<OpenPayment catalog={shown!} />} />
          <Route path="odeme/deneme/:id" element={<TestPayment />} />
          <Route
            path="odeme/kart/:id"
            element={<CardPayment catalog={shown!} />}
          />
          <Route path="odeme/sonuc/:id" element={<PaymentResult />} />
          <Route path="hesabim" element={<Account />} />
          <Route path="turlar" element={<Tours catalog={shown!} />} />
          <Route
            path="turlar/:id"
            element={<TourDetail catalog={shown!} />}
          />
          <Route
            path="rezervasyon/:tourId"
            element={<Booking catalog={shown!} />}
          />
          <Route path="rezervasyonum" element={<Lookup catalog={shown!} />} />
          <Route path="konaklama" element={<Hotels />} />
          <Route path="kesfet/:slug" element={<Discover catalog={shown!} />} />
          <Route path="rehber" element={<Guide />} />
          <Route path="rehber/:slug" element={<ArticlePage catalog={shown!} />} />
          <Route path="hakkimizda" element={<About />} />
          <Route path="iletisim" element={<Contact catalog={shown!} />} />
          <Route
            path="bilgilendirme"
            element={<Information catalog={shown!} />}
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
    </>
  );
  return (
    <>
    <NativeReturnBar />
    <Layout catalog={shown!}>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          {/* Aynı sayfalar Türkçe kökte ve İngilizce /en altında. */}
          <Route path="/en">{pages}</Route>
          <Route path="/">{pages}</Route>
        </Routes>
      </Suspense>
    </Layout>
    </>
  );
}
// Ekrana girince oynayan hareketler yalnız betik çalışıyorsa bekletilir (src/lib/reveal.ts).
document.documentElement.classList.add("js-motion");
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <MemberProvider>
        <App />
      </MemberProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
