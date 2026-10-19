import { useEffect, useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { api } from "../../lib/api";
import { currency } from "../../lib/types";
import { isNativeApp } from "../../lib/native";

type Report = {
  month: string;
  totals: {
    departures: number;
    capacity: number;
    guests: number;
    reservations: number;
    revenue: number;
    outstanding: number;
    cancelled: number;
    noShow: number;
  };
  cash: { payments: number; refunds: number; net: number; cash: number; bankTransfer: number };
  byTour: {
    tourId: string;
    tourName: string;
    departures: number;
    capacity: number;
    guests: number;
    occupancy: number;
    reservations: number;
    revenue: number;
    collected: number;
  }[];
};
const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// Aylık rapor: tur bazında doluluk/ciro ve ay içi tahsilat; Excel'e aktarma.
export function MonthReport() {
  const [month, setMonth] = useState(thisMonth()),
    [data, setData] = useState<Report | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    setData(null);
    setError("");
    api<Report>("/admin/reports/month?month=" + month)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [month]);
  const occupancy = data?.totals.capacity ? Math.round((data.totals.guests / data.totals.capacity) * 100) : 0;
  return (
    <>
      <div className="desk-toolbar">
        <label className="field">
          Ay
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
        {!isNativeApp() ? (
          <a className="btn btn-outline" href={"/api/admin/reports/month.csv?month=" + month}>
            <Download size={16} /> Excel'e aktar
          </a>
        ) : (
          <p className="muted">Excel dosyasını bilgisayardan panele girerek indirebilirsiniz.</p>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!data && !error && (
        <p className="muted">
          <LoaderCircle className="spin" size={16} /> Rapor hazırlanıyor…
        </p>
      )}
      {data && (
        <>
          <div className="admin-metrics">
            <div>
              <span>Ciro (tur tarihine göre)</span>
              <strong>{currency(data.totals.revenue)}</strong>
              <small>Kalan alacak: {currency(data.totals.outstanding)}</small>
            </div>
            <div>
              <span>Doluluk</span>
              <strong>%{occupancy}</strong>
              <small>
                {data.totals.guests} yolcu / {data.totals.capacity} koltuk · {data.totals.departures} sefer
              </small>
            </div>
            <div>
              <span>Ay içi net tahsilat</span>
              <strong>{currency(data.cash.net)}</strong>
              <small>
                Nakit {currency(data.cash.cash)} · Havale {currency(data.cash.bankTransfer)}
              </small>
            </div>
            <div>
              <span>İptal / gelmedi</span>
              <strong>
                {data.totals.cancelled} / {data.totals.noShow}
              </strong>
              <small>İade: {currency(data.cash.refunds)}</small>
            </div>
          </div>
          <div className="desk-table-wrap">
            <table className="desk-table">
              <thead>
                <tr>
                  <th>Tur</th>
                  <th>Doluluk</th>
                  <th>Rezervasyon</th>
                  <th>Ciro / tahsil edilen</th>
                </tr>
              </thead>
              <tbody>
                {data.byTour.map((x) => (
                  <tr key={x.tourId}>
                    <td>
                      <strong>{x.tourName}</strong>
                      <small>{x.departures} sefer</small>
                    </td>
                    <td>
                      %{x.occupancy}
                      <small>
                        {x.guests} / {x.capacity} koltuk
                      </small>
                      <span className="occupancy-bar" aria-hidden="true">
                        <span style={{ width: Math.min(100, x.occupancy) + "%" }} />
                      </span>
                    </td>
                    <td>{x.reservations}</td>
                    <td>
                      {currency(x.revenue)}
                      <small>Tahsil: {currency(x.collected)}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.byTour.length && <p className="admin-empty">Bu ay için sefer veya rezervasyon yok.</p>}
        </>
      )}
    </>
  );
}
