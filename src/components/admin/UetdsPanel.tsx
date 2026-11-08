import { useEffect, useState, type FormEvent } from "react";
import { Download, LoaderCircle, Send } from "lucide-react";
import { api, post } from "../../lib/api";
import { Modal } from "../Modal";
import { useFeedback } from "./feedback";
type Crew = { name: string; phone: string; gender: "K" | "E"; nationality: string; idMasked: string } | null;
type Status = {
  mode: "dry" | "test" | "prod";
  configured: boolean;
  startIlce: number | null;
  plate: string | null;
  driver: Crew;
  guide: Crew;
  ref: string | null;
  reportedAt: number | null;
  reported: number;
  riders: number;
  missingIds: string[];
};
type Report = {
  mode: string;
  ref: string;
  added: number;
  cancelled: number;
  total: number;
  preview?: { op: string; request: string }[];
};
const MODE = { dry: "Kuru çalışma (gönderilmez)", test: "U-ETDS test ortamı", prod: "U-ETDS canlı" };
// Sefer için U-ETDS bildirimi: şoför/rehber bilgisi, bildir ve PDF.
export function UetdsPanel({ departureId, onClose }: { departureId: string; onClose: () => void }) {
  const feedback = useFeedback();
  const [s, setS] = useState<Status | null>(null),
    [busy, setBusy] = useState(false),
    [report, setReport] = useState<Report | null>(null),
    [editCrew, setEditCrew] = useState(false);
  const base = "/admin/departures/" + encodeURIComponent(departureId) + "/uetds";
  const load = () => api<Status>(base).then(setS).catch(feedback.error);
  useEffect(() => {
    load();
  }, [departureId]);
  async function saveCrew(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const person = (k: string) =>
      f.get(k + "Name")
        ? {
            name: f.get(k + "Name"),
            nationality: "TR",
            idNumber: f.get(k + "Id"),
            gender: f.get(k + "Gender"),
            phone: f.get(k + "Phone") || "",
          }
        : null;
    setBusy(true);
    try {
      setS(await post<Status>(base + "/crew", { driver: person("driver"), guide: person("guide") }));
      setEditCrew(false);
      feedback.ok("Personel bilgileri kaydedildi.");
    } catch (e) {
      feedback.error(e);
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    setBusy(true);
    try {
      const r = await post<Report>(base + "/report", {});
      setReport(r);
      feedback.ok(
        r.mode === "dry"
          ? "Kuru çalışma tamamlandı; hiçbir şey gönderilmedi."
          : `U-ETDS'e bildirildi: ${r.added} yolcu eklendi, ${r.cancelled} iptal.`,
      );
      await load();
    } catch (e) {
      feedback.error(e);
    } finally {
      setBusy(false);
    }
  }
  const crewFields = (k: "driver" | "guide", label: string, c: Crew, required: boolean) => (
    <fieldset className="uetds-crew">
      <legend>{label}</legend>
      <div className="form-grid">
        <label className="field">
          Ad soyad
          <input name={k + "Name"} defaultValue={c?.name || ""} required={required} maxLength={100} />
        </label>
        <label className="field">
          T.C. kimlik no
          <input
            name={k + "Id"}
            inputMode="numeric"
            pattern="[1-9][0-9]{10}"
            maxLength={11}
            placeholder={c?.idMasked || ""}
            required={required}
          />
        </label>
        <label className="field">
          Cinsiyet
          <select name={k + "Gender"} defaultValue={c?.gender || "E"}>
            <option value="E">Erkek</option>
            <option value="K">Kadın</option>
          </select>
        </label>
        <label className="field">
          Telefon
          <input name={k + "Phone"} type="tel" defaultValue={c?.phone || ""} />
        </label>
      </div>
    </fieldset>
  );
  return (
    <Modal title="U-ETDS bildirimi" onClose={onClose} wide>
      {!s ? (
        <p className="muted">
          <LoaderCircle className="spin" size={16} /> Yükleniyor…
        </p>
      ) : (
        <div className="uetds-panel">
          <dl className="uetds-facts">
            <div>
              <dt>Bağlantı</dt>
              <dd>{MODE[s.mode]}</dd>
            </div>
            <div>
              <dt>Araç plakası</dt>
              <dd>{s.plate || "Atanmadı"}</dd>
            </div>
            <div>
              <dt>Bildirilen / binecek yolcu</dt>
              <dd>
                {s.reported} / {s.riders}
              </dd>
            </div>
            <div>
              <dt>U-ETDS sefer no</dt>
              <dd>{s.ref || "Henüz bildirilmedi"}</dd>
            </div>
          </dl>
          {!s.configured && (
            <p className="row-note">
              U-ETDS kullanıcı adı ve web servis şifresi sunucuda tanımlı değil (UETDS_USERNAME, UETDS_PASSWORD). Bildirim
              yalnız önizlenir.
            </p>
          )}
          {!s.startIlce && <p className="row-note">UETDS_START_ILCE (Kars merkez ilçe kodu) tanımlanmalı.</p>}
          {s.missingIds.length > 0 && (
            <p className="error">Kimlik bilgisi eksik koltuklar: {s.missingIds.join(", ")}</p>
          )}
          {s.driver && !editCrew ? (
            <div className="uetds-crew-view">
              <p>
                <strong>Şoför:</strong> {s.driver.name} · {s.driver.idMasked}
                {s.driver.phone && " · " + s.driver.phone}
              </p>
              {s.guide && (
                <p>
                  <strong>Rehber:</strong> {s.guide.name} · {s.guide.idMasked}
                </p>
              )}
              <button className="text-link" onClick={() => setEditCrew(true)}>
                Personeli değiştir
              </button>
            </div>
          ) : (
            <form onSubmit={saveCrew}>
              {crewFields("driver", "Şoför (zorunlu)", s.driver, true)}
              {crewFields("guide", "Rehber (isteğe bağlı)", s.guide, false)}
              <button className="btn btn-small" disabled={busy}>
                Personeli kaydet
              </button>
            </form>
          )}
          <div className="button-row">
            <button className="btn" onClick={send} disabled={busy || !s.driver || !s.plate}>
              {busy ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />}
              {s.ref ? "Değişiklikleri bildir" : "U-ETDS'e bildir"}
            </button>
            {s.ref && (
              <a className="btn btn-outline" href={"/api" + base + "/pdf"}>
                <Download size={16} /> Sefer belgesi (PDF)
              </a>
            )}
          </div>
          <p className="muted">
            Yalnız onaylı rezervasyonların yolcuları bildirilir. Sonradan gelen yolcular ve iptaller "Değişiklikleri
            bildir" ile güncellenir.
          </p>
          {report?.preview && (
            <details className="uetds-preview">
              <summary>Gönderilecek istekler ({report.preview.length})</summary>
              {report.preview.map((p, i) => (
                <div key={i}>
                  <strong>{p.op}</strong>
                  <pre>{p.request}</pre>
                </div>
              ))}
            </details>
          )}
        </div>
      )}
    </Modal>
  );
}
