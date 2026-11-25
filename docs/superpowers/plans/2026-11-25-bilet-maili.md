# Bilet Maili ve PDF Belgeler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Onay ve ön rezervasyon maillerini kısa, QR'lı bilet kartına çevirmek; sözleşme ve ön bilgilendirme formunu PDF eki yapmak.

**Architecture:** Kuyruk kaydı, onay anının anlık görüntüsünü taşır (`ticket` alanları + `documents` metinleri). `renderMail` gönderim anında HTML bileti, gömülü QR PNG'yi ve `pdfkit` ile PDF'leri üretir; Resend ve SMTP aynı çıktıyı kullanır.

**Tech Stack:** Node ESM, `pdfkit` (yeni), mevcut `qrcode`, Resend/nodemailer, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-25-bilet-maili-design.md`

## Global Constraints
- Yasal metinler yalnız bağlantı değil, **PDF eki** olarak gider.
- Türkçe karakterler (ğ, ş, ı, İ, ç, ö, ü) PDF'te gömülü yazı tipiyle basılır; Helvetica/WinAnsi kullanılmaz.
- QR ve logo `cid:` ile gömülü; `data:` veya uzak görsel yok.
- QR, `item.action_url` (`/bilet/<token>`) bağlantısını taşır; renk/ayar `server/advanced-api.mjs:20` ile aynı (`errorCorrectionLevel "M"`, `margin 4`, `scale 8`, dark `#1a2846`, light `#ffffff`).
- `ticket` alanı olmayan eski kuyruk kayıtları bugünkü düz gövde düzeniyle gider.
- İptal, hatırlatma, hesap güvenliği ve acente mailleri değişmez.
- Mevcut biçimsiz dosyalar topluca prettier'dan geçirilmez; yalnız yeni dosyalar biçimlendirilir.

## Review Focus
1. Uzun tur adı / uzun buluşma metni mail kartını taşırmamalı → tablo hücrelerinde `word-break`, Task 2'de uzun metin testi.
2. Müşteri adı veya buluşma metninde HTML (`<b>`, `&`) → kaçışlanmalı; Task 2 testi.
3. Siteden değil acente panelinden eklenen kayıt (`legal = null`, ön bilgilendirme yok) → ek olmadan da düzgün mail; Task 3 testi.
4. Kısmi ödeme: acente onayında hem "Ödenen" hem "Kalan bakiye"; hiç ödeme yoksa yalnız "Kalan bakiye"; Task 2 testi.
5. Uzun sözleşme metni birden çok sayfaya taşmalı, satırlar kesilmemeli; Task 1 testi (sayfa sayısı > 1).

---

### Task 1: PDF üretici

**Files:**
- Create: `server/mail-pdf.mjs`
- Create: `server/assets/fonts/Onest.ttf` (google/fonts deposu, `ofl/onest/Onest[wght].ttf`, OFL) ve `server/assets/fonts/OFL.txt`
- Create: `tests/mail-pdf.test.mjs`
- Modify: `package.json` (`pdfkit` bağımlılığı)

**Interfaces:**
- Produces: `documentPdf({ title: string, text: string }): Promise<Buffer>`; `PDF_FONT_PATH: string` (testler için).

- [ ] **Step 1:** `npm install pdfkit` (ana klasörde, `/Users/yck/rota-kars`; worktree `node_modules` sembolik bağlantısını kullanır) ve yazı tipini indir. Değişken yazı tipi pdfkit'te varsayılan örnekle (wght 400) basılır; bozuk çıkarsa aynı depodan statik bir sürüm ya da `Marcellus` başlık + Onest gövde kullanılır.
- [ ] **Step 2: Failing test** `tests/mail-pdf.test.mjs`:
  - `documentPdf` sonucu `Buffer`, `%PDF-` ile başlar, `/FontFile2` içerir, `Helvetica` içermez.
  - Yazı tipi `"ğşıİçöüĞŞÇÖÜ"` karakterlerinin hepsini kapsar (`fontkit` ile `hasGlyphForCodePoint`; `pdfkit` bağımlılığı olarak gelir).
  - 400 satırlık metin için çıktıdaki `/Type /Page` sayısı (`/Type /Pages` hariç) > 1.
  - 400 satırlık çıktı 500 KB'tan küçük (yazı tipi alt kümelenir).
- [ ] **Step 3:** Çalıştır: `node --test tests/mail-pdf.test.mjs` → modül yok hatasıyla FAIL.
- [ ] **Step 4:** `server/mail-pdf.mjs` içinde `documentPdf` yaz: A4, 50pt kenar boşluğu, üstte `server/assets/mail-logo.png` (genişlik 110), başlık (16pt, `#1a2846`), gövde 10pt satır aralığı 2; metin olduğu gibi akar (`doc.text`), `—` ayraç satırları ince çizgiye dönüşebilir; altbilgide `Sayfa N / M` (`bufferPages: true`); PDF meta: `Title`, `Author: "Rota Kars Turizm"`. Akış `Buffer.concat` ile toplanır.
- [ ] **Step 5:** Test PASS.
- [ ] **Step 6: Commit** `PDF belge üretici (pdfkit, Onest)`.

### Task 2: Bilet maili şablonu

**Files:**
- Modify: `server/mail-template.mjs` (`renderMail` async olur)
- Modify: `server/mail-http.mjs` (`await renderMail`)
- Modify: `server/notifications.mjs` (SMTP yolunda `await renderMail`)
- Modify: `tests/mail-template.test.mjs`, `tests/mail-http.test.mjs` (await'e geçiş)

**Interfaces:**
- Consumes: `documentPdf` (Task 1).
- Produces: `renderMail(item): Promise<{ to, subject, text, html, attachments }>`. `item.ticket` şekli (Task 3 üretir):
  ```
  { headline, name, tour, date: "YYYY-MM-DD", time: "HH:MM", pickup, seats: number[],
    reference, transfer: string|null, total, paid, balance, status: "confirmed"|"pending" }
  ```
  (tutarlar kuruş). `item.documents`: `[{ title, filename, text }]` ya da yok.
- Sabit: `QR_CID = "qr@rotakarsturizm.com"` (dışa aktarılır).

- [ ] **Step 1: Failing tests** `tests/mail-template.test.mjs`'e ekle:
  - Onaylı bilet: `html` başlığı, tur adını, `"28 Kasım 2026 Cumartesi · 08:30"`, `"Koltuk"` + `"4"`, rezervasyon no, `cid:qr@rotakarsturizm.com` içerir; ekler: logo + QR (`image/png`, `cid` = `QR_CID`) + her belge için `application/pdf` (dosya adı `documents[i].filename`); `text` kısa (< 600 karakter) ve sözleşme metnini içermez.
  - Tutar satırları: `{paid: 240000, balance: 0}` → "Ödenen 2.400,00 TL", "Kalan bakiye" yok; `{paid: 72000, balance: 168000}` → ikisi de; `{paid: 0, balance: 240000}` → yalnız "Kalan bakiye 2.400,00 TL".
  - `status: "pending"` → QR eki ve `cid:qr@` yok, "Onay bekliyor" ve "Toplam tutar" var.
  - Ad `"Ayşe <b>Y</b> & Co"` → `Ayşe &lt;b&gt;Y&lt;/b&gt; &amp; Co`; 200 karakterlik tur adı ve buluşma metni hücrelerde `word-break` stiliyle basılır.
  - `ticket` yoksa mevcut testler (eski düzen) aynen geçer; mevcut testler `await renderMail(...)` olur.
- [ ] **Step 2:** `node --test tests/mail-template.test.mjs` → FAIL.
- [ ] **Step 3:** `renderMail` async yap. `ticket` varsa: mevcut logolu kabuk (`border-top #c2342b`, logo, altbilgi) korunur; içeriğe başlık (`headline`), "Merhaba {name}," ve bilet kartı tablosu (açık zemin `#f6f8fa`, kenarlık `#dde5eb`, etiketler küçük gri `#47536e`, değerler `#1a2846`): tur adı (büyük harf, `tr-TR`), tarih·saat (`toLocaleDateString("tr-TR", { weekday:"long", day:"numeric", month:"long", year:"numeric", timeZone:"UTC" })` `date+"T12:00:00Z"` üzerinde), buluşma, koltuk(lar), rezervasyon no, varsa transfer, tutar satırları; onaylıysa ortada QR (`width=180`) ve "Girişte bu kodu gösterin"; kartın altında mevcut buton (`actionLabel`). Belgeler varsa "Ekler: …" satırı. QR `QRCode.toBuffer(action_url, {...Global Constraints ayarları})`. PDF'ler `Promise.all(documents.map(documentPdf))`. `text`: başlık, ad, tur, tarih, koltuk, tutar, bağlantı, ek adları. Para biçimi `legal.mjs`'teki `tl` ile aynı (`legal.mjs`'ten dışa aktarılır, kopyalanmaz).
- [ ] **Step 4:** `server/mail-http.mjs` ve `server/notifications.mjs` SMTP gönderiminde `await renderMail(item)`; `mail-http` testi ek dizisinin tamamını base64'e çevirir (PDF'ler dahil).
- [ ] **Step 5:** `node --test tests/mail-template.test.mjs tests/mail-http.test.mjs tests/mail-pdf.test.mjs` → PASS.
- [ ] **Step 6: Commit** `QR'lı bilet mail şablonu ve PDF ekleri`.

### Task 3: Kuyruk ve iş akışı

**Files:**
- Modify: `server/notifications.mjs` (`enqueueNow` `ticket`, `documents` saklar)
- Modify: `server/workflow.mjs:85-97` (`notify`), `:178-213` (`created`), `:245-271` (`confirm`)
- Modify: `tests/legal.test.mjs:163-183`

**Interfaces:**
- Consumes: Task 2'deki `ticket`/`documents` şekli.
- Produces: `notify(r, event, text, dedupeKey?, { ticket?: boolean, documents?: Array<{title, filename, text}> } = {})` — `ticket: true` ise `r`'den bilet alanları kurulur.

- [ ] **Step 1: Failing test** `tests/legal.test.mjs` güncelle:
  - Ön rezervasyon maili: `createdMail.ticket.status === "pending"`, `createdMail.documents.map(d => d.title)` = `["Ön Bilgilendirme Formu"]`, `documents[0].text` `/ÖN BİLGİLENDİRME FORMU/` içerir, `createdMail.body` sözleşme/form metnini **içermez**.
  - Onay maili (kapora ödenmiş, acente onayı): `ticket.status === "confirmed"`, `ticket.headline === "Rezervasyonunuz acente tarafından onaylandı."`, `ticket.paid === r.deposit`, `ticket.balance === r.total - r.deposit`; `documents` başlıkları `["Tur Hizmet Sözleşmesi", "Ön Bilgilendirme Formu"]`, dosya adları `Tur-Hizmet-Sozlesmesi-<ref>.pdf`, `On-Bilgilendirme-Formu-<ref>.pdf`.
  - Yeni test: `legal` olmadan oluşturulan (acente) rezervasyon onaylanınca `documents` yalnız sözleşmeyi içerir (ön bilgilendirme yok), mail yine `ticket` taşır.
- [ ] **Step 2:** `node --test tests/legal.test.mjs` → FAIL.
- [ ] **Step 3:** `enqueueNow` imzasına `ticket = null, documents = null` ekle ve kayda yaz. `notify` içinde `ticket: true` ise `{ headline: text, name, tour: tourName(r), date, time: r.start_time, pickup, seats, reference, transfer: transferLine(r.transfer) || null, total, paid: r.net_paid || 0, balance: r.balance_due ?? r.total, status: r.status === "confirmed" ? "confirmed" : "pending" }`; `body` kısa özet (bugünkü ilk satırlar, `extra` eklenmez). `created` ön bilgilendirmeyi, `confirm` sözleşme + ön bilgilendirmeyi `documents` olarak geçer; ikisi de `ticket: true`.
- [ ] **Step 4:** `node --test tests/legal.test.mjs tests/admin-booking.test.mjs tests/booking.test.mjs` → PASS.
- [ ] **Step 5: Commit** `Onay ve ön rezervasyon mailleri bilet ve PDF belgeleriyle kuyruğa yazılır`.

### Task 4: Uçtan uca kontrol

- [ ] **Step 1:** `npx tsc -b`, `npm run test:replset`, `npm run test:standalone` → hepsi geçer.
- [ ] **Step 2:** Örnek onaylı ve bekleyen kayıt için `renderMail` çıktısını önizleme HTML'ine (cid görseller data URI'ye çevrilerek) ve PDF'lere yaz; kullanıcıya göster.
- [ ] **Step 3:** Yeni dosyaları prettier'dan geçir, commit, PR.
