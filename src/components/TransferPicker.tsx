// Rezervasyonun yolcu adımında isteğe bağlı transfer: havalimanı, otogar veya gardan
// tur buluşmasına (geliş), turdan noktaya (dönüş) ya da gidiş-dönüş. Fiyat grubun
// tamamı içindir ve kişi sayısına göre değişir; kesin tutarı sunucu hesaplar.
import { Plane, Bus, TrainFront } from "lucide-react";
import { useLang } from "../lib/i18n";
import { currency } from "../lib/types";
import {
  TRANSFER_DIRECTIONS,
  TRANSFER_POINTS,
  tierFor,
  transferPrice,
  type TransferChoice,
  type TransferConfig,
  type TransferPointId,
} from "../lib/transfer";

const pointIcons = { airport: Plane, bus: Bus, train: TrainFront };

export function TransferPicker({
  config,
  count,
  value,
  onChange,
}: {
  config: TransferConfig;
  count: number;
  value: TransferChoice | null;
  onChange: (v: TransferChoice | null) => void;
}) {
  const { t } = useLang();
  const priceOf = (point: TransferPointId, direction = value?.direction || "arrival") =>
    transferPrice(config, point, direction, count);
  function enable(on: boolean) {
    if (!on) return onChange(null);
    // İlk fiyatlı seçenek önerilir (önce geliş, yoksa diğer yönler).
    for (const direction of ["arrival", "departure", "both"] as const)
      for (const p of TRANSFER_POINTS)
        if (transferPrice(config, p.id, direction, count))
          return onChange({ point: p.id, direction, info: "" });
  }
  return (
    <fieldset className={"transfer-picker" + (value ? " is-on" : "")}>
      <legend className="sr-only">{t("Transfer")}</legend>
      <label className="transfer-toggle">
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => enable(e.target.checked)} />
        <span>
          <strong>{t("Transfer ekleyin")}</strong>
          <small>
            {t("Havalimanı, otogar ya da gardan sizi alalım. Fiyat {tier} grubunuzun toplamıdır.", {
              tier: t(tierFor(count).label),
            })}
          </small>
        </span>
      </label>
      {value && (
        <div className="transfer-options">
          <div className="transfer-points" role="radiogroup" aria-label={t("Karşılama noktası")}>
            {TRANSFER_POINTS.map((p) => {
              const price = priceOf(p.id),
                Icon = pointIcons[p.id];
              return (
                <label key={p.id} className={"transfer-point" + (price ? "" : " is-unavailable")}>
                  <input
                    type="radio"
                    name="transfer-point"
                    checked={value.point === p.id}
                    disabled={!price}
                    onChange={() => onChange({ ...value, point: p.id })}
                  />
                  <Icon size={18} strokeWidth={1.6} />
                  <span>{t(p.label)}</span>
                  <b>{price ? currency(price) : t("Yok")}</b>
                </label>
              );
            })}
          </div>
          <div className="transfer-directions" role="radiogroup" aria-label={t("Transfer yönü")}>
            {TRANSFER_DIRECTIONS.map((d) => {
              const price = priceOf(value.point, d.id);
              return (
                <label key={d.id} className={"transfer-direction" + (price ? "" : " is-unavailable")}>
                  <input
                    type="radio"
                    name="transfer-direction"
                    checked={value.direction === d.id}
                    disabled={!price}
                    onChange={() => onChange({ ...value, direction: d.id })}
                  />
                  <span>{t(d.label)}</span>
                </label>
              );
            })}
          </div>
          <label className="field">
            {t("Uçuş / sefer bilgisi ve saati (isteğe bağlı)")}
            <input
              value={value.info}
              maxLength={160}
              placeholder={t("Örn. TK2690 · 10:40 varış")}
              onChange={(e) => onChange({ ...value, info: e.target.value })}
            />
          </label>
        </div>
      )}
    </fieldset>
  );
}
