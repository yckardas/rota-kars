import {
  DepartureManager,
  ReservationManager,
  CampaignManager,
  DailyReport,
  NotificationManager,
} from "../components/OperationsDesk";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LogOut,
  RefreshCw,
  Check,
  ExternalLink,
  Plus,
  Ticket,
  BedDouble,
  MessageSquareText,
  Settings2,
  ClipboardList,
  Instagram,
  Bus,
  Users,
  ScrollText,
  ShieldCheck,
  UserRound,
  TriangleAlert,
  Menu,
  X,
  LayoutDashboard,
} from "lucide-react";
import { Overview } from "../components/admin/Overview";
import {
  AppUpdateBanner,
  PushSettings,
} from "../components/admin/MobileApp";
import { disablePush, enablePush, isNativeApp } from "../lib/native";
import { TourOperations } from "../components/TourOperations";
import { InstagramManager } from "../components/InstagramManager";
import {
  AdminLogin,
  AdminAccount,
  FirstOwnerSetup,
  ForcedTwoFactor,
  isTwoFactorRequired,
  ROLE_LABELS,
  type AdminMe,
  type AdminRole,
} from "../components/admin/AdminAuth";
import {
  UserManager,
  AuditLog,
  KvkkTools,
} from "../components/admin/AdminOwner";
import { api, post, ApiError } from "../lib/api";
import {
  currency,
  dateLabel,
  type Catalog,
  type Hotel,
  type Reservation,
  type ReviewsResponse,
} from "../lib/types";
type RequestRecord = {
  id: string;
  kind: string;
  status: string;
  created_at: number;
  body: {
    name: string;
    email: string;
    phone: string;
    checkIn: string;
    checkOut?: string;
    guests: number;
    notes: string;
  };
};
type Dashboard = {
  reservations: Reservation[];
  requests: RequestRecord[];
  hotels: Hotel[];
};
const ALL_TABS = [
  ["overview", "Özet", LayoutDashboard],
  ["reservations", "Rezervasyonlar", Ticket],
  ["departures", "Sefer planı", Bus],
  ["daily", "Günlük operasyon", ClipboardList],
  ["campaigns", "Kampanyalar", Ticket],
  ["notifications", "Bildirim kuyruğu", MessageSquareText],
  ["operations", "Tur ve araç planı", Bus],
  ["requests", "Gelen talepler", ClipboardList],
  ["hotels", "Anlaşmalı oteller", BedDouble],
  ["reviews", "Google yorumları", MessageSquareText],
  ["instagram", "Instagram", Instagram],
  ["integrations", "Bağlantılar", Settings2],
  ["users", "Kullanıcılar", Users],
  ["audit", "Denetim kaydı", ScrollText],
  ["kvkk", "KVKK", ShieldCheck],
] as const;
// Telefonda alt çubukta duran sekmeler; diğerleri "Diğer" menüsünde.
const MOBILE_PRIMARY = ["overview", "reservations", "departures", "daily", "operations"];
const SHORT_LABELS: Record<string, string> = {
  overview: "Özet",
  reservations: "Rezervasyon",
  departures: "Seferler",
  daily: "Günlük",
  operations: "Turlar",
};
// Telefonda tablo satırları kart olur: her hücreye sütun başlığı etiket olarak yazılır.
function useTableLabels(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const apply = () =>
      el.querySelectorAll("table").forEach((table) => {
        const heads = [...table.querySelectorAll("thead th")].map((th) => th.textContent?.trim() || "");
        table.querySelectorAll("tbody tr").forEach((tr) =>
          [...tr.children].forEach((td, i) => {
            if (heads[i] && td.getAttribute("data-label") !== heads[i]) td.setAttribute("data-label", heads[i]);
          }),
        );
      });
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(el, { childList: true, subtree: true });
    return () => observer.disconnect();
  });
}
// Rehber yalnız günlük operasyonu görür (sefer düzenleme ve kampanya ayarları sunucuda kapalı).
const GUIDE_TABS = ["daily"];
const OWNER_TABS = ["users", "audit", "kvkk", "campaigns"];
// Rolün kullanamayacağı sekmeler gösterilmez (sunucu da ayrıca 403 döner).
function tabsFor(role: AdminRole) {
  if (role === "guide")
    return ALL_TABS.filter((t) => GUIDE_TABS.includes(t[0]));
  if (role === "operations")
    return ALL_TABS.filter((t) => !OWNER_TABS.includes(t[0]));
  return [...ALL_TABS];
}
export function Admin({
  catalog,
  refreshCatalog,
}: {
  catalog: Catalog;
  refreshCatalog: () => void;
}) {
  const [me, setMe] = useState<AdminMe | null | undefined>(undefined),
    [data, setData] = useState<Dashboard | null>(null),
    [reviews, setReviews] = useState<ReviewsResponse | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loginNotice, setLoginNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("overview"),
    // Özet ekranından gelen yönlendirme (ör. "Onay bekleyenler" filtresi, yeni kayıt formu).
    [nav, setNav] = useState<{ n: number; status?: string; create?: boolean }>({ n: 0 }),
    [hotelForm, setHotelForm] = useState(false),
    [moreOpen, setMoreOpen] = useState(false),
    mainRef = useRef<HTMLElement>(null),
    navigate = useNavigate();
  useTableLabels(mainRef);
  const canReceivePush = Boolean(
    me && !me.bootstrap && !me.needs2faSetup && me.user.role !== "guide",
  );
  const openFromNotification = (path: string) => {
    setTab("reservations");
    navigate(path);
  };
  // Android uygulamasında giriş yapınca telefon bildirimlere otomatik kaydolur.
  useEffect(() => {
    if (canReceivePush && isNativeApp())
      enablePush(openFromNotification).catch(() => {});
  }, [canReceivePush]);
  // 401 → giriş ekranı, 2FA_REQUIRED → iki adımlı doğrulama kurulumu.
  function handle(e: unknown) {
    if (e instanceof ApiError && e.status === 401) {
      setMe(null);
      setData(null);
    } else if (isTwoFactorRequired(e))
      setMe((m) => (m ? { ...m, needs2faSetup: true } : m));
    else setError((e as Error).message);
  }
  async function loadMe() {
    try {
      const next = await api<AdminMe>("/admin/me");
      setMe(next);
      setError("");
      const allowed = tabsFor(next.user.role);
      setTab((t) =>
        t === "account" || allowed.some((x) => x[0] === t)
          ? t
          : allowed[0][0],
      );
      if (!next.needs2faSetup && next.user.role !== "guide") await load();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setMe(null);
      else handle(e);
    }
  }
  async function load() {
    setBusy(true);
    try {
      setData(await api<Dashboard>("/admin/dashboard"));
      setError("");
    } catch (e) {
      handle(e);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    loadMe();
  }, []);
  async function logout() {
    try {
      await disablePush();
      await post("/admin/logout", {});
    } catch {}
    setMe(null);
    setData(null);
    setLoginNotice("");
  }
  async function loadReviews() {
    setBusy(true);
    try {
      setReviews(await api<ReviewsResponse>("/admin/reviews"));
    } catch (e) {
      handle(e);
    } finally {
      setBusy(false);
    }
  }
  async function saveHotel(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await post("/admin/hotels", {
        name: f.get("name"),
        location: f.get("location"),
        description: f.get("description"),
        amenities: String(f.get("amenities") || "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        active: f.get("active") === "on",
      });
      setHotelForm(false);
      setNotice("Otel kaydedildi.");
      await load();
    } catch (e) {
      handle(e);
    } finally {
      setBusy(false);
    }
  }
  if (me === undefined)
    return (
      <div className="app-loading">
        <img src="/images/logo.png" alt="Rota Kars" />
        <p>Yönetim paneli hazırlanıyor…</p>
      </div>
    );
  if (me === null)
    return (
      <AdminLogin
        key={loginNotice}
        initialNotice={loginNotice}
        onLoggedIn={loadMe}
      />
    );
  if (me.needs2faSetup)
    return (
      <ForcedTwoFactor me={me} onEnabled={loadMe} onLogout={logout} />
    );
  const tabs = tabsFor(me.user.role),
    title =
      tab === "account"
        ? "Hesabım"
        : tabs.find((x) => x[0] === tab)?.[1] || "",
    pick = (id: string, keepNav = false) => {
      if (!keepNav) setNav((cur) => ({ n: cur.n + 1 }));
      setTab(id);
      setMoreOpen(false);
      window.scrollTo({ top: 0 });
      setNotice("");
      setError("");
      if (id === "reviews") loadReviews();
    };
  return (
    <div className={"admin-shell" + (moreOpen ? " more-open" : "")}>
      <aside className="admin-sidebar" id="admin-more-menu">
        <Link to="/">
          <img src="/images/logo.png" alt="Rota Kars" />
        </Link>
        <span>Acente yönetimi</span>
        <nav>
          {tabs.map(([id, label, Icon]) => (
            <button
              className={tab === id ? "active" : ""}
              aria-current={tab === id ? "page" : undefined}
              key={id}
              onClick={() => pick(id)}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
        <div className="admin-user-chip">
          <UserRound size={17} />
          <div>
            <strong>{me.user.name}</strong>
            <small>{me.user.roleLabel || ROLE_LABELS[me.user.role]}</small>
          </div>
        </div>
        <button
          className={"text-link" + (tab === "account" ? " active" : "")}
          aria-current={tab === "account" ? "page" : undefined}
          onClick={() => pick("account")}
        >
          <ShieldCheck size={17} />
          Hesabım
        </button>
        <button className="text-link" onClick={logout}>
          <LogOut size={17} />
          Çıkış yap
        </button>
      </aside>
      <main className="admin-main" ref={mainRef}>
        <AppUpdateBanner />
        <div className="section-heading">
          <div>
            <span className="section-note">Rota Kars</span>
            <h1>{title}</h1>
          </div>
          <button
            className="btn btn-outline btn-small"
            onClick={loadMe}
            disabled={busy}
          >
            <RefreshCw size={15} />
            Yenile
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="notice-success" role="status">
            <Check size={16} />
            {notice}
          </p>
        )}
        {me.bootstrap && (
          <>
            <div className="admin-banner" role="note">
              <TriangleAlert size={18} />
              Paylaşılan parola ile giriş yaptınız. Kendi hesabınızı
              oluşturunca bu parola kapanır.
            </div>
            <FirstOwnerSetup onCreated={loadMe} />
          </>
        )}
        {tab === "account" && (
          <AdminAccount
            me={me}
            onChanged={loadMe}
            onPasswordChanged={(m) => {
              setMe(null);
              setData(null);
              setLoginNotice(m);
            }}
          />
        )}
        {tab === "account" && (
          <PushSettings canReceive={canReceivePush} onOpen={openFromNotification} />
        )}
        {tab === "users" && <UserManager currentId={me.user.id} />}
        {tab === "audit" && <AuditLog />}
        {tab === "kvkk" && <KvkkTools />}
        {(tab === "requests" || tab === "hotels") && !data && (
          <p className="admin-empty">
            {busy ? "Yükleniyor…" : "Kayıtlar yüklenemedi."}
          </p>
        )}
        {tab === "overview" && (
          <Overview
            go={(id, options = {}) => {
              setNav((cur) => ({ n: cur.n + 1, ...options }));
              pick(id, true);
            }}
          />
        )}
        {tab === "reservations" && (
          <ReservationManager
            key={"res-" + nav.n}
            catalog={catalog}
            initialStatus={nav.status || ""}
            startCreating={Boolean(nav.create)}
          />
        )}
        {tab === "departures" && (
          <DepartureManager key={"dep-" + nav.n} catalog={catalog} startCreating={Boolean(nav.create)} />
        )}
        {tab === "campaigns" && <CampaignManager catalog={catalog} />}
        {tab === "daily" && <DailyReport catalog={catalog} />}
        {tab === "notifications" && <NotificationManager />}
        {tab === "requests" && data && (
          <div className="admin-requests">
            {data.requests.length ? (
              data.requests.map((r) => (
                <article key={r.id}>
                  <div className="section-heading">
                    <h3>
                      {r.kind === "hotel"
                        ? "Konaklama"
                        : r.kind === "vehicle"
                          ? "Araç kiralama"
                          : "Özel tur"}{" "}
                      talebi
                    </h3>
                    <small>
                      {new Date(r.created_at).toLocaleDateString("tr-TR")}
                    </small>
                  </div>
                  <strong>{r.body.name}</strong>
                  <p>
                    {r.body.email} · {r.body.phone}
                  </p>
                  <p>
                    {dateLabel(r.body.checkIn)}
                    {r.body.checkOut
                      ? " — " + dateLabel(r.body.checkOut)
                      : ""}{" "}
                    · {r.body.guests} kişi
                  </p>
                  <p className="muted">{r.body.notes || "Ek not yok."}</p>
                </article>
              ))
            ) : (
              <p className="admin-empty">Henüz talep bulunmuyor.</p>
            )}
          </div>
        )}
        {tab === "hotels" && data && (
          <>
            <p className="muted">
              Yalnızca acentenin anlaşmasını doğruladığı otelleri yayımlayın.
            </p>
            <button className="btn" onClick={() => setHotelForm(!hotelForm)}>
              <Plus size={16} />
              Otel ekle
            </button>
            {hotelForm && (
              <form className="admin-editor" onSubmit={saveHotel}>
                <div className="form-grid">
                  <label className="field">
                    Otel adı
                    <input name="name" required minLength={2} />
                  </label>
                  <label className="field">
                    Konum
                    <input
                      name="location"
                      required
                      minLength={2}
                      placeholder="Kars merkez"
                    />
                  </label>
                </div>
                <label className="field">
                  Açıklama
                  <textarea name="description" required minLength={10} />
                </label>
                <label className="field">
                  Özellikler (virgülle ayırın)
                  <input name="amenities" placeholder="Kahvaltı, Wi-Fi" />
                </label>
                <label className="checkbox-label">
                  <input name="active" type="checkbox" />
                  <span>Otelin anlaşması doğrulandı, sitede yayımla.</span>
                </label>
                <button className="btn" disabled={busy}>
                  Oteli kaydet
                </button>
              </form>
            )}
            <div className="admin-hotel-list">
              {data.hotels.map((h) => (
                <article key={h.id}>
                  <div>
                    <h3>{h.name}</h3>
                    <p>{h.location}</p>
                    <small>{h.active ? "Sitede yayında" : "Taslak"}</small>
                  </div>
                  <button
                    className="btn btn-outline btn-small"
                    onClick={async () => {
                      await post("/admin/hotels", {
                        ...h,
                        image: h.image || undefined,
                        active: !h.active,
                      });
                      await load();
                    }}
                  >
                    {h.active ? "Yayından kaldır" : "Yayımla"}
                  </button>
                </article>
              ))}
            </div>
          </>
        )}
        {tab === "reviews" && (
          <>
            <p className="muted">
              Yorum metinleri değiştirilmez. İlgili tur eşleşmesini burada
              düzenleyebilirsiniz. Boş seçim yorumu tur sayfalarından çıkarır,
              genel yorumlar alanında korur.
            </p>
            {!reviews?.reviews.length ? (
              <div className="info-note">
                <MessageSquareText size={22} />
                <div>
                  <strong>Google bağlantısı henüz etkin değil.</strong>
                  <p>
                    Firma işletme erişimi ve Google API bilgileri eklendiğinde
                    yorumlar burada listelenir.
                  </p>
                  <a
                    href={catalog.business.mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-link"
                  >
                    Doğru işletmeyi aç <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            ) : (
              reviews.reviews.map((r) => (
                <form
                  key={r.id}
                  className="admin-review"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    await post("/admin/reviews/assign", {
                      reviewId: r.id,
                      tourIds: f.getAll("tourIds"),
                    });
                    setNotice("Tur eşleşmesi kaydedildi.");
                    await loadReviews();
                  }}
                >
                  <strong>
                    {r.author} · {r.rating}/5
                  </strong>
                  <p>{r.text || "Yalnızca puan"}</p>
                  <div className="review-map-options">
                    {catalog.tours.map((t) => (
                      <label key={t.id}>
                        <input
                          type="checkbox"
                          name="tourIds"
                          value={t.id}
                          defaultChecked={r.tourIds.includes(t.id)}
                        />
                        {t.name}
                      </label>
                    ))}
                  </div>
                  <button className="btn btn-small">Eşleştirmeyi kaydet</button>
                </form>
              ))
            )}
          </>
        )}
        {tab === "operations" && <TourOperations onChange={refreshCatalog} />}
        {tab === "instagram" && <InstagramManager catalog={catalog} />}
        {tab === "integrations" && (
          <div className="integration-list">
            <article>
              <h3>Sanal POS</h3>
              <span className="status-tag">Banka anlaşması bekleniyor</span>
              <p>
                Ödeme ekranı devre dışıdır. Kart verisi alınmaz. Sağlayıcı
                seçildiğinde doğrulanan sunucu bildirimi ve ödeme adapteri
                eklenir.
              </p>
            </article>
            <article>
              <h3>Google yorumları</h3>
              <p>
                Google İşletme Profili OAuth bağlantısı veya Places API ile
                etkinleşir. Google anahtarları sunucuda kalır.
              </p>
              <a
                href={catalog.business.mapsUrl}
                target="_blank"
                rel="noreferrer"
              >
                İşletme bağlantısı <ExternalLink size={14} />
              </a>
            </article>
            <article>
              <h3>E-posta ve SMS</h3>
              <span className="status-tag">Sağlayıcı bağlı değil</span>
              <p>
                E-postalar bildirim kuyruğunda saklanır. SMTP ve site adresi
                tanımlandığında otomatik gönderim başlar. SMS için sağlayıcı
                bağlantısı gerekir.
              </p>
            </article>
          </div>
        )}
      </main>
      <nav className="admin-tabbar" aria-label="Yönetim menüsü">
        {tabs
          .filter(([id]) => MOBILE_PRIMARY.includes(id))
          .map(([id, label, Icon]) => (
            <button
              key={id}
              className={tab === id && !moreOpen ? "active" : ""}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => pick(id)}
            >
              <Icon size={20} />
              <span>{SHORT_LABELS[id] || label}</span>
            </button>
          ))}
        <button
          className={moreOpen || !MOBILE_PRIMARY.includes(tab) ? "active" : ""}
          aria-expanded={moreOpen}
          aria-controls="admin-more-menu"
          onClick={() => setMoreOpen((v) => !v)}
        >
          {moreOpen ? <X size={20} /> : <Menu size={20} />}
          <span>Diğer</span>
        </button>
      </nav>
    </div>
  );
}
