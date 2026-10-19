import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, LoaderCircle, Plus, RotateCcw, Trash2 } from "lucide-react";
import { api, post } from "../../lib/api";
import type { Catalog } from "../../lib/types";
import { MediaUploadButton } from "../MediaUpload";

type Itinerary = { time: string; title: string; text: string };
type TourFields = {
  name: string;
  subtitle: string;
  category: string;
  duration: string;
  location: string;
  season: string;
  departure: string;
  end: string;
  price: number;
  summary: string;
  image: string;
  gallery: string[];
  included: string[];
  excluded: string[];
  itinerary: Itinerary[];
  note: string;
};
type BusinessFields = Record<
  "phone" | "mobile" | "email" | "address" | "hours" | "whatsapp" | "whatsappLabel" | "instagram" | "facebook" | "mapsUrl",
  string
>;
type Info<T> = { current: T; defaults: T; edited: boolean; updatedAt: number | null; updatedBy: string | null };

const lines = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

// Panelden tur metinleri, fotoğrafları ve iletişim bilgileri.
export function ContentManager({
  catalog,
  isOwner,
  onSaved,
}: {
  catalog: Catalog;
  isOwner: boolean;
  onSaved: () => void;
}) {
  const [section, setSection] = useState<string>(catalog.tours[0]?.id || "business");
  return (
    <>
      <p className="muted">
        Sitedeki tur metinlerini, fotoğraflarını ve iletişim bilgilerini buradan güncelleyin. Kaydedince site hemen
        güncellenir; "Varsayılana dön" ile ilk hâline dönebilirsiniz.
      </p>
      <label className="field content-picker">
        Düzenlenecek içerik
        <select value={section} onChange={(e) => setSection(e.target.value)}>
          {catalog.tours.map((t) => (
            <option key={t.id} value={t.id}>
              Tur · {t.name}
            </option>
          ))}
          {isOwner && <option value="business">İletişim bilgileri</option>}
        </select>
      </label>
      {section === "business" ? (
        <BusinessEditor key="business" onSaved={onSaved} />
      ) : (
        <TourEditor key={section} id={section} onSaved={onSaved} />
      )}
    </>
  );
}

function Saved({ info }: { info: Info<unknown> }) {
  if (!info.edited) return <span className="status-tag">Varsayılan içerik</span>;
  return (
    <span className="status-tag">
      Düzenlendi{info.updatedBy ? " · " + info.updatedBy : ""}
      {info.updatedAt ? " · " + new Date(info.updatedAt).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : ""}
    </span>
  );
}

function TourEditor({ id, onSaved }: { id: string; onSaved: () => void }) {
  const [info, setInfo] = useState<Info<TourFields> | null>(null),
    [f, setF] = useState<TourFields | null>(null),
    [included, setIncluded] = useState(""),
    [excluded, setExcluded] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const load = (data: Info<TourFields>) => {
    setInfo(data);
    setF(structuredClone(data.current));
    setIncluded(data.current.included.join("\n"));
    setExcluded(data.current.excluded.join("\n"));
  };
  useEffect(() => {
    api<Info<TourFields>>("/admin/content/tours/" + id)
      .then(load)
      .catch((e) => setError(e.message));
  }, [id]);
  if (!f || !info)
    return error ? (
      <p className="error" role="alert">
        {error}
      </p>
    ) : (
      <p className="muted">
        <LoaderCircle className="spin" size={16} /> Yükleniyor…
      </p>
    );
  const set = <K extends keyof TourFields>(k: K, v: TourFields[K]) => setF({ ...f, [k]: v });
  const setStep = (i: number, patch: Partial<Itinerary>) =>
    set(
      "itinerary",
      f.itinerary.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    );
  const move = (i: number, d: number) => {
    const next = [...f.itinerary];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    set("itinerary", next);
  };
  async function save(reset = false) {
    if (reset && !window.confirm("Bu turun metin ve fotoğrafları ilk hâline dönsün mü?")) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = reset
        ? await post<Info<TourFields>>(`/admin/content/tours/${id}/reset`, {})
        : await post<Info<TourFields>>("/admin/content/tours/" + id, {
            ...f,
            included: lines(included),
            excluded: lines(excluded),
          });
      load(data);
      onSaved();
      setNotice(reset ? "Varsayılan içerik geri yüklendi." : "Kaydedildi, site güncellendi.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const text = (k: "name" | "subtitle" | "category" | "duration" | "location" | "season" | "departure" | "end", label: string, max: number) => (
    <label className="field">
      {label}
      <input value={f[k]} maxLength={max} onChange={(e) => set(k, e.target.value)} />
    </label>
  );
  return (
    <form
      className="admin-editor content-editor"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="content-head">
        <h2>{info.current.name}</h2>
        <Saved info={info} />
      </div>
      <div className="form-grid">
        {text("name", "Tur adı", 80)}
        {text("subtitle", "Alt başlık", 140)}
        {text("category", "Kategori", 30)}
        {text("duration", "Süre", 40)}
        {text("location", "Güzergâh", 80)}
        {text("season", "Sezon", 40)}
        {text("departure", "Hareket saati", 20)}
        {text("end", "Dönüş saati", 20)}
        <label className="field">
          "Başlayan fiyat" (TL)
          <input
            type="number"
            min={0}
            step="1"
            value={f.price / 100}
            onChange={(e) => set("price", Math.round(Number(e.target.value) * 100))}
          />
        </label>
      </div>
      <label className="field">
        Özet
        <textarea rows={4} maxLength={1500} value={f.summary} onChange={(e) => set("summary", e.target.value)} />
      </label>
      <fieldset className="content-images">
        <legend>Fotoğraflar</legend>
        <div className="content-cover">
          <img src={f.image} alt="Kapak fotoğrafı" />
          <span>
            <strong>Kapak fotoğrafı</strong>
            <MediaUploadButton accept="image/jpeg,image/png,image/webp" label="Yeni kapak yükle" onUploaded={(m) => set("image", m.url)} />
          </span>
        </div>
        <div className="content-gallery">
          {f.gallery.map((src, i) => (
            <figure key={src + i}>
              <img src={src} alt={`Galeri ${i + 1}`} loading="lazy" />
              <div>
                <button type="button" className="icon-btn" aria-label="Kapak yap" title="Kapak yap" onClick={() => set("image", src)}>
                  <Check size={15} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Galeriden çıkar"
                  title="Galeriden çıkar"
                  onClick={() => set("gallery", f.gallery.filter((_, j) => j !== i))}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </figure>
          ))}
        </div>
        {f.gallery.length < 12 && (
          <MediaUploadButton
            accept="image/jpeg,image/png,image/webp"
            label="Galeriye fotoğraf ekle"
            onUploaded={(m) => set("gallery", [...f.gallery, m.url])}
          />
        )}
      </fieldset>
      <div className="form-grid">
        <label className="field">
          Fiyata dahil (her satıra bir madde)
          <textarea rows={5} value={included} onChange={(e) => setIncluded(e.target.value)} />
        </label>
        <label className="field">
          Fiyata dahil değil (her satıra bir madde)
          <textarea rows={5} value={excluded} onChange={(e) => setExcluded(e.target.value)} />
        </label>
      </div>
      <fieldset className="content-itinerary">
        <legend>Program</legend>
        {f.itinerary.map((s, i) => (
          <div className="itinerary-row" key={i}>
            <input aria-label="Saat" placeholder="Saat" value={s.time} maxLength={20} onChange={(e) => setStep(i, { time: e.target.value })} />
            <input aria-label="Başlık" placeholder="Başlık" value={s.title} maxLength={80} onChange={(e) => setStep(i, { title: e.target.value })} required />
            <textarea aria-label="Açıklama" placeholder="Açıklama" rows={2} value={s.text} maxLength={600} onChange={(e) => setStep(i, { text: e.target.value })} />
            <div className="itinerary-tools">
              <button type="button" className="icon-btn" aria-label="Yukarı taşı" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp size={15} />
              </button>
              <button type="button" className="icon-btn" aria-label="Aşağı taşı" disabled={i === f.itinerary.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown size={15} />
              </button>
              <button type="button" className="icon-btn" aria-label="Adımı sil" onClick={() => set("itinerary", f.itinerary.filter((_, j) => j !== i))}>
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {f.itinerary.length < 15 && (
          <button type="button" className="text-link" onClick={() => set("itinerary", [...f.itinerary, { time: "", title: "", text: "" }])}>
            <Plus size={15} /> Adım ekle
          </button>
        )}
      </fieldset>
      <label className="field">
        Not (sayfanın altında)
        <textarea rows={2} maxLength={600} value={f.note} onChange={(e) => set("note", e.target.value)} />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice-success" role="status">
          <Check size={16} /> {notice}
        </p>
      )}
      <div className="flow-actions">
        {info.edited && (
          <button type="button" className="text-link" onClick={() => save(true)} disabled={busy}>
            <RotateCcw size={15} /> Varsayılana dön
          </button>
        )}
        <button className="btn" disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}
          Kaydet
        </button>
      </div>
    </form>
  );
}

function BusinessEditor({ onSaved }: { onSaved: () => void }) {
  const [info, setInfo] = useState<Info<BusinessFields> | null>(null),
    [f, setF] = useState<BusinessFields | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    api<Info<BusinessFields>>("/admin/content/business")
      .then((d) => {
        setInfo(d);
        setF(d.current);
      })
      .catch((e) => setError(e.message));
  }, []);
  if (!f || !info) return error ? <p className="error">{error}</p> : null;
  const field = (k: keyof BusinessFields, label: string, extra: Record<string, unknown> = {}) => (
    <label className="field">
      {label}
      <input value={f[k] || ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...extra} />
    </label>
  );
  return (
    <form
      className="admin-editor content-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        setNotice("");
        try {
          const d = await post<Info<BusinessFields>>("/admin/content/business", f);
          setInfo(d);
          setF(d.current);
          onSaved();
          setNotice("İletişim bilgileri güncellendi.");
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="content-head">
        <h2>İletişim bilgileri</h2>
        <Saved info={info} />
      </div>
      <p className="muted">Sitenin alt kısmı, iletişim sayfası, sohbet botu ve WhatsApp düğmesi bu bilgileri kullanır.</p>
      <div className="form-grid">
        {field("phone", "Sabit telefon", { type: "tel", required: true })}
        {field("mobile", "Cep telefonu", { type: "tel" })}
        {field("whatsapp", "WhatsApp (ülke koduyla, yalnız rakam)", { inputMode: "numeric", pattern: "\\d{10,15}", required: true })}
        {field("whatsappLabel", "WhatsApp görünen numara")}
        {field("email", "E-posta", { type: "email", required: true })}
        {field("hours", "Çalışma saatleri")}
        {field("address", "Adres", { required: true })}
        {field("mapsUrl", "Google Haritalar bağlantısı", { type: "url" })}
        {field("instagram", "Instagram bağlantısı", { type: "url" })}
        {field("facebook", "Facebook bağlantısı", { type: "url" })}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice-success" role="status">
          <Check size={16} /> {notice}
        </p>
      )}
      <button className="btn" disabled={busy}>
        {busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}
        Kaydet
      </button>
    </form>
  );
}
