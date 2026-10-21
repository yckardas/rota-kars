import { useEffect, useState } from "react";
import {
  AlarmClock,
  Bus,
  CalendarDays,
  ClipboardList,
  LoaderCircle,
  Plus,
  QrCode,
  TriangleAlert,
  Users,
} from "lucide-react";
import { api } from "../../lib/api";
import { currency, dateLabel } from "../../lib/types";
import { PassengerList } from "./MobileApp";
import { TicketScanner } from "./TicketScanner";

type OverviewData = {
  today: string;
  todayDepartures: {
    id: string;
    tourName: string;
    startTime: string;
    pickup: string;
    guideName: string | null;
    booked: number;
    capacity: number;
    active: boolean;
  }[];
  pending: {
    count: number;
    items: {
      reference: string;
      name: string;
      phone: string;
      tourName: string;
      date: string;
      seats: number;
      total: number;
      expiresAt: number;
    }[];
  };
  cancellationRequests: number;
  newRequests: number;
  week: { departures: number; booked: number; capacity: number };
};

const timeLeft = (at: number) => {
  const ms = at - Date.now();
  if (ms <= 0) return "süresi doldu";
  const h = Math.floor(ms / 3600000),
    m = Math.floor((ms % 3600000) / 60000);
  return h ? `${h} sa ${m} dk kaldı` : `${m} dk kaldı`;
};

// Yönetim ana ekranı: telefonda ilk bakışta günün işi.
export function Overview({
  go,
}: {
  go: (tab: string, options?: { status?: string; flag?: string; create?: boolean; ref?: string }) => void;
}) {
  const [data, setData] = useState<OverviewData | null>(null),
    [error, setError] = useState(""),
    [passengers, setPassengers] = useState(""),
    [scanning, setScanning] = useState(false);
  useEffect(() => {
    const load = () =>
      api<OverviewData>("/admin/overview")
        .then(setData)
        .catch((e) => setError(e.message));
    load();
    // Panel açık kaldıkça dakikada bir tazelenir.
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);
  if (error)
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  if (!data)
    return (
      <p className="muted">
        <LoaderCircle className="spin" size={16} /> Özet yükleniyor…
      </p>
    );
  const urgent = data.pending.items.filter((p) => p.expiresAt - Date.now() < 6 * 3600000).length;
  return (
    <div className="overview">
      <div className="overview-actions">
        <button className="btn" onClick={() => go("reservations", { create: true })}>
          <Plus size={16} /> Yeni rezervasyon
        </button>
        <button className="btn btn-outline" onClick={() => go("departures", { create: true })}>
          <CalendarDays size={16} /> Sefer aç
        </button>
        <button className="btn btn-outline" onClick={() => setScanning(true)}>
          <QrCode size={16} /> Bilet okut
        </button>
      </div>
      <div className="overview-cards">
        <button className={"overview-card" + (data.pending.count ? " attention" : "")} onClick={() => go("reservations", { status: "pending_agency" })}>
          <AlarmClock size={20} />
          <strong>{data.pending.count}</strong>
          <span>Onay bekleyen</span>
          {urgent > 0 && <small>{urgent} tanesinin süresi 6 saatten az</small>}
        </button>
        <button className={"overview-card" + (data.cancellationRequests ? " attention" : "")} onClick={() => go("reservations", { flag: "cancel_request" })}>
          <TriangleAlert size={20} />
          <strong>{data.cancellationRequests}</strong>
          <span>İptal talebi</span>
        </button>
        <button className={"overview-card" + (data.newRequests ? " attention" : "")} onClick={() => go("requests")}>
          <ClipboardList size={20} />
          <strong>{data.newRequests}</strong>
          <span>Yeni talep</span>
        </button>
        <button className="overview-card" onClick={() => go("departures")}>
          <Users size={20} />
          <strong>
            {data.week.booked}/{data.week.capacity}
          </strong>
          <span>7 günlük doluluk · {data.week.departures} sefer</span>
        </button>
      </div>

      <section className="overview-section">
        <h2>Bugün kalkan seferler · {dateLabel(data.today)}</h2>
        {data.todayDepartures.length === 0 && <p className="muted">Bugün sefer yok.</p>}
        <ul className="overview-list">
          {data.todayDepartures.map((d) => (
            <li key={d.id}>
              <Bus size={18} />
              <span>
                <strong>
                  {d.startTime} · {d.tourName}
                </strong>
                <small>
                  {d.booked}/{d.capacity} koltuk · {d.pickup} · Rehber: {d.guideName || "atanmadı"}
                </small>
              </span>
              <button className="btn btn-outline btn-small" onClick={() => setPassengers(d.id)}>
                Yolcular
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="overview-section">
        <h2>Onay bekleyenler (süresi yaklaşan önce)</h2>
        {data.pending.items.length === 0 && <p className="muted">Onay bekleyen ön rezervasyon yok.</p>}
        <ul className="overview-list">
          {data.pending.items.map((p) => (
            <li key={p.reference}>
              <AlarmClock size={18} />
              <span>
                <strong>
                  {p.name} · {p.seats} kişi · {currency(p.total)}
                </strong>
                <small>
                  {p.reference} · {p.tourName} · {dateLabel(p.date)} · {timeLeft(p.expiresAt)}
                </small>
              </span>
              <a className="btn btn-outline btn-small" href={"tel:" + p.phone.replace(/[^\d+]/g, "")}>
                Ara
              </a>
              <button className="btn btn-small" onClick={() => go("reservations", { ref: p.reference })}>
                Aç
              </button>
            </li>
          ))}
        </ul>
        {data.pending.count > data.pending.items.length && (
          <button className="text-link" onClick={() => go("reservations", { status: "pending_agency" })}>
            Tümünü gör ({data.pending.count})
          </button>
        )}
      </section>
      {passengers && <PassengerList departureId={passengers} onClose={() => setPassengers("")} />}
      {scanning && <TicketScanner onClose={() => setScanning(false)} />}
    </div>
  );
}
