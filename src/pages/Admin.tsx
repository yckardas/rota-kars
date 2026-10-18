import {
  DepartureManager,
  ReservationManager,
  CampaignManager,
  DailyReport,
  NotificationManager,
} from "../components/OperationsDesk";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  LockKeyhole,
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
  LoaderCircle,
  Instagram,
  Bus,
} from "lucide-react";
import { TourOperations } from "../components/TourOperations";
import { InstagramManager } from "../components/InstagramManager";
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
export function Admin({
  catalog,
  refreshCatalog,
}: {
  catalog: Catalog;
  refreshCatalog: () => void;
}) {
  const [data, setData] = useState<Dashboard | null>(null),
    [reviews, setReviews] = useState<ReviewsResponse | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("reservations"),
    [hotelForm, setHotelForm] = useState(false);
  async function load() {
    setBusy(true);
    try {
      setData(await api<Dashboard>("/admin/dashboard"));
      setError("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setData(null);
      else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await post("/admin/login", { password: f.get("password") });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function loadReviews() {
    setBusy(true);
    try {
      setReviews(await api<ReviewsResponse>("/admin/reviews"));
    } catch (e) {
      setError((e as Error).message);
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
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <div className="admin-login">
        <Link to="/">
          <img src="/images/logo.png" alt="Rota Kars" />
        </Link>
        <LockKeyhole size={27} />
        <h1>Acente yönetimi</h1>
        <p>
          Rezervasyonlar, konaklama talepleri ve Google yorum eşleştirmeleri.
        </p>
        <form onSubmit={login}>
          <label className="field">
            Yönetici parolası
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="btn block" disabled={busy}>
            {busy ? <LoaderCircle size={17} className="spin" /> : null}Giriş yap
          </button>
        </form>
        <small>
          Yerel kurulum: .env dosyasındaki ADMIN_PASSWORD alanıyla etkinleşir.
        </small>
      </div>
    );
  const tabs = [
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
  ] as const;
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link to="/">
          <img src="/images/logo.png" alt="Rota Kars" />
        </Link>
        <span>Acente yönetimi</span>
        <nav>
          {tabs.map(([id, label, Icon]) => (
            <button
              className={tab === id ? "active" : ""}
              key={id}
              onClick={() => {
                setTab(id);
                setNotice("");
                if (id === "reviews") loadReviews();
              }}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
        <button
          className="text-link"
          onClick={async () => {
            await post("/admin/logout", {});
            setData(null);
          }}
        >
          <LogOut size={17} />
          Çıkış yap
        </button>
      </aside>
      <main className="admin-main">
        <div className="section-heading">
          <div>
            <span className="section-note">Rota Kars</span>
            <h1>{tabs.find((x) => x[0] === tab)?.[1]}</h1>
          </div>
          <button className="btn btn-outline btn-small" onClick={load}>
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
        {tab === "reservations" && <ReservationManager catalog={catalog} />}
        {tab === "departures" && <DepartureManager catalog={catalog} />}
        {tab === "campaigns" && <CampaignManager catalog={catalog} />}
        {tab === "daily" && <DailyReport catalog={catalog} />}
        {tab === "notifications" && <NotificationManager />}
        {tab === "requests" && (
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
        {tab === "hotels" && (
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
    </div>
  );
}
