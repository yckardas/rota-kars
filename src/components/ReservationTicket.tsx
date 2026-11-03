// Ön rezervasyon belgesi: rezervasyon sonunda ve "Rezervasyonum" sayfasında kullanılır.
// Hatıra kartının arka yüzü gibi: solda durum ve ödeme, sağda pul, damga ve adres satırları.
import { Info } from "lucide-react";
import { responsive } from "../lib/images";
import { placeName } from "../lib/place";
import { Postmark } from "./Postmark";
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
// Kartın köşesine basılmış lastik damga: onaylıysa kırmızı, beklerken lacivert,
// iptal ve süre dolumunda soluk mürekkep.
export function StatusStamp({ status }: { status: string }) {
  const tone = ["confirmed", "completed"].includes(status)
    ? "is-ok"
    : status === "pending_agency"
      ? "is-pending"
      : "is-void";
  return (
    <span className={"status-stamp " + tone}>
      {statusLabels[status] || status}
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
  const t = catalog.tours.find((t) => t.id === r.tourId);
  return (
    <article className="reservation-ticket">
      <div className="ticket-message">
        <StatusStamp status={r.status} />
        <h2>{t?.name || r.tourId}</h2>
        <div className="ticket-reference">
          <span>Referans numarası</span>
          <strong>{r.reference}</strong>
        </div>
        {Boolean(r.discount_amount) && (
          <p className="ticket-discount">
            Üyelik indirimi: −{currency(r.discount_amount || 0)} · İndirim
            sonrası {currency(r.total)}
          </p>
        )}
        <div className="ticket-data">
          <div>
            <span>Toplam tur bedeli</span>
            <strong>{currency(r.total)}</strong>
          </div>
          <div>
            <span>Tercih edilen ilk ödeme</span>
            <strong>{currency(r.deposit)}</strong>
          </div>
          <div>
            <span>Net tahsilat</span>
            <strong>{currency(r.net_paid || 0)}</strong>
          </div>
          <div>
            <span>Kalan ödeme</span>
            <strong>{currency(r.balance_due ?? r.total)}</strong>
          </div>
        </div>
        {r.qrDataUrl && (
          <div className="ticket-qr">
            <img
              src={r.qrDataUrl}
              alt="Rezervasyon doğrulama QR kodu"
              width="164"
              height="164"
            />
            <div>
              <strong>Rezervasyon belgeniz</strong>
              <p>
                Kodu okutan güncel onay durumunu görür. Binişte rehberimiz de bu
                kodu okutur.
              </p>
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
      </div>
      <div className="ticket-divider" aria-hidden="true" />
      <div className="ticket-address">
        <div className="ticket-stamp-row">
          {t && (
            <div className="kp-stamp ticket-stamp">
              <div className="ticket-stamp-face">
                <img {...responsive(t.image, "160px")} alt="" />
                <span>
                  {placeName(t)}
                  <b>{currency(r.total)}</b>
                </span>
              </div>
            </div>
          )}
          <Postmark
            date={r.date}
            time={r.start_time}
            label={`Tur tarihi ${dateLabel(r.date)}, ${r.start_time}`}
          />
        </div>
        <dl className="ticket-lines">
          <div>
            <dt>Tur tarihi</dt>
            <dd>
              {dateLabel(r.date)} · {r.start_time}
            </dd>
          </div>
          <div>
            <dt>Yolcular</dt>
            <dd>{r.passengers.join(", ")}</dd>
          </div>
          <div>
            <dt>Koltuklar</dt>
            <dd>{r.seats.join(", ")}</dd>
          </div>
          <div>
            <dt>Buluşma</dt>
            <dd>{r.pickup}</dd>
          </div>
        </dl>
      </div>
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
