// Panel · Rehber yazıları. Solda yazı listesi (taslak / yayında), sağda düzenleyici:
// başlık, adres, konu, özet, kapak görseli, ilgili turlar ve Markdown gövde; gövdenin
// sitedeki görünümü yanında canlı önizlenir. Yayına alınan yazı /rehber'de görünür.
import { useEffect, useState, type FormEvent } from "react";
import { Check, ExternalLink, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { api, post } from "../../lib/api";
import { Markdown } from "../../lib/markdown";
import { MediaUploadButton } from "../MediaUpload";
import { useFeedback } from "./feedback";
import { ARTICLE_CATEGORIES, type Article, type Catalog } from "../../lib/types";

type Draft = {
  id?: string;
  slug: string;
  title: string;
  summary: string;
  category: Article["category"];
  cover: string;
  body: string;
  tourIds: string[];
  status: "draft" | "published";
};
const blank = (): Draft => ({
  slug: "",
  title: "",
  summary: "",
  category: "aktivite",
  cover: "/images/kars.webp",
  body: "",
  tourIds: [],
  status: "draft",
});
const toDraft = (a: Article): Draft => ({
  id: a.id,
  slug: a.slug,
  title: a.title,
  summary: a.summary,
  category: a.category,
  cover: a.cover,
  body: a.body || "",
  tourIds: a.tourIds,
  status: a.status || "draft",
});
const HELP = "## Ara başlık · - madde · 1. numaralı madde · > alıntı · **kalın** · [bağlantı](/turlar/ani-cildir) · ![açıklama](/images/kars.webp)";

export function ArticleManager({ catalog }: { catalog: Catalog }) {
  const [items, setItems] = useState<Article[] | null>(null),
    [draft, setDraft] = useState<Draft | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    feedback = useFeedback();
  async function load() {
    setItems(await api<Article[]>("/admin/articles"));
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  async function save(e: FormEvent, status: Draft["status"]) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const saved = await post<Article>("/admin/articles", { ...draft, status });
      setDraft(toDraft(saved));
      await load();
      feedback.ok(status === "published" ? "Yazı yayında." : "Taslak kaydedildi.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!draft?.id) return;
    if (!(await feedback.confirm({ title: "Yazı silinsin mi?", body: draft.title, confirmLabel: "Sil", danger: true }))) return;
    try {
      await api("/admin/articles/" + draft.id, { method: "DELETE" });
      setDraft(null);
      await load();
      feedback.ok("Yazı silindi.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="article-admin">
      <aside className="article-admin-list">
        <button type="button" className="btn btn-small" onClick={() => setDraft(blank())}>
          <Plus size={15} /> Yeni yazı
        </button>
        {!items && !error && <p className="admin-empty">Yükleniyor…</p>}
        <ul>
          {(items || []).map((a) => (
            <li key={a.id}>
              <button type="button" className={draft?.id === a.id ? "active" : ""} onClick={() => setDraft(toDraft(a))}>
                <strong>{a.title}</strong>
                <small>
                  <span className={"operation-status " + (a.status === "published" ? "open" : "closed")}>
                    {a.status === "published" ? "Yayında" : "Taslak"}
                  </span>{" "}
                  {ARTICLE_CATEGORIES[a.category]}
                </small>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      {draft ? (
        <form className="admin-editor article-editor" onSubmit={(e) => save(e, draft.status)}>
          <h2>{draft.id ? "Yazıyı düzenle" : "Yeni yazı"}</h2>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <label className="field">
            Başlık
            <input value={draft.title} maxLength={140} required minLength={5} onChange={(e) => set("title", e.target.value)} />
          </label>
          <div className="form-grid">
            <label className="field">
              Adres (boş bırakırsanız başlıktan üretilir)
              <input
                value={draft.slug}
                maxLength={80}
                placeholder="cildir-golunde-atli-kizak"
                onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              />
              <small>/rehber/{draft.slug || "…"}</small>
            </label>
            <label className="field">
              Konu
              <select value={draft.category} onChange={(e) => set("category", e.target.value as Draft["category"])}>
                {Object.entries(ARTICLE_CATEGORIES).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            Özet (liste ve arama sonuçlarında görünür)
            <textarea rows={2} value={draft.summary} maxLength={320} required minLength={20} onChange={(e) => set("summary", e.target.value)} />
          </label>
          <div className="article-cover-field">
            <img src={draft.cover} alt="Kapak" />
            <div>
              <label className="field">
                Kapak görseli
                <input value={draft.cover} onChange={(e) => set("cover", e.target.value.trim())} />
              </label>
              <MediaUploadButton accept="image/jpeg,image/png,image/webp" label="Kapak yükle" onUploaded={(m) => set("cover", m.url)} />
            </div>
          </div>
          <fieldset className="choice-row article-tours-field">
            <legend>İlgili turlar (tur sayfasında ve yazının altında gösterilir)</legend>
            {catalog.tours.map((t) => (
              <label key={t.id} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={draft.tourIds.includes(t.id)}
                  onChange={(e) =>
                    set("tourIds", e.target.checked ? [...draft.tourIds, t.id] : draft.tourIds.filter((x) => x !== t.id))
                  }
                />
                <span>{t.name}</span>
              </label>
            ))}
          </fieldset>
          <div className="article-body-editor">
            <label className="field">
              Yazı
              <textarea rows={22} value={draft.body} maxLength={30000} required onChange={(e) => set("body", e.target.value)} />
              <small>{HELP}</small>
            </label>
            <div className="article-preview" aria-label="Önizleme">
              <small>Önizleme</small>
              <div className="article-body">
                <Markdown source={draft.body} />
              </div>
            </div>
          </div>
          <div className="article-actions">
            {draft.id && (
              <button type="button" className="text-link danger" onClick={remove}>
                <Trash2 size={15} /> Sil
              </button>
            )}
            {draft.status === "published" && draft.slug && (
              <a className="text-link" href={"/rehber/" + draft.slug} target="_blank" rel="noreferrer">
                <ExternalLink size={15} /> Sitede aç
              </a>
            )}
            <span />
            <button type="button" className="btn btn-small btn-outline" disabled={busy} onClick={(e) => save(e, "draft")}>
              {draft.status === "published" ? "Yayından kaldır (taslak)" : "Taslak kaydet"}
            </button>
            <button type="button" className="btn btn-small" disabled={busy} onClick={(e) => save(e, "published")}>
              {busy ? <LoaderCircle size={15} className="spin" /> : <Check size={15} />}
              {draft.status === "published" ? "Güncelle" : "Yayına al"}
            </button>
          </div>
        </form>
      ) : (
        <div className="admin-editor article-editor-empty">
          <p className="muted">Düzenlemek için soldan bir yazı seçin ya da yeni yazı başlatın. Taslaklar sitede görünmez.</p>
        </div>
      )}
    </div>
  );
}
