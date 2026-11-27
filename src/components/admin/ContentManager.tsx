import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Eye,
  EyeOff,
  LoaderCircle,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
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
  documents: string[];
  minParticipants: number;
  minNoticeHours: number;
  cardLabel?: string;
};
type BusinessFields = Record<
  "phone" | "mobile" | "email" | "address" | "hours" | "whatsapp" | "whatsappLabel" | "instagram" | "facebook" | "mapsUrl",
  string
>;
type AnnouncementFields = { enabled: boolean; text: string; textEn: string; link: string };
type ServiceVehicle = { name: string; photos: string[] };
type ServiceFields = { vehicles: ServiceVehicle[] };
const MAX_VEHICLES = 8,
  MAX_VEHICLE_PHOTOS = 10;
type Info<T> = { current: T; defaults: T; edited: boolean; updatedAt: number | null; updatedBy: string | null };
// Paneldeki tur listesi satırı; custom: panelden kopyalanmış, hidden: taslak (sitede yok).
type TourMeta = { id: string; name: string; custom: boolean; hidden: boolean; sourceId: string | null };
// İngilizce (/en): en = panelde girilen, enFallback = girilmeyen alanda kullanılan eski
// çeviri, enStale = Türkçesi İngilizceden sonra değişen alanlar (bkz. server/content.mjs).
type EnKey = (typeof EN_KEYS)[number];
type EnFields = Partial<Pick<TourFields, EnKey>>;
type TourInfo = Info<TourFields> & {
  tour?: TourMeta;
  en?: EnFields;
  enFallback?: EnFields;
  enStale?: EnKey[];
};
const EN_KEYS = [
  "name",
  "subtitle",
  "category",
  "duration",
  "location",
  "season",
  "departure",
  "end",
  "summary",
  "included",
  "excluded",
  "itinerary",
  "note",
  "documents",
  "cardLabel",
] as const;
const EN_LABELS: Record<EnKey, string> = {
  name: "Tur adı",
  subtitle: "Alt başlık",
  category: "Kategori",
  duration: "Süre",
  location: "Güzergâh",
  season: "Sezon",
  departure: "Hareket saati",
  end: "Dönüş saati",
  summary: "Özet",
  included: "Fiyata dahil",
  excluded: "Fiyata dahil değil",
  itinerary: "Program",
  note: "Not",
  documents: "Gerekli belgeler",
  cardLabel: "Kart şeridi yazısı",
};
const LIST_KEYS = ["included", "excluded", "documents"] as const;
// İngilizce formun düz hâli: liste alanları satır satır metin, program adım adım.
type EnDraft = Record<Exclude<EnKey, "itinerary">, string> & {
  itinerary: Itinerary[];
};
const toDraft = (x: EnFields): EnDraft => {
  const d = {} as EnDraft;
  for (const k of EN_KEYS) {
    if (k === "itinerary") d.itinerary = structuredClone(x.itinerary || []);
    else if ((LIST_KEYS as readonly string[]).includes(k))
      d[k] = ((x[k] as string[] | undefined) || []).join("\n");
    else d[k] = (x[k] as string | undefined) || "";
  }
  return d;
};
// Tur adından adres önerisi: "Günübirlik Tiflis" → "gunubirlik-tiflis".
const slugify = (s: string) =>
  s
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşü]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[c] || c)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

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
  const [section, setSection] = useState<string>(catalog.tours[0]?.id || "business"),
    // Taslak kopyalar sitedeki katalogda yok; liste panelden gelir.
    [tourList, setTourList] = useState<TourMeta[]>(() =>
      catalog.tours.map((t) => ({ id: t.id, name: t.name, custom: false, hidden: false, sourceId: null })),
    );
  const refreshList = () =>
    api<TourMeta[]>("/admin/content/tours")
      .then(setTourList)
      .catch(() => {});
  useEffect(() => {
    refreshList();
  }, []);
  return (
    <>
      <p className="muted">
        Sitedeki tur metinlerini, fotoğraflarını ve iletişim bilgilerini buradan güncelleyin. Kaydedince site hemen güncellenir; "Varsayılana dön" ile
        ilk hâline dönebilirsiniz. İngilizce sayfada (/en) görünen metinleri
        turun "İngilizce" sekmesinden girin; İngilizcesi girilmeyen alanda
        Türkçe değişmediyse eski çeviri, yoksa Türkçe görünür.
      </p>
      <label className="field content-picker">
        Düzenlenecek içerik
        <select value={section} onChange={(e) => setSection(e.target.value)}>
          {tourList.map((t) => (
            <option key={t.id} value={t.id}>
              Tur · {t.name}
              {t.custom ? (t.hidden ? " · taslak" : " · kopya") : ""}
            </option>
          ))}
          {isOwner && <option value="business">İletişim bilgileri</option>}
          {isOwner && <option value="announcement">Duyuru şeridi</option>}
        </select>
      </label>
      {section === "business" ? (
        <BusinessEditor key="business" onSaved={onSaved} />
      ) : section === "announcement" ? (
        <AnnouncementEditor key="announcement" onSaved={onSaved} />

      ) : (
        <TourEditor
          key={section}
          id={section}
          tours={tourList}
          onSaved={() => {
            onSaved();
            refreshList();
          }}
          onOpen={(id) => {
            refreshList().then(() => setSection(id));
            onSaved();
          }}
        />
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

function TourEditor({
  id,
  tours,
  onSaved,
  onOpen,
}: {
  id: string;
  tours: TourMeta[];
  onSaved: () => void;
  // Kopyalanan ya da silinen turdan sonra açılacak tur.
  onOpen: (id: string) => void;
}) {
  const [info, setInfo] = useState<TourInfo | null>(null),
    [copying, setCopying] = useState(false),
    [copyName, setCopyName] = useState(""),
    [copyId, setCopyId] = useState(""),
    [copyIdTouched, setCopyIdTouched] = useState(false),
    [f, setF] = useState<TourFields | null>(null),
    [included, setIncluded] = useState(""),
    [excluded, setExcluded] = useState(""),
    [documents, setDocuments] = useState(""),
    [lang, setLang] = useState<"tr" | "en">("tr"),
    [enDraft, setEnDraft] = useState<EnDraft | null>(null),
    // Yalnız elle değiştirilen ya da kayıtta İngilizcesi olan alanlar gönderilir; eski çeviriyle
    // dolu gelen alan gönderilmez, Türkçesi değişirse sunucu onu kendiliğinden bırakır.
    [enTouched, setEnTouched] = useState<Set<EnKey>>(new Set()),
    [enConfirm, setEnConfirm] = useState<Set<EnKey>>(new Set()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const load = (data: TourInfo) => {
    setInfo(data);
    setF(structuredClone(data.current));
    setIncluded(data.current.included.join("\n"));
    setExcluded(data.current.excluded.join("\n"));
    setDocuments((data.current.documents || []).join("\n"));
    const own = data.en || {},
      merged: EnFields = { ...(data.enFallback || {}) };
    for (const k of EN_KEYS)
      if (own[k] !== undefined) Object.assign(merged, { [k]: own[k] });
    setEnDraft(toDraft(merged));
    setEnTouched(new Set());
    setEnConfirm(new Set());
  };
  useEffect(() => {
    api<TourInfo>("/admin/content/tours/" + id)
      .then(load)
      .catch((e) => setError(e.message));
  }, [id]);
  if (!f || !info || !enDraft)
    return error ? (
      <p className="error" role="alert">
        {error}
      </p>
    ) : (
      <p className="muted">
        <LoaderCircle className="spin" size={16} /> Yükleniyor…
      </p>
    );
  // Güncel form üzerine yazılır: yükleme sürerken yapılan değişiklikler silinmez.
  const set = <K extends keyof TourFields>(k: K, v: TourFields[K]) => setF((cur) => (cur ? { ...cur, [k]: v } : cur));
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
  const setEn = <K extends keyof EnDraft>(k: K, v: EnDraft[K]) => {
    setEnDraft((cur) => (cur ? { ...cur, [k]: v } : cur));
    setEnTouched((cur) => new Set(cur).add(k as EnKey));
  };
  // Gönderilecek İngilizce: kayıttaki ya da elle değiştirilen alanlar; boş alan silinir.
  const enPayload = () => {
    const out: Record<string, unknown> = {};
    for (const k of EN_KEYS) {
      if (!enTouched.has(k) && info.en?.[k] === undefined) continue;
      if (k === "itinerary") {
        const steps = enDraft.itinerary.map((s) => ({
          time: s.time.trim(),
          title: s.title.trim(),
          text: s.text.trim(),
        }));
        out[k] = steps.some((s) => s.time || s.title || s.text) ? steps : [];
      } else if ((LIST_KEYS as readonly string[]).includes(k))
        out[k] = lines(enDraft[k]);
      else out[k] = enDraft[k].trim();
    }
    return out;
  };
  const stale = info.enStale || [];
  async function save(reset = false) {
    if (
      reset &&
      !window.confirm(
        "Bu turun metin (İngilizce dahil) ve fotoğrafları ilk hâline dönsün mü? Fiyat ve asgari katılımcı değişmez.",
      )
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = reset
        ? await post<TourInfo>(`/admin/content/tours/${id}/reset`, {})
        : await post<TourInfo>("/admin/content/tours/" + id, {
            ...f,
            included: lines(included),
            excluded: lines(excluded),
            documents: lines(documents),
            en: enPayload(),
            enConfirm: [...enConfirm],
          });
      load(data);
      onSaved();
      setNotice(
        reset
          ? "Varsayılan içerik geri yüklendi."
          : data.enStale?.length
            ? `Kaydedildi, site güncellendi. ${data.enStale.length} alanın Türkçesi İngilizcesinden sonra değişti; İngilizce sekmesine bakın.`
            : "Kaydedildi, site güncellendi.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const meta = info.tour,
    sourceName = meta?.sourceId ? tours.find((t) => t.id === meta.sourceId)?.name || meta.sourceId : "";
  // Turu yeni bir tur olarak kopyalar; kopya taslak açılır ve hemen düzenlenir.
  async function copyTour() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const created = await post<TourInfo>(`/admin/content/tours/${id}/copy`, { id: copyId, name: copyName.trim() });
      onOpen(created.tour?.id || copyId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function setHidden(hidden: boolean) {
    setBusy(true);
    setError("");
    try {
      load(await post<TourInfo>(`/admin/content/tours/${id}/visibility`, { hidden }));
      onSaved();
      setNotice(hidden ? "Tur taslağa alındı; sitede görünmüyor." : "Tur yayında. Seferlerini Sefer planından ekleyebilirsiniz.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function removeTour() {
    if (!window.confirm(`"${info!.current.name}" turu silinsin mi? Bu işlem geri alınamaz.`)) return;
    setBusy(true);
    setError("");
    try {
      await api(`/admin/content/tours/${encodeURIComponent(id)}`, { method: "DELETE" });
      onOpen(meta?.sourceId || tours[0]?.id || "business");
    } catch (e) {
      setError((e as Error).message);
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
        {meta?.custom && (
          <span className={"status-tag" + (meta.hidden ? "" : " status-confirmed")}>
            {meta.hidden ? "Taslak · sitede görünmüyor" : "Yayında"}
          </span>
        )}
        <Saved info={info} />
      </div>
      {/* Kopya tur: kaynağı, yayın durumu ve silme. */}
      {meta?.custom && (
        <div className="tour-copy-status">
          <p>
            Bu tur <strong>{sourceName}</strong> turundan kopyalandı. Adresi: <code>/turlar/{id}</code>.{" "}
            {meta.hidden
              ? "Taslak: adını, programını, gezilecek yerleri ve fiyatını düzenleyip kaydedin, sonra yayınlayın."
              : "Sitede yayında; seferlerini Sefer planından ekleyin."}
          </p>
          <div className="flow-actions">
            {meta.hidden ? (
              <button type="button" className="btn btn-small" disabled={busy} onClick={() => setHidden(false)}>
                <Eye size={15} /> Yayınla
              </button>
            ) : (
              <button type="button" className="btn btn-outline btn-small" disabled={busy} onClick={() => setHidden(true)}>
                <EyeOff size={15} /> Taslağa al
              </button>
            )}
            <button type="button" className="text-link danger-text" disabled={busy} onClick={removeTour}>
              <Trash2 size={15} /> Turu sil
            </button>
          </div>
        </div>
      )}
      {/* Kopyalama: aynı turdan rotası, süresi veya programı farklı yeni bir tur. */}
      <div className="tour-copy-box">
        {copying ? (
          <>
            <p className="form-hint">
              Kopya, bu turun metinleri, fotoğrafları, belgeleri, fiyatı ve araç planıyla <strong>taslak</strong> olarak
              açılır; seferler kopyalanmaz. Düzenleyip yayınlayana kadar sitede görünmez.
            </p>
            <div className="form-grid">
              <label className="field">
                Yeni turun adı
                <input
                  value={copyName}
                  maxLength={80}
                  autoFocus
                  onChange={(e) => {
                    setCopyName(e.target.value);
                    if (!copyIdTouched) setCopyId(slugify(e.target.value));
                  }}
                  placeholder="Ör. Günübirlik Tiflis"
                />
              </label>
              <label className="field">
                Sayfa adresi
                <input
                  value={copyId}
                  maxLength={60}
                  onChange={(e) => {
                    setCopyIdTouched(true);
                    setCopyId(slugify(e.target.value));
                  }}
                  placeholder="gunubirlik-tiflis"
                />
                <small className="muted">rotakarsturizm.com/turlar/{copyId || "…"}</small>
              </label>
            </div>
            <div className="flow-actions">
              <button type="button" className="text-link" onClick={() => setCopying(false)}>
                Vazgeç
              </button>
              <button
                type="button"
                className="btn btn-small"
                disabled={busy || copyName.trim().length < 3 || copyId.length < 3}
                onClick={copyTour}
              >
                <Copy size={15} /> Kopyayı oluştur
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-outline btn-small"
            onClick={() => {
              setCopying(true);
              setCopyName(info.current.name + " (yeni)");
              setCopyId(slugify(info.current.name + " yeni"));
              setCopyIdTouched(false);
            }}
          >
            <Copy size={15} /> Bu turu kopyala
          </button>
        )}
      </div>
      {/* Dil sekmesi: İngilizce sayfada (/en) görünen metinler ayrı girilir. */}
      <div
        className="status-filters content-lang"
        role="tablist"
        aria-label="İçerik dili"
      >
        {(
          [
            ["tr", "Türkçe"],
            ["en", "İngilizce (/en)"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={lang === id}
            className={"chip" + (lang === id ? " active" : "")}
            onClick={() => setLang(id)}
          >
            {label}
            {id === "en" && stale.length > 0 && ` · ${stale.length} uyarı`}
          </button>
        ))}
      </div>
      {stale.length > 0 && lang === "tr" && (
        <p className="content-en-warning" role="status">
          <AlertTriangle size={16} /> {stale.length} alanın Türkçe metni
          İngilizceden sonra değişti:{" "}
          {stale.map((k) => EN_LABELS[k]).join(", ")}. İngilizce sekmesinden
          güncelleyin.
        </p>
      )}
      {lang === "en" ? (
        <TourEnglish
          f={f}
          included={lines(included)}
          excluded={lines(excluded)}
          documents={lines(documents)}
          info={info}
          draft={enDraft}
          touched={enTouched}
          setEn={setEn}
          confirm={enConfirm}
          setConfirm={setEnConfirm}
        />
      ) : (
        <>
        <div className="form-grid">
          {text("name", "Tur adı", 80)}
          {text("subtitle", "Alt başlık", 140)}
          {text("category", "Kategori", 30)}
          {text("duration", "Süre", 40)}
          {text("location", "Güzergâh", 80)}
          <label className="field">
            Kart şeridi yazısı (isteğe bağlı)
            <input
              value={f.cardLabel || ""}
              maxLength={24}
              placeholder="Boşsa güzergâhtaki yer adı yazar"
              onChange={(e) => set("cardLabel", e.target.value)}
            />
            <small className="muted">Tur kartındaki fotoğrafın altındaki renkli şeritte görünür. Ör. "Bakü'de Yılbaşı".</small>
          </label>
          {text("season", "Sezon", 40)}
          {text("departure", "Hareket saati", 20)}
          {text("end", "Dönüş saati", 40)}
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
        <fieldset className="form-grid">
          <legend>Asgari katılımcı (sözleşmede yazılır)</legend>
          <label className="field">
            Asgari katılımcı sayısı
            <input
              type="number"
              min={0}
              max={60}
              step="1"
              value={f.minParticipants || ""}
              placeholder="Yok"
              onChange={(e) => set("minParticipants", Math.max(0, Math.round(Number(e.target.value) || 0)))}
            />
          </label>
          <label className="field">
            Ulaşılamazsa en geç kaç saat önce iptal bildirilir
            <input
              type="number"
              min={0}
              max={720}
              step="1"
              value={f.minNoticeHours || ""}
              placeholder="ör. 48"
              onChange={(e) => set("minNoticeHours", Math.max(0, Math.round(Number(e.target.value) || 0)))}
            />
          </label>
          <p className="muted">
            Doldurulursa ön bilgilendirme formunda ve sözleşmede bu tur için yazılır. Boş bırakılırsa sayı ve süre
            verilmeden genel ifade kalır; konaklamalı paket turlarda yönetmelik sayı ve sürenin yazılmasını ister.
          </p>
        </fieldset>
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
              onUploaded={(m) => setF((cur) => (cur ? { ...cur, gallery: [...cur.gallery, m.url] } : cur))}
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
              <input aria-label="Saat" placeholder="Saat" value={s.time} maxLength={40} onChange={(e) => setStep(i, { time: e.target.value })} />
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
        {/* Yurt dışı turlarında en çok sorulan bilgi: tur sayfasının üstünde renkli kutuda,
            rezervasyonda yolcu bilgileri adımında gösterilir. */}
        <fieldset className="content-documents">
          <legend>Gerekli belgeler ve önemli notlar</legend>
          <p className="form-hint">
            Kimlik, pasaport, vize, muvafakatname, sınır harcı gibi yolcunun mutlaka bilmesi gerekenler. Her satıra bir
            madde yazın (en fazla 12). Tur sayfasının üstünde dikkat çeken kutuda ve rezervasyon sırasında görünür; boş
            bırakılırsa kutu çıkmaz.
          </p>
          <textarea
            rows={5}
            value={documents}
            onChange={(e) => setDocuments(e.target.value)}
            placeholder={"Ör. Pasaport veya yeni tip (çipli) T.C. kimlik kartı\n18 yaş altı için muvafakatname"}
          />
        </fieldset>
        <label className="field">
          Not (sayfanın altında)
          <textarea rows={2} maxLength={600} value={f.note} onChange={(e) => set("note", e.target.value)} />
        </label>
        </>
      )}
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

// İngilizce sekmesi: her çevrilebilir alanın İngilizcesi, yanında güncel Türkçe metin.
// Boş alan /en'de eski çeviriyle (Türkçesi değişmediyse) ya da Türkçe görünür.
function TourEnglish({
  f,
  included,
  excluded,
  documents,
  info,
  draft,
  touched,
  setEn,
  confirm,
  setConfirm,
}: {
  f: TourFields;
  included: string[];
  excluded: string[];
  documents: string[];
  info: TourInfo;
  draft: EnDraft;
  touched: Set<EnKey>;
  setEn: <K extends keyof EnDraft>(k: K, v: EnDraft[K]) => void;
  confirm: Set<EnKey>;
  setConfirm: (next: Set<EnKey>) => void;
}) {
  const tr = (k: EnKey): unknown =>
    k === "included"
      ? included
      : k === "excluded"
        ? excluded
        : k === "documents"
          ? documents
          : f[k];
  const same = (a: unknown, b: unknown) =>
    JSON.stringify(a ?? "") === JSON.stringify(b ?? "");
  // Alanın altındaki durum satırı: eskiyen İngilizce, eski çeviri ya da boş alan.
  const status = (k: EnKey) => {
    const own = info.en?.[k] !== undefined,
      fallback = info.enFallback?.[k] !== undefined,
      trChanged = !same(
        tr(k),
        info.current[k] ??
          ((LIST_KEYS as readonly string[]).includes(k) ? [] : ""),
      );
    if (touched.has(k)) return null;
    if (own && info.enStale?.includes(k))
      return (
        <span className="content-en-note is-warn">
          <span>
            <AlertTriangle size={14} /> Türkçe metin İngilizceden sonra değişti;
            İngilizceyi güncelleyin.
          </span>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={confirm.has(k)}
              onChange={(e) => {
                const next = new Set(confirm);
                if (e.target.checked) next.add(k);
                else next.delete(k);
                setConfirm(next);
              }}
            />
            İngilizce hâlâ doğru
          </label>
        </span>
      );
    if ((own || fallback) && trChanged)
      return (
        <span className="content-en-note is-warn">
          <span>
            <AlertTriangle size={14} /> Türkçeyi değiştirdiniz; İngilizcesini de
            güncelleyin.
          </span>
        </span>
      );
    if (fallback)
      return (
        <span className="content-en-note">
          Eski çeviri kullanılıyor; değiştirebilirsiniz.
        </span>
      );
    // Boş ya da yalnız saat/sayı olan Türkçe metin için not gerekmez.
    if (!own && !draft[k].length && !/^[\d\s:.,·–-]*$/.test(trText(k)))
      return (
        <span className="content-en-note">
          Boş: İngilizce sayfada Türkçesi görünür.
        </span>
      );
    return null;
  };
  const trText = (k: EnKey) => {
    const v = tr(k);
    return Array.isArray(v) ? (v as string[]).join(" · ") : String(v || "");
  };
  const input = (
    k: Exclude<EnKey, "itinerary" | (typeof LIST_KEYS)[number]>,
    max: number,
    long = false,
  ) => (
    <div className="content-en-field">
      <label className="field">
        {EN_LABELS[k]} (İngilizce)
        {long ? (
          <textarea
            rows={k === "summary" ? 4 : 2}
            maxLength={max}
            value={draft[k]}
            onChange={(e) => setEn(k, e.target.value)}
          />
        ) : (
          <input
            value={draft[k]}
            maxLength={max}
            onChange={(e) => setEn(k, e.target.value)}
          />
        )}
        <small className="muted">Türkçe: {trText(k) || "—"}</small>
      </label>
      {status(k)}
    </div>
  );
  const list = (k: (typeof LIST_KEYS)[number]) => (
    <div className="content-en-field">
      <label className="field">
        {EN_LABELS[k]} (İngilizce, her satıra bir madde)
        <textarea
          rows={5}
          value={draft[k]}
          onChange={(e) => setEn(k, e.target.value)}
        />
        <small className="muted">Türkçe: {trText(k) || "—"}</small>
      </label>
      {status(k)}
    </div>
  );
  const rows = Math.max(f.itinerary.length, draft.itinerary.length),
    steps = Array.from(
      { length: rows },
      (_, i) => draft.itinerary[i] || { time: "", title: "", text: "" },
    ),
    setStep = (i: number, patch: Partial<Itinerary>) =>
      setEn(
        "itinerary",
        steps.map((s, j) => (j === i ? { ...s, ...patch } : s)),
      );
  return (
    <div className="content-en">
      <p className="form-hint">
        İngilizce sayfada (/en) bu metinler görünür. Boş bıraktığınız alanda,
        Türkçesi değişmediyse eski çeviri, yoksa Türkçe metin gösterilir. Fiyat,
        tarih ve fotoğraflar Türkçe sekmesindekiyle aynıdır. Filtrelerin
        çalışması için kategori Culture, Nature, Winter, Abroad ya da Overnight;
        günübirlik süre Day trip olmalı.
      </p>
      <div className="form-grid">
        {input("name", 80)}
        {input("subtitle", 140)}
        {input("category", 30)}
        {input("duration", 40)}
        {input("location", 80)}
        {input("cardLabel", 24)}
        {input("season", 40)}
        {input("departure", 20)}
        {input("end", 40)}
      </div>
      {input("summary", 1500, true)}
      <div className="form-grid">
        {list("included")}
        {list("excluded")}
      </div>
      <fieldset className="content-itinerary">
        <legend>Program (İngilizce)</legend>
        {status("itinerary")}
        {steps.map((s, i) => {
          const source = f.itinerary[i];
          return (
            <div className="itinerary-row" key={i}>
              <small className="muted content-en-source">
                {source
                  ? `Türkçe ${i + 1}. adım: ${[source.time, source.title].filter(Boolean).join(" · ")} — ${source.text}`
                  : "Türkçede bu adım yok."}
              </small>
              <input
                aria-label={`${i + 1}. adım saati (İngilizce)`}
                placeholder="Time"
                value={s.time}
                maxLength={40}
                onChange={(e) => setStep(i, { time: e.target.value })}
              />
              <input
                aria-label={`${i + 1}. adım başlığı (İngilizce)`}
                placeholder="Title"
                value={s.title}
                maxLength={80}
                onChange={(e) => setStep(i, { title: e.target.value })}
              />
              <textarea
                aria-label={`${i + 1}. adım açıklaması (İngilizce)`}
                placeholder="Description"
                rows={2}
                value={s.text}
                maxLength={600}
                onChange={(e) => setStep(i, { text: e.target.value })}
              />
              {!source && (
                <div className="itinerary-tools">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Adımı sil"
                    onClick={() =>
                      setEn(
                        "itinerary",
                        steps.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </fieldset>
      {list("documents")}
      {input("note", 600, true)}
    </div>
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

// Sitenin en üstündeki duyuru şeridi: kampanya, yeni rota, bayram programı gibi kısa haberler.
function AnnouncementEditor({ onSaved }: { onSaved: () => void }) {
  const [info, setInfo] = useState<Info<AnnouncementFields> | null>(null),
    [f, setF] = useState<AnnouncementFields | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    api<Info<AnnouncementFields>>("/admin/content/announcement")
      .then((d) => {
        setInfo(d);
        setF(d.current);
      })
      .catch((e) => setError(e.message));
  }, []);
  if (!f || !info) return error ? <p className="error">{error}</p> : null;
  return (
    <form
      className="admin-editor content-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        setNotice("");
        try {
          const d = await post<Info<AnnouncementFields>>("/admin/content/announcement", f);
          setInfo(d);
          setF(d.current);
          onSaved();
          setNotice(d.current.enabled ? "Duyuru sitede yayında." : "Duyuru kapatıldı; sitede görünmüyor.");
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="content-head">
        <h2>Duyuru şeridi</h2>
        <Saved info={info} />
      </div>
      <p className="muted">
        Sitenin en üstünde, menünün üzerinde renkli bir şerit olarak görünür. Ziyaretçi kapatırsa o oturumda yeniden
        çıkmaz; metni değiştirdiğinizde yeniden görünür. İngilizce metin boşsa İngilizce sayfada şerit gösterilmez.
      </p>
      <label className="checkbox-label">
        <input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />
        Duyuru sitede görünsün
      </label>
      <div className="form-grid">
        <label className="field">
          Duyuru metni (Türkçe, en çok 140 karakter)
          <input
            value={f.text}
            maxLength={140}
            required={f.enabled}
            placeholder="Örn. Yılbaşı Van turu satışta: son 6 koltuk"
            onChange={(e) => setF({ ...f, text: e.target.value })}
          />
        </label>
        <label className="field">
          İngilizce metin (isteğe bağlı)
          <input value={f.textEn} maxLength={140} onChange={(e) => setF({ ...f, textEn: e.target.value })} />
        </label>
        <label className="field">
          Bağlantı (isteğe bağlı)
          <input
            value={f.link}
            maxLength={300}
            placeholder="/turlar/van ya da https://…"
            onChange={(e) => setF({ ...f, link: e.target.value })}
          />
        </label>
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

// Paneldeki "Hizmet araçları" sekmesi: önce hizmet seçilir, altında o hizmetin araçları.
export function ServiceVehiclesManager({ catalog, onSaved }: { catalog: Catalog; onSaved: () => void }) {
  const [id, setId] = useState(catalog.services[0]?.id || "");
  return (
    <>
      <p className="muted">
        Hizmet sayfalarındaki "Bu hizmetteki araçlarımız" bölümü. Hizmeti seçin; araç ekleyip kaldırabilir, adını ve
        sırasını değiştirebilir, fotoğraf yükleyebilirsiniz. Kaydedince site hemen güncellenir.
      </p>
      <label className="field content-picker">
        Hizmet
        <select value={id} onChange={(e) => setId(e.target.value)}>
          {catalog.services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} · {s.vehicles?.length || 0} araç
            </option>
          ))}
        </select>
      </label>
      {id && <ServiceEditor key={id} id={id} onSaved={onSaved} />}
    </>
  );
}

// Hizmet sayfasındaki "Bu hizmetteki araçlarımız" kartları: araç adı ve fotoğrafları.
// Her aracın ilk fotoğrafı kartta kapak olur; ziyaretçi tıklayınca hepsi açılır.
function ServiceEditor({ id, onSaved }: { id: string; onSaved: () => void }) {
  const [info, setInfo] = useState<(Info<ServiceFields> & { title: string }) | null>(null),
    [f, setF] = useState<ServiceFields | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const load = (d: Info<ServiceFields> & { title: string }) => {
    setInfo(d);
    setF(structuredClone(d.current));
  };
  useEffect(() => {
    api<Info<ServiceFields> & { title: string }>("/admin/content/services/" + id)
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
  // Güncel form üzerine yazılır: yükleme sürerken yapılan değişiklikler silinmez.
  const setVehicle = (i: number, patch: (v: ServiceVehicle) => ServiceVehicle) =>
    setF((cur) => (cur ? { vehicles: cur.vehicles.map((v, j) => (j === i ? patch(v) : v)) } : cur));
  const moveVehicle = (i: number, d: number) =>
    setF((cur) => {
      if (!cur) return cur;
      const next = [...cur.vehicles];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return { vehicles: next };
    });
  async function save(reset = false) {
    if (reset && !window.confirm("Bu hizmetin araçları ilk hâline dönsün mü?")) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = reset
        ? await post<Info<ServiceFields> & { title: string }>(`/admin/content/services/${id}/reset`, {})
        : await post<Info<ServiceFields> & { title: string }>("/admin/content/services/" + id, {
            vehicles: f!.vehicles.map((v) => ({ ...v, name: v.name.trim() })),
          });
      load(data);
      onSaved();
      setNotice(reset ? "Varsayılan araçlar geri yüklendi." : "Kaydedildi, hizmet sayfası güncellendi.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="admin-editor content-editor"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="content-head">
        <h2>{info.title} · araçlar</h2>
        <Saved info={info} />
      </div>
      <p className="muted">
        Hizmet sayfasındaki "Bu hizmetteki araçlarımız" bölümü. Her aracın ilk fotoğrafı kartta kapak olarak görünür;
        ziyaretçi karta tıklayınca aracın bütün fotoğrafları açılır. Hiç araç kalmazsa bölüm sayfada gösterilmez.
      </p>
      {f.vehicles.map((v, i) => (
        <fieldset className="content-images service-vehicle" key={i}>
          <legend>{i + 1}. araç</legend>
          <label className="field">
            Araç adı
            <input
              value={v.name}
              maxLength={60}
              required
              placeholder="Ör. Mercedes-Benz Vito VIP"
              onChange={(e) => setVehicle(i, (cur) => ({ ...cur, name: e.target.value }))}
            />
          </label>
          <div className="content-gallery">
            {v.photos.map((src, j) => (
              <figure key={src + j}>
                <img src={src} alt={`${v.name || "Araç"}, fotoğraf ${j + 1}`} loading="lazy" />
                {j === 0 && <span className="service-vehicle-cover">Kapak</span>}
                <div>
                  {j > 0 && (
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="Kapak yap"
                      title="Kapak yap"
                      onClick={() => setVehicle(i, (cur) => ({ ...cur, photos: [src, ...cur.photos.filter((_, k) => k !== j)] }))}
                    >
                      <Check size={15} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Fotoğrafı çıkar"
                    title="Fotoğrafı çıkar"
                    onClick={() => setVehicle(i, (cur) => ({ ...cur, photos: cur.photos.filter((_, k) => k !== j) }))}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </figure>
            ))}
          </div>
          {v.photos.length === 0 && <p className="form-hint">Kaydetmeden önce en az bir fotoğraf ekleyin.</p>}
          <div className="service-vehicle-tools">
            {v.photos.length < MAX_VEHICLE_PHOTOS && (
              <MediaUploadButton
                accept="image/jpeg,image/png,image/webp"
                label="Fotoğraf ekle"
                onUploaded={(m) => setVehicle(i, (cur) => ({ ...cur, photos: [...cur.photos, m.url] }))}
              />
            )}
            <span className="itinerary-tools">
              <button type="button" className="icon-btn" aria-label="Aracı yukarı taşı" disabled={i === 0} onClick={() => moveVehicle(i, -1)}>
                <ArrowUp size={15} />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label="Aracı aşağı taşı"
                disabled={i === f.vehicles.length - 1}
                onClick={() => moveVehicle(i, 1)}
              >
                <ArrowDown size={15} />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label="Aracı kaldır"
                onClick={() => {
                  if (window.confirm(`"${v.name || i + 1 + ". araç"}" bu hizmetten kaldırılsın mı?`))
                    setF((cur) => (cur ? { vehicles: cur.vehicles.filter((_, k) => k !== i) } : cur));
                }}
              >
                <Trash2 size={15} />
              </button>
            </span>
          </div>
        </fieldset>
      ))}
      {f.vehicles.length < MAX_VEHICLES && (
        <button
          type="button"
          className="text-link"
          onClick={() => setF((cur) => (cur ? { vehicles: [...cur.vehicles, { name: "", photos: [] }] } : cur))}
        >
          <Plus size={15} /> Araç ekle
        </button>
      )}
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
