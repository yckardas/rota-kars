import { useEffect, useState, type FormEvent } from "react";
import { ExternalLink, Plus, LoaderCircle } from "lucide-react";
import { api, post } from "../lib/api";
import type { InstagramPost } from "./InstagramSection";
import type { Catalog } from "../lib/types";
import { MediaUploadButton } from "./MediaUpload";
export function InstagramManager({ catalog }: { catalog: Catalog }) {
  const [posts, setPosts] = useState<InstagramPost[]>([]),
    [editing, setEditing] = useState<InstagramPost | null | false>(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [cover, setCover] = useState(""),
    [videoSrc, setVideoSrc] = useState("");
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
  // Düzenleme formu açılınca kapak ve video alanları o paylaşımla doldurulur.
  useEffect(() => {
    if (editing === false) return;
    setCover(editing?.cover || catalog.tours[0].image);
    setVideoSrc(editing?.videoSrc || "");
  }, [editing, catalog.tours]);
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
            <span className="media-field">
              <input
                name="videoSrc"
                value={videoSrc}
                onChange={(e) => setVideoSrc(e.target.value)}
                placeholder="/media/… veya /videos/ani-turu.mp4"
                pattern="(/videos/[A-Za-z0-9_-]+|/media/[a-f0-9-]{36})\.(mp4|webm)"
              />
              <MediaUploadButton
                accept="video/mp4,video/webm"
                label="Video yükle"
                onUploaded={(m) => setVideoSrc(m.url)}
              />
            </span>
            <small>
              MP4/WebM videoyu yükleyin (en fazla 150 MB); kartta üzerine
              gelince oynar. Boş bırakılırsa Instagram oynatıcısı açılır.
            </small>
          </label>
          <div className="form-grid">
            <label className="field">
              Kapak görseli
              <span className="media-field">
                <select
                  name="cover"
                  value={cover}
                  onChange={(e) => setCover(e.target.value)}
                >
                  {[
                    ...new Set([
                      cover,
                      ...catalog.tours.map((t) => t.image),
                      "/images/cildir.jpg",
                      "/images/rota-bus.jpg",
                    ]),
                  ].map((img) => (
                    <option key={img} value={img}>
                      {img.startsWith("/media/") ? "Yüklenen görsel" : img.split("/").at(-1)}
                    </option>
                  ))}
                </select>
                <MediaUploadButton
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  label="Görsel yükle"
                  onUploaded={(m) => setCover(m.url)}
                />
              </span>
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
