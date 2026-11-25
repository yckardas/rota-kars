// Sözleşme ve ön bilgilendirme formu maile PDF eki olarak gider (kalıcı veri saklayıcısı).
// Türkçe karakterler gömülü yazı tipiyle basılır; uzun metin sayfalara bölünür.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fontkit from "fontkit";
import { documentPdf, pdfSafe, PDF_FONT_PATH } from "../server/mail-pdf.mjs";

const pages = (pdf) =>
  (pdf.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) || []).length;

test("PDF embeds its own font instead of the standard Helvetica", async () => {
  const pdf = await documentPdf({
    title: "Tur Hizmet Sözleşmesi",
    text: "Çıldır Gölü, Iğdır, İstanbul — ğüşöç",
  });
  assert.ok(Buffer.isBuffer(pdf));
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  const raw = pdf.toString("latin1");
  assert.match(raw, /\/FontFile2/, "TrueType yazı tipi gömülü");
  assert.doesNotMatch(
    raw,
    /Helvetica/,
    "standart (Türkçesiz) yazı tipi kullanılmaz",
  );
});

test("the embedded font covers every Turkish letter", () => {
  const font = fontkit.openSync(PDF_FONT_PATH);
  for (const ch of "ğşıİçöüĞŞÇÖÜ")
    assert.ok(
      font.hasGlyphForCodePoint(ch.codePointAt(0)),
      `${ch} için glif var`,
    );
});

test("long legal text flows onto several pages and stays small", async () => {
  const text = Array.from(
    { length: 400 },
    (_, i) =>
      `MADDE ${i + 1}. Müşteri, iptal ve iade koşullarını okuduğunu kabul eder.`,
  ).join("\n");
  const pdf = await documentPdf({ title: "Ön Bilgilendirme Formu", text });
  // 400 satır ≈ 8 A4 sayfası: satırlar kırpılmadan akarsa sayfa sayısı buna yakın olur.
  assert.ok(pages(pdf) >= 7, `sayfa sayısı ${pages(pdf)}`);
  assert.ok(pdf.length < 500 * 1024, `boyut ${pdf.length} bayt`);
});

// Onest'te olmayan karakterler (ör. transfer satırındaki "↔", Gürcüce/Ermenice adlar)
// PDF'te boş kutu olarak basılırdı; yazı tipinde karşılığı olanlarla değiştirilir.
test("characters the font lacks are replaced so no blank boxes reach the PDF", () => {
  const font = fontkit.openSync(PDF_FONT_PATH);
  assert.equal(
    pdfSafe("Transfer: Kars Havalimanı ↔ Kars merkez"),
    "Transfer: Kars Havalimanı – Kars merkez",
  );
  assert.equal(pdfSafe("Yolcu: ნინო"), "Yolcu: ????");
  assert.equal(
    pdfSafe("Çıldır · ğüşöç İ 2.400,00 TL"),
    "Çıldır · ğüşöç İ 2.400,00 TL",
    "Türkçe metin aynen kalır",
  );
  for (const ch of pdfSafe("Kars ↔ Ani · ნ Ա 😀"))
    assert.ok(font.hasGlyphForCodePoint(ch.codePointAt(0)), `glif yok: ${ch}`);
});
