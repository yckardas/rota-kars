// Onaylı biletin altında: "Takvime ekle" (.ics) ve "WhatsApp'tan paylaş". Paylaşım metni
// yalnız tur, tarih, saat ve buluşma yerini içerir; ad, e-posta, telefon, referans ve
// bilet bağlantısı paylaşılmaz.
import { CalendarPlus, Share2 } from "lucide-react";
import { localPath, useLang } from "../lib/i18n";
import { dateLabel, type Reservation, type Tour } from "../lib/types";

const pad = (n: number) => String(n).padStart(2, "0");
// Türkiye yıl boyu UTC+3'tür; takvim saatleri UTC olarak yazılır.
const utcStamp = (ms: number) => {
  const d = new Date(ms);
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    "00Z"
  );
};
const at = (date: string, time: string) =>
  Date.parse(`${date}T${time}:00+03:00`);
const addDays = (date: string, days: number) => {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
// Dönüş: süredeki gün sayısı ("3 gün · 2 gece") ve dönüş metnindeki saat ("2. gün 23:50").
// Saat yazmıyorsa ("Akşam", "Gece") son gün 21:00 sayılır.
function endOf(tour: Tour | undefined, date: string, start: number) {
  const days = Number(/(\d+)\s*gün/i.exec(tour?.duration || "")?.[1]) || 1,
    time = /(\d{1,2})[:.](\d{2})/.exec(tour?.end || ""),
    last = addDays(date, days - 1);
  let end = time
    ? at(last, `${pad(Number(time[1]))}:${time[2]}`)
    : at(last, "21:00");
  // Gece yarısından sonraki dönüş ("4. günün gecesi 03:00") ertesi güne düşer.
  if (time && days > 1 && Number(time[1]) < 6) end += 86400000;
  return Number.isFinite(end) && end > start ? end : start + 10 * 3600000;
}
const icsText = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
// RFC 5545: satırlar 75 baytı geçmez; devam satırı boşlukla başlar.
// Türkçe harfler UTF-8'de 2 bayt olduğundan bayt sayılır.
const fold = (line: string) => {
  const out: string[] = [];
  let part = "",
    bytes = 0;
  for (const ch of line) {
    const size = new TextEncoder().encode(ch).length;
    if (bytes + size > 73) {
      out.push(part);
      part = "";
      bytes = 0;
    }
    part += ch;
    bytes += size;
  }
  out.push(part);
  return out.join("\r\n ");
};
export function calendarFile(
  r: Reservation,
  tour: Tour | undefined,
  tourName: string,
) {
  const start = at(r.date, r.start_time || "09:00"),
    end = endOf(tour, r.date, start),
    description = [
      `Referans: ${r.reference}`,
      `Hareket: ${r.start_time || ""}`,
      r.pickup ? `Buluşma: ${r.pickup}` : "",
      r.seats.length ? `Koltuk: ${r.seats.join(", ")}` : "",
      "Rezervasyon belgeniz: rotakarsturizm.com/rezervasyonum",
    ]
      .filter(Boolean)
      .join("\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rota Kars Turizm//Bilet//TR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${r.reference}@rotakarsturizm.com`,
    `DTSTAMP:${utcStamp(Date.now())}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(end)}`,
    `SUMMARY:${icsText("Rota Kars · " + tourName)}`,
    r.pickup ? `LOCATION:${icsText(r.pickup)}` : "",
    `DESCRIPTION:${icsText(description)}`,
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText("Yarın turunuz var: " + tourName)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .map(fold)
    .join("\r\n");
}
export function TicketActions({
  reservation: r,
  tour,
}: {
  reservation: Reservation;
  tour: Tour | undefined;
}) {
  const { t, lang } = useLang();
  const name = tour?.name || r.tourId;
  function addToCalendar() {
    const url = URL.createObjectURL(
      new Blob([calendarFile(r, tour, name)], {
        type: "text/calendar;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `rota-kars-${r.reference}.ics`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const text =
    t(
      "Rota Kars Turizm ile {tour} turuna katılıyorum: {date}, hareket {time}.",
      {
        tour: name,
        date: dateLabel(r.date),
        time: r.start_time || "",
      },
    ) +
    (r.pickup ? " " + t("Buluşma: {pickup}.", { pickup: r.pickup }) : "") +
    "\n" +
    window.location.origin +
    localPath(lang, "/turlar/" + r.tourId);
  return (
    <div className="ticket-actions">
      <button
        type="button"
        className="btn btn-outline btn-small"
        onClick={addToCalendar}
      >
        <CalendarPlus size={16} aria-hidden="true" /> {t("Takvime ekle")}
      </button>
      <a
        className="btn btn-outline btn-small"
        href={"https://wa.me/?text=" + encodeURIComponent(text)}
        target="_blank"
        rel="noreferrer"
      >
        <Share2 size={16} aria-hidden="true" /> {t("WhatsApp'tan paylaş")}
      </a>
    </div>
  );
}
