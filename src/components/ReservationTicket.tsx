// Ön rezervasyon belgesi: rezervasyon sonunda ve "Rezervasyonum" sayfasında kullanılır.
// Hatıra kartının arka yüzü gibi: solda durum ve ödeme, sağda pul, damga ve adres satırları.
import { Info } from "lucide-react";
import { responsive } from "../lib/images";
import { placeName } from "../lib/place";
import { Postmark } from "./Postmark";
import { useLang } from "../lib/i18n";
import {
  currency,
  dateLabel,
  type Catalog,
  type Reservation,
} from "../lib/types";
const statusLabels: Record<string, string> = {
  pending_agency: "Acente onayı bekliyor",
  confirmed: "Onaylı rezervasyon",
  completed: "Tur tamamlandı",
  cancelled: "İptal edildi",
  expired: "Süresi doldu",
};
// Biletin üst satırı: Rota Kars logosu ve site adresi. Ekranda, yazdırılan/PDF
// bilette ve QR doğrulama sayfasında aynı görünür (yazdırmada site başlığı gizlenir).
export function TicketBrand() {
  return (
    <div className="ticket-brand">
      <img src="/images/logo.png" alt="Rota Kars Turizm" width="110" height="40" />
      <span>rotakarsturizm.com</span>
    </div>
  );
}
// Kartın köşesine basılmış lastik damga: onaylıysa kırmızı, beklerken lacivert,
// iptal ve süre dolumunda soluk mürekkep.
export function StatusStamp({ status }: { status: string }) {
  const { t } = useLang();
  const tone = ["confirmed", "completed"].includes(status)
    ? "is-ok"
    : status === "pending_agency"
      ? "is-pending"
      : "is-void";
  return (
    <span className={"status-stamp " + tone}>
      {statusLabels[status] ? t(statusLabels[status]) : status}
    </span>
  );
}
export function ReservationTicket({
  reservation: r,
  catalog,
}: {
  reservation: Reservation;
  catalog: Catalog;
}) {
  const { t } = useLang();
  const tour = catalog.tours.find((x) => x.id === r.tourId);
  return (
    <article className="reservation-ticket">
      <div className="ticket-message">
        <TicketBrand />
        <StatusStamp status={r.status} />
        <h2>{tour?.name || r.tourId}</h2>
        <div className="ticket-reference">
          <span>{t("Referans numarası")}</span>
          <strong>{r.reference}</strong>
        </div>
        {Boolean(r.discount_amount) && (
          <p className="ticket-discount">
            {t("Üyelik indirimi: −{discount} · İndirim sonrası {total}", {
              discount: currency(r.discount_amount || 0),
              total: currency(r.total),
            })}
          </p>
        )}
        <div className="ticket-data">
          <div>
            <span>{t("Toplam tur bedeli")}</span>
            <strong>{currency(r.total)}</strong>
          </div>
          <div>
            <span>{t("Tercih edilen ilk ödeme")}</span>
            <strong>{currency(r.deposit)}</strong>
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
                  "Kodu okutan güncel onay durumunu görür. Binişte rehberimiz de bu kodu okutur.",
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
          {tour && (
            <div className="kp-stamp ticket-stamp">
              <div className="ticket-stamp-face">
                <img {...responsive(tour.image, "160px")} alt="" />
                <span>
                  {placeName(tour)}
                  <b>{currency(r.total)}</b>
                </span>
              </div>
            </div>
          )}
          <Postmark
            date={r.date}
            time={r.start_time}
            label={t("Tur tarihi {date}, {time}", {
              date: dateLabel(r.date),
              time: String(r.start_time),
            })}
          />
        </div>
        <dl className="ticket-lines">
          <div>
            <dt>{t("Tur tarihi")}</dt>
            <dd>
              {dateLabel(r.date)} · {r.start_time}
            </dd>
          </div>
          <div>
            <dt>{t("Yolcular")}</dt>
            <dd>{r.passengers.join(", ")}</dd>
          </div>
          <div>
            <dt>{t("Koltuklar")}</dt>
            <dd>{r.seats.join(", ")}</dd>
          </div>
          <div>
            <dt>{t("Buluşma")}</dt>
            <dd>{r.pickup}</dd>
          </div>
          {r.transfer && (
            <div>
              <dt>{t("Transfer")}</dt>
              <dd>
                {t(r.transfer.pointLabel)} · {t(r.transfer.directionLabel)}
                {r.transfer.info ? ` · ${r.transfer.info}` : ""} · {currency(r.transfer.amount)}
              </dd>
            </div>
          )}
        </dl>
      </div>
      <div className="ticket-bottom">
        <Info size={16} />
        <p>
          {r.status === "confirmed" || r.status === "completed"
            ? t(
                "Rezervasyonunuz onaylandı. Güncel ödeme ve hareket bilgileri yukarıda.",
              )
            : t(
                "Bu bir ön rezervasyondur; kapora ödenip onaylanınca biletiniz geçerli olur. Ödemesi kaydedilmeyen ön rezervasyonlar 24 saat sonra düşer. Referansınızı ve e-posta adresinizi saklayın.",
              )}
        </p>
      </div>
    </article>
  );
}
