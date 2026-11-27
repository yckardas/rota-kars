// Panel · Bekleme ve ön kayıt. Üstte tur bazında satış modu: online satış ya da talep
// toplama (kesinleşme eşiği, ilerlemenin sitede görünmesi, "satışı aç ve haber ver").
// Altta bekleme listesi (dolu sefer), ön kayıt ve "tarih açılınca haber ver" (satışa kapalı tur)
// kayıtları, durum ve iletişim düğmeleriyle.
import { useEffect, useState } from "react";
import { BellRing, Check, LoaderCircle, Mail, MessageCircle, Phone } from "lucide-react";
import { api, post } from "../../lib/api";
import { dateLabel } from "../../lib/types";
import { useFeedback } from "./feedback";

type InterestRow = {
  id: string;
  kind: "waitlist" | "prereg" | "notify";
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
  salesOpen: boolean;
  preregCount: number;
  // Satışa kapalı turda "tarih açılınca haber ver" bekleyen kişi sayısı.
  notifyCount: number;
  // Talep toplayan ya da bekleyen ön kaydı olan tarihler (tarihin 1. aracının id'si).
  // decisionDate: kesinleşme kararının en geç günü; geçtiyse (closedOnSite) sitede ön kayda kapalı.
  dates: {
    id: string;
    date: string;
    start_time: string;
    count: number;
    demand: boolean;
    salesOpen: boolean;
    decisionDate: string;
    closedOnSite: boolean;
  }[];
};
const KIND: Record<InterestRow["kind"], string> = {
  waitlist: "Bekleme listesi",
  prereg: "Ön kayıt",
  notify: "Tarih açılınca haber",
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
    [kind, setKind] = useState<"all" | InterestRow["kind"]>("all"),
    // Tur bazında süzme ("Tarih açılınca haber bekleyenler" listesinden).
    [tourFilter, setTourFilter] = useState(""),
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
    (r) =>
      (kind === "all" || r.kind === kind) &&
      (!tourFilter || r.tour_id === tourFilter) &&
      (status === "all" || ["waiting", "notified"].includes(r.status)),
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
  // Talep toplayan tur ya da online turdaki talep tarihi (seferde satış modu) üstte görünür.
  const collecting = (t: TourMode) => t.mode === "demand" || t.dates.length > 0,
    demandTours = tours.filter(collecting),
    onlineTours = tours.filter((t) => !collecting(t)),
    notifyTours = tours.filter((t) => t.notifyCount > 0);
  return (
    <>
      <div className="operations-intro">
        <BellRing size={23} />
        <p>
          Talep toplama modundaki turda koltuk satılmaz; müşteriler ücretsiz ön kayıt bırakır. Eşiğe ulaşınca sefer
          oluşturup "Satışı aç" deyin: ön kayıtlılara rezervasyon bağlantısı gider. Dolu seferde yer açılınca bekleme
          listesindekilere sistem kendiliğinden haber verir. Satışa kapalı turda "Tarih açılınca haber ver" diyenlere,
          tur satışa açılıp tarihi ya da ön kaydı olunca sistem e-posta gönderir.
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
      {/* Önce iş: talep toplanan turlar (eşik, tarihler, "Satışa aç"). */}
      <h2 className="interest-heading">Talep toplanan turlar</h2>
      {demandTours.length ? (
        <div className="interest-tours">
          {demandTours.map((t) => (
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
            openDate={(x) =>
              run(t.id, async () => {
                if (
                  !(await feedback.confirm({
                    title: `${t.name} · ${dateLabel(x.date)} satışa açılsın mı?`,
                    body: x.count
                      ? `Bu tarihe kayıtlı ${x.count} kişiye rezervasyon bağlantısı e-postayla gider.`
                      : "Bu tarihe henüz ön kayıt yok; tarih online satışa geçer.",
                    confirmLabel: "Satışa aç",
                  }))
                )
                  return "";
                const r = await post<{ notified: number }>(`/admin/departures/${encodeURIComponent(x.id)}/open-sales`, {});
                return `${t.name} · ${dateLabel(x.date)} satışa açıldı; ${r.notified} kişiye haber verildi.`;
              })
            }
            open={() =>
              run(t.id, async () => {
                if (
                  !(await feedback.confirm({
                    title: `${t.name} satışa açılsın mı?`,
                    body: t.dates.length
                      ? `Tur online satışa geçer; tarih belirtmeyen ${t.preregCount} kişiye ve satışa geçen tarihlere kayıtlı olanlara e-posta gider. "Talep toplama" olarak işaretli tarihler talepte kalır.`
                      : `Tur online satışa geçer ve bekleyen ${t.preregCount} kişilik ön kayda rezervasyon bağlantısı e-postayla gider.`,
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
      ) : (
        <p className="admin-empty">Talep toplama modunda tur yok. Bir turu aşağıdaki "Satış modu ayarları"ndan talep toplamaya alabilirsiniz.</p>
      )}
      {notifyTours.length > 0 && (
        <>
          <h2 className="interest-heading">Tarih açılınca haber bekleyenler</h2>
          <ul className="interest-notify">
            {notifyTours.map((t) => (
              <li key={t.id}>
                <strong>{t.name}</strong>
                <span>
                  {t.notifyCount} kişi ·{" "}
                  {t.salesOpen
                    ? "tur satışta; tarih açılınca e-posta gider"
                    : "satışa kapalı"}
                </span>
                <button
                  type="button"
                  className="btn btn-small btn-outline"
                  onClick={() => {
                    setKind("notify");
                    setTourFilter(t.id);
                  }}
                >
                  Kayıtları göster
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <h2 className="interest-heading">Bekleme listesi ve ön kayıtlar</h2>
      <div className="status-filters" role="group" aria-label="Kayıt türü">
        {(
          [
            ["all", "Tümü"],
            ["waitlist", "Bekleme listesi"],
            ["prereg", "Ön kayıt"],
            ["notify", "Tarih açılınca haber"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className={"chip" + (kind === id ? " active" : "")} aria-pressed={kind === id} onClick={() => setKind(id)}>
            {label}
          </button>
        ))}
        {tourFilter && (
          <button
            type="button"
            className="chip active"
            aria-pressed="true"
            onClick={() => setTourFilter("")}
          >
            {name(tourFilter)} ×
          </button>
        )}
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
                {KIND[r.kind] || r.kind} · {name(r.tour_id)}
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
      {/* Ayar: online satıştaki turlar katlanmış durur; talep toplamaya almak için açılır. */}
      <details className="interest-settings">
        <summary>Satış modu ayarları · {onlineTours.length} tur online satışta</summary>
        <div className="interest-tours">
          {onlineTours.map((t) => (
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
            openDate={(x) =>
              run(t.id, async () => {
                if (
                  !(await feedback.confirm({
                    title: `${t.name} · ${dateLabel(x.date)} satışa açılsın mı?`,
                    body: x.count
                      ? `Bu tarihe kayıtlı ${x.count} kişiye rezervasyon bağlantısı e-postayla gider.`
                      : "Bu tarihe henüz ön kayıt yok; tarih online satışa geçer.",
                    confirmLabel: "Satışa aç",
                  }))
                )
                  return "";
                const r = await post<{ notified: number }>(`/admin/departures/${encodeURIComponent(x.id)}/open-sales`, {});
                return `${t.name} · ${dateLabel(x.date)} satışa açıldı; ${r.notified} kişiye haber verildi.`;
              })
            }
            open={() =>
              run(t.id, async () => {
                if (
                  !(await feedback.confirm({
                    title: `${t.name} satışa açılsın mı?`,
                    body: t.dates.length
                      ? `Tur online satışa geçer; tarih belirtmeyen ${t.preregCount} kişiye ve satışa geçen tarihlere kayıtlı olanlara e-posta gider. "Talep toplama" olarak işaretli tarihler talepte kalır.`
                      : `Tur online satışa geçer ve bekleyen ${t.preregCount} kişilik ön kayda rezervasyon bağlantısı e-postayla gider.`,
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
      </details>
    </>
  );
}

function ModeCard({
  tour: t,
  busy,
  save,
  open,
  openDate,
}: {
  tour: TourMode;
  busy: boolean;
  save: (mode: "online" | "demand", threshold: number, showProgress: boolean) => void;
  open: () => void;
  openDate: (date: TourMode["dates"][number]) => void;
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
      {/* Eşik ve ilerleme, online turdaki talep tarihleri için de geçerlidir. */}
      {(mode === "demand" || t.dates.some((x) => x.demand)) && (
        <div className="interest-demand-fields">
          <label className="field">
            Kesinleşme eşiği (kişi)
            <input type="number" min={1} max={200} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={showProgress} onChange={(e) => setShowProgress(e.target.checked)} />
            <span>"Kaç kişi hazır" çubuğu sitede görünsün</span>
          </label>
          <small className="muted">
            Sitede eşik ve "karar en geç" günü görünür: tarih eksi turun iptal
            bildirim süresi (Tur içerikleri). Süre girilmediyse günübirlikte 48
            saat, 2–6 günlük turda 7 gün, daha uzun turda 20 gün sayılır; bu gün
            geçen tarih sitede ön kayda kapanır.
          </small>
        </div>
      )}
      {(t.mode === "demand" || t.preregCount > 0) && (
        <div className="interest-progress">
          <span>
            {t.dates.length ? "Tarih belirtmeyen ön kayıt" : "Ön kayıt"}: <b>{t.preregCount}</b> / {t.demand.threshold} kişi
          </span>
          <progress max={100} value={pct} />
        </div>
      )}
      {t.dates.length > 0 && (
        <ul className="interest-dates">
          {t.dates.map((x) => (
            <li key={x.id}>
              <strong>
                {dateLabel(x.date)} · {x.start_time}
              </strong>
              {x.demand ? (
                <button className="btn btn-small btn-outline" type="button" disabled={busy} onClick={() => openDate(x)}>
                  Satışa aç
                </button>
              ) : (
                <span className="operation-status open">Satışta</span>
              )}
              <div className="interest-progress">
                <span>
                  Ön kayıt: <b>{x.count}</b> / {t.demand.threshold} kişi
                  {x.demand &&
                    (x.closedOnSite
                      ? ` · Karar günü geçti (${dateLabel(x.decisionDate)}); sitede ön kayda kapalı`
                      : ` · Karar en geç ${dateLabel(x.decisionDate)}`)}
                </span>
                <progress max={100} value={Math.min(100, Math.round((x.count / Math.max(1, t.demand.threshold)) * 100))} />
              </div>
            </li>
          ))}
        </ul>
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
