import { useEffect, useState, type FormEvent } from "react";
import { CreditCard, LoaderCircle } from "lucide-react";
import { api, post } from "../../lib/api";
import { currency } from "../../lib/types";
import { useFeedback } from "./feedback";

// Kartla (Vakıfbank sanal POS) alınmış tahsilatın karta iadesi. Aynı gün yalnız
// tamamı iptal edilir, sonraki günler kısmi iade yapılabilir. İade kaydı yalnız
// banka onayından sonra yazılır; yanıt alınamayan iade askıya alınır ve burada
// banka paneline bakılarak sonuçlandırılır. Bankaya iade yalnız sahip rolündedir.
type Refund = {
  id: string;
  amount: number;
  type: "cancel" | "refund";
  status: "pending" | "succeeded" | "failed" | "unknown" | "not_recorded" | "resolving";
  createdAt: number;
  by: string;
  resultCode: string;
  resultDetail: string;
  resolvedBy: string;
  resolvable: boolean;
};
type CardPayment = {
  id: string;
  amount: number;
  paidAt: number;
  transactionId: string;
  maskedPan: string;
  refunded: number;
  refundable: number;
  sameDay: boolean;
  refunds: Refund[];
};
type CardPayments = {
  netPaid: number;
  blocked: boolean;
  canRefund: boolean;
  enabled: boolean;
  payments: CardPayment[];
};
const STATUS: Record<Refund["status"], string> = {
  pending: "Bankada işleniyor",
  succeeded: "Gerçekleşti",
  failed: "Gerçekleşmedi",
  unknown: "Askıda · banka yanıtı yok",
  not_recorded: "Askıda · kayıt yazılamadı",
  resolving: "Sonuçlandırılıyor",
};
const stamp = (ms: number) =>
  new Date(ms).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const last4 = (pan: string) => (pan ? "**** " + pan.slice(-4) : "kart");

export function CardRefunds({ reference, onChange }: { reference: string; onChange: () => Promise<void> | void }) {
  const feedback = useFeedback();
  const [data, setData] = useState<CardPayments | null>(null),
    [busy, setBusy] = useState(false);
  const load = () =>
    api<CardPayments>("/admin/reservations/" + reference + "/card-payments")
      .then(setData)
      .catch(feedback.error);
  useEffect(() => {
    load();
  }, [reference]);
  async function run(task: () => Promise<{ status: string; message?: string }>) {
    setBusy(true);
    try {
      const result = await task();
      if (result.status === "succeeded" || result.status === "failed") feedback.ok(result.message || "Kaydedildi.");
      // Askıya alınan iade başarı sayılmaz: uyarı olarak gösterilir.
      else feedback.error(result.message || "İade askıya alındı.");
    } catch (e) {
      feedback.error(e);
    } finally {
      setBusy(false);
      await load();
      await onChange();
    }
  }
  async function refund(e: FormEvent<HTMLFormElement>, p: CardPayment) {
    e.preventDefault();
    const amount = p.sameDay ? p.amount : Math.round(Number(new FormData(e.currentTarget).get("amount")) * 100);
    const cancel = p.sameDay;
    const ok = await feedback.confirm({
      title: cancel ? `${currency(amount)} kart ödemesi iptal edilsin mi?` : `${currency(amount)} karta iade edilsin mi?`,
      body: (
        <>
          {cancel
            ? "Ödeme bugün alındığı için bankada iptal edilir; tutarın tamamı karta döner."
            : "Tutar bankaya iade olarak gönderilir; karta yansıması bankaya göre birkaç gün sürebilir."}{" "}
          Kart {last4(p.maskedPan)}. Bu işlem gerçek para hareketidir ve geri alınamaz.
        </>
      ),
      confirmLabel: cancel ? "Ödemeyi iptal et" : "Karta iade et",
      danger: true,
    });
    if (!ok) return;
    await run(() =>
      post("/admin/reservations/" + reference + "/card-refunds", { paymentId: p.id, amount, confirm: true }),
    );
  }
  async function resolve(x: Refund, outcome: "succeeded" | "failed") {
    const ok = await feedback.confirm({
      title: outcome === "succeeded" ? "İade bankada gerçekleşti mi?" : "İade bankada gerçekleşmedi mi?",
      body:
        outcome === "succeeded"
          ? `Vakıfbank üye işyeri panelinde ${currency(x.amount)} iadeyi gördüyseniz onaylayın. İade kaydı rezervasyona yazılır.`
          : "Banka panelinde bu iade yoksa onaylayın. İade düşer ve yeniden iade yapılabilir.",
      confirmLabel: outcome === "succeeded" ? "Gerçekleşti" : "Gerçekleşmedi",
      danger: outcome === "failed",
    });
    if (!ok) return;
    await run(async () => {
      const res = await post<{ status: string }>("/admin/card-refunds/" + x.id + "/resolve", { outcome, confirm: true });
      return { ...res, message: outcome === "succeeded" ? "İade kaydedildi." : "İade düşürüldü." };
    });
  }
  if (!data) return <p className="muted">Yükleniyor…</p>;
  if (!data.payments.length) return <p className="muted">Bu rezervasyonda kartla alınmış tahsilat yok.</p>;
  return (
    <div className="admin-editor card-refunds">
      <p className="form-hint">
        Bu sekme bankaya gerçek iade gönderir. Bugün alınan ödeme yalnız tamamıyla iptal edilir; kısmi iade ertesi
        günden itibaren yapılabilir. Havale, nakit veya POS iadesi için yukarıdan "Havale / nakit / POS iadesini
        kaydet"i seçin.
        {!data.canRefund && " Karta iade yalnız sahip rolündeki yönetici tarafından yapılabilir."}
        {!data.enabled && " Vakıfbank bağlantısı şu an kapalı; iade banka panelinden yapılmalı."}
      </p>
      {data.blocked && (
        <p className="error">
          Sonucu bilinmeyen bir iade var. Vakıfbank üye işyeri panelinden kontrol edip aşağıdan sonuçlandırın;
          sonuçlanana kadar yeni kart iadesi yapılamaz.
        </p>
      )}
      {data.payments.map((p) => (
        <div key={p.id} className="card-refund">
          <p>
            <CreditCard size={15} /> <strong>{currency(p.amount)}</strong> · {last4(p.maskedPan)} · {stamp(p.paidAt)}
            {p.refunded > 0 && <> · İade edilen {currency(p.refunded)}</>}
            <br />
            <small className="muted">Banka işlem no: {p.transactionId}</small>
          </p>
          {data.canRefund && data.enabled && p.refundable > 0 && (
            <form onSubmit={(e) => refund(e, p)} className={p.sameDay ? "card-refund-row" : "form-grid"}>
              {p.sameDay ? (
                <span className="muted">Bugün alındı: yalnız tamamı ({currency(p.amount)}) iptal edilebilir.</span>
              ) : (
                <label className="field">
                  İade tutarı (TL) · en çok {currency(p.refundable)}
                  <input
                    type="number"
                    name="amount"
                    min="0.01"
                    step="0.01"
                    max={p.refundable / 100}
                    defaultValue={p.refundable / 100}
                    required
                  />
                </label>
              )}
              <div>
                <button className="btn btn-small" disabled={busy}>
                  {busy ? <LoaderCircle size={15} className="spin" /> : <CreditCard size={15} />}
                  {p.sameDay ? "Ödemeyi iptal et" : "Karta iade et"}
                </button>
              </div>
            </form>
          )}
          {p.refunds.length > 0 && (
            <ol className="audit-timeline">
              {p.refunds.map((x) => (
                <li key={x.id}>
                  <time>{stamp(x.createdAt)}</time>
                  <span>
                    {x.type === "cancel" ? "İptal" : "İade"} · {currency(x.amount)} ·{" "}
                    <span className={"status-tag" + (x.status === "succeeded" ? " status-confirmed" : x.status === "failed" ? " status-cancelled" : "")}>
                      {STATUS[x.status] || x.status}
                    </span>
                    {x.by && ` · ${x.by}`}
                    {x.status === "failed" && x.resultDetail && ` · ${x.resultDetail}`}
                    {x.resolvedBy && ` · sonuçlandıran ${x.resolvedBy}`}
                    <br />
                    <small className="muted">İşlem: {x.id}</small>
                  </span>
                  {x.resolvable && data.canRefund && (
                    <span className="desk-action-buttons">
                      <button className="btn btn-small" disabled={busy} onClick={() => resolve(x, "succeeded")}>
                        Gerçekleşti
                      </button>
                      {x.status !== "not_recorded" && (
                        <button className="btn btn-outline btn-small danger-text" disabled={busy} onClick={() => resolve(x, "failed")}>
                          Gerçekleşmedi
                        </button>
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      ))}
    </div>
  );
}
