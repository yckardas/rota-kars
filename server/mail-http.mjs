// E-posta HTTPS üzerinden (Resend API, 443) gönderilir: Railway SMTP bağlantılarını
// zaman aşımına düşürüyor (2026-10'dan beri tüm denemeler ETIMEDOUT). SMTP yedek olarak kalır.
import { renderMail } from "./mail-template.mjs";

// Hangi yolla gönderileceği: RESEND_API_KEY varsa Resend, yoksa SMTP_HOST varsa SMTP.
export function mailDelivery(env = {}) {
  if (!env.MAIL_FROM || !/^https?:\/\//.test(env.PUBLIC_BASE_URL || ""))
    return null;
  if (env.RESEND_API_KEY) return "resend";
  if (env.SMTP_HOST) return "smtp";
  return null;
}

export function resendSender(env, fetchImpl = fetch) {
  return async (item) => {
    const mail = renderMail(item);
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        // Kira süresi dolup aynı kayıt yeniden alınırsa Resend ikinci kopyayı göndermez.
        "Idempotency-Key": item.id,
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        attachments: mail.attachments.map((a) => ({
          filename: a.filename,
          content: Buffer.from(a.content).toString("base64"),
          content_type: a.contentType,
          content_id: a.cid,
        })),
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      const error = new Error(`Resend ${res.status}: ${detail}`);
      error.code = `HTTP_${res.status}`;
      throw error;
    }
  };
}
