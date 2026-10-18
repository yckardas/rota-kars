// Ön rezervasyon belgesi: rezervasyon sonunda ve "Rezervasyonum" sayfasında kullanılır.
import { Info, Ticket } from "lucide-react";
import {
  currency,
  dateLabel,
  type Catalog,
  type Reservation,
} from "../lib/types";
export function ReservationTicket({
  reservation: r,
  catalog,
}: {
  reservation: Reservation;
  catalog: Catalog;
}) {
  const t = catalog.tours.find((t) => t.id === r.tourId);
  return (
    <article className="reservation-ticket">
      <div className="ticket-top">
        <span>
          <Ticket size={22} /> Rota Kars
        </span>
        <span
          className={
            "status-tag " + (r.status === "pending_agency" ? "" : "inactive")
          }
        >
          {r.status === "pending_agency"
            ? "Acente onayı bekliyor"
            : r.status === "cancelled"
              ? "İptal edildi"
              : r.status === "expired"
                ? "Süresi doldu"
                : r.status === "confirmed"
                  ? "Onaylı rezervasyon"
                  : r.status === "completed"
                    ? "Tur tamamlandı"
                    : r.status}
        </span>
      </div>
      <h2>{t?.name || r.tourId}</h2>
      {Boolean(r.discount_amount) && (
        <p className="ticket-discount">
          Üyelik indirimi: −{currency(r.discount_amount || 0)} · İndirim sonrası{" "}
          {currency(r.total)}
        </p>
      )}
      <div className="ticket-data">
        <div>
          <span>Referans numarası</span>
          <strong>{r.reference}</strong>
        </div>
        <div>
          <span>Tur tarihi</span>
          <strong>{dateLabel(r.date)}</strong>
        </div>
        <div>
          <span>Koltuklar</span>
          <strong>{r.seats.join(", ")}</strong>
        </div>
        <div>
          <span>Yolcular</span>
          <strong>{r.passengers.join(", ")}</strong>
        </div>
        <div>
          <span>Toplam tur bedeli</span>
          <strong>{currency(r.total)}</strong>
        </div>
        <div>
          <span>Tercih edilen ilk ödeme</span>
          <strong>{currency(r.deposit)}</strong>
        </div>
      </div>
      <div className="ticket-data">
        <div>
          <span>Net tahsilat</span>
          <strong>{currency(r.net_paid || 0)}</strong>
        </div>
        <div>
          <span>Kalan ödeme</span>
          <strong>{currency(r.balance_due ?? r.total)}</strong>
        </div>
        <div>
          <span>Hareket / buluşma</span>
          <strong>
            {r.start_time} · {r.pickup}
          </strong>
        </div>
      </div>
      {r.qrDataUrl && (
        <div className="ticket-qr">
          <img
            src={r.qrDataUrl}
            alt="Rezervasyon doğrulama QR kodu"
            width="150"
            height="150"
          />
          <div>
            <strong>Rezervasyon belgeniz</strong>
            <p>QR kodu okutarak güncel onay durumunu görebilirsiniz.</p>
            <a
              className="text-link"
              href={r.ticketUrl}
              target="_blank"
              rel="noreferrer"
            >
              Belgeyi doğrula
            </a>
            <button className="text-link" onClick={() => window.print()}>
              Yazdır / PDF kaydet
            </button>
          </div>
        </div>
      )}
      <div className="ticket-bottom">
        <Info size={16} />
        <p>
          {r.status === "confirmed" || r.status === "completed"
            ? "Rezervasyonunuz acente tarafından onaylanmıştır. Güncel ödeme ve hareket bilgileri yukarıdadır."
            : "Ön rezervasyon kesin bilet değildir. Tahsilat kaydedilmemiş ve onaylanmamış talepler 24 saat sonra serbest kalır. Referansınızı ve e-posta adresinizi saklayın."}
        </p>
      </div>
    </article>
  );
}
