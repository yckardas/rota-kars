import { localeOf } from "../lib/i18n";
// Hatıra kartı dünyasının posta damgası: iki halka, üstte yer, ortada tarih ve saat.
// Tarih "2026-11-06" biçiminde gelir, damgada "06 KAS 26" olarak basılır.
export const postmarkDate = (iso: string) =>
  new Date(iso + "T12:00:00")
    .toLocaleDateString(localeOf(), {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    })
    .replace(/\./g, "")
    .toLocaleUpperCase(localeOf());
export function Postmark({
  date,
  time,
  place = "KARS",
  label,
  className = "kp-postmark",
}: {
  date: string;
  time?: string;
  place?: string;
  label: string;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 132 132"
      role="img"
      aria-label={label}
    >
      <circle cx="66" cy="66" r="60" />
      <circle cx="66" cy="66" r="42" />
      <text x="66" y="22" textAnchor="middle" className="kp-pm-ring">
        {place}
      </text>
      <text x="66" y="64" textAnchor="middle" className="kp-pm-date">
        {postmarkDate(date)}
      </text>
      {time && (
        <text x="66" y="84" textAnchor="middle" className="kp-pm-time">
          {time}
        </text>
      )}
    </svg>
  );
}
