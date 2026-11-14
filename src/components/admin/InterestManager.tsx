// Panel · Bekleme ve ön kayıt. Üstte tur bazında satış modu: online satış ya da talep
// toplama (kesinleşme eşiği, ilerlemenin sitede görünmesi, "satışı aç ve haber ver").
// Altta bekleme listesi (dolu sefer) ve ön kayıt kayıtları, durum ve iletişim düğmeleriyle.
import { useEffect, useState } from "react";
import { BellRing, Check, LoaderCircle, Mail, MessageCircle, Phone } from "lucide-react";
import { api, post } from "../../lib/api";
import { dateLabel } from "../../lib/types";
import { useFeedback } from "./feedback";

type InterestRow = {
  id: string;
  kind: "waitlist" | "prereg";
  tour_id: string;
  departure_date: string | null;
  count: number;
  name: string;
  email: string;
  phone: string;
  preferred_date: string;
  notes: string;
  status: "waiting" | "notified" | "converted" | "cancelled";
  created_at: number;
  notified_at: number | null;
};
type TourMode = {
  id: string;
  name: string;
  mode: "online" | "demand";
  demand: { threshold: number; showProgress: boolean };
  preregCount: number;
};
const STATUS: Record<InterestRow["status"], string> = {
  waiting: "Bekliyor",
  notified: "Haber verildi",
  converted: "Rezervasyon yaptı",
  cancelled: "Vazgeçti",
};
const wa = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  const intl = d.startsWith("90") ? d : d.replace(/^0/, "90");
  return intl.length >= 11 ? "https://wa.me/" + intl : "";
};

export function InterestManager({ onChange }: { onChange: () => void }) {
  const [items, setItems] = useState<InterestRow[] | null>(null),
    [tours, setTours] = useState<TourMode[]>([]),
    [kind, setKind] = useState<"all" | "waitlist" | "prereg">("all"),
    [status, setStatus] = useState<"open" | "all">("open"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(""),
    feedback = useFeedback();
  async function load() {
    const d = await api<{ items: InterestRow[]; tours: TourMode[] }>("/admin/interest");
    setItems(d.items);
    setTours(d.tours);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  const name = (id: string) => tours.find((t) => t.id === id)?.name || id;
  const visible = (items || []).filter(
    (r) => (kind === "all" || r.kind === kind) && (status === "all" || ["waiting", "notified"].includes(r.status)),
  );
  async function run(id: string, fn: () => Promise<string>) {
    setBusy(id);
    setError("");
    setNotice("");
    try {
      const done = await fn();
      if (!done) return;
      setNotice(done);
      await load();
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <div className="operations-intro">
        <BellRing size={23} />
        <p>
          Talep toplama modundaki turda koltuk satılmaz; müşteriler ücretsiz ön kayıt bırakır. Eşiğe ulaşınca sefer
          oluşturup "Satışı aç" deyin: ön kayıtlılara rezervasyon bağlantısı gider. Dolu seferde yer açılınca bekleme
          listesindekilere sistem kendiliğinden haber verir.
        </p>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice-success" role="status">
          <Check size={17} /> {notice}
        </p>
      )}
      <div className="interest-tours">
        {tours.map((t) => (
          <ModeCard
            key={t.id + t.mode + t.demand.threshold + t.demand.showProgress}
            tour={t}
            busy={busy === t.id}
            save={(mode, threshold, showProgress) =>
              run(t.id, async () => {
                await post(`/admin/operations/${t.id}/mode`, { mode, threshold, showProgress });
                return `${t.name}: ${mode === "demand" ? "talep toplama" : "online satış"} kaydedildi.`;
              })
            }
            open={() =>
              run(t.id, async () => {
                if (
                  !(await feedback.confirm({
                    title: `${t.name} satışa açılsın mı?`,
                    body: `Tur online satışa geçer ve bekleyen ${t.preregCount} kişilik ön kayda rezervasyon bağlantısı e-postayla gider.`,
                    confirmLabel: "Satışı aç ve haber ver",
                  }))
                )
                  return "";
                const r = await post<{ notified: number }>(`/admin/operations/${t.id}/open-sales`, {});
                return `${t.name} satışa açıldı; ${r.notified} ön kayıtlıya haber verildi.`;
              })
            }
          />
        ))}
      </div>
      <div className="status-filters" role="group" aria-label="Kayıt türü">
        {(
          [
            ["all", "Tümü"],
            ["waitlist", "Bekleme listesi"],
            ["prereg", "Ön kayıt"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className={"chip" + (kind === id ? " active" : "")} aria-pressed={kind === id} onClick={() => setKind(id)}>
            {label}
          </button>
        ))}
        <button type="button" className={"chip" + (status === "all" ? " active" : "")} aria-pressed={status === "all"} onClick={() => setStatus(status === "all" ? "open" : "all")}>
          Kapananları da göster
        </button>
      </div>
      <div className="admin-requests">
        {!items && !error && <p className="admin-empty">Yükleniyor…</p>}
        {items && visible.length === 0 && <p className="admin-empty">Bu filtrede kayıt yok.</p>}
        {visible.map((r) => (
          <article key={r.id} className={"request-card status-" + r.status}>
            <div className="section-heading">
              <h3>
                {r.kind === "waitlist" ? "Bekleme listesi" : "Ön kayıt"} · {name(r.tour_id)}
              </h3>
              <small>{new Date(r.created_at).toLocaleDateString("tr-TR")}</small>
            </div>
            <strong>
              {r.name} · {r.count} kişi
            </strong>
            <p>
              {r.departure_date ? `Sefer: ${dateLabel(r.departure_date)}` : r.preferred_date ? `Tercih: ${r.preferred_date}` : "Tarih tercihi yok"}
              {r.notified_at ? ` · Haber: ${new Date(r.notified_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}` : ""}
            </p>
            {r.notes && <p className="muted">{r.notes}</p>}
            <div className="passenger-actions">
              <a className="btn btn-outline btn-small" href={"tel:" + r.phone.replace(/[^\d+]/g, "")}>
                <Phone size={15} /> Ara
              </a>
              {wa(r.phone) && (
                <a className="btn btn-outline btn-small" href={wa(r.phone)} target="_blank" rel="noreferrer">
                  <MessageCircle size={15} /> WhatsApp
                </a>
              )}
              <a className="btn btn-outline btn-small" href={"mailto:" + r.email}>
                <Mail size={15} /> E-posta
              </a>
            </div>
            <label className="field">
              Durum
              <select
                value={r.status}
                disabled={busy === r.id}
                onChange={(e) =>
                  run(r.id, async () => {
                    await post("/admin/interest/" + r.id, { status: e.target.value });
                    return "Durum güncellendi.";
                  })
                }
              >
                {Object.entries(STATUS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </article>
        ))}
      </div>
    </>
  );
}

function ModeCard({
  tour: t,
  busy,
  save,
  open,
}: {
  tour: TourMode;
  busy: boolean;
  save: (mode: "online" | "demand", threshold: number, showProgress: boolean) => void;
  open: () => void;
}) {
  const [mode, setMode] = useState(t.mode),
    [threshold, setThreshold] = useState(t.demand.threshold),
    [showProgress, setShowProgress] = useState(t.demand.showProgress);
  const pct = Math.min(100, Math.round((t.preregCount / Math.max(1, t.demand.threshold)) * 100));
  return (
    <article className={"interest-tour" + (t.mode === "demand" ? " is-demand" : "")}>
      <h3>{t.name}</h3>
      <label className="field">
        Satış modu
        <select value={mode} onChange={(e) => setMode(e.target.value as TourMode["mode"])}>
          <option value="online">Online satış (koltuk ve ödeme)</option>
          <option value="demand">Talep toplama (ödeme kapalı, ücretsiz ön kayıt)</option>
        </select>
      </label>
      {mode === "demand" && (
        <div className="interest-demand-fields">
          <label className="field">
            Kesinleşme eşiği (kişi)
            <input type="number" min={1} max={200} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={showProgress} onChange={(e) => setShowProgress(e.target.checked)} />
            <span>"Kaç kişi hazır" çubuğu sitede görünsün</span>
          </label>
        </div>
      )}
      {(t.mode === "demand" || t.preregCount > 0) && (
        <div className="interest-progress">
          <span>
            Ön kayıt: <b>{t.preregCount}</b> / {t.demand.threshold} kişi
          </span>
          <progress max={100} value={pct} />
        </div>
      )}
      <div className="interest-actions">
        <button
          className="btn btn-small btn-outline"
          disabled={busy}
          onClick={() => save(mode, threshold, showProgress)}
        >
          {busy ? <LoaderCircle size={15} className="spin" /> : <Check size={15} />} Kaydet
        </button>
        {t.mode === "demand" && (
          <button className="btn btn-small" disabled={busy} onClick={open}>
            Satışı aç ve haber ver
          </button>
        )}
      </div>
    </article>
  );
}
