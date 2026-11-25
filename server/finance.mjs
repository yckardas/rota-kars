// Finans paneli hesapları: veri girer, rapor çıkar (saf fonksiyonlar; veri tabanına dokunmaz).
// Tasarım: docs/superpowers/specs/2026-11-25-finans-paneli-design.md

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

// "Önceki tur" fiyatı: bugünden önceki en son sefer; yoksa en yakın gelecek sefer; yoksa katalog.
export function unitPrice(tourId, departures, today, tours) {
  const own = departures.filter((d) => d.tour_id === tourId && Number(d.price) > 0);
  const past = own.filter((d) => d.date < today).sort((a, b) => b.date.localeCompare(a.date));
  if (past.length) return Number(past[0].price);
  const next = own.filter((d) => d.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  if (next.length) return Number(next[0].price);
  const t = tours.find((x) => x.id === tourId);
  return t && Number(t.price) > 0 ? Number(t.price) : null;
}

const ESTIMATED_KINDS = ["tour-info", "private-tour"];
export function requestEstimate(req, { departures, tours, today }) {
  if (!ESTIMATED_KINDS.includes(req.kind)) return null;
  const body = req.body || {};
  const candidates = body.tourId ? [body.tourId] : matchTours(body.notes);
  const priced = candidates
    .map((id) => ({ id, price: unitPrice(id, departures, today, tours) }))
    .filter((x) => x.price != null);
  if (!priced.length) return null;
  const average = Math.round(priced.reduce((n, x) => n + x.price, 0) / priced.length);
  return {
    amount: (Number(body.guests) || 1) * average,
    tourIds: priced.map((x) => x.id),
    averaged: priced.length > 1,
  };
}
