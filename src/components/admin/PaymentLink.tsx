import { useState } from "react";
import { Copy, CreditCard, LoaderCircle, Mail, MessageCircle } from "lucide-react";
import { post } from "../../lib/api";
import { currency, type Reservation } from "../../lib/types";
import { waNumber } from "../../lib/phone";
import { whatsappLink } from "../../lib/whatsapp";
import { useFeedback } from "./feedback";

// Müşteriye kartla ödeme bağlantısı: ön rezervasyonda kalan kapora, onaylanmış
// rezervasyonda kalan bakiye. Müşteri bağlantıdan Vakıfbank 3D Secure ile öder;
// ödeme rezervasyona kendiliğinden işlenir (elle kayıt gerekmez).
export function PaymentLink({ booking: r, onSent }: { booking: Reservation; onSent?: () => void }) {
  const feedback = useFeedback();
  const [link, setLink] = useState<{ url: string; amount: number } | null>(null),
    [busy, setBusy] = useState<"" | "link" | "email">("");
  async function get(send?: "email") {
    setBusy(send || "link");
    try {
      const res = await post<{ url: string; amount: number; sent?: boolean }>(
        "/admin/reservations/" + r.reference + "/payment-link",
        send ? { send } : {},
      );
      setLink(res);
      if (send) {
        feedback.ok(`Ödeme bağlantısı ${r.email} adresine gönderildi.`);
        onSent?.();
      }
      return res;
    } catch (e) {
      feedback.error(e);
      return null;
    } finally {
      setBusy("");
    }
  }
  async function copy() {
    const res = link || (await get());
    if (!res) return;
    try {
      await navigator.clipboard.writeText(res.url);
      feedback.ok("Bağlantı kopyalandı.");
    } catch {
      window.prompt("Bağlantıyı kopyalayın:", res.url);
    }
  }
  async function whatsapp() {
    const res = link || (await get());
    const wa = waNumber(r.phone);
    if (!res || !wa) return;
    window.open(
      whatsappLink(
        wa,
        `Merhaba ${r.name}, ${r.reference} numaralı rezervasyonunuzun ${r.status === "confirmed" ? "kalan" : "kapora"} tutarı ${currency(res.amount)}. Bu bağlantıdan kartla güvenle ödeyebilirsiniz (3D Secure): ${res.url}`,
      ),
      "_blank",
      "noopener",
    );
  }
  return (
    <div className="payment-link-box">
      <p>
        <CreditCard size={15} /> <strong>Müşteri kartla ödesin</strong>
        <br />
        <small className="muted">
          Bağlantıdan Vakıfbank güvenli ödeme sayfasında öder; tahsilat rezervasyona kendiliğinden işlenir.
        </small>
      </p>
      <div className="desk-action-buttons">
        <button type="button" className="btn btn-outline btn-small" onClick={copy} disabled={Boolean(busy)}>
          {busy === "link" ? <LoaderCircle size={15} className="spin" /> : <Copy size={15} />} Bağlantıyı kopyala
        </button>
        {waNumber(r.phone) && (
          <button type="button" className="btn btn-outline btn-small" onClick={whatsapp} disabled={Boolean(busy)}>
            <MessageCircle size={15} /> WhatsApp ile gönder
          </button>
        )}
        {r.email && (
          <button type="button" className="btn btn-outline btn-small" onClick={() => get("email")} disabled={Boolean(busy)}>
            {busy === "email" ? <LoaderCircle size={15} className="spin" /> : <Mail size={15} />} E-postayla gönder
          </button>
        )}
      </div>
      {link && <code className="payment-link-url">{link.url}</code>}
    </div>
  );
}
