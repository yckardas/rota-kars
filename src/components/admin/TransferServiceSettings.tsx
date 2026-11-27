// Panel · Araç düzeni ve transfer: turdan bağımsız online transfer (VIP transfer sayfası).
// Satış açık/kapalı, en az kaç saat önceden ayrılabileceği ve fiyat tablosu (grup başına
// toplam). Rezervasyonlar "Rezervasyonlar → Online transfer" listesinde görünür.
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { TransferConfig } from "../../lib/transfer";
import { TransferEditor } from "./TransferEditor";
import "./TransferServiceSettings.css";

type Settings = TransferConfig & {
  minLeadHours: number;
  paymentEnabled: boolean;
};

export function TransferServiceSettings() {
  const [settings, setSettings] = useState<Settings | null>(null),
    [minLeadHours, setMinLeadHours] = useState(12),
    [error, setError] = useState("");
  useEffect(() => {
    api<Settings>("/admin/transfer-service")
      .then((s) => {
        setSettings(s);
        setMinLeadHours(s.minLeadHours);
      })
      .catch((e) => setError(e.message));
  }, []);
  if (error)
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  if (!settings) return null;
  return (
    <section
      className="tour-operation transfer-service-settings"
      aria-labelledby="transfer-service-title"
    >
      <h2 id="transfer-service-title">Online transfer (turdan bağımsız)</h2>
      <p className="muted">
        VIP transfer sayfasında müşteri güzergâhı, tarihi ve uçuş numarasını
        seçip tutarın tamamını kartla öder; ödeme alınınca rezervasyon
        kendiliğinden onaylanır ve ekibe bildirim gider. Kayıtlar Rezervasyonlar
        → Online transfer listesinde alınış saatine göre sıralanır. İptal:
        alınıştan 24 saat öncesine kadar tam iade, sonrasında %30 kesinti.
      </p>
      {!settings.paymentEnabled && (
        <p className="error" role="note">
          Online kartla ödeme kapalı olduğu için satış açık olsa da sitede
          transfer satılmaz.
        </p>
      )}
      <TransferEditor
        tourId="transfer"
        tourName="Online transfer"
        title="Online transfer satışı ve fiyatları"
        enabledLabel="VIP transfer sayfasında online transfer satılsın"
        endpoint="/admin/transfer-service"
        config={settings}
        extra={{ minLeadHours }}
        onSaved={(saved) => {
          const next = saved as Settings;
          setSettings(next);
          setMinLeadHours(next.minLeadHours);
        }}
      >
        <label className="field transfer-lead">
          En az kaç saat önceden ayrılabilir
          <input
            type="number"
            min={1}
            max={168}
            value={minLeadHours}
            onChange={(e) =>
              setMinLeadHours(
                Math.max(1, Math.min(168, Number(e.target.value) || 1)),
              )
            }
          />
        </label>
      </TransferEditor>
    </section>
  );
}
