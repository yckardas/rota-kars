// Online transfer belgesi (Rezervasyonum ve ödeme sonrası): tur biletiyle aynı hatıra
// kartı düzeni; koltuk yerine geliş / dönüş bacakları, kişi, bagaj ve adres.
import { Info } from "lucide-react";
import { Postmark } from "./Postmark";
import { StatusStamp, TicketBrand } from "./ReservationTicket";
import { useLang } from "../lib/i18n";
import { TRANSFER_POINTS, transferRoute } from "../lib/transfer";
import { currency, dateLabel, type Reservation } from "../lib/types";

export function TransferTicket({
  reservation: r,
}: {
  reservation: Reservation;
}) {
  const { t } = useLang();
  const b = r.transfer_booking;
  if (!b) return null;
  const people = (n: number) =>
      n === 1 ? t("1 kişi") : t("{count} kişi", { count: n }),
    bagText = (n: number) =>
      n === 0
        ? t("Bagaj yok")
        : n === 1
          ? t("1 bagaj")
          : t("{count} bagaj", { count: n });
  const point = t(
      TRANSFER_POINTS.find((p) => p.id === b.point)?.label || b.point,
    ),
    confirmed = r.status === "confirmed" || r.status === "completed";
  return (
    <article className="reservation-ticket transfer-ticket">
      <div className="ticket-message">
        <TicketBrand />
        <StatusStamp status={r.status} />
        <h2>{t("VIP transfer")}</h2>
        <p className="muted">{transferRoute(b, t)}</p>
        <div className="ticket-reference">
          <span>{t("Referans numarası")}</span>
          <strong>{r.reference}</strong>
        </div>
        <div className="ticket-data">
          <div>
            <span>{t("Transfer bedeli")}</span>
            <strong>{currency(r.total)}</strong>
          </div>
          <div>
            <span>{t("Ödeme")}</span>
            <strong>{t("Tam ödeme")}</strong>
          </div>
          <div>
            <span>{t("Net tahsilat")}</span>
            <strong>{currency(r.net_paid || 0)}</strong>
          </div>
          <div>
            <span>{t("Kalan ödeme")}</span>
            <strong>{currency(r.balance_due ?? r.total)}</strong>
          </div>
        </div>
        {r.qrDataUrl && (
          <div className="ticket-qr">
            <img
              src={r.qrDataUrl}
              alt={t("Rezervasyon doğrulama QR kodu")}
              width="164"
              height="164"
            />
            <div>
              <strong>{t("Rezervasyon belgeniz")}</strong>
              <p>
                {t(
                  "Kodu okutan güncel onay durumunu görür. Şoförümüz alınışta bu kodu okutabilir.",
                )}
              </p>
              <a
                className="text-link"
                href={r.ticketUrl}
                target="_blank"
                rel="noreferrer"
              >
                {t("Belgeyi doğrula")}
              </a>
              <button className="text-link" onClick={() => window.print()}>
                {t("Yazdır / PDF kaydet")}
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="ticket-divider" aria-hidden="true" />
      <div className="ticket-address">
        <div className="ticket-stamp-row">
          <Postmark
            date={r.date}
            time={r.start_time}
            label={t("Transfer tarihi {date}, {time}", {
              date: dateLabel(r.date),
              time: String(r.start_time),
            })}
          />
        </div>
        <dl className="ticket-lines">
          {b.legs.map((l) => (
            <div key={l.type}>
              <dt>{l.type === "arrival" ? t("Geliş") : t("Dönüş")}</dt>
              <dd>
                {dateLabel(l.date)} · {l.time} ·{" "}
                {l.type === "arrival"
                  ? `${point} → ${b.address}`
                  : `${b.address} → ${point}`}
                {l.flight ? ` · ${l.flight}` : ""}
              </dd>
            </div>
          ))}
          <div>
            <dt>{t("Yolcu")}</dt>
            <dd>
              {people(r.pax || 1)} · {bagText(b.bags)}
            </dd>
          </div>
          <div>
            <dt>{t("İrtibat")}</dt>
            <dd>
              {r.name} · {r.phone}
            </dd>
          </div>
          {r.notes && (
            <div>
              <dt>{t("Not")}</dt>
              <dd>{r.notes}</dd>
            </div>
          )}
        </dl>
      </div>
      <div className="ticket-bottom">
        <Info size={16} />
        <p>
          {confirmed
            ? t(
                "Transferiniz onaylandı. Uçuş veya sefer saatiniz ya da adresiniz değişirse bizi en kısa sürede arayın.",
              )
            : t(
                "Ödeme tamamlanınca transferiniz onaylanır. Ödemesi tamamlanmayan kayıt en geç 24 saat sonra düşer. Referansınızı ve e-posta adresinizi saklayın.",
              )}
        </p>
      </div>
    </article>
  );
}
