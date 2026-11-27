// Talep toplayan tarihler (tur detayı): her tarih için tahmini fiyat, ilerleme açıksa
// "kaç kişi hazır" çubuğu, kaç kişi gerektiği, kararın en geç verileceği gün ve o tarihe
// ön kayıt düğmesi. Uzun listede ilk dört tarih görünür.
import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { useLang } from "../lib/i18n";
import { currency, dateLabel, hasPrice, type DemandDate } from "../lib/types";

const FIRST = 4;

export function DemandDates({
  title,
  dates,
  threshold,
  onPick,
}: {
  title: string;
  dates: DemandDate[];
  threshold: number;
  onPick: (id: string) => void;
}) {
  const { t } = useLang(),
    [all, setAll] = useState(false),
    shown = all ? dates : dates.slice(0, FIRST);
  return (
    <div className="demand-dates">
      <h3>
        <CalendarDays size={17} aria-hidden="true" /> {title}
      </h3>
      <ul>
        {shown.map((d) => (
          <li key={d.id}>
            <div className="demand-date-head">
              <strong>
                {dateLabel(d.date)} · {d.start_time}
              </strong>
              <span>{hasPrice(d.price) ? t("tahmini {price}", { price: currency(d.price) }) : t("Fiyat için arayın")}</span>
            </div>
            <button type="button" className="btn btn-small btn-outline" onClick={() => onPick(d.id)}>
              {t("Ön kayıt")}
            </button>
            {d.count !== undefined && (
              <div className="demand-progress">
                <span>
                  {t("{count} / {threshold} kişi hazır", {
                    count: Math.min(d.count, threshold),
                    threshold,
                  })}
                </span>
                <progress max={threshold} value={Math.min(d.count, threshold)} />
              </div>
            )}
            <p className="demand-date-rule">
              {d.count !== undefined
                ? d.decisionDate &&
                  t("Karar en geç {date}", { date: dateLabel(d.decisionDate) })
                : d.decisionDate
                  ? t("En az {threshold} kişi gerekli · karar en geç {date}", {
                      threshold,
                      date: dateLabel(d.decisionDate),
                    })
                  : t("En az {threshold} kişi gerekli", { threshold })}
            </p>
          </li>
        ))}
      </ul>
      {dates.length > FIRST && (
        <button type="button" className="text-link demand-dates-more" onClick={() => setAll(!all)}>
          {all ? t("Daha az göster") : t("Tüm tarihler ({n})", { n: dates.length })}
        </button>
      )}
    </div>
  );
}
