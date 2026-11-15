// Rezervasyonun yolcu adımında isteğe bağlı transfer: havalimanı, otogar veya tren garından
// Kars merkezdeki ya da Sarıkamış'taki konaklama yerine (geliş), konaklama yerinden noktaya
// (dönüş) ya da gidiş-dönüş. Fiyat grubun tamamı içindir ve kişi sayısına göre değişir;
// kesin tutarı sunucu hesaplar.
import { useEffect } from "react";
import { Plane, Bus, TrainFront, BedDouble } from "lucide-react";
import { useLang } from "../lib/i18n";
import { currency } from "../lib/types";
import {
  TRANSFER_DESTINATIONS,
  TRANSFER_DIRECTIONS,
  TRANSFER_POINTS,
  destinationOffered,
  tierFor,
  transferPrice,
  type TransferChoice,
  type TransferConfig,
  type TransferDestinationId,
  type TransferDirection,
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
  const tier = tierFor(count);
  // 15 kişiden kalabalık grupta transfer kademesi yok: seçim kaldırılır.
  useEffect(() => {
    if (value && !tier) onChange(null);
  }, [value, tier, onChange]);
  const priceOf = (
    point: TransferPointId,
    destination: TransferDestinationId = value?.destination || "kars",
    direction: TransferDirection = value?.direction || "arrival",
  ) => transferPrice(config, destination, point, direction, count);
  const destinations = TRANSFER_DESTINATIONS.filter((d) =>
    destinationOffered(config, d.id),
  );
  // İlk fiyatlı seçenek önerilir (önce istenen varış yeri ve geliş, yoksa diğerleri).
  function firstPriced(
    prefer: TransferDestinationId = "kars",
  ): TransferChoice | null {
    const order = [
      prefer,
      ...TRANSFER_DESTINATIONS.map((d) => d.id).filter((id) => id !== prefer),
    ];
    for (const destination of order)
      for (const direction of ["arrival", "departure", "both"] as const)
        for (const p of TRANSFER_POINTS)
          if (transferPrice(config, destination, p.id, direction, count))
            return {
              point: p.id,
              destination,
              direction,
              info: value?.info || "",
            };
    return null;
  }
  function chooseDestination(destination: TransferDestinationId) {
    if (!value) return;
    // Aynı nokta ve yön yeni varış yerinde de fiyatlıysa korunur.
    if (priceOf(value.point, destination, value.direction))
      onChange({ ...value, destination });
    else onChange(firstPriced(destination));
  }
  return (
    <fieldset className={"transfer-picker" + (value ? " is-on" : "")}>
      <legend className="sr-only">{t("Transfer")}</legend>
      <label className="transfer-toggle">
        <input
          type="checkbox"
          checked={Boolean(value)}
          disabled={!tier}
          onChange={(e) => onChange(e.target.checked ? firstPriced() : null)}
        />
        <span>
          <strong>{t("Transfer ekleyin")}</strong>
          <small>
            {tier
              ? t(
                  "Havalimanı, otogar ya da tren garından konaklama yerinize götürelim. Fiyat {tier} grubunuzun toplamıdır.",
                  { tier: t(tier.label) },
                )
              : t(
                  "15 kişiden kalabalık gruplar için transferi acenteyle planlayalım; bizi arayın.",
                )}
          </small>
        </span>
      </label>
      {value && (
        <div className="transfer-options">
          {destinations.length > 1 && (
            <div
              className="transfer-directions"
              role="radiogroup"
              aria-label={t("Konaklama yeri")}
            >
              {destinations.map((d) => (
                <label key={d.id} className="transfer-direction">
                  <input
                    type="radio"
                    name="transfer-destination"
                    checked={value.destination === d.id}
                    onChange={() => chooseDestination(d.id)}
                  />
                  <BedDouble size={16} strokeWidth={1.6} />
                  <span>{t(d.label)}</span>
                </label>
              ))}
            </div>
          )}
          <div
            className="transfer-points"
            role="radiogroup"
            aria-label={t("Karşılama noktası")}
          >
            {TRANSFER_POINTS.map((p) => {
              const price = priceOf(p.id),
                Icon = pointIcons[p.id];
              return (
                <label
                  key={p.id}
                  className={
                    "transfer-point" + (price ? "" : " is-unavailable")
                  }
                >
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
          <div
            className="transfer-directions"
            role="radiogroup"
            aria-label={t("Transfer yönü")}
          >
            {TRANSFER_DIRECTIONS.map((d) => {
              const price = priceOf(value.point, value.destination, d.id);
              return (
                <label
                  key={d.id}
                  className={
                    "transfer-direction" + (price ? "" : " is-unavailable")
                  }
                >
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
            {t(
              "Uçuş / sefer bilgisi, saati ve konaklama yeriniz (isteğe bağlı)",
            )}
            <input
              value={value.info}
              maxLength={160}
              placeholder={t("Örn. TK2690 · 10:40 varış · Otel adı")}
              onChange={(e) => onChange({ ...value, info: e.target.value })}
            />
          </label>
        </div>
      )}
    </fieldset>
  );
}
