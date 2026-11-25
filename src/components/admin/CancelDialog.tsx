import { useEffect, useState, type FormEvent } from "react";
import { CreditCard, LoaderCircle } from "lucide-react";
import { api, post } from "../../lib/api";
import { currency, type Reservation } from "../../lib/types";
import { Modal } from "../Modal";
import { useFeedback } from "./feedback";

// Rezervasyon iptali, isteğe bağlı iadeyle birlikte. İade tutarı iptal ve iade
// koşullarına göre önerilir (müşteri iptali: süre geçtiyse kapora düşülür; acente
// iptali: tamamı). Karta iade bankaya gider; havale / nakit / POS iadesi dışarıda
// yapılan işlemin kaydıdır. Karta iade bugün yapılamıyorsa iptal yapılmadan söylenir.
type Quote = {
  netPaid: number;
  freeUntil: number;
  late: boolean;
  deposit: number;
  requestedAt: number | null;
  customer: { retained: number; refund: number };
  agency: { retained: number; refund: number };
  card: { paid: number; enabled: boolean; blocked: boolean; customer: string; agency: string };
  canRefundCard: boolean;
};
type Method = "card" | "bank_transfer" | "cash" | "pos" | "later";
type Result = { reservation: Reservation; refund: { status: string; amount: number; message: string } | null };
const stamp = (ms: number) =>
  new Date(ms).toLocaleString("tr-TR", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });

export function CancelDialog({
  booking: r,
  onClose,
  onDone,
}: {
  booking: Reservation;
  onClose: () => void;
  onDone: () => Promise<void> | void;
}) {
  const feedback = useFeedback();
  const [quote, setQuote] = useState<Quote | null>(null),
    [who, setWho] = useState<"customer" | "agency">(r.cancellation_requested_at ? "customer" : "agency"),
    [method, setMethod] = useState<Method>("later"),
    [amount, setAmount] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    api<Quote>("/admin/reservations/" + r.reference + "/cancel-quote")
      .then((q) => {
        setQuote(q);
        const cardOk = q.card.paid > 0 && q.card.enabled && q.canRefundCard;
        setMethod(q.netPaid === 0 ? "later" : cardOk ? "card" : "bank_transfer");
      })
      .catch((e) => setError((e as Error).message));
  }, [r.reference]);
  const suggested = quote ? quote[who].refund : 0;
  useEffect(() => {
    if (quote) setAmount(String(suggested / 100));
  }, [quote, who]);
  const cents = Math.round(Number(amount) * 100) || 0,
    cardProblem = quote && method === "card" ? (cents === quote[who].refund ? quote.card[who] : "") : "";
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!quote) return;
    const f = new FormData(e.currentTarget),
      refund =
        method === "later" || cents <= 0
          ? undefined
          : {
              amount: cents,
              method,
              ...(method === "card" ? {} : { externalReference: String(f.get("externalReference") || "") }),
            };
    const ok = await feedback.confirm({
      title: r.reference + " iptal edilsin mi?",
      body: (
        <>
          Koltuklar boşa çıkar ve müşteriye iptal e-postası gider.{" "}
          {refund
            ? method === "card"
              ? `${currency(cents)} karta iade edilir; bu gerçek para hareketidir ve geri alınamaz.`
              : `${currency(cents)} iade kaydı yazılır.`
            : quote.netPaid > 0
              ? `${currency(quote.netPaid)} tahsilatın iadesi şimdi yapılmaz; sonra İade sekmesinden yapılabilir.`
              : ""}
        </>
      ),
      confirmLabel: refund && method === "card" ? "İptal et ve karta iade et" : "Rezervasyonu iptal et",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setError("");
    try {
      const res = await post<Result>("/admin/reservations/" + r.reference + "/cancel", refund ? { refund } : {});
      if (!res.refund || res.refund.status === "succeeded")
        feedback.ok(res.refund ? "Rezervasyon iptal edildi. " + res.refund.message : "Rezervasyon iptal edildi.");
      // İptal yapıldı ama iade askıda / reddedildi: uyarı olarak gösterilir.
      else feedback.error("Rezervasyon iptal edildi. " + res.refund.message);
      await onDone();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const cardAvailable = Boolean(quote && quote.card.paid > 0 && quote.card.enabled && quote.canRefundCard);
  return (
    <Modal title={"İptal · " + r.reference} onClose={onClose}>
      <form className="admin-editor cancel-dialog" onSubmit={submit}>
        {!quote && !error && (
          <p className="muted">
            <LoaderCircle className="spin" size={15} /> Hesaplanıyor…
          </p>
        )}
        {quote && (
          <>
            {quote.netPaid > 0 && (
              <fieldset className="choice-row">
                <legend>İptal eden</legend>
                <label className="checkbox-label">
                  <input type="radio" name="who" checked={who === "customer"} onChange={() => setWho("customer")} />
                  <span>
                    Müşteri isteği (iptal koşullarına göre)
                    {quote.requestedAt && <small className="muted"> · talep {stamp(quote.requestedAt)}</small>}
                  </span>
                </label>
                <label className="checkbox-label">
                  <input type="radio" name="who" checked={who === "agency"} onChange={() => setWho("agency")} />
                  <span>Acente (asgari katılımcı, hava, yol, araç…): tamamı iade</span>
                </label>
              </fieldset>
            )}
            <p className="form-hint">
              Net tahsilat <strong>{currency(quote.netPaid)}</strong>.{" "}
              {quote.netPaid > 0 &&
                (who === "customer"
                  ? quote.late
                    ? `Kesintisiz iptal süresi ${stamp(quote.freeUntil)} itibarıyla geçti: kapora (${currency(quote.customer.retained)}) iade edilmez, ${currency(quote.customer.refund)} iade edilir.`
                    : `Kesintisiz iptal süresi içinde (${stamp(quote.freeUntil)} öncesi): tamamı iade edilir.`
                  : "Acente iptalinde kesinti yapılmaz.")}
            </p>
            {quote.netPaid > 0 && (
              <div className="form-grid">
                <label className="field">
                  İade yöntemi
                  <select value={method} onChange={(e) => setMethod(e.target.value as Method)}>
                    {cardAvailable && <option value="card">Karta iade (Vakıfbank'a gönderilir)</option>}
                    <option value="bank_transfer">Havale / EFT ile iade ettim (kayıt)</option>
                    <option value="cash">Nakit iade ettim (kayıt)</option>
                    <option value="pos">POS cihazından iade ettim (kayıt)</option>
                    <option value="later">İadeyi sonra yapacağım</option>
                  </select>
                </label>
                {method !== "later" && (
                  <label className="field">
                    İade tutarı (TL) · önerilen {currency(suggested)}
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      max={quote.netPaid / 100}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </label>
                )}
              </div>
            )}
            {quote.card.paid > 0 && !cardAvailable && (
              <p className="muted">
                {!quote.canRefundCard
                  ? "Karta iade yalnız sahip rolündeki yönetici tarafından yapılabilir."
                  : "Vakıfbank bağlantısı kapalı; karta iade banka panelinden yapılmalı."}
              </p>
            )}
            {method !== "later" && method !== "card" && quote.netPaid > 0 && (
              <>
                {quote.card.paid > 0 && (
                  <p className="error">Bu seçenek bankaya iade göndermez; kartla alınan ödeme kartta kalır.</p>
                )}
                <label className="field">
                  Dekont / makbuz no veya not (isteğe bağlı)
                  <input name="externalReference" maxLength={200} placeholder="Ör. dekont no, makbuz no, elden alındı" />
                </label>
              </>
            )}
            {method === "card" && cents > 0 && (
              <p className="form-hint">
                <CreditCard size={14} /> Bugün alınan kart ödemesi bankada yalnız tamamıyla iptal edilir; kısmi iade
                yarından itibaren yapılabilir.
              </p>
            )}
            {cardProblem && <p className="error">{cardProblem}</p>}
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="desk-action-buttons">
          <button className="btn btn-small danger-text" disabled={busy || !quote || Boolean(cardProblem)}>
            {busy ? <LoaderCircle size={15} className="spin" /> : null}
            {method === "card" && cents > 0 ? "İptal et ve karta iade et" : "Rezervasyonu iptal et"}
          </button>
          <button type="button" className="btn btn-outline btn-small" onClick={onClose} disabled={busy}>
            Vazgeç
          </button>
        </div>
      </form>
    </Modal>
  );
}
