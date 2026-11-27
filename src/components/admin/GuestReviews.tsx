// Panel · Katılımcı yorumları. Tur sonrası e-postadaki bağlantıyla bırakılan yorumlar
// onay bekleyen olarak gelir; onaylanan yorum ilgili tur sayfasında "Doğrulanmış katılımcı"
// etiketiyle, yalnız ad ve soyadın baş harfiyle görünür. Metin değiştirilemez.
import { useEffect, useState } from "react";
import { BadgeCheck, Check, Trash2, Undo2, X } from "lucide-react";
import { api, post } from "../../lib/api";
import { dateLabel } from "../../lib/types";
import { useFeedback } from "./feedback";

type GuestReview = {
  id: string;
  tourId: string;
  tourName: string;
  date: string;
  reference: string;
  name: string;
  rating: number;
  text: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
};
const STATUS: Record<GuestReview["status"], string> = {
  pending: "Onay bekliyor",
  approved: "Yayında",
  rejected: "Reddedildi",
};

export function GuestReviews() {
  const feedback = useFeedback();
  const [items, setItems] = useState<GuestReview[] | null>(null),
    [filter, setFilter] = useState<"pending" | "all">("pending"),
    [busy, setBusy] = useState("");
  const load = () =>
    api<GuestReview[]>("/admin/guest-reviews")
      .then(setItems)
      .catch(feedback.error);
  useEffect(() => {
    load();
  }, []);
  async function act(id: string, fn: () => Promise<unknown>, done: string) {
    setBusy(id);
    try {
      await fn();
      feedback.ok(done);
      await load();
    } catch (e) {
      feedback.error(e);
    } finally {
      setBusy("");
    }
  }
  const pending = (items || []).filter((r) => r.status === "pending").length;
  const visible = (items || []).filter(
    (r) => filter === "all" || r.status === "pending",
  );
  return (
    <section className="guest-review-admin">
      <h2 className="interest-heading">
        <BadgeCheck size={20} /> Katılımcı yorumları{" "}
        {pending ? `· ${pending} onay bekliyor` : ""}
      </h2>
      <p className="muted">
        Tur bittikten sonra onaylı rezervasyon sahiplerine bir kez yorum isteği
        e-postası gider. Onayladığınız yorum ilgili tur sayfasında ad ve soyadın
        baş harfiyle görünür. Yorum metni değiştirilemez; uygunsuz yorumu
        reddedin, kişi isterse silin.
      </p>
      <div className="status-filters" role="group" aria-label="Yorum filtresi">
        <button
          type="button"
          className={"chip" + (filter === "pending" ? " active" : "")}
          aria-pressed={filter === "pending"}
          onClick={() => setFilter("pending")}
        >
          Onay bekleyenler
        </button>
        <button
          type="button"
          className={"chip" + (filter === "all" ? " active" : "")}
          aria-pressed={filter === "all"}
          onClick={() => setFilter("all")}
        >
          Tümü
        </button>
      </div>
      <div className="admin-requests">
        {!items && <p className="admin-empty">Yükleniyor…</p>}
        {items && !visible.length && (
          <p className="admin-empty">
            {filter === "pending"
              ? "Onay bekleyen katılımcı yorumu yok."
              : "Henüz katılımcı yorumu yok."}
          </p>
        )}
        {visible.map((r) => (
          <article
            key={r.id}
            className={
              "request-card status-" +
              (r.status === "pending" ? "new" : r.status)
            }
          >
            <div className="section-heading">
              <h3>
                {r.tourName} · {dateLabel(r.date)}
              </h3>
              <small>{STATUS[r.status]}</small>
            </div>
            <strong>
              {r.name} · {"★".repeat(r.rating)}
              {"☆".repeat(5 - r.rating)} · {r.reference}
            </strong>
            <p>{r.text || "Yalnız puan bıraktı."}</p>
            <div className="passenger-actions">
              {r.status !== "approved" && (
                <button
                  className="btn btn-small"
                  disabled={busy === r.id}
                  onClick={() =>
                    act(
                      r.id,
                      () =>
                        post("/admin/guest-reviews/" + r.id, {
                          status: "approved",
                        }),
                      "Yorum tur sayfasında yayında.",
                    )
                  }
                >
                  <Check size={15} /> Onayla ve yayımla
                </button>
              )}
              {r.status !== "rejected" && (
                <button
                  className="btn btn-outline btn-small"
                  disabled={busy === r.id}
                  onClick={() =>
                    act(
                      r.id,
                      () =>
                        post("/admin/guest-reviews/" + r.id, {
                          status: "rejected",
                        }),
                      r.status === "approved"
                        ? "Yorum yayından kaldırıldı."
                        : "Yorum reddedildi.",
                    )
                  }
                >
                  {r.status === "approved" ? (
                    <Undo2 size={15} />
                  ) : (
                    <X size={15} />
                  )}
                  {r.status === "approved" ? "Yayından kaldır" : "Reddet"}
                </button>
              )}
              <button
                className="btn btn-outline btn-small"
                disabled={busy === r.id}
                onClick={async () => {
                  if (
                    !(await feedback.confirm({
                      title: "Yorum kalıcı olarak silinsin mi?",
                      body: "Bu işlem geri alınamaz. Kişinin silme talebi gibi durumlarda kullanın.",
                      confirmLabel: "Sil",
                      danger: true,
                    }))
                  )
                    return;
                  act(
                    r.id,
                    () =>
                      api("/admin/guest-reviews/" + r.id, { method: "DELETE" }),
                    "Yorum silindi.",
                  );
                }}
              >
                <Trash2 size={15} /> Sil
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
