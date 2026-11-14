// Tur sayfasında "Yolculuğunuza ekleyin": transfer seçenekleri ve fiyatları (grup
// başına toplam, kişi sayısına göre). Rezervasyonun yolcu adımında sepete eklenir.
import { ArrowRight, Bus, Plane, TrainFront } from "lucide-react";
import { Link, useLang } from "../lib/i18n";
import { currency } from "../lib/types";
import {
  TRANSFER_POINTS,
  TRANSFER_TIERS,
  offersTransfer,
  type TransferConfig,
} from "../lib/transfer";

const pointIcons = { airport: Plane, bus: Bus, train: TrainFront };

export function TransferOffer({ tourId, config }: { tourId: string; config?: TransferConfig }) {
  const { t } = useLang();
  if (!config || !offersTransfer(config)) return null;
  const points = TRANSFER_POINTS.filter((p) => TRANSFER_TIERS.some((tier) => config.oneWay[p.id][tier.id] || config.roundTrip[p.id][tier.id]));
  return (
    <section className="tour-extra transfer-offer" aria-labelledby="transfer-offer-title">
      <h2 id="transfer-offer-title">{t("Sizi kapıdan alalım.")}</h2>
      <p className="muted">
        {t("Havalimanı, otogar ya da gardan tur buluşmasına, dönüşte de geri. Fiyat grubunuzun toplamıdır; rezervasyonda ekleyebilirsiniz.")}
      </p>
      <div className="transfer-offer-table" role="table" aria-label={t("Tek yön transfer fiyatları")}>
        <div role="row" className="transfer-offer-head">
          <span role="columnheader">{t("Tek yön")}</span>
          {TRANSFER_TIERS.map((tier) => (
            <span role="columnheader" key={tier.id}>
              {t(tier.label)}
            </span>
          ))}
        </div>
        {points.map((p) => {
          const Icon = pointIcons[p.id];
          return (
            <div role="row" key={p.id}>
              <span role="rowheader">
                <Icon size={17} strokeWidth={1.6} /> {t(p.label)}
              </span>
              {TRANSFER_TIERS.map((tier) => {
                const price = config.oneWay[p.id][tier.id];
                return (
                  <span role="cell" key={tier.id} className={price ? "price" : "muted"}>
                    {price ? currency(price) : "—"}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
      <Link className="text-link" to={"/rezervasyon/" + tourId}>
        {t("Tarih seçip transfer ekleyin")} <ArrowRight size={15} />
      </Link>
    </section>
  );
}
