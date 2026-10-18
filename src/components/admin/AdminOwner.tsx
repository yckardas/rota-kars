import { useEffect, useState, type FormEvent } from "react";
import { Download, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { api, post } from "../../lib/api";
import { ROLE_LABELS, type AdminRole, type AdminUser } from "./AdminAuth";
const message = (e: unknown) => (e as Error).message;
const dateTime = (t?: number | null) =>
  t
    ? new Date(t).toLocaleString("tr-TR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";
const patch = <T,>(url: string, body: unknown) =>
  api<T>(url, { method: "PATCH", body: JSON.stringify(body) });
// Sahip: yönetici hesapları.
export function UserManager({ currentId }: { currentId: string }) {
  const [users, setUsers] = useState<AdminUser[] | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [creating, setCreating] = useState(false),
    [resetId, setResetId] = useState<string | null>(null);
  async function load() {
    try {
      setUsers(await api<AdminUser[]>("/admin/users"));
    } catch (e) {
      setError(message(e));
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(done);
      await load();
      return true;
    } catch (e) {
      setError(message(e));
      await load();
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form);
    const ok = await run(
      () =>
        post("/admin/users", {
          name: f.get("name"),
          email: f.get("email"),
          role: f.get("role"),
          password: f.get("password"),
        }),
      "Yönetici hesabı oluşturuldu.",
    );
    if (ok) {
      form.reset();
      setCreating(false);
    }
  }
  async function resetPassword(e: FormEvent<HTMLFormElement>, u: AdminUser) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const ok = await run(
      () =>
        post("/admin/users/" + u.id + "/reset", {
          password: f.get("password"),
        }),
      u.name + " için yeni parola tanımlandı. Parolayı güvenli bir kanaldan iletin.",
    );
    if (ok) setResetId(null);
  }
  return (
    <>
      <p className="muted">
        Sahip her şeyi yönetir. Operasyon; kullanıcılar, denetim kaydı, KVKK ve
        kampanya ayarları dışındaki işlemleri yapar. Rehber yalnız günlük
        raporu, sefer listesini ve bilet kontrolünü görür.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice-success" role="status">
          {notice}
        </p>
      )}
      <button
        className="btn btn-small"
        aria-expanded={creating}
        onClick={() => setCreating(!creating)}
      >
        <Plus size={15} />
        Yönetici ekle
      </button>
      {creating && (
        <form className="admin-editor admin-card" onSubmit={create}>
          <h2>Yeni yönetici</h2>
          <div className="form-grid">
            <label className="field">
              Ad soyad
              <input name="name" minLength={2} required autoComplete="off" />
            </label>
            <label className="field">
              E-posta adresi
              <input
                name="email"
                type="email"
                maxLength={254}
                required
                autoComplete="off"
              />
            </label>
            <label className="field">
              Rol
              <select name="role" defaultValue="operations">
                {(Object.keys(ROLE_LABELS) as AdminRole[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Geçici parola
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={200}
                required
                autoComplete="new-password"
              />
              <small>En az 12 karakter. Kişi ilk girişte değiştirmeli.</small>
            </label>
          </div>
          <button className="btn btn-small" disabled={busy}>
            {busy ? <LoaderCircle size={15} className="spin" /> : null}
            Hesabı oluştur
          </button>
        </form>
      )}
      {!users ? (
        <p className="admin-empty">Hesaplar yükleniyor…</p>
      ) : (
        <div className="desk-table-wrap admin-section">
          <table className="desk-table">
            <thead>
              <tr>
                <th>Yönetici</th>
                <th>Rol</th>
                <th>Durum</th>
                <th>Son giriş</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const self = u.id === currentId;
                return (
                  <tr key={u.id} className={u.disabled ? "is-muted" : ""}>
                    <td>
                      <strong>{u.name}</strong>
                      {self && <small>Siz</small>}
                      <small>{u.email}</small>
                    </td>
                    <td>
                      <label className="sr-only" htmlFor={"role-" + u.id}>
                        {u.name} rolü
                      </label>
                      <select
                        id={"role-" + u.id}
                        value={u.role}
                        disabled={busy || self}
                        onChange={(e) =>
                          run(
                            () =>
                              patch("/admin/users/" + u.id, {
                                role: e.target.value,
                              }),
                            u.name + " rolü güncellendi.",
                          )
                        }
                      >
                        {(Object.keys(ROLE_LABELS) as AdminRole[]).map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span
                        className={
                          "status-tag" + (u.disabled ? " inactive" : "")
                        }
                      >
                        {u.disabled ? "Kapalı" : "Etkin"}
                      </span>
                      <small>
                        İki adımlı doğrulama: {u.totpEnabled ? "açık" : "kapalı"}
                      </small>
                    </td>
                    <td>{dateTime(u.lastLoginAt)}</td>
                    <td>
                      <div className="admin-row-actions">
                        <button
                          className="text-link"
                          disabled={busy || self}
                          onClick={() =>
                            run(
                              () =>
                                patch("/admin/users/" + u.id, {
                                  disabled: !u.disabled,
                                }),
                              u.name +
                                (u.disabled
                                  ? " hesabı açıldı."
                                  : " hesabı kapatıldı."),
                            )
                          }
                        >
                          {u.disabled ? "Hesabı aç" : "Hesabı kapat"}
                        </button>
                        <button
                          className="text-link"
                          disabled={busy}
                          aria-expanded={resetId === u.id}
                          onClick={() =>
                            setResetId(resetId === u.id ? null : u.id)
                          }
                        >
                          Parolayı sıfırla
                        </button>
                        {u.totpEnabled && (
                          <button
                            className="text-link"
                            disabled={busy}
                            onClick={() => {
                              if (
                                window.confirm(
                                  u.name +
                                    " için iki adımlı doğrulama sıfırlansın mı? Kişi bir sonraki girişte yeniden kurmalıdır.",
                                )
                              )
                                run(
                                  () =>
                                    post("/admin/users/" + u.id + "/reset", {
                                      resetTotp: true,
                                    }),
                                  u.name +
                                    " için iki adımlı doğrulama sıfırlandı.",
                                );
                            }}
                          >
                            2FA sıfırla
                          </button>
                        )}
                      </div>
                      {resetId === u.id && (
                        <form
                          className="admin-inline-form"
                          onSubmit={(e) => resetPassword(e, u)}
                        >
                          <label className="field">
                            Yeni geçici parola
                            <input
                              name="password"
                              type="password"
                              minLength={12}
                              maxLength={200}
                              autoComplete="new-password"
                              autoFocus
                              required
                            />
                          </label>
                          <button
                            className="btn btn-small"
                            disabled={busy}
                          >
                            Kaydet
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
type AuditEntry = {
  id: string;
  admin_email: string | null;
  action: string;
  details?: Record<string, unknown> | null;
  at: number;
};
const AUDIT_LABELS: Record<string, string> = {
  login: "Giriş",
  login_locked: "Hesap kilitlendi",
  owner_created: "İlk sahip hesabı oluşturuldu",
  user_created: "Yönetici eklendi",
  user_updated: "Yönetici güncellendi",
  user_reset: "Yönetici sıfırlandı",
  password_changed: "Parola değişti",
  totp_enabled: "2FA açıldı",
  totp_disabled: "2FA kapatıldı",
  kvkk_erase: "KVKK silme",
  export: "Veri dışa aktarımı",
  post: "Kayıt / işlem",
  patch: "Güncelleme",
  delete: "Silme",
};
function auditDetails(entry: AuditEntry) {
  const d = entry.details || {};
  if (typeof d.path === "string") return d.path;
  const parts = Object.entries(d)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
    .map(([k, v]) => k + ": " + String(v));
  return parts.join(" · ") || "—";
}
// Sahip: denetim kaydı.
export function AuditLog() {
  const [rows, setRows] = useState<AuditEntry[] | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    api<AuditEntry[]>("/admin/audit")
      .then(setRows)
      .catch((e) => setError(message(e)));
  }, []);
  if (error)
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  if (!rows) return <p className="admin-empty">Denetim kaydı yükleniyor…</p>;
  return (
    <>
      <p className="muted">
        Yönetici girişleri, değişiklik yapan işlemler ve kişisel veri içeren
        dışa aktarımlar burada tutulur. En yeni kayıt en üsttedir.
      </p>
      {rows.length ? (
        <div className="desk-table-wrap admin-section">
          <table className="desk-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Yönetici</th>
                <th>İşlem</th>
                <th>Ayrıntı</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    {new Date(r.at).toLocaleString("tr-TR", {
                      dateStyle: "short",
                      timeStyle: "medium",
                    })}
                  </td>
                  <td>{r.admin_email || "İlk kurulum"}</td>
                  <td>{AUDIT_LABELS[r.action] || r.action}</td>
                  <td className="audit-details">{auditDetails(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="admin-empty">Henüz kayıt yok.</p>
      )}
    </>
  );
}
type Retention = {
  unpaidReservationDays: number;
  paidReservationDays: number;
  requestDays: number;
  notificationDays: number;
  auditDays: number;
};
const RETENTION_LABELS: [keyof Retention, string][] = [
  ["unpaidReservationDays", "Ödemesiz ön rezervasyonlar"],
  ["paidReservationDays", "Ödemeli rezervasyon ve tahsilat kayıtları"],
  ["requestDays", "Konaklama ve özel tur talepleri"],
  ["notificationDays", "Gönderilmiş bildirimler"],
  ["auditDays", "Denetim kaydı"],
];
const daysLabel = (n: number) =>
  n >= 365 ? `${n} gün (yaklaşık ${Math.round(n / 365)} yıl)` : `${n} gün`;
const EXPORT_LABELS: Record<string, string> = {
  reservations: "Rezervasyon",
  requests: "Talep",
  coupons: "Kupon",
  socialAccounts: "Sosyal hesap",
  notifications: "Bildirim",
  payments: "Ödeme kaydı",
  ledger: "Tahsilat kaydı",
  reviews: "Yorum",
};
// Sahip: KVKK başvuruları (dışa aktarım, silme, saklama süreleri).
export function KvkkTools() {
  const [retention, setRetention] = useState<Retention | null>(null),
    [exported, setExported] = useState<{
      email: string;
      data: Record<string, unknown>;
    } | null>(null),
    [erased, setErased] = useState<Record<string, unknown> | null>(null),
    [confirm, setConfirm] = useState(""),
    [exportError, setExportError] = useState(""),
    [eraseError, setEraseError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<Retention>("/admin/kvkk/retention")
      .then(setRetention)
      .catch(() => {});
  }, []);
  async function exportData(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email")).trim();
    setBusy(true);
    setExportError("");
    setExported(null);
    try {
      setExported({
        email,
        data: await post<Record<string, unknown>>("/admin/kvkk/export", {
          email,
        }),
      });
    } catch (e) {
      setExportError(message(e));
    } finally {
      setBusy(false);
    }
  }
  function download() {
    if (!exported) return;
    const blob = new Blob([JSON.stringify(exported.data, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download =
      "kvkk-" +
      exported.email.replace(/[^a-z0-9]+/gi, "-") +
      "-" +
      new Date().toISOString().slice(0, 10) +
      ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function erase(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      email = String(new FormData(form).get("email")).trim();
    if (confirm !== "SİL") {
      setEraseError("Onay için kutuya büyük harflerle SİL yazın.");
      return;
    }
    setBusy(true);
    setEraseError("");
    setErased(null);
    try {
      setErased(
        await post<Record<string, unknown>>("/admin/kvkk/erase", {
          email,
          confirm: "SİL",
        }),
      );
      form.reset();
      setConfirm("");
    } catch (e) {
      setEraseError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const counts = exported
    ? Object.entries(exported.data).filter(([, v]) => Array.isArray(v))
    : [];
  return (
    <div className="kvkk-tools">
      <section className="admin-card">
        <h2>Veri dökümü (md. 11)</h2>
        <p className="muted">
          Başvuru sahibinin e-postasıyla eşleşen üyelik, rezervasyon, talep ve
          kupon kayıtlarını dışa aktarır. Kimliğin doğrulandığından emin olun;
          işlem denetim kaydına yazılır.
        </p>
        <form className="admin-inline-form" onSubmit={exportData}>
          <label className="field">
            Başvuru sahibinin e-postası
            <input name="email" type="email" maxLength={254} required />
          </label>
          <button className="btn btn-small" disabled={busy}>
            {busy ? <LoaderCircle size={15} className="spin" /> : null}
            Dökümü hazırla
          </button>
        </form>
        {exportError && (
          <p className="error" role="alert">
            {exportError}
          </p>
        )}
        {exported && (
          <div className="kvkk-result" role="status">
            <strong>{exported.email}</strong>
            <ul>
              <li>Üyelik: {exported.data.member ? "var" : "yok"}</li>
              {counts.map(([k, v]) => (
                <li key={k}>
                  {EXPORT_LABELS[k] || k}: {(v as unknown[]).length}
                </li>
              ))}
            </ul>
            <button className="btn btn-outline btn-small" onClick={download}>
              <Download size={15} />
              JSON indir
            </button>
          </div>
        )}
      </section>
      <section className="admin-card danger-zone">
        <h2>Silme / anonimleştirme</h2>
        <p className="muted">
          Üyelik ve talepler silinir; ödemesiz rezervasyonların kişisel
          alanları anonimleştirilir. Tahsilatı olan rezervasyonlar vergi ve
          ticari mevzuat gereği 10 yıl olduğu gibi saklanır, süre dolunca
          anonimleşir. Yaklaşan yolculuğu olan kişiler için işlem yapılamaz.
          Bu işlem geri alınamaz.
        </p>
        <form onSubmit={erase}>
          <div className="form-grid">
            <label className="field">
              Başvuru sahibinin e-postası
              <input name="email" type="email" maxLength={254} required />
            </label>
            <label className="field">
              Onaylamak için SİL yazın
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="off"
                required
              />
            </label>
          </div>
          <button
            className="btn btn-danger btn-small"
            disabled={busy || confirm !== "SİL"}
          >
            <Trash2 size={15} />
            Kişisel verileri sil
          </button>
        </form>
        {eraseError && (
          <p className="error" role="alert">
            {eraseError}
          </p>
        )}
        {erased && (
          <div className="kvkk-result" role="status">
            <strong>İşlem tamamlandı.</strong>
            <ul>
              <li>Üyelik hesabı: {erased.member ? "silindi" : "bulunamadı"}</li>
              <li>Anonimleştirilen kayıt: {String(erased.anonymized ?? 0)}</li>
              <li>
                Yasal yükümlülükle saklanan kayıt:{" "}
                {String(erased.retainedForLegalObligation ?? 0)}
              </li>
              <li>Silinen talep: {String(erased.requestsDeleted ?? 0)}</li>
            </ul>
          </div>
        )}
      </section>
      <section className="admin-card">
        <h2>Saklama süreleri</h2>
        {retention ? (
          <ul className="legal-list">
            {RETENTION_LABELS.map(([k, label]) => (
              <li key={k}>
                {label}: {daysLabel(retention[k])}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Saklama süreleri yükleniyor…</p>
        )}
        <p className="muted">
          Süresi dolan kayıtlar günlük olarak otomatik silinir veya
          anonimleştirilir.
        </p>
      </section>
    </div>
  );
}
