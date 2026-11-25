// Sözleşme ve ön bilgilendirme formu PDF olarak maile eklenir (mesafeli satışta
// kalıcı veri saklayıcısı). Türkçe karakterler için sitenin yazı tipi Onest gömülür;
// pdfkit'in standart yazı tipleri ğ, ş, ı, İ harflerini basamaz.
import PDFDocument from "pdfkit";
import * as fontkit from "fontkit";
import { fileURLToPath } from "node:url";

export const PDF_FONT_PATH = fileURLToPath(
  new URL("./assets/fonts/Onest.ttf", import.meta.url),
);
const LOGO_PATH = fileURLToPath(
  new URL("./assets/mail-logo.png", import.meta.url),
);
const font = fontkit.openSync(PDF_FONT_PATH);
// Yazı tipinde olmayan karakter PDF'te boş kutu olur: transfer satırındaki "↔" kısa
// tireye, diğerleri (Gürcüce/Ermenice harfler, emoji) "?" işaretine çevrilir.
const REPLACEMENTS = { "↔": "–" };
export const pdfSafe = (text) =>
  Array.from(String(text ?? ""), (ch) => {
    const cp = ch.codePointAt(0);
    if (cp < 0x20) return " ";
    if (font.hasGlyphForCodePoint(cp)) return ch;
    return REPLACEMENTS[ch] ?? "?";
  }).join("");
const INK = "#1a2846",
  MUTED = "#47536e",
  RULE = "#dde5eb";

export function documentPdf({ title, text }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 60, left: 50, right: 50 },
      bufferPages: true,
      info: { Title: title, Author: "Rota Kars Turizm" },
      font: PDF_FONT_PATH,
    });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.image(LOGO_PATH, doc.page.margins.left, doc.y, { width: 110 });
    doc.moveDown(3.5);
    doc.fillColor(INK).fontSize(16).text(pdfSafe(title));
    doc.moveDown(0.6);
    doc.fillColor(INK).fontSize(10);
    const width =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    for (const line of String(text || "").split("\n")) {
      // Metindeki "———" ayraçları ince bir çizgiye dönüşür.
      if (/^—{3,}$/.test(line.trim())) {
        doc.moveDown(0.4);
        const y = doc.y;
        doc
          .moveTo(doc.page.margins.left, y)
          .lineTo(doc.page.margins.left + width, y)
          .strokeColor(RULE)
          .stroke();
        doc.moveDown(0.6);
        continue;
      }
      doc.text(pdfSafe(line) || " ", { width, lineGap: 2 });
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const bottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0; // altbilgi yeni sayfa açmasın
      doc
        .fillColor(MUTED)
        .fontSize(8)
        .text(
          `Rota Kars Turizm · ${pdfSafe(title)} · Sayfa ${i + 1} / ${range.count}`,
          doc.page.margins.left,
          doc.page.height - 40,
          {
            width,
            align: "center",
            lineBreak: false,
          },
        );
      doc.page.margins.bottom = bottom;
    }
    doc.end();
  });
}
