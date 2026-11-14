import { localeOf } from "./i18n";
import type { PricedTransfer, TransferConfig } from "./transfer";
export type Tour = {
  // Satışı açık turun ilk seferi (katalogda sunucu ekler).
  next?: { date: string; startTime: string; available: number };
  // Açık seferlerin en düşük fiyatı (yoksa tur fiyatı); "…’den" gösterimleri bunu kullanır.
  fromPrice?: number;
  // Tur bazında transfer fiyatları (panelden; bkz. lib/transfer.ts).
  transfer?: TransferConfig;
  // "demand": talep toplama (koltuk satılmaz, ücretsiz ön kayıt). Eşik kişi sayısıdır;
  // count yalnız panelde "ilerlemeyi göster" açıksa gelir.
  mode?: "online" | "demand";
  demand?: { threshold: number; showProgress: boolean; count?: number };
  id: string;
  // Yurt dışı tur (katalogda yalnız yurt dışı turlarda bulunur).
  abroad?: boolean;
  salesOpen: boolean;
  vehicle: Vehicle;
  name: string;
  subtitle: string;
  category: string;
  duration: string;
  location: string;
  image: string;
  gallery: string[];
  price: number;
  departure: string;
  end: string;
  inquiryOnly: boolean;
  season: string;
  summary: string;
  included: string[];
  excluded: string[];
  itinerary: { time: string; title: string; text: string }[];
  note: string;
  source: string;
};
export type Story = {
  id: string;
  tourId: string;
  title: string;
  image: string;
  location: string;
  scenes: { title: string; text: string }[];
};
export type VehicleModel = {
  id: string;
  name: string;
  min: number;
  max: number;
  seats: number;
  columns: number;
};
export type Vehicle = {
  modelId?: string;
  id: string;
  name: string;
  passengerSeats: number;
  driverSeats: number;
  guideSeats: number;
  sellableSeats: number;
  layout: (string | number | null)[][];
  description: string;
  // Gövde çizimi: binek, minibüs, midibüs, turizm midibüsü, otobüs.
  shape?: "car" | "van" | "midibus" | "bus" | "coach";
  // Sefere filodan bir araç atanmışsa; plaka yalnız panel yanıtlarında gelir.
  unit?: { id: string; name: string; year: number; plate?: string };
};
export type FleetVehicle = {
  id: string;
  plate: string;
  name: string;
  year: number;
  vehicleModel: string;
  passengerSeats: number;
  note: string;
};
export type Catalog = {
  business: {
    name: string;
    phone: string;
    mobile: string;
    email: string;
    address: string;
    mapsUrl: string;
    instagram: string;
    facebook: string;
    whatsapp: string;
    whatsappLabel: string;
    hours: string;
    tursabNo: string;
    founded: number;
    legalName: string;
    legalNameShort: string;
    licenseGroup: string;
    mersis: string;
    taxOffice: string;
    taxNo: string;
    tradeRegistry: string;
    tradeRegistryNo: string;
    chamber: string;
    chamberNo: string;
    kep: string;
  };
  features: { icon: string; title: string; text: string }[];
  services: {
    id: string;
    title: string;
    image: string;
    imageAlt?: string;
    text: string;
  }[];
  fleet: { note: string; tourism: string[]; vip: string[]; perks: string[] };
  cancellationPolicy: string;
  tours: Tour[];
  stories: Story[];
  vehicle: Vehicle;
  vehicleModels: VehicleModel[];
  photoCredits: {
    id: string;
    path: string;
    title: string;
    author: string;
    license: string;
    licenseUrl: string;
    source: string;
    changes: string;
  }[];
  // İngilizce sürüm metinleri (server/catalog-en.mjs).
  translations?: { en: Record<string, any> };
  payment: {
    enabled: boolean;
    message: string;
    test?: boolean;
    // Vakıfbank: kart sitenin formunda alınır, 3D Secure ile bankada doğrulanır.
    cardForm?: boolean;
    // Ödeme kapalıyken kart ekranının önizlemesi (PAYMENT_PREVIEW=1).
    preview?: boolean;
    simulator?: boolean;
    depositPercent?: number;
  };
  preview: boolean;
  demo?: boolean;
  turnstileSiteKey?: string | null;
};
export type Departure = {
  id: string;
  tour_id: string;
  date: string;
  // Geçerli kişi başı fiyat (özel fiyat yoksa turun fiyatı).
  price: number;
  // Bu sefere özel fiyat; null ise sefer tur fiyatını izler.
  custom_price: number | null;
  active: number;
  available: number;
  start_time: string;
  pickup: string;
  guide_name: string;
  guide_phone: string;
  vehicle_id?: string;
  vehicle: Vehicle;
};
export type Seat = { number: number; status: "occupied" | "available" };
export type Hold = { token: string; seats: number[]; expiresAt: number };
export type PassengerDetail = {
  nationality: string;
  idNumber: string;
  gender: "K" | "E";
};
export type Reservation = {
  ticket_token: string;
  // Onaylanan yasal belgeler (server/legal.mjs); Türkçe düz metin.
  pre_info_text?: string | null;
  contract_text?: string | null;
  passenger_details?: PassengerDetail[];
  ticketUrl?: string;
  qrDataUrl?: string;
  net_paid?: number;
  paid_total?: number;
  refunded_total?: number;
  balance_due?: number;
  start_time?: string;
  pickup?: string;
  guide_name?: string;
  cancellation_requested_at?: number;
  checked_in_at?: number;
  created_at?: number;
  notes?: string;
  source?: string;
  ledger?: {
    id: string;
    kind: string;
    amount: number;
    method: string;
    external_reference: string;
    created_at?: number;
  }[];
  vehicle?: Vehicle | null;
  subtotal?: number;
  discount_amount?: number;
  transfer?: PricedTransfer | null;
  transfer_amount?: number;
  reference: string;
  departure_id: string;
  email: string;
  name: string;
  phone: string;
  passengers: string[];
  seats: number[];
  total: number;
  deposit: number;
  status: string;
  date: string;
  tourId: string;
  expires_at: number;
};
export type Hotel = {
  id: string;
  name: string;
  location: string;
  description: string;
  amenities: string[];
  image: string | null;
  active: number;
};
export type Review = {
  id: string;
  author: string;
  authorUrl: string | null;
  avatar: string | null;
  text: string;
  rating: number;
  date: string;
  url: string;
  tourIds: string[];
  relativeDate?: string;
};
export type ReviewsResponse = {
  status: string;
  reviews: Review[];
  rating: number | null;
  total: number | null;
  mapsUrl: string;
  sort: string | null;
  fetchedAt?: string;
  scope?: "all" | "tour" | "agency";
  terms?: { term: string; exact: boolean }[];
};
export const currency = (value: number) =>
  new Intl.NumberFormat(localeOf(), {
    style: "currency",
    currency: "TRY",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).format(value / 100);
// Fiyatı henüz girilmemiş tur (price 0): tutar yerine "Fiyat için arayın" gösterilir.
export const hasPrice = (value: number | undefined) => Number(value) > 0;
export const dateLabel = (s: string) =>
  new Date(s + "T12:00:00").toLocaleDateString(localeOf(), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
// Rehber yazısı (server/articles.mjs). body yalnız yazı sayfasında gelir.
export type Article = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: "aktivite" | "rehber" | "kultur";
  cover: string;
  tourIds: string[];
  publishedAt: number | null;
  updatedAt: number;
  body?: string;
  status?: "draft" | "published";
  author?: string | null;
};
export const ARTICLE_CATEGORIES: Record<Article["category"], string> = {
  aktivite: "Aktivite",
  rehber: "Gezi rehberi",
  kultur: "Tarih ve kültür",
};
