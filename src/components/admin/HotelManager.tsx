import { useEffect, useState, type FormEvent } from "react";
import { Check, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { api, post } from "../../lib/api";
import type { Hotel } from "../../lib/types";
import { MediaUploadButton } from "../MediaUpload";
import { useFeedback } from "./feedback";

// Anlaşmalı oteller: ekle, düzenle, fotoğraf, yayımla/kaldır, sil.
export function HotelManager() {
  const feedback = useFeedback();
  const [hotels, setHotels] = useState<Hotel[] | null>(null),
    [editing, setEditing] = useState<Hotel | null | false>(false),
    [busy, setBusy] = useState(false);
  const load = () =>
    api<{ hotels: Hotel[] }>("/admin/dashboard")
      .then((d) => setHotels(d.hotels))
      .catch(feedback.error);
  useEffect(() => {
    load();
  }, []);
  async function save(
    h: Omit<Hotel, "id" | "active"> & { id?: string; active: boolean },
    done: string,
  ) {
    setBusy(true);
    try {
      await post("/admin/hotels", { ...h, image: h.image || undefined });
      feedback.ok(done);
      setEditing(false);
      await load();
    } catch (e) {
      feedback.error(e);
    } finally {
      setBusy(false);
    }
  }
  async function remove(h: Hotel) {
    if (
      !(await feedback.confirm({
        title: h.name + " silinsin mi?",
        body: "Otel siteden ve listeden kaldırılır. Geçici olarak gizlemek için 'Yayından kaldır' yeterlidir.",
        confirmLabel: "Oteli sil",
        danger: true,
      }))
    )
      return;
    try {
      await api("/admin/hotels/" + h.id, { method: "DELETE" });
      feedback.ok("Otel silindi.");
      await load();
    } catch (e) {
      feedback.error(e);
    }
  }
  return (
    <>
      <p className="muted">
        Yalnızca acentenin anlaşmasını doğruladığı otelleri yayımlayın.
      </p>
      {editing === false && (
        <button className="btn" onClick={() => setEditing(null)}>
          <Plus size={16} />
          Otel ekle
        </button>
      )}
      {editing !== false && (
        <HotelEditor
          key={editing?.id || "new"}
          hotel={editing}
          busy={busy}
          cancel={() => setEditing(false)}
          save={(h) => save(h, "Otel kaydedildi.")}
        />
      )}
      {!hotels && <p className="admin-empty">Yükleniyor…</p>}
      {hotels && !hotels.length && editing === false && (
        <p className="admin-empty">Henüz otel eklenmedi.</p>
      )}
      <div className="admin-hotel-list">
        {hotels?.map((h) => (
          <article key={h.id}>
            {h.image && <img src={h.image} alt="" loading="lazy" />}
            <div>
              <h3>{h.name}</h3>
              <p>{h.location}</p>
              <small
                className={"status-tag " + (h.active ? "status-confirmed" : "")}
              >
                {h.active ? "Sitede yayında" : "Taslak"}
              </small>
            </div>
            <div className="button-row">
              <button
                className="btn btn-outline btn-small"
                disabled={busy}
                onClick={() =>
                  save(
                    { ...h, active: !h.active },
                    h.active ? "Otel yayından kaldırıldı." : "Otel yayımlandı.",
                  )
                }
              >
                {h.active ? "Yayından kaldır" : "Yayımla"}
              </button>
              <button
                className="text-link"
                onClick={() => {
                  setEditing(h);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                <Pencil size={14} /> Düzenle
              </button>
              <button
                className="text-link danger-text"
                onClick={() => remove(h)}
              >
                <Trash2 size={14} /> Sil
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
function HotelEditor({
  hotel: h,
  busy,
  cancel,
  save,
}: {
  hotel: Hotel | null;
  busy: boolean;
  cancel: () => void;
  save: (
    h: Omit<Hotel, "id" | "active"> & { id?: string; active: boolean },
  ) => void;
}) {
  const [image, setImage] = useState(h?.image || "");
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save({
      ...(h ? { id: h.id } : {}),
      name: String(f.get("name")),
      location: String(f.get("location")),
      description: String(f.get("description")),
      amenities: String(f.get("amenities") || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      image: image || null,
      active: f.get("active") === "on",
    });
  }
  return (
    <form className="admin-editor" onSubmit={submit}>
      <h2>{h ? "Oteli düzenle" : "Yeni otel"}</h2>
      <div className="form-grid">
        <label className="field">
          Otel adı
          <input name="name" required minLength={2} defaultValue={h?.name} />
        </label>
        <label className="field">
          Konum
          <input
            name="location"
            required
            minLength={2}
            placeholder="Kars merkez"
            defaultValue={h?.location}
          />
        </label>
      </div>
      <label className="field">
        Açıklama
        <textarea
          name="description"
          required
          minLength={10}
          defaultValue={h?.description}
        />
      </label>
      <label className="field">
        Özellikler (virgülle ayırın)
        <input
          name="amenities"
          placeholder="Kahvaltı, Wi-Fi"
          defaultValue={h?.amenities.join(", ")}
        />
      </label>
      <div className="hotel-image-field">
        {image && <img src={image} alt="" />}
        <MediaUploadButton
          accept="image/jpeg,image/png,image/webp"
          label={image ? "Fotoğrafı değiştir" : "Fotoğraf yükle"}
          onUploaded={(m) => setImage(m.url)}
        />
        {image && (
          <button
            type="button"
            className="text-link"
            onClick={() => setImage("")}
          >
            Fotoğrafı kaldır
          </button>
        )}
      </div>
      <label className="checkbox-label">
        <input
          name="active"
          type="checkbox"
          defaultChecked={Boolean(h?.active)}
        />
        <span>Otelin anlaşması doğrulandı, sitede yayımla.</span>
      </label>
      <div className="button-row">
        <button className="btn" disabled={busy}>
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Check size={16} />
          )}
          Oteli kaydet
        </button>
        <button type="button" className="text-link" onClick={cancel}>
          Vazgeç
        </button>
      </div>
    </form>
  );
}
