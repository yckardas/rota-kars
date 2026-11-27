import { useEffect, useState, type FormEvent } from "react";
import { CreditCard, LoaderCircle } from "lucide-react";
import { api, post } from "../../lib/api";
import { currency, type Reservation } from "../../lib/types";
import { Modal } from "../Modal";
import { useFeedback } from "./feedback";

// Rezervasyondan yolcu çıkarma (kısmi iptal), isteğe bağlı iadeyle birlikte. Seçilen
// yolcuların koltuğu boşalır, bedel kalan yolculara göre yeniden yazılır (transfer kişi
// kademesine göre). Müşteri isteğinde kesintisiz iptal süresi geçtiyse çıkan yolcuların
// kapora payı kesilir; acente kararıyla kesinti yapılmaz. İade, yeni bedeli aşan tahsilat
// kadardır; karta iade bankaya gider, havale / nakit / POS iadesi kayıttır.
type Plan = { fee: number; total: number; refund: number };
type Quote = {
  seats: number[];
  names: string[];
  netPaid: number;
  totalBefore: number;
  share: number;
  late: boolean;
  freeUntil: number;
  transferBefore: number;
  transfer: { amount: number; tierLabel: string } | null;
  customer: Plan;
  agency: Plan;
  card: { paid: number; enabled: boolean; blocked: boolean; customer: string; agency: string };
  canRefundCard: boolean;
};
type Method = "card" | "bank_transfer" | "cash" | "pos" | "later";
type Result = { reservation: Reservation; refund: { status: string; amount: number; message: string } | null };
const stamp = (ms: number) =>
  new Date(ms).toLocaleString("tr-TR", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });

export function RemovePassengersDialog({
  booking: r,
  onClose,
  onDone,
}: {
  booking: Reservation;
  onClose: () => void;
  onDone: () => Promise<void> | void;
}) {
  const feedback = useFeedback();
  // Elle iadenin tekrar koruması: pencere açıkken aynı kimlik gider.
  const [requestId] = useState(() => crypto.randomUUID());
  const [seats, setSeats] = useState<number[]>([]),
    [quote, setQuote] = useState<Quote | null>(null),
    [loading, setLoading] = useState(false),
    [who, setWho] = useState<"customer" | "agency">("customer"),
    [method, setMethod] = useState<Method>("later"),
    [amount, setAmount] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  // Seçim değişince yeni hesap gelene kadar önceki özet görünür kalır (pencere zıplamaz);
  // bu sırada gönderme kapalıdır.
  useEffect(() => {
    setError("");
    if (!seats.length) return setQuote(null);
    let live = true;
    setLoading(true);
    api<Quote>(`/admin/reservations/${r.reference}/removal-quote?seats=${[...seats].sort((a, b) => a - b).join(",")}`)
      .then((q) => {
        if (!live) return;
        setQuote(q);
        const cardOk = q.card.paid > 0 && q.card.enabled && q.canRefundCard;
        setMethod(q.customer.refund + q.agency.refund === 0 ? "later" : cardOk ? "card" : "bank_transfer");
      })
      .catch((e) => {
        if (!live) return;
        setQuote(null);
        setError((e as Error).message);
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [r.reference, seats]);
  const plan = quote ? quote[who] : null,
    suggested = plan?.refund || 0;
  useEffect(() => {
    if (quote) setAmount(String(suggested / 100));
  }, [quote, who]);
  const cents = Math.round(Number(amount) * 100) || 0,
    refunding = Boolean(plan && plan.refund > 0 && method !== "later" && cents > 0),
    cardProblem = quote && refunding && method === "card" && cents === suggested ? quote.card[who] : "",
    cardAvailable = Boolean(quote && quote.card.paid > 0 && quote.card.enabled && quote.canRefundCard),
    toggle = (seat: number) =>
      setSeats((cur) => (cur.includes(seat) ? cur.filter((n) => n !== seat) : [...cur, seat])),
    label = seats.length > 1 ? `${seats.length} yolcuyu çıkar` : "Yolcuyu çıkar";
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!quote || !plan) return;
    const f = new FormData(e.currentTarget),
      refund = refunding
        ? {
            amount: cents,
            method,
            ...(method === "card" ? {} : { note: String(f.get("externalReference") || ""), requestId }),
          }
        : undefined;
    const ok = await feedback.confirm({
      title: `${quote.names.join(", ")} rezervasyondan çıkarılsın mı?`,
      body: (
        <>
          Koltuk {quote.seats.join(", ")} boşa çıkar, yeni toplam {currency(plan.total)} olur ve müşteriye e-posta gider.{" "}
          {refund
            ? method === "card"
              ? `${currency(cents)} karta iade edilir; bu gerçek para hareketidir ve geri alınamaz.`
              : `${currency(cents)} iade kaydı yazılır.`
            : plan.refund > 0
              ? `${currency(plan.refund)} fazla tahsilatın iadesi şimdi yapılmaz; sonra İade sekmesinden yapılabilir.`
              : ""}
        </>
      ),
      confirmLabel: refund && method === "card" ? label + " ve karta iade et" : label,
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setError("");
    try {
      const res = await post<Result>(`/admin/reservations/${r.reference}/remove-passengers`, {
        seats: quote.seats,
        waive: who === "agency",
        ...(refund ? { refund } : {}),
      });
      const done = quote.names.join(", ") + " rezervasyondan çıkarıldı.";
      if (!res.refund || res.refund.status === "succeeded")
        feedback.ok(res.refund ? done + " " + res.refund.message : done);
      // Yolcu çıkarıldı ama iade askıda / reddedildi: uyarı olarak gösterilir.
      else feedback.error(done + " " + res.refund.message);
      await onDone();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={"Yolcu çıkar · " + r.reference} onClose={onClose}>
      <form className="admin-editor cancel-dialog" onSubmit={submit}>
        <fieldset className="choice-row">
          <legend>Çıkarılacak yolcular</legend>
          {r.seats.map((seat, i) => {
            const checked = seats.includes(seat),
              // En az bir yolcu kalır; hepsi için rezervasyonu iptal edin.
              last = !checked && seats.length >= r.seats.length - 1;
            return (
              <label className="checkbox-label" key={seat}>
                <input type="checkbox" checked={checked} disabled={last || busy} onChange={() => toggle(seat)} />
                <span>
                  Koltuk {seat} · {r.passengers[i]}
                </span>
              </label>
            );
          })}
          <small className="muted">Bütün yolcular için rezervasyonu "İptal et" ile iptal edin.</small>
        </fieldset>
        {loading && !quote && (
          <p className="muted">
            <LoaderCircle className="spin" size={15} /> Hesaplanıyor…
          </p>
        )}
        {quote && plan && (
          <>
            {quote.late && quote.customer.fee > 0 && (
              <fieldset className="choice-row">
                <legend>Çıkarma nedeni</legend>
                <label className="checkbox-label">
                  <input type="radio" name="who" checked={who === "customer"} onChange={() => setWho("customer")} />
                  <span>Müşteri isteği (iptal koşullarına göre): kapora payı {currency(quote.customer.fee)} kesilir</span>
                </label>
                <label className="checkbox-label">
                  <input type="radio" name="who" checked={who === "agency"} onChange={() => setWho("agency")} />
                  <span>Acente kararı: kesinti yapılmaz</span>
                </label>
              </fieldset>
            )}
            <p className="form-hint">
              Çıkan yolcu payı <strong>{currency(quote.share)}</strong>
              {quote.transfer && quote.transfer.amount !== quote.transferBefore && (
                <>
                  {" "}
                  (transfer {currency(quote.transferBefore)} → {currency(quote.transfer.amount)}, {quote.transfer.tierLabel})
                </>
              )}
              . Toplam {currency(quote.totalBefore)} → <strong>{currency(plan.total)}</strong>
              {plan.fee > 0 && <> (kesinti {currency(plan.fee)} dahil)</>}. Net tahsilat {currency(quote.netPaid)}.{" "}
              {quote.late
                ? quote.customer.fee > 0
                  ? `Kesintisiz iptal süresi ${stamp(quote.freeUntil)} itibarıyla geçti.`
                  : ""
                : `Kesintisiz iptal süresi içinde (${stamp(quote.freeUntil)} öncesi): kesinti yok.`}
            </p>
            {plan.refund > 0 ? (
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
                    İade tutarı (TL) · en çok {currency(suggested)}
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      max={suggested / 100}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </label>
                )}
              </div>
            ) : (
              <p className="muted">
                Yeni toplam net tahsilatı aşmıyor; iade gerekmez.
                {plan.total > quote.netPaid && ` Kalan borç ${currency(plan.total - quote.netPaid)}.`}
              </p>
            )}
            {plan.refund > 0 && quote.card.paid > 0 && !cardAvailable && (
              <p className="muted">
                {!quote.canRefundCard
                  ? "Karta iade yalnız sahip rolündeki yönetici tarafından yapılabilir."
                  : "Vakıfbank bağlantısı kapalı; karta iade banka panelinden yapılmalı."}
              </p>
            )}
            {refunding && method !== "card" && (
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
            {refunding && method === "card" && (
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
          <button className="btn btn-small danger-text" disabled={busy || !quote || loading || Boolean(cardProblem)}>
            {busy ? <LoaderCircle size={15} className="spin" /> : null}
            {refunding && method === "card" ? label + " ve karta iade et" : label}
          </button>
          <button type="button" className="btn btn-outline btn-small" onClick={onClose} disabled={busy}>
            Vazgeç
          </button>
        </div>
      </form>
    </Modal>
  );
}
