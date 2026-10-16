export type Tour = {
  id: string;
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
export type Vehicle = {
  id: string;
  name: string;
  passengerSeats: number;
  driverSeats: number;
  guideSeats: number;
  sellableSeats: number;
  layout: (string | number | null)[][];
  description: string;
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
  };
  features: { icon: string; title: string; text: string }[];
  services: { title: string; image: string; text: string }[];
  fleet: { note: string; tourism: string[]; vip: string[]; perks: string[] };
  cancellationPolicy: string;
  tours: Tour[];
  stories: Story[];
  vehicle: Vehicle;
  payment: { enabled: boolean; message: string };
  preview: boolean;
};
export type Departure = {
  id: string;
  tour_id: string;
  date: string;
  price: number;
  active: number;
  available: number;
};
export type Seat = { number: number; status: "occupied" | "available" };
export type Hold = { token: string; seats: number[]; expiresAt: number };
export type Reservation = {
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
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value / 100);
export const dateLabel = (s: string) =>
  new Date(s + "T12:00:00").toLocaleDateString("tr-TR", {
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
