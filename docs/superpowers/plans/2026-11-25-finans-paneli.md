# Finans Paneli Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Yönetici panelde ciro, tahsilat, alacak, beklenen ödeme, tur bazında satış, ödeme yöntemi, talep hattı ve geçmiş alacakları gün/hafta/ay/aralık olarak gösteren "Finans" sekmesi.

**Architecture:** Hesaplar saf fonksiyonlarda (`server/finance.mjs`): veri girer, rapor nesnesi çıkar; test edilmesi kolay. `workflow.financeReport` veriyi yükleyip bu fonksiyonu çağırır, `GET /api/admin/finance` onu sunar. İstemcide tek bileşen dosyası + elle SVG/CSS grafikler.

**Tech Stack:** Node (Express, zod), Mongo/`:memory:` store, React 19 + TypeScript, node:test.

**Spec:** `docs/superpowers/specs/2026-11-25-finans-paneli-design.md`

## Global Constraints

- Tutarlar kuruş tamsayı; gösterim `currency()` (`src/lib/types.ts`).
- Gün sınırları Europe/Istanbul (`localDate` — `server/departures.mjs`).
- Canlı rezervasyon = durum `cancelled`/`expired` değil (monthReport ile aynı).
- Aylık rapor (`monthReport`) çıktısı ve CSV'si değişmez.
- Yeni npm bağımlılığı yok; grafikler elle SVG/CSS, `src/admin.css` değişkenleriyle, karanlık modda okunur.
- Erişim: sahip + operasyon; rehber 403 (mevcut `roleAllows` zaten engeller — yeni yol GUIDE_ALLOWED'a eklenmez).
- Tahmini talep tutarı arayüzde her yerde "tahmini" etiketli ve soluk/çizgili görünümde.
- Telefonda yatay kaydırma yok.

## Review Focus

1. **Boş dönem** (hiç rezervasyon/tahsilat/talep yok): tüm bölümler sıfır ve boş durum metniyle çizilir, grafik 0'a bölmez → Task 2 testi `empty period`.
2. **Gece yarısı sınırı**: 23:30 İstanbul'da girilen tahsilat o güne sayılır (UTC'ye göre ertesi/önceki gün değil) → Task 2 testi `istanbul day boundary`.
3. **Tamamı iade edilmiş / fazla iadeli kayıt**: kalan bakiye negatif olmaz, alacağa eklenmez (`max(0, …)`) → Task 2 testi `refunded booking`.
4. **Geçersiz aralık** (`from > to`, 366 günden uzun, bozuk tarih): 400 ve okunur Türkçe mesaj → Task 3 testi.
5. **Silinmiş/kataloğa sonradan eklenmiş tur**: rezervasyonun turu `tours` içinde yoksa ad olarak `tourId` gösterilir, hesap çökmez → Task 2 testi `unknown tour`.

---

### Task 1: Talep tahmini — tur eşleştirme ve birim fiyat

**Files:**
- Create: `server/finance.mjs`
- Test: `tests/finance.test.mjs`

**Interfaces:**
- Produces:
  - `TOUR_KEYWORDS: Array<[string, string[]]>` — `[anahtarKelime, tourId[]]`, spec tablosu birebir.
  - `matchTours(notes: string): string[]` — eşleşen tur kimlikleri (tekrarsız).
  - `unitPrice(tourId: string, departures: {tour_id, date, price}[], today: "YYYY-MM-DD", tours: {id, price}[]): number | null`
  - `requestEstimate(req: {kind, body:{tourId?, guests?, notes?}}, ctx: {departures, tours, today}): { amount: number, tourIds: string[], averaged: boolean } | null`

- [ ] **Step 1: Write the failing tests** (`tests/finance.test.mjs`)

```js
test("matchTours: anahtar kelime, genel kelime yok sayılır, uzun ifade kısa olanı ezer", () => {
  assert.deepEqual(matchTours("Ani ve Çıldır için 6 kişi"), ["ani-cildir"]);
  assert.deepEqual(matchTours("Günübirlik bir tur istiyoruz"), []);
  assert.deepEqual(matchTours("VAN HAVZASI turu"), ["van-havzasi"]);
  assert.deepEqual(matchTours("Van turu").sort(), ["van", "van-gunubirlik", "van-havzasi"]);
  assert.deepEqual(matchTours("Batum ve Tiflis").sort(), ["batum", "tiflis"]);
  assert.deepEqual(matchTours("savan"), [], "kelime sınırı");
  assert.deepEqual(matchTours(""), []);
});
test("unitPrice: önceki sefer → gelecek sefer → katalog", () => {
  const deps = [
    { tour_id: "batum", date: "2026-10-01", price: 200000 },
    { tour_id: "batum", date: "2026-11-01", price: 220000 },
    { tour_id: "batum", date: "2026-12-01", price: 250000 },
    { tour_id: "tiflis", date: "2026-12-10", price: 300000 },
  ];
  const tours = [{ id: "batum", price: 1 }, { id: "tiflis", price: 2 }, { id: "mardin", price: 400000 }];
  assert.equal(unitPrice("batum", deps, "2026-11-25", tours), 220000);
  assert.equal(unitPrice("tiflis", deps, "2026-11-25", tours), 300000);
  assert.equal(unitPrice("mardin", deps, "2026-11-25", tours), 400000);
  assert.equal(unitPrice("yok", deps, "2026-11-25", tours), null);
});
test("requestEstimate: tourId önceliklidir; nottan çoklu eşleşmede ortalama; konaklama/araç tahminsiz", () => {
  const ctx = { today: "2026-11-25", tours: [{ id: "van-gunubirlik", price: 300000 }, { id: "van", price: 600000 }, { id: "van-havzasi", price: 700000 }, { id: "batum", price: 220000 }], departures: [] };
  assert.deepEqual(requestEstimate({ kind: "tour-info", body: { tourId: "batum", guests: 3, notes: "Van" } }, ctx), { amount: 660000, tourIds: ["batum"], averaged: false });
  assert.deepEqual(requestEstimate({ kind: "private-tour", body: { guests: 2, notes: "Van turu" } }, ctx).amount, 2 * Math.round((300000 + 600000 + 700000) / 3));
  assert.equal(requestEstimate({ kind: "private-tour", body: { guests: 2, notes: "Van turu" } }, ctx).averaged, true);
  assert.equal(requestEstimate({ kind: "hotel", body: { tourId: "batum", guests: 2 } }, ctx), null);
  assert.equal(requestEstimate({ kind: "vehicle", body: { guests: 2, notes: "Batum" } }, ctx), null);
  assert.equal(requestEstimate({ kind: "private-tour", body: { guests: 2, notes: "bir yer" } }, ctx), null);
});
```

- [ ] **Step 2: Run** `node --test tests/finance.test.mjs` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement** the four exports in `server/finance.mjs`. Normalize with `toLocaleLowerCase("tr-TR")`; word boundary regex `new RegExp("(^|[^\\p{L}])" + kw + "([^\\p{L}]|$)", "u")`. After collecting matched keywords, drop any keyword that is a substring of another matched keyword (so "van" drops when "van havzası" matched). Average = `Math.round(sum / n)` over tours whose `unitPrice` is non-null; amount = `guests × average`. `guests` missing → 1. Estimate only for kinds `tour-info` and `private-tour`.

- [ ] **Step 4: Run** `node --test tests/finance.test.mjs` — Expected: PASS.

- [ ] **Step 5: Commit** `git add server/finance.mjs tests/finance.test.mjs && git commit -m "Finans: talep tahmini için tur eşleştirme ve birim fiyat"`

---

### Task 2: Rapor hesabı — `buildFinance` ve `workflow.financeReport`

**Files:**
- Modify: `server/finance.mjs` (add `buildFinance`)
- Modify: `server/workflow.mjs` (add `financeReport` next to `monthReport`, ~line 786)
- Test: `tests/finance.test.mjs`

**Interfaces:**
- Consumes: `requestEstimate` (Task 1); `REQUEST_STATUS` from `server/requests.mjs`; `localDate` from `server/departures.mjs`.
- Produces:
  - `buildFinance(input) => FinanceReport` where `input = { reservations, ledger, departures, requests, tours, today, from, to, bucket: "day"|"week" }`.
    - `reservations`: rows as returned by `workflow.list({ all: true })` (`id, reference, name, phone, tourId, departure_id, date, start_time, seats, total, net_paid, status`).
    - `ledger`: raw `payment_ledger` rows (`reservation_id, kind, amount, method, note, created_at`).
  - `workflow.financeReport({ from, to, bucket }) => Promise<FinanceReport>` — loads `api.list({ all: true })`, `db.find("payment_ledger", {})`, `departures.list()`, `db.find("requests", {})`, `tours`, `today = localDate(clock())`, calls `buildFinance`.
  - `FinanceReport` (JSON):
    ```
    { range: { from, to, bucket },
      summary: { revenue, revenuePending, payments, refunds, collected, outstanding, outstandingNoShow, expected7 },
      series: [{ key, revenue, collected }],              // key = bucket start "YYYY-MM-DD" (week → Monday); every bucket in range present, zeros included
      expected: { total, days: [{ date, amount, count }], rows: [{ reference, name, phone, tourName, date, start_time, balance }] }, // today..today+29, rows sorted by date
      byTour: [{ tourId, tourName, departures, capacity, guests, occupancy, revenue, collected }],
      methods: { cash, bankTransfer, pos, card },          // net (payment − refund) in period
      pipeline: { stages: [{ status, label, count, estimatedCount, estimate }], openCount, openEstimate, unestimated },
      overdue: [{ reference, name, phone, tourName, date, status, balance }],
      day: null | { departures: [{ departureId, tourName, start_time, guests, revenue, balance }],
                    ledger: [{ at, reference, name, kind, method, amount, note }] } }   // only when from === to
    ```
  - Definitions are the spec's "Hesap tanımları"; `byTour` mirrors `monthReport.byTour` for the same dates (same live filter, `collected = Σ net_paid`). `pipeline.stages` order = keys of `REQUEST_STATUS`; `openCount/openEstimate` exclude `won` and `lost`; `unestimated` = open requests with null estimate.

- [ ] **Step 1: Write failing tests** in `tests/finance.test.mjs` using small literal fixtures (helper `res({ ... })`):
  - `revenue by tour date, collected by payment day`: reservation dated in range total 300000 net_paid 90000 with ledger payment 90000 dated before range → `summary.revenue === 300000`, `summary.collected === 0`; a ledger payment inside range for a reservation dated next month → counted in `collected` and `methods`, not in `revenue`.
  - `pending share`: a `pending_agency` booking in range → included in `revenue` and in `revenuePending`.
  - `outstanding excludes no_show and is period-independent`: confirmed balance 50000 + no_show balance 30000 + cancelled balance 99999 → `outstanding === 50000`, `outstandingNoShow === 30000`, regardless of `from/to`.
  - `expected payments`: confirmed bookings dated today (balance 10000), today+6 (20000), today+7 (40000), today+30 (5000), yesterday (7000) → `expected7 === 30000`, `expected.total === 70000`, `expected.days` has 30 entries starting today, yesterday's booking appears in `overdue` only.
  - `overdue statuses`: past `pending_agency` with balance not in overdue (it expires); past `completed` and `confirmed` with balance are.
  - `series buckets`: range 2026-11-01..2026-11-30 with `bucket:"week"` → keys `["2026-10-26","2026-11-02","2026-11-09","2026-11-16","2026-11-23","2026-11-30"]`; with `bucket:"day"` → 30 keys.
  - `pipeline`: requests created in range: tour-info batum guests 2 status `new`; private-tour "Van" status `offered`; hotel status `new`; private-tour status `won` → stage `new` count 2 estimatedCount 1; `openCount === 3`; `openEstimate` = batum + van average; `won` stage counted but not in `openEstimate`; request created outside range ignored.
  - `day view`: `from === to` → `day.departures` lists that day's departures with guests and balance; `day.ledger` lists that day's entries with `note`; `from !== to` → `day === null`.
  - Review Focus: `empty period` (all zero, `series` all zeros, no throw), `istanbul day boundary` (ledger `created_at = Date.parse("2026-11-10T20:30:00Z")` → counted on `"2026-11-10"`; `Date.parse("2026-11-10T21:30:00Z")` → `"2026-11-11"`), `refunded booking` (net_paid > total never yields negative balance), `unknown tour` (tourId not in tours → `tourName === tourId`).
  - Integration: `financeReport matches monthReport for a month` — via `openStore(":memory:", { clock })`: create departures + `adminReserve` bookings with payments; assert `financeReport({from:"YYYY-MM-01", to: last day, bucket:"day"}).byTour` deep-equals `monthReport(month).byTour`, and `summary.revenue === monthReport.totals.revenue`, `summary.collected === monthReport.cash.net`.

- [ ] **Step 2: Run** `node --test tests/finance.test.mjs` — Expected: new tests FAIL.

- [ ] **Step 3: Implement** `buildFinance` in `server/finance.mjs` and `financeReport` in `workflow.mjs`. Ledger→reservation lookup by `reservation_id === r.id`; ledger day = `localDate(created_at)`; week key = Monday of the Istanbul date.

- [ ] **Step 4: Run** `node --test tests/finance.test.mjs tests/admin-booking.test.mjs` — Expected: PASS.

- [ ] **Step 5: Commit** `git commit -am "Finans: dönem raporu hesabı"` (plus new test file changes).

---

### Task 3: API ucu `GET /api/admin/finance`

**Files:**
- Modify: `server/advanced-api.mjs` (next to `/api/admin/reports/month`, ~line 456)
- Test: `tests/advanced-http.test.mjs`

**Interfaces:**
- Consumes: `store.workflow.financeReport` (Task 2).
- Produces: `GET /api/admin/finance?from=YYYY-MM-DD&to=YYYY-MM-DD&bucket=day|week` → `FinanceReport`. `bucket` default `"day"`.

- [ ] **Step 1: Write failing test** `finance endpoint: auth, range validation, shape`:
  - unauthenticated → 401;
  - after login: `from=2026-11-10&to=2026-11-01` → 400, message contains `"Başlangıç"`; range of 367 days → 400; `from=bozuk` → 400;
  - `from=2026-11-01&to=2026-11-30&bucket=week` → 200 with keys `summary, series, expected, byTour, methods, pipeline, overdue, day` and `day === null`.

- [ ] **Step 2: Run** `node --test --test-name-pattern="finance endpoint" tests/advanced-http.test.mjs` — Expected: FAIL (404).

- [ ] **Step 3: Implement** route with zod: `from: ymd, to: ymd, bucket: z.enum(["day","week"]).default("day")`, refine `from <= to` ("Başlangıç tarihi bitişten sonra olamaz."), span ≤ 366 days ("En fazla bir yıllık aralık seçin.").

- [ ] **Step 4: Run** same command — Expected: PASS.

- [ ] **Step 5: Commit** `git commit -am "Finans: yönetici API ucu"`

---

### Task 4: Panel — Finans sekmesi ve grafikler

**Files:**
- Create: `src/components/admin/FinancePanel.tsx` (bileşen, dönem seçici, bölümler)
- Create: `src/components/admin/financeCharts.tsx` (`BarPairs`, `HBars`, `StackBar`, `DayBars` — elle SVG/CSS)
- Modify: `src/pages/Admin.tsx` (`ALL_TABS`'a `["finance", "Finans", Wallet, "Satış"]`, `reports`'ın hemen üstüne; render `{tab === "finance" && <FinancePanel key={key("fin")} onReservation={(ref) => pick("reservations", { ref })} />}`)
- Modify: `src/admin.css` (`.finance-*` sınıfları)

**Interfaces:**
- Consumes: `FinanceReport` JSON (Task 2) via `api<FinanceReport>("/admin/finance?…")`.
- Produces: `export function FinancePanel(props: { onReservation: (ref: string) => void })`.

- [ ] **Step 1: Implement period state** — mode `"day"|"week"|"month"|"range"`, anchor date; ← / → shift by one unit, "Bugün" resets. Request params: day → `from=to=anchor`; week → Monday..Sunday, `bucket=day`; month → 1..last, `bucket=day`; range → two date inputs, `bucket = span > 62 days ? "week" : "day"`.
- [ ] **Step 2: Implement sections in spec order** with Turkish copy from the spec: kartlar ("Ciro", altında "X onay bekliyor"; "Net tahsilat"; "Açık alacak", altında "gelmeyenlerde X"; "7 günde beklenen"); grafik (gün modunda yerine "Günün hareketleri"); "Beklenen ödemeler · 30 gün" (gün çubukları + satırlar, `telHref`/`whatsappLink` from `src/lib/phone` / `src/lib/whatsapp`, satır tıklaması `onReservation(reference)`); "Tur bazında satış" with explanatory line "Tahsil edilen: bu satışlardan bugüne kadar alınan. Üstteki kart dönemde kasaya gireni gösterir."; "Ödeme yöntemleri"; "Talep hattı" (aşama satırları; tahmini tutar çizgili/soluk ve "tahmini" etiketli; satırda "N talep · M'si tahminli"; ortalamalı tahmin aşama düzeyinde toplanır, talep başına satır yoktur); "Geçmiş turdan kalan alacak". Boş durum metinleri her bölümde.
- [ ] **Step 3: Typecheck** `npx tsc -b` — Expected: no output.
- [ ] **Step 4: Browser verification** (local preview `acente-onay` + `mongo-acente` in `/Users/yck/rota-kars/.claude/launch.json`): seed bookings/payments/requests via admin API, check each section renders with correct numbers against the API JSON, toggle Gün/Hafta/Ay/Aralık, narrow viewport (375px) without horizontal scroll, dark mode readable, console has no errors.
- [ ] **Step 5: Commit** `git add src && git commit -m "Finans sekmesi: dönem seçici, kartlar ve grafikler"`

---

### Task 5: Son doğrulama

- [ ] **Step 1:** `npm test` — Expected: all pass in both Mongo modes.
- [ ] **Step 2:** `npx tsc -b && npm run build` — Expected: success.
- [ ] **Step 3:** Whole-branch review (fresh reviewer) against spec; fix real findings.
- [ ] **Step 4:** Report to user; PR + yayın only on their go-ahead.
