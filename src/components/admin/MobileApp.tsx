import { useEffect, useState } from "react";
import {
  BellRing,
  Check,
  Download,
  LoaderCircle,
  MessageCircle,
  Phone,
  Smartphone,
  UserCheck,
} from "lucide-react";
import { api, post } from "../../lib/api";
import { dateLabel } from "../../lib/types";
import {
  checkAppUpdate,
  enablePush,
  isNativeApp,
  type AppUpdate,
} from "../../lib/native";
import { Modal } from "../Modal";

type Device = {
  id: string;
  platform: string;
  label: string;
  createdAt: number;
  lastSeen: number;
};

// Hesabım sekmesi: bu telefonun bildirim durumu ve kayıtlı cihazlar.
export function PushSettings({
  canReceive,
  onOpen,
}: {
  canReceive: boolean;
  onOpen: (path: string) => void;
}) {
  const [info, setInfo] = useState<{ enabled: boolean; devices: Device[] } | null>(null),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const load = () =>
    api<{ enabled: boolean; devices: Device[] }>("/admin/devices")
      .then(setInfo)
      .catch((e) => setError(e.message));
  useEffect(() => {
    if (canReceive) load();
  }, [canReceive]);
  async function run(kind: "enable" | "test") {
    setBusy(kind);
    setError("");
    setMessage("");
    try {
      if (kind === "enable") {
        const state = await enablePush(onOpen);
        setMessage(
          state === "registered"
            ? "Bu telefon bildirim alacak."
            : state === "unconfigured"
              ? "Bu uygulama sürümü bildirim servisine (Firebase) bağlı değil. Bildirimli yeni sürümü kurun."
              : state === "denied"
              ? "Bildirim izni verilmedi. Telefon ayarlarından Rota Kars Yönetim için bildirimlere izin verin."
              : "Bildirimler yalnız Android uygulamasında açılabilir.",
        );
        await load();
      } else {
        const r = await post<{ sent: number }>("/admin/devices/test", {});
        setMessage(
          r.sent
            ? `Test bildirimi ${r.sent} cihaza gönderildi.`
            : "Kayıtlı cihaz bulunamadı. Önce uygulamada bildirimleri açın.",
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  if (!canReceive)
    return (
      <section className="admin-section push-settings">
        <h2>
          <BellRing size={19} /> Telefon bildirimleri
        </h2>
        <p className="muted">
          Rezervasyon ve yorum bildirimleri yalnız sahip ve operasyon
          hesaplarına gönderilir.
        </p>
      </section>
    );
  return (
    <section className="admin-section push-settings">
      <h2>
        <BellRing size={19} /> Telefon bildirimleri
      </h2>
      <p className="muted">
        Yeni ön rezervasyon, iptal, gelen talep ve yeni Google yorumu anında
        telefonunuza düşer.
      </p>
      {info && !info.enabled && (
        <p className="admin-banner" role="note">
          Bildirim servisi sunucuda henüz ayarlı değil (Firebase).
        </p>
      )}
      <div className="push-actions">
        {isNativeApp() && (
          <button className="btn" onClick={() => run("enable")} disabled={Boolean(busy)}>
            {busy === "enable" ? <LoaderCircle className="spin" size={16} /> : <Smartphone size={16} />}
            Bu telefonda bildirimleri aç
          </button>
        )}
        <button
          className="btn btn-outline"
          onClick={() => run("test")}
          disabled={Boolean(busy) || !info?.enabled || !info.devices.length}
        >
          {busy === "test" ? <LoaderCircle className="spin" size={16} /> : <BellRing size={16} />}
          Test bildirimi gönder
        </button>
      </div>
      {message && (
        <p className="notice-success" role="status">
          <Check size={16} /> {message}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {info && (
        <ul className="device-list">
          {info.devices.length === 0 && <li className="muted">Kayıtlı telefon yok.</li>}
          {info.devices.map((d) => (
            <li key={d.id}>
              <Smartphone size={16} />
              <span>
                <strong>{d.label || "Android telefon"}</strong>
                <small>Son görülme: {new Date(d.lastSeen).toLocaleString("tr-TR")}</small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Uygulamanın yeni sürümü varsa üstte uyarı (APK tek dokunuşla indirilir).
export function AppUpdateBanner() {
  const [update, setUpdate] = useState<AppUpdate | null>(null);
  useEffect(() => {
    checkAppUpdate().then(setUpdate).catch(() => {});
  }, []);
  if (!update) return null;
  return (
    <div className={"app-update" + (update.required ? " required" : "")} role="status">
      <Download size={18} />
      <span>
        <strong>
          Uygulamanın yeni sürümü hazır ({update.version})
          {update.required ? " — güncelleme gerekli" : ""}
        </strong>
        {update.notes && <small>{update.notes}</small>}
      </span>
      <a className="btn btn-small" href={update.apkUrl} target="_blank" rel="noreferrer">
        Güncelle
      </a>
    </div>
  );
}

type PassengerData = {
  departure: {
    id: string;
    tourName: string;
    date: string;
    startTime: string;
    pickup: string;
    guideName: string | null;
  };
  bookings: {
    reference: string;
    status: string;
    name: string;
    phone: string;
    whatsapp: string | null;
    seats: number[];
    passengers: string[];
    notes: string;
    checkedIn: boolean;
    ticketToken: string | null;
  }[];
};
const STATUS: Record<string, string> = {
  confirmed: "Onaylı",
  pending_agency: "Onay bekliyor",
  completed: "Tamamlandı",
  no_show: "Gelmedi",
};

// Telefonda yolcu listesi: arama, WhatsApp ve biniş işaretleme.
export function PassengerList({ departureId, onClose }: { departureId: string; onClose: () => void }) {
  const [data, setData] = useState<PassengerData | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  const load = () =>
    api<PassengerData>(`/admin/departures/${encodeURIComponent(departureId)}/passengers`)
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, [departureId]);
  async function checkIn(token: string, reference: string) {
    setBusy(reference);
    setError("");
    try {
      await post(`/admin/tickets/${encodeURIComponent(token)}/check-in`, {});
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const seatsTotal = data?.bookings.reduce((n, b) => n + b.seats.length, 0) || 0,
    boarded = data?.bookings.filter((b) => b.checkedIn).reduce((n, b) => n + b.seats.length, 0) || 0;
  return (
    <Modal title="Yolcu listesi" onClose={onClose} wide>
      {!data && !error && (
        <p className="muted">
          <LoaderCircle className="spin" size={16} /> Liste yükleniyor…
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {data && (
        <div className="passenger-list">
          <header>
            <h2>{data.departure.tourName}</h2>
            <p>
              {dateLabel(data.departure.date)} · {data.departure.startTime} · {data.departure.pickup}
            </p>
            <p className="muted">
              {seatsTotal} yolcu · {boarded} bindi · Rehber: {data.departure.guideName || "atanmadı"}
            </p>
          </header>
          {data.bookings.length === 0 && <p className="muted">Bu seferde rezervasyon yok.</p>}
          <ul>
            {data.bookings.map((b) => (
              <li key={b.reference} className={b.checkedIn ? "boarded" : ""}>
                <div className="passenger-head">
                  <strong>
                    Koltuk {b.seats.join(", ")} · {b.name}
                  </strong>
                  <span className={"status-tag status-" + b.status}>{STATUS[b.status] || b.status}</span>
                </div>
                {b.passengers.length > 1 && <p className="passenger-names">{b.passengers.join(" · ")}</p>}
                {b.notes && <p className="passenger-notes">Not: {b.notes}</p>}
                <small>{b.reference}</small>
                <div className="passenger-actions">
                  <a className="btn btn-outline btn-small" href={"tel:" + b.phone.replace(/[^\d+]/g, "")}>
                    <Phone size={15} /> Ara
                  </a>
                  {b.whatsapp && (
                    <a className="btn btn-outline btn-small" href={b.whatsapp} target="_blank" rel="noreferrer">
                      <MessageCircle size={15} /> WhatsApp
                    </a>
                  )}
                  {b.ticketToken && !b.checkedIn && (
                    <button
                      className="btn btn-small"
                      onClick={() => checkIn(b.ticketToken!, b.reference)}
                      disabled={busy === b.reference}
                    >
                      {busy === b.reference ? <LoaderCircle className="spin" size={15} /> : <UserCheck size={15} />}
                      Bindi
                    </button>
                  )}
                  {b.checkedIn && (
                    <span className="boarded-tag">
                      <Check size={15} /> Bindi
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}

type SessionRow = { current: boolean; createdAt: number; expiresAt: number; remember: boolean; device: string };
// Hesabım: açık oturumlar; telefon kaybolursa diğer tüm oturumlar tek dokunuşla kapatılır.
export function SessionList() {
  const [rows, setRows] = useState<SessionRow[] | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const load = () =>
    api<SessionRow[]>("/admin/me/sessions")
      .then(setRows)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  const when = (t: number) => new Date(t).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
  return (
    <section className="admin-section push-settings">
      <h2>
        <Smartphone size={19} /> Açık oturumlar
      </h2>
      <p className="muted">Bu hesapla giriş yapılmış cihazlar. Tanımadığınız bir oturum varsa hepsini kapatıp parolanızı değiştirin.</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <ul className="device-list">
        {rows?.map((s, i) => (
          <li key={i}>
            <Smartphone size={16} />
            <span>
              <strong>
                {s.device || "Cihaz"}
                {s.current ? " · bu cihaz" : ""}
              </strong>
              <small>
                Giriş {when(s.createdAt)} · {s.remember ? "hatırlanıyor, " : ""}bitiş {when(s.expiresAt)}
              </small>
            </span>
          </li>
        ))}
      </ul>
      {rows && rows.length > 1 && (
        <button
          className="btn btn-outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const r = await post<{ removed: number }>("/admin/me/sessions/revoke-others", {});
              setMessage(`${r.removed} oturum kapatıldı.`);
              await load();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Diğer tüm oturumları kapat
        </button>
      )}
      {message && (
        <p className="notice-success" role="status">
          <Check size={16} /> {message}
        </p>
      )}
    </section>
  );
}
