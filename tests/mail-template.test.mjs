// Müşteriye giden bilet e-postası: düz metin korunur, yanında Rota Kars logolu
// HTML sürümü gider; logo e-postaya gömülüdür (uzak görsel engelinden etkilenmez).
import { test } from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import { renderMail, LOGO_CID } from "../server/mail-template.mjs";

const item = {
  recipient: "misafir@example.com",
  subject: "Rota Kars · Rezervasyonunuz onaylandı",
  body: "Merhaba Ayşe <b>Yılmaz</b>,\nRK-ABC123 · Ani, Çıldır ve Kars\n\nKoltuklar: 3, 4.",
  action_url: "https://rotakarsturizm.com/bilet/abc123",
};

test("ticket e-mail carries the embedded logo, escaped text and a ticket button", () => {
  const mail = renderMail(item);
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

test("non-http action links are not turned into buttons", () => {
  const mail = renderMail({ ...item, action_url: "javascript:alert(1)" });
  assert.ok(!mail.html.includes("javascript:"));
  assert.ok(!mail.html.includes("<a "));
});

test("the MIME message contains an inline logo part referenced by the HTML", async () => {
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
  const info = await transport.sendMail({ from: "Rota Kars <bilet@rotakarsturizm.com>", ...renderMail(item) });
  const raw = info.message.toString();
  assert.match(raw, /Content-Type: multipart\/related/);
  assert.match(raw, /Content-Type: text\/html/);
  assert.match(raw, /Content-Type: text\/plain/);
  assert.match(raw, new RegExp(`Content-ID: <${LOGO_CID}>`));
  assert.match(raw, /Content-Disposition: inline/);
});
