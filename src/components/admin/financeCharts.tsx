import { currency } from "../../lib/types";

// Finans paneli grafikleri: kütüphanesiz, CSS ile çizilir; dar ekranda sıkışır, kaymaz.

const pct = (v: number, max: number) => (max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0);

// Dilim başına yan yana iki çubuk (ör. ciro ve tahsilat). Etiketler kalabalıksa seyreltilir.
export function BarPairs({
  data,
  aLabel,
  bLabel,
}: {
  data: { key: string; label: string; a: number; b: number }[];
  aLabel: string;
  bLabel: string;
}) {
  const max = Math.max(0, ...data.map((d) => Math.max(d.a, d.b)));
  const every = Math.max(1, Math.ceil(data.length / 10));
  return (
    <figure className="finance-chart">
      <div className="finance-legend">
        <span className="swatch a" /> {aLabel}
        <span className="swatch b" /> {bLabel}
      </div>
      <div className="finance-bars" role="img" aria-label={`${aLabel} ve ${bLabel} grafiği`}>
        {data.map((d, i) => (
          <div key={d.key} className="finance-bar-col" title={`${d.label}\n${aLabel}: ${currency(d.a)}\n${bLabel}: ${currency(d.b)}`}>
            <div className="finance-bar-pair">
              <span className="bar a" style={{ height: pct(d.a, max) + "%" }} />
              <span className="bar b" style={{ height: pct(d.b, max) + "%" }} />
            </div>
            <small className={(i / every) % 2 ? "alt" : ""}>{i % every === 0 ? d.label : ""}</small>
          </div>
        ))}
      </div>
    </figure>
  );
}

// Tek seri gün çubukları (beklenen ödemeler); seçili gün vurgulanır.
export function DayBars({
  data,
  selected,
  onSelect,
}: {
  data: { key: string; label: string; value: number; count: number }[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  const max = Math.max(0, ...data.map((d) => d.value));
  const every = Math.max(1, Math.ceil(data.length / 10));
  return (
    <div className="finance-bars compact">
      {data.map((d, i) => (
        <button
          key={d.key}
          type="button"
          className={"finance-bar-col" + (selected === d.key ? " selected" : "")}
          title={`${d.label}: ${currency(d.value)} · ${d.count} kayıt`}
          aria-label={`${d.label}: ${currency(d.value)}, ${d.count} kayıt`}
          aria-pressed={selected === d.key}
          onClick={() => onSelect(selected === d.key ? "" : d.key)}
        >
          <div className="finance-bar-pair">
            <span className="bar c" style={{ height: pct(d.value, max) + "%" }} />
          </div>
          <small className={(i / every) % 2 ? "alt" : ""}>{i % every === 0 ? d.label : ""}</small>
        </button>
      ))}
    </div>
  );
}

// Yatay çubuklar: etiket, çubuk, değer. "estimate" çizgili gösterilir (tahmini tutar).
export function HBars({
  rows,
}: {
  rows: { key: string; label: string; value: number; sub?: string; estimate?: boolean; fill?: number }[];
}) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  return (
    <ul className="finance-hbars">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="finance-hbar-head">
            <strong>{r.label}</strong>
            <span>
              {r.estimate && r.value > 0 ? "~" : ""}
              {currency(r.value)}
            </span>
          </div>
          <div className={"finance-hbar" + (r.estimate ? " estimate" : "")}>
            <span style={{ width: pct(r.value, max) + "%" }} />
            {r.fill != null && <i style={{ width: pct(r.fill, max) + "%" }} />}
          </div>
          {r.sub && <small>{r.sub}</small>}
        </li>
      ))}
    </ul>
  );
}

// Tek yığılmış çubuk + açıklama (ödeme yöntemleri).
export function StackBar({ parts }: { parts: { key: string; label: string; value: number; tone: string }[] }) {
  const total = parts.reduce((n, p) => n + Math.max(0, p.value), 0);
  return (
    <div className="finance-stack">
      <div className="finance-stack-bar" role="img" aria-label="Ödeme yöntemi payları">
        {parts.map((p) =>
          p.value > 0 ? <span key={p.key} className={"tone-" + p.tone} style={{ width: pct(p.value, total) + "%" }} title={p.label} /> : null,
        )}
      </div>
      <ul>
        {parts.map((p) => (
          <li key={p.key}>
            <span className={"swatch tone-" + p.tone} /> {p.label}
            <strong>{currency(p.value)}</strong>
            <small>%{total > 0 ? Math.round((Math.max(0, p.value) / total) * 100) : 0}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
