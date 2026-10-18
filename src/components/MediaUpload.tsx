import { useRef, useState } from "react";
import { Upload, LoaderCircle } from "lucide-react";

export type UploadedMedia = { id: string; url: string; kind: "image" | "video"; size: number };

// Dosyayı yönetici oturumuyla bucket'a yükler ve /media/... adresini döner.
export async function uploadMedia(file: File): Promise<UploadedMedia> {
  const r = await fetch("/api/admin/uploads", {
    method: "POST",
    body: file,
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Rota-Client": "web",
      "X-File-Name": encodeURIComponent(file.name),
    },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || "Dosya yüklenemedi.");
  return data;
}

export function MediaUploadButton({
  accept,
  label,
  onUploaded,
}: {
  accept: string;
  label: string;
  onUploaded: (media: UploadedMedia) => void;
}) {
  const input = useRef<HTMLInputElement>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <span className="media-upload">
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          setError("");
          try {
            onUploaded(await uploadMedia(file));
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      <button
        type="button"
        className="btn btn-small btn-outline"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? <LoaderCircle size={14} className="spin" /> : <Upload size={14} />}
        {busy ? "Yükleniyor…" : label}
      </button>
      {error && (
        <small className="form-error" role="alert">
          {error}
        </small>
      )}
    </span>
  );
}
