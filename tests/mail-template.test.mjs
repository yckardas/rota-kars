// Müşteriye giden bilet e-postası: düz metin korunur, yanında Rota Kars logolu
// HTML sürümü gider; logo e-postaya gömülüdür (uzak görsel engelinden etkilenmez).
import { test } from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import { renderMail, LOGO_CID, QR_CID } from "../server/mail-template.mjs";

const item = {
  recipient: "misafir@example.com",
  subject: "Rota Kars · Rezervasyonunuz onaylandı",
  body: "Merhaba Ayşe <b>Yılmaz</b>,\nRK-ABC123 · Ani, Çıldır ve Kars\n\nKoltuklar: 3, 4.",
  action_url: "https://rotakarsturizm.com/bilet/abc123",
};

test("ticket e-mail carries the embedded logo, escaped text and a ticket button", async () => {
  const mail = await renderMail(item);
  assert.equal(mail.to, "misafir@example.com");
  assert.equal(mail.text, item.body + "\n\n" + item.action_url, "düz metin aynen korunur");
  assert.match(mail.html, new RegExp(`<img src="cid:${LOGO_CID}"`));
  assert.equal(mail.attachments[0].cid, LOGO_CID);
  assert.ok(mail.attachments[0].content.length > 1000, "logo dosyası okunur");
  assert.ok(mail.html.includes("Ayşe &lt;b&gt;Yılmaz&lt;/b&gt;"), "metin HTML'e kaçışlanır");
  assert.ok(!mail.html.includes("<b>Yılmaz"));
  assert.match(mail.html, /href="https:\/\/rotakarsturizm\.com\/bilet\/abc123"[^>]*>Biletinizi açın</);
  assert.match(mail.html, /TÜRSAB A Grubu 13948/);
});

test("non-http action links are not turned into buttons", async () => {
  const mail = await renderMail({ ...item, action_url: "javascript:alert(1)" });
  assert.ok(!mail.html.includes("javascript:"));
  assert.ok(!mail.html.includes("<a "));
});

test("the MIME message contains an inline logo part referenced by the HTML", async () => {
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
  const info = await transport.sendMail({ from: "Rota Kars <bilet@rotakarsturizm.com>", ...(await renderMail(item)) });
  const raw = info.message.toString();
  assert.match(raw, /Content-Type: multipart\/related/);
  assert.match(raw, /Content-Type: text\/html/);
  assert.match(raw, /Content-Type: text\/plain/);
  assert.match(raw, new RegExp(`Content-ID: <${LOGO_CID}>`));
  assert.match(raw, /Content-Disposition: inline/);
});

// Bilet kartı: onay ve ön rezervasyon mailleri kısa bir kart + QR olarak gider;
// sözleşme ve ön bilgilendirme formu gövdeye değil PDF ekine yazılır.
const ticketItem = (ticket = {}, extra = {}) => ({
  ...item,
  subject: "Rota Kars · Ödemeniz alındı, rezervasyonunuz onaylandı.",
  body: "Merhaba Yusuf,\nRK-06AE3816FE · Ani Antik Kenti, Çıldır Gölü, Kars Gezisi",
  ticket: {
    headline: "Ödemeniz alındı, rezervasyonunuz onaylandı.",
    name: "Yusuf",
    tour: "Ani Antik Kenti, Çıldır Gölü, Kars Gezisi",
    date: "2026-11-28",
    time: "08:30",
    pickup: "Kars merkezde ev, otel ve yakın noktalardan alıp bırakma",
    seats: [4],
    reference: "RK-06AE3816FE",
    transfer: null,
    total: 240000,
    paid: 240000,
    balance: 0,
    status: "confirmed",
    ...ticket,
  },
  documents: [
    { title: "Tur Hizmet Sözleşmesi", filename: "Tur-Hizmet-Sozlesmesi-RK-06AE3816FE.pdf", text: "TUR HİZMET SÖZLEŞMESİ\nMADDE 1. TARAFLAR" },
    { title: "Ön Bilgilendirme Formu", filename: "On-Bilgilendirme-Formu-RK-06AE3816FE.pdf", text: "ÖN BİLGİLENDİRME FORMU" },
  ],
  ...extra,
});

test("confirmed ticket: short card with date, seat, reference, embedded QR and PDF attachments", async () => {
  const mail = await renderMail(ticketItem());
  assert.match(mail.html, /Ödemeniz alındı, rezervasyonunuz onaylandı\./);
  assert.match(mail.html, /ANİ ANTİK KENTİ, ÇILDIR GÖLÜ, KARS GEZİSİ/);
  assert.match(mail.html, /28 Kasım 2026 Cumartesi · 08:30/);
  assert.match(mail.html, /Koltuk[\s\S]*?>4</);
  assert.match(mail.html, /RK-06AE3816FE/);
  assert.match(mail.html, new RegExp(`<img src="cid:${QR_CID}"`));
  assert.equal(QR_CID, "qr@rotakarsturizm.com");
  const qr = mail.attachments.find((a) => a.cid === QR_CID);
  assert.equal(qr.contentType, "image/png");
  assert.ok(qr.content.length > 500);
  const pdfs = mail.attachments.filter((a) => a.contentType === "application/pdf");
  assert.deepEqual(pdfs.map((a) => a.filename), ["Tur-Hizmet-Sozlesmesi-RK-06AE3816FE.pdf", "On-Bilgilendirme-Formu-RK-06AE3816FE.pdf"]);
  assert.ok(pdfs.every((a) => a.content.subarray(0, 5).toString() === "%PDF-"));
  assert.match(mail.html, /Tur Hizmet Sözleşmesi/, "ek adları mailde listelenir");
  assert.ok(mail.text.length < 600, `düz metin kısa (${mail.text.length})`);
  assert.doesNotMatch(mail.text + mail.html, /MADDE 1\. TARAFLAR/, "sözleşme gövdeye yazılmaz");
});

test("amount rows: paid, partial payment and unpaid balance", async () => {
  const full = (await renderMail(ticketItem({ paid: 240000, balance: 0 }))).html;
  assert.match(full, /Ödenen[\s\S]*?2\.400,00 TL/);
  assert.doesNotMatch(full, /Kalan bakiye/);
  const partial = (await renderMail(ticketItem({ paid: 72000, balance: 168000 }))).html;
  assert.match(partial, /Ödenen[\s\S]*?720,00 TL/);
  assert.match(partial, /Kalan bakiye[\s\S]*?1\.680,00 TL/);
  const unpaid = (await renderMail(ticketItem({ headline: "Rezervasyonunuz acente tarafından onaylandı.", paid: 0, balance: 240000 }))).html;
  assert.match(unpaid, /Rezervasyonunuz acente tarafından onaylandı\./);
  assert.doesNotMatch(unpaid, /Ödenen/);
  assert.match(unpaid, /Kalan bakiye[\s\S]*?2\.400,00 TL/);
});

test("pending pre-reservation shows no QR and says it awaits approval", async () => {
  const mail = await renderMail(ticketItem({ status: "pending", paid: 0, balance: 240000 }, { documents: [] }));
  assert.ok(!mail.attachments.some((a) => a.cid === QR_CID));
  assert.doesNotMatch(mail.html, /cid:qr@/);
  assert.match(mail.html, /Onay bekliyor/);
  assert.match(mail.html, /Toplam tutar[\s\S]*?2\.400,00 TL/);
  assert.ok(!mail.attachments.some((a) => a.contentType === "application/pdf"));
});

test("ticket card escapes customer text and wraps very long values", async () => {
  const long = "Ç".repeat(200);
  const mail = await renderMail(ticketItem({ name: "Ayşe <b>Y</b> & Co", tour: long, pickup: long }));
  assert.ok(mail.html.includes("Ayşe &lt;b&gt;Y&lt;/b&gt; &amp; Co"));
  assert.ok(!mail.html.includes("<b>Y</b>"));
  assert.match(mail.html, /word-break:break-word/);
});
