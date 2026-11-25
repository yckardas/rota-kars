// Müşteriye ve acenteye giden e-postaların biçimi: düz metin her zaman gönderilir,
// yanında logolu HTML sürümü de olur. Logo e-postaya gömülü (CID) eklenir; böylece
// uzak görselleri engelleyen e-posta programlarında da görünür.
import { readFileSync } from "node:fs";
import QRCode from "qrcode";
import { business } from "./catalog.mjs";
import { tl } from "./legal.mjs";
import { documentPdf } from "./mail-pdf.mjs";

export const LOGO_CID = "logo@rotakarsturizm.com";
export const QR_CID = "qr@rotakarsturizm.com";
const logo = readFileSync(new URL("./assets/mail-logo.png", import.meta.url));
const escape = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// Paragraflar boş satırla, satırlar tek satır sonuyla ayrılır.
const paragraphs = (text) =>
  String(text || "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;line-height:1.6;color:#1a2846;font-size:15px">${escape(p).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
const actionLabel = (url) =>
  /\/bilet\//.test(url) ? "Biletinizi açın" : /\/odeme\//.test(url) ? "Ödemeyi yapın" : "Bağlantıyı açın";

// Bilet kartı satırı: etiket küçük gri, değer lacivert; uzun metin taşmadan kırılır.
const cell = (label, value) =>
  `<div style="font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#47536e">${escape(label)}</div>
<div style="font-size:15px;color:#1a2846;font-weight:600;line-height:1.4">${value}</div>`;
// İki sütunlu satırlarda sütunlar eşit genişlikte (dar sütunda rezervasyon no kırılmasın).
// Her satır kendi tablosu: tek ve iki sütunlu satırlar birbirinin genişliğini bozmaz.
const row = (...cells) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed"><tr>${cells
    .map(
      (c) =>
        `<td valign="top" width="${Math.floor(100 / cells.length)}%" style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;word-break:break-word;overflow-wrap:anywhere">${c}</td>`,
    )
    .join("")}</tr></table>`;
const longDate = (ymd, time) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }) + (time ? ` · ${time}` : "");
// Bilet sayfasındaki QR ile aynı ayar: panel okuyucusu ve baskı için net.
const qrPng = (url) =>
  QRCode.toBuffer(url, {
    errorCorrectionLevel: "M",
    margin: 4,
    scale: 8,
    color: { dark: "#1a2846", light: "#ffffff" },
  });

function ticketCard(t, { qr }) {
  const confirmed = t.status === "confirmed";
  const paidRows = confirmed
    ? [t.paid > 0 && cell("Ödenen", escape(tl(t.paid))), t.balance > 0 && cell("Kalan bakiye", escape(tl(t.balance)))].filter(Boolean)
    : [];
  // Ödenecek ve ödenen yoksa (ör. ücretsiz kayıt) toplam yine görünür.
  const amounts = paidRows.length ? paidRows : [cell("Toplam tutar", escape(tl(t.total)))];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fa;border:1px solid #dde5eb;border-radius:6px;margin:4px 0 18px">
<tr><td style="padding:18px 20px">
${confirmed ? "" : `<div style="display:inline-block;margin:0 0 10px;padding:3px 9px;border-radius:3px;background:#fff4d6;color:#7a5a00;font:600 12px Arial,Helvetica,sans-serif">Onay bekliyor</div>`}
<div style="font:700 17px Arial,Helvetica,sans-serif;color:#1a2846;letter-spacing:.02em;line-height:1.35;word-break:break-word;overflow-wrap:anywhere">${escape(String(t.tour || "").toLocaleUpperCase("tr-TR"))}</div>
<div style="font:15px Arial,Helvetica,sans-serif;color:#c2342b;margin:4px 0 6px">${escape(longDate(t.date, t.time))}</div>
${row(cell("Buluşma", escape(t.pickup)))}
${t.transfer ? row(cell("Transfer", escape(t.transfer))) : ""}
${row(cell((t.seats || []).length > 1 ? "Koltuklar" : "Koltuk", escape((t.seats || []).join(", "))), cell("Rezervasyon", escape(t.reference)))}
${amounts.length ? row(...amounts) : ""}
${
  qr
    ? `<div style="text-align:center;margin:14px 0 0"><img src="cid:${QR_CID}" width="180" height="180" alt="Bilet QR kodu" style="display:inline-block;border:0;width:180px;height:180px">
<div style="font:13px Arial,Helvetica,sans-serif;color:#47536e;margin-top:4px">Girişte bu kodu gösterin</div></div>`
    : ""
}
</td></tr></table>`;
}

// Mail hazırlanamazsa (PDF/QR) hata sağlayıcı hatasından ayrılır: panel doğru sebebi gösterir.
export async function renderForSend(item) {
  try {
    return await renderMail(item);
  } catch (e) {
    throw Object.assign(new Error(`Mail hazırlanamadı: ${e?.message || e}`), { code: "RENDER_FAILED" });
  }
}

export async function renderMail({ recipient, subject, body, action_url: url, ticket = null, documents = null }) {
  if (ticket) return renderTicketMail({ recipient, subject, url, ticket, documents: documents || [] });
  return renderPlainMail({ recipient, subject, body, url });
}

const shell = ({ subject, content }) => {
  const contact = [business.phone, business.email].filter(Boolean).map(escape).join(" · ");
  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(subject)}</title></head>
<body style="margin:0;padding:0;background:#e9eef1">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e9eef1;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:5px;border-top:4px solid #c2342b">
<tr><td style="padding:24px 28px 8px">
<img src="cid:${LOGO_CID}" width="137" height="50" alt="${escape(business.name)}" style="display:block;border:0;height:50px;width:137px">
</td></tr>
<tr><td style="padding:16px 28px 8px;font-family:Arial,Helvetica,sans-serif">
${content}
</td></tr>
<tr><td style="padding:16px 28px 22px;border-top:1px solid #dde5eb;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#47536e">
<strong style="color:#1a2846">${escape(business.name)}</strong> · TÜRSAB ${escape(business.licenseGroup || "A")} Grubu ${escape(business.tursabNo)}<br>
${contact}<br>${escape(business.address)}
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
};
const logoAttachment = () => ({ filename: "rota-kars.png", content: logo, contentType: "image/png", cid: LOGO_CID });
const button = (safeUrl) =>
  `<p style="margin:8px 0 18px"><a href="${escape(safeUrl)}" style="display:inline-block;background:#c2342b;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:4px">${actionLabel(safeUrl)}</a></p>
<p style="margin:0 0 14px;font-size:12px;color:#47536e;word-break:break-all">${escape(safeUrl)}</p>`;

async function renderTicketMail({ recipient, subject, url, ticket: t, documents }) {
  const safeUrl = url && /^https?:\/\//.test(url) ? url : null;
  const qr = t.status === "confirmed" && safeUrl;
  const [qrContent, pdfs] = await Promise.all([qr ? qrPng(safeUrl) : null, Promise.all(documents.map((d) => documentPdf(d)))]);
  const names = documents.map((d) => d.title);
  const amountText =
    t.status === "confirmed"
      ? [t.paid > 0 && `Ödenen: ${tl(t.paid)}`, t.balance > 0 && `Kalan bakiye: ${tl(t.balance)}`].filter(Boolean).join(" · ") ||
        `Toplam tutar: ${tl(t.total)}`
      : `Toplam tutar: ${tl(t.total)} (onay bekliyor)`;
  const text = [
    t.headline,
    `Merhaba ${t.name},`,
    `${t.reference} · ${t.tour}`,
    `${longDate(t.date, t.time)} · Koltuk: ${(t.seats || []).join(", ")}`,
    t.pickup ? `Buluşma: ${t.pickup}` : "",
    t.transfer || "",
    amountText,
    url || "",
    names.length ? `Ekler: ${names.join(", ")} (PDF)` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const content = `<p style="margin:0 0 6px;font-size:20px;font-weight:700;color:#1a2846;line-height:1.3">${escape(t.headline)}</p>
<p style="margin:0 0 14px;font-size:15px;color:#1a2846">Merhaba ${escape(t.name)},</p>
${ticketCard(t, { qr })}
${safeUrl ? button(safeUrl) : ""}
${names.length ? `<p style="margin:0 0 14px;font-size:13px;color:#47536e">Ekler: ${names.map((n) => escape(n) + " (PDF)").join(" · ")}</p>` : ""}`;
  return {
    to: recipient,
    subject,
    text,
    html: shell({ subject, content }),
    attachments: [
      logoAttachment(),
      ...(qrContent ? [{ filename: "bilet-qr.png", content: qrContent, contentType: "image/png", cid: QR_CID }] : []),
      ...documents.map((d, i) => ({ filename: d.filename, content: pdfs[i], contentType: "application/pdf" })),
    ],
  };
}

function renderPlainMail({ recipient, subject, body, url }) {
  const text = body + (url ? "\n\n" + url : "");
  const safeUrl = url && /^https?:\/\//.test(url) ? url : null;
  const content = `${paragraphs(body)}
${safeUrl ? button(safeUrl) : ""}`;
  return { to: recipient, subject, text, html: shell({ subject, content }), attachments: [logoAttachment()] };
}
