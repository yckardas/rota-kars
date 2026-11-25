// Finans paneli hesapları: veri girer, rapor çıkar (saf fonksiyonlar; veri tabanına dokunmaz).
// Tasarım: docs/superpowers/specs/2026-11-25-finans-paneli-design.md
import { localDate } from "./departures.mjs";
import { REQUEST_STATUS } from "./requests.mjs";

// Talep notundan tur bulmak için anahtar kelimeler. "Günübirlik", "Konaklamalı", "Büyük",
// "Butik", "tur" gibi genel kelimeler bilerek yok. Düz "van" üç turla eşleşir (fiyat ortalaması).
export const TOUR_KEYWORDS = [
  ["ani", ["ani-cildir"]],
  ["çıldır", ["ani-cildir"]],
  ["sarıkamış", ["sarikamis"]],
  ["kayak", ["sarikamis"]],
  ["batum", ["batum"]],
  ["tiflis", ["tiflis"]],
  ["gürcistan", ["tiflis"]],
  ["nahçıvan", ["nahcivan"]],
  ["azerbaycan", ["buyuk-azerbaycan"]],
  ["bakü", ["buyuk-azerbaycan"]],
  ["mardin", ["butik-mardin"]],
  ["güneydoğu", ["guneydogu"]],
  ["divriği", ["sivas-kemaliye"]],
  ["kemaliye", ["sivas-kemaliye"]],
  ["sivas", ["sivas-kemaliye"]],
  ["karadeniz", ["karadeniz"]],
  ["narman", ["narman-tortum"]],
  ["tortum", ["narman-tortum"]],
  ["şavşat", ["savsat-karagol"]],
  ["karagöl", ["savsat-karagol"]],
  ["van havzası", ["van-havzasi"]],
  ["van", ["van-gunubirlik", "van", "van-havzasi"]],
];
const lower = (s) => String(s || "").toLocaleLowerCase("tr-TR");
const hasWord = (text, kw) => new RegExp("(^|[^\\p{L}])" + kw + "([^\\p{L}]|$)", "u").test(text);

export function matchTours(notes) {
  const text = lower(notes);
  if (!text) return [];
  const hits = TOUR_KEYWORDS.filter(([kw]) => hasWord(text, kw)).map(([kw]) => kw);
  // Uzun ifade kısa olanı ezer: "van havzası" geçiyorsa düz "van" düşer.
  const kept = hits.filter((kw) => !hits.some((other) => other !== kw && other.includes(kw)));
  return [...new Set(kept.flatMap((kw) => TOUR_KEYWORDS.find(([k]) => k === kw)[1]))];
}

// "Önceki tur" fiyatı: bugünden önceki en son seferde müşterilerin ödediği koltuk fiyatı
// (rezervasyonun o anki subtotal'ı / koltuk); o seferde satış yoksa seferin fiyatı;
// geçmiş sefer yoksa en yakın gelecek sefer; o da yoksa katalog.
export function unitPrice(tourId, departures, today, tours, reservations = []) {
  const own = departures.filter((d) => d.tour_id === tourId && Number(d.price) > 0);
  const past = own.filter((d) => d.date < today).sort((a, b) => b.date.localeCompare(a.date));
  if (past.length) {
    const paid = reservations
      .filter((r) => r.departure_id === past[0].id && !["cancelled", "expired"].includes(r.status) && Number(r.subtotal) > 0 && r.seats?.length)
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    return paid.length ? Math.round(Number(paid[0].subtotal) / paid[0].seats.length) : Number(past[0].price);
  }
  const next = own.filter((d) => d.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  if (next.length) return Number(next[0].price);
  const t = tours.find((x) => x.id === tourId);
  return t && Number(t.price) > 0 ? Number(t.price) : null;
}

const ESTIMATED_KINDS = ["tour-info", "private-tour"];
export function requestEstimate(req, { departures, tours, today, reservations = [] }) {
  if (!ESTIMATED_KINDS.includes(req.kind)) return null;
  const body = req.body || {};
  const candidates = body.tourId ? [body.tourId] : matchTours(body.notes);
  const priced = candidates
    .map((id) => ({ id, price: unitPrice(id, departures, today, tours, reservations) }))
    .filter((x) => x.price != null);
  if (!priced.length) return null;
  const average = Math.round(priced.reduce((n, x) => n + x.price, 0) / priced.length);
  return {
    amount: (Number(body.guests) || 1) * average,
    tourIds: priced.map((x) => x.id),
    averaged: priced.length > 1,
  };
}

// ---- Dönem raporu ----
const DAY = 86400000;
const addDays = (ymd, n) => new Date(Date.parse(ymd + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);
// Haftalar pazartesi başlar.
const monday = (ymd) => addDays(ymd, -((new Date(ymd + "T00:00:00Z").getUTCDay() + 6) % 7));
const live = (r) => !["cancelled", "expired"].includes(r.status);
const balanceOf = (r) => Math.max(0, Number(r.total) - Number(r.net_paid || 0));
const sum = (rows, f) => rows.reduce((n, x) => n + f(x), 0);
const METHOD_KEYS = { cash: "cash", bank_transfer: "bankTransfer", pos: "pos", "online:vakifbank": "card" };

// Tur bazında satış (Finans ve Aylık rapor ortak): katalog sırası, sonra katalogdan kalkmış turlar.
// reservations: dönemdeki canlı rezervasyonlar; departures: dönemdeki seferler.
export function tourRows({ tours, departures, reservations }) {
  const name = (id) => tours.find((t) => t.id === id)?.name || id;
  const ids = [...tours.map((t) => t.id), ...new Set(reservations.map((r) => r.tourId).filter((id) => !tours.some((t) => t.id === id)))];
  return ids
    .map((id) => {
      const tds = departures.filter((d) => d.tour_id === id),
        trs = reservations.filter((r) => r.tourId === id),
        capacity = sum(tds, (d) => d.vehicle?.sellableSeats || 0),
        guests = sum(trs, (r) => r.seats.length);
      return {
        tourId: id,
        tourName: name(id),
        departures: tds.length,
        capacity,
        guests,
        occupancy: capacity ? Math.round((guests / capacity) * 100) : 0,
        reservations: trs.length,
        revenue: sum(trs, (r) => Number(r.total)),
        collected: sum(trs, (r) => Number(r.net_paid || 0)),
      };
    })
    .filter((x) => x.departures || x.reservations);
}

export function buildFinance({ reservations, ledger, departures, requests, tours, today, from, to, bucket = "day" }) {
  const tourName = (id) => tours.find((t) => t.id === id)?.name || id;
  const inRange = (ymd) => ymd >= from && ymd <= to;
  const alive = reservations.filter(live);
  const sold = alive.filter((r) => inRange(r.date));
  const byId = new Map(reservations.map((r) => [r.id, r]));
  const periodLedger = ledger
    .map((p) => ({ ...p, day: localDate(p.created_at), amount: Number(p.amount) }))
    .filter((p) => inRange(p.day));
  const net = (p) => (p.kind === "refund" ? -p.amount : p.amount);

  // Tahsilat yöntemleri (net).
  const methods = { cash: 0, bankTransfer: 0, pos: 0, card: 0 };
  for (const p of periodLedger) if (METHOD_KEYS[p.method]) methods[METHOD_KEYS[p.method]] += net(p);

  // Grafik: her dilim (gün ya da pazartesi başlayan hafta) sıfırla da olsa yer alır.
  const keyOf = (ymd) => (bucket === "week" ? monday(ymd) : ymd);
  const series = [];
  for (let k = keyOf(from); k <= to; k = addDays(k, bucket === "week" ? 7 : 1)) series.push({ key: k, revenue: 0, collected: 0 });
  const slot = new Map(series.map((x) => [x.key, x]));
  for (const r of sold) slot.get(keyOf(r.date)) && (slot.get(keyOf(r.date)).revenue += Number(r.total));
  for (const p of periodLedger) slot.get(keyOf(p.day)) && (slot.get(keyOf(p.day)).collected += net(p));

  // Beklenen ödemeler: bugünden 30 gün; vade = tur tarihi.
  const last = addDays(today, 29),
    week = addDays(today, 6);
  const due = alive
    .filter((r) => r.status !== "no_show" && r.date >= today && r.date <= last && balanceOf(r) > 0)
    .sort((a, b) => (a.date + (a.start_time || "")).localeCompare(b.date + (b.start_time || "")));
  const days = Array.from({ length: 30 }, (_, i) => {
    const date = addDays(today, i),
      rows = due.filter((r) => r.date === date);
    return { date, amount: sum(rows, balanceOf), count: rows.length };
  });
  const person = (r) => ({ reference: r.reference, name: r.name, phone: r.phone, tourName: tourName(r.tourId), date: r.date });

  const byTour = tourRows({ tours, departures: departures.filter((d) => inRange(d.date)), reservations: sold });

  // Talep hattı: dönemde gelen talepler; tahmin yalnız turla eşleşenlere.
  const ctx = { departures, tours, today, reservations };
  const periodRequests = requests.filter((q) => inRange(localDate(q.created_at)));
  const stages = Object.entries(REQUEST_STATUS).map(([status, label]) => {
    const rows = periodRequests.filter((q) => q.status === status),
      est = rows.map((q) => requestEstimate(q, ctx)).filter(Boolean);
    return { status, label, count: rows.length, estimatedCount: est.length, estimate: sum(est, (e) => e.amount) };
  });
  const open = stages.filter((x) => !["won", "lost"].includes(x.status));

  const day =
    from === to
      ? {
          departures: departures
            .filter((d) => d.date === from)
            .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""))
            .map((d) => {
              const rows = alive.filter((r) => r.departure_id === d.id);
              return {
                departureId: d.id,
                tourName: tourName(d.tour_id),
                start_time: d.start_time,
                guests: sum(rows, (r) => r.seats.length),
                revenue: sum(rows, (r) => Number(r.total)),
                balance: sum(rows, balanceOf),
              };
            }),
          ledger: periodLedger
            .sort((a, b) => a.created_at - b.created_at)
            .map((p) => {
              const r = byId.get(p.reservation_id);
              // Eski kayıtlarda dekont numarası external_reference'tadır; iç referans (PANEL-…) gösterilmez.
              const note = p.note || (String(p.external_reference || "").startsWith("PANEL-") ? "" : p.external_reference || "");
              return { at: p.created_at, reference: r?.reference || "", name: r?.name || "", kind: p.kind, method: p.method, amount: p.amount, note };
            }),
        }
      : null;

  const payments = sum(periodLedger.filter((p) => p.kind !== "refund"), (p) => p.amount),
    refunds = sum(periodLedger.filter((p) => p.kind === "refund"), (p) => p.amount);
  return {
    range: { from, to, bucket },
    summary: {
      revenue: sum(sold, (r) => Number(r.total)),
      revenuePending: sum(sold.filter((r) => r.status === "pending_agency"), (r) => Number(r.total)),
      payments,
      refunds,
      collected: payments - refunds,
      outstanding: sum(alive.filter((r) => r.status !== "no_show"), balanceOf),
      outstandingNoShow: sum(alive.filter((r) => r.status === "no_show"), balanceOf),
      expected7: sum(due.filter((r) => r.date <= week), balanceOf),
    },
    series,
    expected: { total: sum(due, balanceOf), days, rows: due.map((r) => ({ ...person(r), start_time: r.start_time, balance: balanceOf(r) })) },
    byTour,
    methods,
    pipeline: {
      stages,
      openCount: sum(open, (x) => x.count),
      openEstimate: sum(open, (x) => x.estimate),
      unestimated: sum(open, (x) => x.count - x.estimatedCount),
    },
    overdue: alive
      .filter((r) => r.date < today && ["confirmed", "completed"].includes(r.status) && balanceOf(r) > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({ ...person(r), status: r.status, balance: balanceOf(r) })),
    day,
  };
}
