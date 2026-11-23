# Tur bilgi talebi, panelden koltuk kapatma, özel talep kartı — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tur sayfası talebini tur adıyla kaydetmek, panelden kimlikli telefon rezervasyonuyla koltuk kapatmak, Turlar sayfasına özel talep bandı eklemek.

**Architecture:** Mevcut `requests` ve `adminReserve` akışları genişletilir; yeni koleksiyon yok. Kimlik alanları `passenger_details` dizisinde, eksik yolcu `null`.

**Tech Stack:** Node 22 + Express 5 + zod, MongoDB (testlerde `:memory:`), React 19 + Vite, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-23-talep-ve-koltuk-design.md`

## Global Constraints
- Talep türü anahtarı `tour-info`, etiketi "Tur bilgi / fiyat talebi".
- Kimlik alanları panelde isteğe bağlı; doldurulan TR kimlik `tcknValid` ile doğrulanır (`passengerDetail` şeması).
- Tüm yeni herkese açık metinlerin İngilizcesi `src/lib/en/site.ts`'e eklenir.
- Ödeme koduna dokunulmaz.

## Review Focus
- `null` kimlik girdisi pii seal/open ve U-ETDS `missingIds` içinde çökmez → Task 2 testi.
- Kimliği yarım girilmiş yolcu (uyruk var, numara yok) → istemci o yolcuyu `null` gönderir; sunucu tam şemayı ister → Task 2 testi (yarım nesne 400).
- `tour-info` talebinde `tourId` yoksa 400 → Task 1 testi.
- Koltuk taşıma (`move`) sonrası kimlik dizisi korunur (değişmez) → mevcut davranış, dokunulmuyor.
- Seferler tablosundan açılan formda satış kapalı sefer de seçili gelir → Task 3 elle doğrulama.

---

### Task 1: `tour-info` talep türü
**Files:** `server/requests.mjs`, `server/app.mjs:81-104`, `src/components/RequestForm.tsx`, `src/pages/TourDetail.tsx:551`, `src/components/admin/RequestManager.tsx:63`, `src/lib/en/site.ts`, Test: `tests/stay-request.test.mjs`
- [ ] Test `tour info request carries the tour name and requires a tour`: `/requests` `{kind:"tour-info", tourId:"ani-cildir", ...}` → 201, satır `kind==="tour-info"`, acente konusu `/Tur bilgi \/ fiyat talebi: TL-.* · Ani, Çıldır ve Kars/`; `tourId` olmadan → 400.
- [ ] Çalıştır, FAIL gör.
- [ ] `REQUEST_KINDS["tour-info"]`, şemada enum + `.refine(r => r.kind !== "tour-info" || r.tourId)`.
- [ ] RequestForm `kind` birleşimine `"tour-info"`; başlık `"{tour} için bilgi ve fiyat"`; `tourId` tour-info'da da gönderilir. TourDetail `kind="tour-info" tourId tourName initialCheckIn`. RequestManager KIND etiketi + filtre çipi.
- [ ] Testler PASS, commit.

### Task 2: Panel rezervasyonunda isteğe bağlı kimlik + sonradan tamamlama
**Files:** `server/pii.mjs:48-56`, `server/advanced-api.mjs:273-366`, `server/store.mjs:489-515`, `server/workflow.mjs:559-571`, Test: `tests/admin-booking.test.mjs`
- [ ] Test `agency booking stores optional passenger ids and can complete them later`: `adminReserve(base(d,{passengerDetails:[{nationality:"TR",idNumber:<geçerli>,gender:"K"}, null]}))` → `passenger_details[0].idNumber` açık, `[1]===null`; `workflow.passengers(ref, names, [null, {nationality:"DE",idNumber:"C01X00T47",gender:"E"}])` sonrası ikisi de dolu; uzunluk uyuşmazlığı 400.
- [ ] HTTP: `/admin/reservations` `passengerDetails: z.array(passengerDetail.nullable()).optional()`; `/passengers` `details` aynı tip, isteğe bağlı.
- [ ] `sealDetails/openDetails` null'u korur; `adminReserve` → `reserve({passengerDetails})`; `workflow.passengers(reference, names, details?)`.
- [ ] PASS, commit.

### Task 3: Panel arayüzü
**Files:** `src/components/admin/NewReservation.tsx`, `src/components/OperationsDesk.tsx` (Seferler İşlem sütunu, rezervasyon kartı Yolcular sekmesi, araç çubuğu düğmesi)
- [ ] NewReservation: `initialDepartureId?` prop; her koltuk satırında uyruk (TR varsayılan, `countries`), T.C./pasaport, cinsiyet; numara boşsa o yolcu `null`, doluysa tam nesne (cinsiyet zorunlu). TR'de istemci `tcknValid` uyarısı.
- [ ] Seferler satırına "Koltuk kapat" düğmesi → NewReservation o sefer seçili. Araç çubuğu düğmesi "Koltuk kapat / rezervasyon".
- [ ] Rezervasyon kartı: kimliği eksik koltuk "kimlik eksik" etiketi; "Yolcu adları" sekmesi "Yolcular" olur ve kimlik alanlarını düzenler.
- [ ] `npm run typecheck`, tarayıcıda dene, commit.

### Task 4: Turlar sayfası özel talep bandı
**Files:** `src/pages/Tours.tsx`, `src/renkli.css` (gerekirse `.private-journey p`), `src/lib/en/site.ts`
- [ ] Liste sonuna `section.private-journey`: başlık "Aradığınız rota listede yok mu?", kısa metin, düğme "Özel tur ve hizmet talebi" → `RequestForm kind="private-tour"`, arama metni varsa `initialNotes`.
- [ ] typecheck, tarayıcıda masaüstü+mobil, commit.
