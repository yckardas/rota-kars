import { useEffect, useState, type FormEvent } from "react";
import { ExternalLink, Plus, LoaderCircle } from "lucide-react";
import { api, post } from "../lib/api";
import type { InstagramPost } from "./InstagramSection";
import type { Catalog } from "../lib/types";
export function InstagramManager({ catalog }: { catalog: Catalog }) {
  const [posts, setPosts] = useState<InstagramPost[]>([]),
    [editing, setEditing] = useState<InstagramPost | null | false>(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  async function load() {
    try {
      setPosts(await api<InstagramPost[]>("/admin/instagram"));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await post("/admin/instagram", {
        ...(editing ? { id: editing.id } : {}),
        title: f.get("title"),
        permalink: f.get("permalink"),
        cover: f.get("cover"),
        videoSrc: String(f.get("videoSrc") || "").trim() || null,
        position: Number(f.get("position")),
        active: f.get("active") === "on",
      });
      setEditing(false);
      setNotice("Instagram paylaşımı kaydedildi.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function toggle(p: InstagramPost) {
    setError("");
    setBusy(true);
    try {
      await post("/admin/instagram", { ...p, active: !p.active });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="muted">
        Herkese açık Reels veya gönderi bağlantısı ekleyin. Instagram hesabında
        gömmeye izin verilmiş olmalıdır. API anahtarı gerekmez; kapak görselleri
        arşivimizden seçilir.
      </p>
      <button
        className="btn"
        onClick={() => {
          setEditing(null);
          setNotice("");
        }}
      >
        <Plus size={16} />
        Video ekle
      </button>
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
      {editing !== false && (
        <form
          key={editing?.id || "new"}
          onSubmit={save}
          className="admin-editor"
        >
          <label className="field">
            Başlık
            <input
              name="title"
              defaultValue={editing?.title}
              minLength={2}
              maxLength={100}
              required
            />
          </label>
          <label className="field">
            Instagram Reels / gönderi bağlantısı
            <input
              type="url"
              name="permalink"
              defaultValue={editing?.permalink}
              placeholder="https://www.instagram.com/reel/…/"
              maxLength={500}
              required
            />
          </label>
          <label className="field">
            Otomatik önizleme için video dosyası (isteğe bağlı)
            <input
              name="videoSrc"
              defaultValue={editing?.videoSrc || ""}
              placeholder="/videos/ani-turu.mp4"
              pattern="/videos/[A-Za-z0-9_-]+\.(mp4|webm)"
            />
            <small>
              Özgün MP4/WebM dosyasını public/videos klasörüne koyup yolunu
              yazın. Boş bırakılırsa Instagram oynatıcısı açılır.
            </small>
          </label>
          <div className="form-grid">
            <label className="field">
              Kapak görseli
              <select
                name="cover"
                defaultValue={editing?.cover || catalog.tours[0].image}
              >
                {[
                  ...new Set([
                    ...catalog.tours.map((t) => t.image),
                    "/images/cildir.jpg",
                    "/images/rota-bus.jpg",
                  ]),
                ].map((img) => (
                  <option key={img} value={img}>
                    {img.split("/").at(-1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Sıra
              <input
                type="number"
                name="position"
                defaultValue={editing?.position ?? posts.length}
                min={0}
                max={99}
                required
              />
            </label>
          </div>
          <label className="checkbox-label">
            <input
              name="active"
              type="checkbox"
              defaultChecked={editing ? Boolean(editing.active) : true}
            />
            <span>Ana sayfada yayımla</span>
          </label>
          <div className="button-row">
            <button className="btn" disabled={busy}>
              {busy ? <LoaderCircle size={16} className="spin" /> : null}Kaydet
            </button>
            <button
              className="text-link"
              type="button"
              onClick={() => setEditing(false)}
            >
              Vazgeç
            </button>
          </div>
        </form>
      )}
      <div className="instagram-admin-list">
        {posts.map((p) => (
          <article key={p.id}>
            <img src={p.cover} alt="" />
            <div>
              <h3>{p.title}</h3>
              <a href={p.permalink} target="_blank" rel="noreferrer">
                Paylaşımı aç <ExternalLink size={12} />
              </a>
              <small>
                {p.active ? "Yayında" : "Taslak"} · Sıra: {p.position}
              </small>
            </div>
            <div className="instagram-admin-actions">
              <button
                className="btn btn-outline btn-small"
                onClick={() => setEditing(p)}
              >
                Düzenle
              </button>
              <button
                className="text-link"
                disabled={busy}
                onClick={() => toggle(p)}
              >
                {p.active ? "Yayından kaldır" : "Yayımla"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
