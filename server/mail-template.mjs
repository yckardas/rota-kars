// Müşteriye ve acenteye giden e-postaların biçimi: düz metin her zaman gönderilir,
// yanında logolu HTML sürümü de olur. Logo e-postaya gömülü (CID) eklenir; böylece
// uzak görselleri engelleyen e-posta programlarında da görünür.
import { readFileSync } from "node:fs";
import { business } from "./catalog.mjs";

export const LOGO_CID = "logo@rotakarsturizm.com";
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
const actionLabel = (url) => (/\/bilet\//.test(url) ? "Biletinizi açın" : "Bağlantıyı açın");

export function renderMail({ recipient, subject, body, action_url: url }) {
  const text = body + (url ? "\n\n" + url : "");
  const safeUrl = url && /^https?:\/\//.test(url) ? url : null;
  const contact = [business.phone, business.email].filter(Boolean).map(escape).join(" · ");
  const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(subject)}</title></head>
<body style="margin:0;padding:0;background:#e9eef1">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e9eef1;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:5px;border-top:4px solid #c2342b">
<tr><td style="padding:24px 28px 8px">
<img src="cid:${LOGO_CID}" width="137" height="50" alt="${escape(business.name)}" style="display:block;border:0;height:50px;width:137px">
</td></tr>
<tr><td style="padding:16px 28px 8px;font-family:Arial,Helvetica,sans-serif">
${paragraphs(body)}
${
  safeUrl
    ? `<p style="margin:8px 0 18px"><a href="${escape(safeUrl)}" style="display:inline-block;background:#c2342b;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:4px">${actionLabel(safeUrl)}</a></p>
<p style="margin:0 0 14px;font-size:12px;color:#47536e;word-break:break-all">${escape(safeUrl)}</p>`
    : ""
}
</td></tr>
<tr><td style="padding:16px 28px 22px;border-top:1px solid #dde5eb;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#47536e">
<strong style="color:#1a2846">${escape(business.name)}</strong> · TÜRSAB ${escape(business.licenseGroup || "A")} Grubu ${escape(business.tursabNo)}<br>
${contact}<br>${escape(business.address)}
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
  return {
    to: recipient,
    subject,
    text,
    html,
    attachments: [{ filename: "rota-kars.png", content: logo, contentType: "image/png", cid: LOGO_CID }],
  };
}
