// Gelen talepler (konaklama, özel tur, araç kiralama): alan etiketleri, türe göre
// durum adları ve acente/müşteri mesajlarında kullanılan okunur özet.
export const ROOM_TYPES = {
  single: "Tek kişilik",
  double: "Çift kişilik (büyük yatak)",
  twin: "İki ayrı yatak",
  triple: "Üç kişilik",
  family: "Aile odası",
};
export const BUDGETS = {
  economy: "Ekonomik",
  standard: "Orta",
  premium: "Üst seviye",
};
export const REQUEST_KINDS = {
  hotel: "Konaklama talebi",
  "private-tour": "Özel tur talebi",
  vehicle: "Araç kiralama talebi",
};
// Durum anahtarları tüm türlerde aynıdır; konaklamada acente otelle görüşüp döner,
// bu yüzden adları o akışa göre okunur.
export const REQUEST_STATUS = {
  new: "Yeni",
  contacted: "Arandı",
  in_progress: "Görüşülüyor",
  offered: "Teklif verildi",
  won: "Rezervasyona döndü",
  lost: "Kapandı",
};
const HOTEL_STATUS = {
  ...REQUEST_STATUS,
  contacted: "Müşteri arandı",
  in_progress: "Otelle görüşülüyor",
  offered: "Teklif müşteriye iletildi",
  won: "Konaklama onaylandı",
  lost: "Olmadı",
};
export const statusLabel = (kind, status) => (kind === "hotel" ? HOTEL_STATUS : REQUEST_STATUS)[status] || status;

// Bir e-posta adresine formlardan günde en fazla bu kadar otomatik yanıt gider.
export const formMailPerDay = (env = process.env) => Math.max(1, Number(env.FORM_MAIL_PER_DAY) || 3);
// forCustomer: müşteriye giden otomatik yanıtta formdaki serbest metin (ad, not) yer
// almaz; aksi halde form, ajansın alan adından istenen adrese istenen metni yollar.
export function describeRequest(body, { tourName = "", hotelName = "", forCustomer = false } = {}) {
  return [
    tourName && `Tur: ${tourName}`,
    !forCustomer && `Ad: ${body.name} · ${body.phone} · ${body.email}`,
    body.checkOut ? `Tarih: ${body.checkIn} → ${body.checkOut}` : body.checkIn && `Tarih: ${body.checkIn}`,
    `Kişi: ${body.guests}${body.children ? ` (${body.children} çocuk dahil)` : ""}`,
    body.rooms && `Oda: ${body.rooms}${body.roomType ? ` × ${ROOM_TYPES[body.roomType]}` : ""}`,
    !body.rooms && body.roomType && `Oda tercihi: ${ROOM_TYPES[body.roomType]}`,
    body.budget && `Bütçe: ${BUDGETS[body.budget]}`,
    hotelName && `Otel tercihi: ${hotelName}`,
    !forCustomer && body.notes && `Not: ${String(body.notes).slice(0, 500)}`,
  ]
    .filter(Boolean)
    .join("\n");
}
