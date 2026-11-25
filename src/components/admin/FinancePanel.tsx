import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle, MessageCircle, Phone } from "lucide-react";
import { api } from "../../lib/api";
import { currency, dateLabel, today } from "../../lib/types";
import { telHref, waNumber } from "../../lib/phone";
import { whatsappLink } from "../../lib/whatsapp";
import { BarPairs, DayBars, HBars, StackBar } from "./financeCharts";

// Sunucudaki buildFinance çıktısı (server/finance.mjs).
type Person = { reference: string; name: string; phone: string; tourName: string; date: string };
type FinanceReport = {
  range: { from: string; to: string; bucket: "day" | "week" };
  summary: {
    revenue: number;
    revenuePending: number;
    payments: number;
    refunds: number;
    collected: number;
    outstanding: number;
    outstandingNoShow: number;
    expected7: number;
  };
  series: { key: string; revenue: number; collected: number }[];
  expected: { total: number; days: { date: string; amount: number; count: number }[]; rows: (Person & { start_time: string; balance: number })[] };
  byTour: { tourId: string; tourName: string; departures: number; capacity: number; guests: number; occupancy: number; reservations: number; revenue: number; collected: number }[];
  methods: { cash: number; bankTransfer: number; pos: number; card: number };
  pipeline: {
    stages: { status: string; label: string; count: number; estimatedCount: number; estimate: number }[];
    openCount: number;
    openEstimate: number;
    unestimated: number;
  };
  overdue: (Person & { status: string; balance: number })[];
  day: null | {
    departures: { departureId: string; tourName: string; start_time: string; guests: number; revenue: number; balance: number }[];
    ledger: { at: number; reference: string; name: string; kind: string; method: string; amount: number; note: string }[];
  };
};
type Mode = "day" | "week" | "month" | "range";

const DAY = 86400000;
const addDays = (ymd: string, n: number) => new Date(Date.parse(ymd + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);
const monday = (ymd: string) => addDays(ymd, -((new Date(ymd + "T00:00:00Z").getUTCDay() + 6) % 7));
const monthStart = (ymd: string) => ymd.slice(0, 8) + "01";
const monthEnd = (ymd: string) => addDays(addMonths(monthStart(ymd), 1), -1);
function addMonths(ymd: string, n: number) {
  const [y, m] = ymd.split("-").map(Number),
    t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}-01`;
}
const short = (ymd: string) => new Date(ymd + "T12:00:00Z").toLocaleDateString("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" });
const monthName = (ymd: string) => new Date(ymd + "T12:00:00Z").toLocaleDateString("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" });
const span = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1;

function periodOf(mode: Mode, anchor: string, rangeFrom: string, rangeTo: string) {
  if (mode === "day") return { from: anchor, to: anchor, bucket: "day" as const, title: dateLabel(anchor) };
  if (mode === "week") {
    const from = monday(anchor),
      to = addDays(from, 6);
    return { from, to, bucket: "day" as const, title: `${short(from)} – ${short(to)}` };
  }
  if (mode === "month") return { from: monthStart(anchor), to: monthEnd(anchor), bucket: "day" as const, title: monthName(anchor) };
  const [from, to] = rangeFrom <= rangeTo ? [rangeFrom, rangeTo] : [rangeTo, rangeFrom];
  return { from, to, bucket: span(from, to) > 62 ? ("week" as const) : ("day" as const), title: `${short(from)} – ${short(to)}` };
}
const METHOD = (m: string) =>
  m === "cash" ? "Nakit" : m === "bank_transfer" ? "Havale / EFT" : m === "pos" ? "POS" : m.startsWith("online:") ? "Online kart" : m;

// Finans: dönem cirosu ve tahsilatı, alacaklar, beklenen ödemeler, talep hattı.
export function FinancePanel({ onReservation }: { onReservation: (ref: string) => void }) {
  const [mode, setMode] = useState<Mode>("month"),
    [anchor, setAnchor] = useState(today()),
    [rangeFrom, setRangeFrom] = useState(addDays(today(), -29)),
    [rangeTo, setRangeTo] = useState(today()),
    [data, setData] = useState<FinanceReport | null>(null),
    [error, setError] = useState(""),
    [dueDay, setDueDay] = useState("");
  const period = useMemo(() => periodOf(mode, anchor, rangeFrom, rangeTo), [mode, anchor, rangeFrom, rangeTo]);
  useEffect(() => {
    let alive = true;
    setError("");
    api<FinanceReport>(`/admin/finance?from=${period.from}&to=${period.to}&bucket=${period.bucket}`)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [period.from, period.to, period.bucket]);
  const shift = (dir: 1 | -1) =>
    setAnchor((a) => (mode === "day" ? addDays(a, dir) : mode === "week" ? addDays(a, 7 * dir) : addMonths(a, dir)));
  const stale = data && (data.range.from !== period.from || data.range.to !== period.to);
  const s = data?.summary;
  const dueRows = data ? data.expected.rows.filter((r) => !dueDay || r.date === dueDay) : [];
  return (
    <div className="finance">
      <div className="finance-toolbar">
        <div className="status-filters" role="radiogroup" aria-label="Dönem">
          {(
            [
              ["day", "Gün"],
              ["week", "Hafta"],
              ["month", "Ay"],
              ["range", "Tarih aralığı"],
            ] as const
          ).map(([m, label]) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} className={"chip" + (mode === m ? " active" : "")} onClick={() => setMode(m)}>
              {label}
            </button>
          ))}
        </div>
        {mode === "range" ? (
          <div className="finance-range">
            <label className="field">
              Başlangıç
              <input type="date" value={rangeFrom} onChange={(e) => e.target.value && setRangeFrom(e.target.value)} />
            </label>
            <label className="field">
              Bitiş
              <input type="date" value={rangeTo} onChange={(e) => e.target.value && setRangeTo(e.target.value)} />
            </label>
          </div>
        ) : (
          <div className="finance-nav">
            <button type="button" className="btn btn-outline btn-small" aria-label="Önceki" onClick={() => shift(-1)}>
              <ChevronLeft size={16} />
            </button>
            <strong>{period.title}</strong>
            <button type="button" className="btn btn-outline btn-small" aria-label="Sonraki" onClick={() => shift(1)}>
              <ChevronRight size={16} />
            </button>
            <button type="button" className="btn btn-outline btn-small" onClick={() => setAnchor(today())}>
              Bugün
            </button>
          </div>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!data && !error && (
        <p className="muted">
          <LoaderCircle className="spin" size={16} /> Hazırlanıyor…
        </p>
      )}
      {data && s && (
        <div className={"finance-body" + (stale ? " stale" : "")} aria-busy={Boolean(stale)}>
          <div className="admin-metrics finance-metrics">
            <div>
              <span>Ciro (tur tarihine göre)</span>
              <strong>{currency(s.revenue)}</strong>
              <small>{s.revenuePending ? `${currency(s.revenuePending)} onay bekliyor` : "Onay bekleyen yok"}</small>
            </div>
            <div>
              <span>Net tahsilat (kasaya giren)</span>
              <strong>{currency(s.collected)}</strong>
              <small>
                Tahsilat {currency(s.payments)} · iade {currency(s.refunds)}
              </small>
            </div>
            <div>
              <span>Açık alacak (bugün itibarıyla)</span>
              <strong>{currency(s.outstanding)}</strong>
              <small>{s.outstandingNoShow ? `Gelmeyenlerde ayrıca ${currency(s.outstandingNoShow)}` : "Tüm canlı rezervasyonlar"}</small>
            </div>
            <div>
              <span>7 günde beklenen</span>
              <strong>{currency(s.expected7)}</strong>
              <small>30 günde {currency(data.expected.total)}</small>
            </div>
          </div>

          {data.day ? (
            <section className="finance-section">
              <h3>Günün hareketleri</h3>
              <div className="finance-two">
                <div>
                  <h4>Kalkan seferler</h4>
                  {data.day.departures.length ? (
                    <ul className="finance-list">
                      {data.day.departures.map((d) => (
                        <li key={d.departureId}>
                          <div>
                            <strong>
                              {d.start_time} · {d.tourName}
                            </strong>
                            <small>{d.guests} kişi</small>
                          </div>
                          <div className="finance-amount">
                            {currency(d.revenue)}
                            {d.balance > 0 && <small>Kalan {currency(d.balance)}</small>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="admin-empty">Bu gün kalkan sefer yok.</p>
                  )}
                </div>
                <div>
                  <h4>Tahsilat ve iadeler</h4>
                  {data.day.ledger.length ? (
                    <ul className="finance-list">
                      {data.day.ledger.map((p, i) => (
                        <li key={i}>
                          <button type="button" className="finance-row-link" onClick={() => p.reference && onReservation(p.reference)}>
                            <strong>
                              {new Date(p.at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} · {p.name || p.reference}
                            </strong>
                            <small>
                              {p.reference} · {METHOD(p.method)}
                              {p.note ? ` · ${p.note}` : ""}
                            </small>
                          </button>
                          <div className={"finance-amount" + (p.kind === "refund" ? " refund" : "")}>
                            {p.kind === "refund" ? "−" : ""}
                            {currency(p.amount)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="admin-empty">Bu gün tahsilat veya iade yok.</p>
                  )}
                </div>
              </div>
            </section>
          ) : (
            <section className="finance-section">
              <h3>Ciro ve tahsilat</h3>
              <p className="muted finance-note">
                {data.range.bucket === "week" ? "Haftalık" : "Günlük"} · ciro tur tarihine, tahsilat paranın girdiği güne göre.
              </p>
              <BarPairs
                aLabel="Ciro"
                bLabel="Net tahsilat"
                data={data.series.map((x) => ({
                  key: x.key,
                  label: data.range.bucket === "week" ? short(x.key) : String(Number(x.key.slice(8))),
                  a: x.revenue,
                  b: x.collected,
                }))}
              />
            </section>
          )}

          <section className="finance-section">
            <h3>Beklenen ödemeler · önümüzdeki 30 gün</h3>
            <p className="muted finance-note">Kalan bakiye en geç tur günü ödenir. Bir güne dokunarak listeyi süzebilirsiniz.</p>
            <DayBars
              selected={dueDay}
              onSelect={setDueDay}
              data={data.expected.days.map((d) => ({ key: d.date, label: short(d.date), value: d.amount, count: d.count }))}
            />
            {dueRows.length ? (
              <ul className="finance-list">
                {dueRows.map((r) => (
                  <PersonRow key={r.reference} row={r} amount={r.balance} meta={`${dateLabel(r.date)} ${r.start_time || ""}`} onOpen={onReservation} />
                ))}
              </ul>
            ) : (
              <p className="admin-empty">{dueDay ? "Bu gün için beklenen ödeme yok." : "Önümüzdeki 30 günde bekleyen ödeme yok."}</p>
            )}
          </section>

          <section className="finance-section">
            <h3>Tur bazında satış</h3>
            <p className="muted finance-note">Tahsil edilen: bu satışlardan bugüne kadar alınan. Üstteki kart dönemde kasaya gireni gösterir.</p>
            {data.byTour.length ? (
              <>
                <HBars
                  rows={data.byTour
                    .filter((x) => x.reservations > 0)
                    .sort((a, b) => b.revenue - a.revenue)
                    .map((x) => ({
                      key: x.tourId,
                      label: x.tourName,
                      value: x.revenue,
                      fill: x.collected,
                      sub: `Tahsil edilen ${currency(x.collected)} · ${x.guests}/${x.capacity} koltuk (%${x.occupancy}) · ${x.departures} sefer`,
                    }))}
                />
                {data.byTour.some((x) => !x.reservations) && (
                  <details className="finance-more">
                    <summary>
                      Satış olmayan {data.byTour.filter((x) => !x.reservations).length} turun seferi var
                    </summary>
                    <p className="muted">
                      {data.byTour
                        .filter((x) => !x.reservations)
                        .map((x) => `${x.tourName} (${x.departures} sefer)`)
                        .join(" · ")}
                    </p>
                  </details>
                )}
              </>
            ) : (
              <p className="admin-empty">Bu dönemde sefer veya rezervasyon yok.</p>
            )}
          </section>

          <section className="finance-section">
            <h3>Ödeme yöntemleri</h3>
            <StackBar
              parts={[
                { key: "cash", label: "Nakit", value: data.methods.cash, tone: "cash" },
                { key: "bank", label: "Havale / EFT", value: data.methods.bankTransfer, tone: "bank" },
                { key: "pos", label: "POS", value: data.methods.pos, tone: "pos" },
                { key: "card", label: "Online kart", value: data.methods.card, tone: "card" },
              ]}
            />
          </section>

          <section className="finance-section">
            <h3>Talep hattı</h3>
            <p className="muted finance-note">
              Dönemde gelen talepler. Tahmini tutar: kişi sayısı × o turun önceki sefer fiyatı (birden çok tur uyarsa ortalaması). Konaklama ve
              araç talepleri tahmine girmez.
            </p>
            <div className="admin-metrics finance-metrics two">
              <div>
                <span>Açık talep</span>
                <strong>{data.pipeline.openCount}</strong>
                <small>{data.pipeline.unestimated ? `${data.pipeline.unestimated} tanesi tahminsiz` : "Hepsi tahminli"}</small>
              </div>
              <div className="estimate">
                <span>Tahmini değer (açık)</span>
                <strong>~{currency(data.pipeline.openEstimate)}</strong>
                <small>Tahmindir, ciroya eklenmez</small>
              </div>
            </div>
            <HBars
              rows={data.pipeline.stages.map((x) => ({
                key: x.status,
                label: `${x.label} · ${x.count}`,
                value: x.estimate,
                estimate: true,
                sub: x.count ? `${x.count} talep · ${x.estimatedCount} tanesi tahminli` : "Talep yok",
              }))}
            />
          </section>

          <section className="finance-section">
            <h3>Geçmiş turdan kalan alacak</h3>
            {data.overdue.length ? (
              <ul className="finance-list warn">
                {data.overdue.map((r) => (
                  <PersonRow key={r.reference} row={r} amount={r.balance} meta={`${dateLabel(r.date)} · ${r.status === "completed" ? "Tamamlandı" : "Onaylı"}`} onOpen={onReservation} />
                ))}
              </ul>
            ) : (
              <p className="admin-empty">Tur tarihi geçmiş, parası eksik kayıt yok.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function PersonRow({ row, amount, meta, onOpen }: { row: Person; amount: number; meta: string; onOpen: (ref: string) => void }) {
  const wa = waNumber(row.phone);
  return (
    <li>
      <button type="button" className="finance-row-link" onClick={() => onOpen(row.reference)}>
        <strong>{row.name}</strong>
        <small>
          {row.reference} · {row.tourName} · {meta}
        </small>
      </button>
      <div className="finance-amount">{currency(amount)}</div>
      <div className="finance-actions">
        <a className="btn btn-outline btn-small" href={telHref(row.phone)} aria-label={`${row.name} ara`}>
          <Phone size={14} />
        </a>
        {wa && (
          <a
            className="btn btn-outline btn-small"
            href={whatsappLink(wa, `Merhaba ${row.name}, Rota Kars rezervasyonunuz (${row.reference}) için kalan ${currency(amount)} ödeme hakkında yazıyoruz.`)}
            target="_blank"
            rel="noreferrer"
            aria-label={`${row.name} WhatsApp`}
          >
            <MessageCircle size={14} />
          </a>
        )}
      </div>
    </li>
  );
}
