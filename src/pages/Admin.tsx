import {
  DepartureManager,
  ReservationManager,
  CampaignManager,
  DailyReport,
  NotificationManager,
} from "../components/OperationsDesk";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  LogOut,
  RefreshCw,
  ExternalLink,
  Ticket,
  BedDouble,
  MessageSquareText,
  ClipboardCheck,
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
  FileText,
  BarChart3,
  CalendarDays,
  Inbox,
  Gift,
  Mail,
  Star,
  Plug,
  Search,
} from "lucide-react";
import { MonthReport } from "../components/admin/MonthReport";
import { ContentManager } from "../components/admin/ContentManager";
import { Overview } from "../components/admin/Overview";
import { RequestManager } from "../components/admin/RequestManager";
import { HotelManager } from "../components/admin/HotelManager";
import { CommandPalette } from "../components/admin/CommandPalette";
import { FeedbackProvider, useFeedback } from "../components/admin/feedback";
import {
  AppUpdateBanner,
  PushSettings,
  SessionList,
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
import type { Catalog, ReviewsResponse } from "../lib/types";
// Menü işe göre gruplanır; her sekmenin kendi simgesi vardır.
const ALL_TABS = [
  ["overview", "Özet", LayoutDashboard, "Operasyon"],
  ["reservations", "Rezervasyonlar", Ticket, "Operasyon"],
  ["departures", "Sefer planı", CalendarDays, "Operasyon"],
  ["daily", "Günlük operasyon", ClipboardCheck, "Operasyon"],
  ["requests", "Gelen talepler", Inbox, "Operasyon"],
  ["reports", "Aylık rapor", BarChart3, "Satış"],
  ["campaigns", "Kampanyalar", Gift, "Satış"],
  ["notifications", "Bildirim kuyruğu", Mail, "Satış"],
  ["content", "Site içerikleri", FileText, "Site"],
  ["operations", "Tur ve araç planı", Bus, "Site"],
  ["hotels", "Anlaşmalı oteller", BedDouble, "Site"],
  ["reviews", "Google yorumları", Star, "Site"],
  ["instagram", "Instagram", Instagram, "Site"],
  ["integrations", "Bağlantılar", Plug, "Yönetim"],
  ["users", "Kullanıcılar", Users, "Yönetim"],
  ["audit", "Denetim kaydı", ScrollText, "Yönetim"],
  ["kvkk", "KVKK", ShieldCheck, "Yönetim"],
] as const;
type Tab = (typeof ALL_TABS)[number];
// Telefonda alt çubukta duran sekmeler; diğerleri "Diğer" menüsünde.
const MOBILE_PRIMARY = ["overview", "reservations", "departures", "daily"];
const SHORT_LABELS: Record<string, string> = {
  overview: "Özet",
  reservations: "Rezervasyon",
  departures: "Seferler",
  daily: "Günlük",
};
type Counts = { pending: number; cancellationRequests: number; newRequests: number };
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
function tabsFor(role: AdminRole): Tab[] {
  if (role === "guide")
    return ALL_TABS.filter((t) => GUIDE_TABS.includes(t[0]));
  if (role === "operations")
    return ALL_TABS.filter((t) => !OWNER_TABS.includes(t[0]));
  return [...ALL_TABS];
}
export function Admin(props: { catalog: Catalog; refreshCatalog: () => void }) {
  return (
    <FeedbackProvider>
      <AdminPanel {...props} />
    </FeedbackProvider>
  );
}
// Adres çubuğu: /yonetim?sekme=reservations kalıcıdır (yenileme, geri tuşu, paylaşılan bağlantı).
// ref / filtre / yeni / q tek seferlik yönlendirmedir: okunur ve adresten silinir.
type Nav = { n: number; status?: string; flag?: string; create?: boolean; ref?: string; q?: string };
function AdminPanel({
  catalog,
  refreshCatalog,
}: {
  catalog: Catalog;
  refreshCatalog: () => void;
}) {
  const [me, setMe] = useState<AdminMe | null | undefined>(undefined),
    [error, setError] = useState(""),
    [loginNotice, setLoginNotice] = useState(""),
    [params, setParams] = useSearchParams(),
    [nav, setNav] = useState<Nav>({ n: 0 }),
    [moreOpen, setMoreOpen] = useState(false),
    [palette, setPalette] = useState(false),
    [counts, setCounts] = useState<Counts | null>(null),
    mainRef = useRef<HTMLElement>(null),
    navigate = useNavigate();
  useTableLabels(mainRef);
  const requested = params.get("sekme") || "overview";
  useEffect(() => {
    const ref = params.get("ref"),
      filtre = params.get("filtre"),
      q = params.get("q"),
      create = params.get("yeni") === "1";
    if (!ref && !filtre && !q && !create) return;
    setNav((cur) => ({
      n: cur.n + 1,
      ref: ref || undefined,
      q: q || undefined,
      create,
      ...(filtre?.startsWith("flag:") ? { flag: filtre.slice(5) } : { status: filtre || undefined }),
    }));
    setParams({ sekme: requested }, { replace: true });
  }, [params]);
  const canReceivePush = Boolean(
    me && !me.bootstrap && !me.needs2faSetup && me.user.role !== "guide",
  );
  const openFromNotification = (path: string) => navigate(path);
  // Android uygulamasında giriş yapınca telefon bildirimlere otomatik kaydolur.
  useEffect(() => {
    if (canReceivePush && isNativeApp())
      enablePush(openFromNotification).catch(() => {});
  }, [canReceivePush]);
  // Menü rozetleri: onay bekleyen, iptal talebi, yeni talep. Dakikada bir tazelenir.
  const canCount = Boolean(me && !me.needs2faSetup && me.user.role !== "guide");
  useEffect(() => {
    if (!canCount) return;
    const load = () => api<Counts>("/admin/counts").then(setCounts).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [canCount, nav.n, requested]);
  // Ctrl+K / ⌘K veya "/" ile hızlı arama.
  useEffect(() => {
    if (!me || me.needs2faSetup) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName) ||
        (e.target as HTMLElement)?.isContentEditable;
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing && !document.querySelector("dialog[open]"))) {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [me]);
  // 401 → giriş ekranı, 2FA_REQUIRED → iki adımlı doğrulama kurulumu.
  function handle(e: unknown) {
    if (e instanceof ApiError && e.status === 401) setMe(null);
    else if (isTwoFactorRequired(e))
      setMe((m) => (m ? { ...m, needs2faSetup: true } : m));
    else setError((e as Error).message);
  }
  async function loadMe() {
    try {
      setMe(await api<AdminMe>("/admin/me"));
      setError("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setMe(null);
      else handle(e);
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
    setLoginNotice("");
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
    tab =
      requested === "account" || tabs.some((x) => x[0] === requested)
        ? requested
        : tabs[0][0],
    title =
      tab === "account"
        ? "Hesabım"
        : tabs.find((x) => x[0] === tab)?.[1] || "",
    badge = (id: string) =>
      !counts
        ? 0
        : id === "reservations"
          ? counts.pending + counts.cancellationRequests
          : id === "requests"
            ? counts.newRequests
            : 0,
    groups = [...new Set(tabs.map((t) => t[3]))],
    pick = (id: string, options: Omit<Nav, "n"> = {}) => {
      setNav((cur) => ({ n: cur.n + 1, ...options }));
      if (id !== tab) setParams({ sekme: id });
      setMoreOpen(false);
      setPalette(false);
      window.scrollTo({ top: 0 });
      setError("");
    };
  const key = (id: string) => id + "-" + nav.n;
  return (
    <div className={"admin-shell" + (moreOpen ? " more-open" : "")}>
      <aside className="admin-sidebar" id="admin-more-menu">
        <Link to="/">
          <img src="/images/logo.png" alt="Rota Kars" />
        </Link>
        <span>Acente yönetimi</span>
        <button className="admin-search-button" onClick={() => setPalette(true)}>
          <Search size={16} />
          <span>Ara veya git…</span>
          <kbd>{/Mac|iPhone/.test(navigator.platform) ? "⌘K" : "Ctrl K"}</kbd>
        </button>
        <nav>
          {groups.map((group) => (
            <div className="admin-nav-group" key={group}>
              {groups.length > 1 && <h2>{group}</h2>}
              {tabs
                .filter((t) => t[3] === group)
                .map(([id, label, Icon]) => (
                  <button
                    className={tab === id ? "active" : ""}
                    aria-current={tab === id ? "page" : undefined}
                    key={id}
                    onClick={() => pick(id)}
                  >
                    <Icon size={17} />
                    <span>{label}</span>
                    {badge(id) > 0 && (
                      <b className="nav-badge" aria-label={badge(id) + " bekleyen"}>
                        {badge(id)}
                      </b>
                    )}
                  </button>
                ))}
            </div>
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
          <div className="admin-heading-actions">
            <button
              className="btn btn-outline btn-small admin-mobile-search"
              onClick={() => setPalette(true)}
              aria-label="Ara"
            >
              <Search size={15} />
            </button>
            <button
              className="btn btn-outline btn-small"
              onClick={() => {
                loadMe();
                setNav((cur) => ({ n: cur.n + 1 }));
              }}
            >
              <RefreshCw size={15} />
              Yenile
            </button>
          </div>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
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
          <>
            <AdminAccount
              me={me}
              onChanged={loadMe}
              onPasswordChanged={(m) => {
                setMe(null);
                setLoginNotice(m);
              }}
            />
            <PushSettings canReceive={canReceivePush} onOpen={openFromNotification} />
            {!me.bootstrap && <SessionList />}
          </>
        )}
        {tab === "users" && <UserManager key={key("users")} currentId={me.user.id} />}
        {tab === "audit" && <AuditLog key={key("audit")} />}
        {tab === "kvkk" && <KvkkTools />}
        {tab === "overview" && <Overview key={key("overview")} go={pick} />}
        {tab === "reservations" && (
          <ReservationManager
            key={key("res")}
            catalog={catalog}
            initialStatus={nav.status || ""}
            initialFlag={nav.flag || ""}
            openRef={nav.ref || ""}
            startCreating={Boolean(nav.create)}
          />
        )}
        {tab === "departures" && (
          <DepartureManager key={key("dep")} catalog={catalog} startCreating={Boolean(nav.create)} />
        )}
        {tab === "campaigns" && <CampaignManager key={key("camp")} catalog={catalog} />}
        {tab === "daily" && <DailyReport key={key("daily")} catalog={catalog} />}
        {tab === "reports" && <MonthReport key={key("rep")} />}
        {tab === "notifications" && <NotificationManager key={key("notif")} />}
        {tab === "requests" && <RequestManager key={key("req")} initialQuery={nav.q || ""} />}
        {tab === "hotels" && <HotelManager key={key("hotels")} />}
        {tab === "reviews" && <ReviewAssignments key={key("reviews")} catalog={catalog} />}
        {tab === "operations" && <TourOperations key={key("ops")} onChange={refreshCatalog} />}
        {tab === "instagram" && <InstagramManager key={key("ig")} catalog={catalog} />}
        {tab === "content" && (
          <ContentManager key={key("content")} catalog={catalog} isOwner={me.user.role === "owner"} onSaved={refreshCatalog} />
        )}
        {tab === "integrations" && <Integrations catalog={catalog} />}
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
              <span className="tabbar-icon">
                <Icon size={20} />
                {badge(id) > 0 && <b className="nav-badge">{badge(id)}</b>}
              </span>
              <span>{SHORT_LABELS[id] || label}</span>
            </button>
          ))}
        <button
          className={moreOpen || !MOBILE_PRIMARY.includes(tab) ? "active" : ""}
          aria-expanded={moreOpen}
          aria-controls="admin-more-menu"
          onClick={() => setMoreOpen((v) => !v)}
        >
          <span className="tabbar-icon">
            {moreOpen ? <X size={20} /> : <Menu size={20} />}
            {!moreOpen && badge("requests") > 0 && <b className="nav-badge">{badge("requests")}</b>}
          </span>
          <span>Diğer</span>
        </button>
      </nav>
      {palette && (
        <CommandPalette
          tabs={[
            ...tabs.map(([id, label, icon, group]) => ({ id, label, icon, group })),
            { id: "account", label: "Hesabım", icon: ShieldCheck, group: "Hesap" },
          ]}
          canSearch={me.user.role !== "guide"}
          onTab={(id) => pick(id)}
          onReservation={(ref) => pick("reservations", { ref })}
          onRequests={(q) => pick("requests", { q })}
          onClose={() => setPalette(false)}
        />
      )}
    </div>
  );
}
function ReviewAssignments({ catalog }: { catalog: Catalog }) {
  const feedback = useFeedback();
  const [reviews, setReviews] = useState<ReviewsResponse | null>(null);
  const load = () =>
    api<ReviewsResponse>("/admin/reviews").then(setReviews).catch(feedback.error);
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <p className="muted">
        Yorum metinleri değiştirilmez. İlgili tur eşleşmesini burada
        düzenleyebilirsiniz. Boş seçim yorumu tur sayfalarından çıkarır,
        genel yorumlar alanında korur.
      </p>
      {!reviews ? (
        <p className="admin-empty">Yükleniyor…</p>
      ) : !reviews.reviews.length ? (
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
              try {
                await post("/admin/reviews/assign", {
                  reviewId: r.id,
                  tourIds: f.getAll("tourIds"),
                });
                feedback.ok("Tur eşleşmesi kaydedildi.");
                await load();
              } catch (err) {
                feedback.error(err);
              }
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
  );
}
function Integrations({ catalog }: { catalog: Catalog }) {
  return (
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
        <a href={catalog.business.mapsUrl} target="_blank" rel="noreferrer">
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
  );
}
