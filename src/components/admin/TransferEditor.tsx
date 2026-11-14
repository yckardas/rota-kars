// Panel · Tur ve araç planı: turun transfer fiyat tablosu. Fiyatlar GRUP BAŞINA
// TOPLAMDIR (TL); boş bırakılan hücrede o nokta/kişi grubu için transfer sunulmaz.
import { useState, type FormEvent } from "react";
import { Check, LoaderCircle, Plane } from "lucide-react";
import { post } from "../../lib/api";
import {
  TRANSFER_POINTS,
  TRANSFER_TIERS,
  type TransferConfig,
  type TransferTable,
} from "../../lib/transfer";

type Draft = Record<"oneWay" | "roundTrip", Record<string, Record<string, string>>>;
const toDraft = (c: TransferConfig): Draft => ({
  oneWay: toRows(c.oneWay),
  roundTrip: toRows(c.roundTrip),
});
const toRows = (table: TransferTable) =>
  Object.fromEntries(
    TRANSFER_POINTS.map((p) => [
      p.id,
      Object.fromEntries(TRANSFER_TIERS.map((t) => [t.id, table[p.id]?.[t.id] ? String(table[p.id][t.id]! / 100) : ""])),
    ]),
  );
const toTable = (rows: Draft["oneWay"]) =>
  Object.fromEntries(
    TRANSFER_POINTS.map((p) => [
      p.id,
      Object.fromEntries(
        TRANSFER_TIERS.map((t) => {
          const v = Number(rows[p.id][t.id].replace(",", "."));
          return [t.id, rows[p.id][t.id].trim() && v > 0 ? Math.round(v * 100) : null];
        }),
      ),
    ]),
  );

export function TransferEditor({
  tourId,
  tourName,
  config,
  onSaved,
}: {
  tourId: string;
  tourName: string;
  config: TransferConfig;
  onSaved: (c: TransferConfig) => void;
}) {
  const [enabled, setEnabled] = useState(config.enabled),
    // Başlıktaki durum kayıtlı hâli gösterir (kaydedilmemiş işaret değil).
    [savedEnabled, setSavedEnabled] = useState(config.enabled),
    [draft, setDraft] = useState<Draft>(() => toDraft(config)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const set = (table: keyof Draft, point: string, tier: string, value: string) =>
    setDraft((d) => ({ ...d, [table]: { ...d[table], [point]: { ...d[table][point], [tier]: value } } }));
  // Gidiş-dönüşte boş hücreler tek yönün iki katıyla doldurulur (girilmiş fiyatlara dokunulmaz).
  function suggestRoundTrip() {
    setDraft((d) => ({
      ...d,
      roundTrip: Object.fromEntries(
        TRANSFER_POINTS.map((p) => [
          p.id,
          Object.fromEntries(
            TRANSFER_TIERS.map((t) => {
              const one = Number(d.oneWay[p.id][t.id].replace(",", "."));
              return [t.id, d.roundTrip[p.id][t.id] || (one > 0 ? String(one * 2) : "")];
            }),
          ),
        ]),
      ),
    }));
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = await post<TransferConfig>(`/admin/operations/${tourId}/transfer`, {
        enabled,
        oneWay: toTable(draft.oneWay),
        roundTrip: toTable(draft.roundTrip),
      });
      onSaved(saved);
      setDraft(toDraft(saved));
      setSavedEnabled(saved.enabled);
      setNotice("Transfer fiyatları kaydedildi.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const grid = (table: keyof Draft, title: string) => (
    <table className="transfer-grid">
      <caption>{title}</caption>
      <thead>
        <tr>
          <th scope="col">Nokta</th>
          {TRANSFER_TIERS.map((t) => (
            <th key={t.id} scope="col">
              {t.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {TRANSFER_POINTS.map((p) => (
          <tr key={p.id}>
            <th scope="row">{p.label}</th>
            {TRANSFER_TIERS.map((t) => (
              <td key={t.id}>
                <input
                  inputMode="decimal"
                  aria-label={`${title} · ${p.label} · ${t.label} (TL)`}
                  placeholder="—"
                  value={draft[table][p.id][t.id]}
                  onChange={(e) => set(table, p.id, t.id, e.target.value.replace(/[^\d.,]/g, ""))}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <details className="operation-transfer" open={config.enabled || undefined}>
      <summary>
        <Plane size={15} /> Transfer fiyatları {savedEnabled ? "· satışta" : "· kapalı"}
      </summary>
      <form onSubmit={save}>
        <p className="muted">
          Fiyatlar grubun tamamı için toplamdır (TL). Müşterinin kişi sayısına göre kademe seçilir. Boş bıraktığınız
          hücre o nokta ve kişi grubu için sunulmaz.
        </p>
        <label className="checkbox-label">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span>{tourName} rezervasyonlarında transfer sunulsun</span>
        </label>
        {grid("oneWay", "Tek yön (geliş ya da dönüş)")}
        {grid("roundTrip", "Gidiş-dönüş")}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="notice-success" role="status">
            <Check size={15} /> {notice}
          </p>
        )}
        <div className="transfer-actions">
          <button type="button" className="text-link" onClick={suggestRoundTrip}>
            Boş gidiş-dönüş hücrelerini tek yönün iki katıyla doldur
          </button>
          <button className="btn btn-small" disabled={busy}>
            {busy ? <LoaderCircle size={15} className="spin" /> : <Check size={15} />}
            Transferi kaydet
          </button>
        </div>
      </form>
    </details>
  );
}
