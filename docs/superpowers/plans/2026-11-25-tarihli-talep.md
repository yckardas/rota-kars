# Tarih bazında talep toplama — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Talep toplamayı sefer (tarih) bazında yapmak: acenta talep tarihini sefer olarak açar, müşteri ön kayıtta tarih seçer, panelde tarih başına sayaç ve tarih başına "Satışa aç".

**Architecture:** `departures.sales_mode` (`"demand" | "online" | null`, null = tur modu) seferin etkin modunu belirler; grup (ek araç) içinde ortak alandır. Talep tarihleri satılabilir sefer uç noktasına girmez; katalog turunda `demandDates` olarak yayınlanır. Ön kayıt grubun 1. aracına bağlanır. Bir talep tarihi satılabilir olunca (hangi yolla olursa olsun) dakikalık iş o tarihin bekleyenlerine e-posta atar; "Satışa aç" aynı işi hemen çağırır.

**Tech Stack:** Node 22, Express 5, zod, MongoDB (testlerde `:memory:` replset+standalone), React 19 + Vite, lucide-react, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-25-tarihli-talep-design.md`

## Global Constraints

- Eski kayıtlar alan olmadan çalışır: `sales_mode` yoksa tur moduna uyar; göç yok.
- `npm test` iki MongoDB modunda yeşil (`npm test` ikisini de koşar); `npm run build` temiz.
- Halka açık veride (`/api/catalog`, `/api/tours/:id/departures`) plaka, rehber, kapalı koltuk, `sales_mode` dışı iç alan yok.
- `/api/tours/:id/departures` yalnız satılabilir seferleri döner (değişmez).
- Sunucu hata metinleri Türkçe; API hata anahtarı `message`.
- Yeni müşteri metinleri `src/lib/en/` sözlüğüne İngilizceleriyle eklenir.
- Etkin mod: `effectiveMode = row.sales_mode ?? tourMode`; `demand = effectiveMode === "demand"`.
- Aktif rezervasyon = `reservations` içinde `departure_id` o sefer ve `status ∈ {pending_agency, confirmed}`.

## Review Focus

1. Aynı e-posta önce bir tarihe, sonra tarihsiz ön kayıt bırakırsa tarihli kayıt ezilmemeli (tekilleştirme `departure_id: null` ile) → Task 2 testi.
2. Talep tarihine ek araç eklenince yeni araç grubun modunu almalı; "Satışa aç" tüm araçları açmalı; kayıt 2. araçtan gelse de grubun 1. aracına bağlanmalı → Task 1 ve Task 2 testleri.
3. Satış kesimi geçmiş ya da pasif talep tarihi `demandDates`'te görünmemeli, ön kaydı 409 → Task 3 testi.
4. Haber verme işi iki kez koşunca kişi başına tek e-posta; "Vazgeçti" durumundakine hiç → Task 2 testi.
5. Turun "Satışı aç ve haber ver"i: `"demand"` olarak işaretli tarih talepte kalmalı, onun kayıtlarına e-posta gitmemeli → Task 2 testi.

---

### Task 1: Seferde satış modu (sunucu)

**Files:**
- Modify: `server/departures.mjs` (enrich ~l.100, save ~l.181-310, addVehicle, remove)
- Modify: `server/advanced-api.mjs` (POST `/api/admin/departures` şeması ~l.215)
- Test: `tests/talep-tarihi.test.mjs` (yeni; fikstür `tests/interest.test.mjs` fikstürünün kopyası: saat kontrollü `openStore(":memory:", { clock, env, seed:false })`, admin girişi, `call`, `departure(tourId, extra)` = `store.departures.save`, `outbox()`)

**Interfaces:**
- Produces: enrich edilmiş seferde `sales_mode: "demand"|"online"|null`, `mode: "demand"|"online"` (etkin), `demand: boolean`; `salesOpen` artık `base.mode` yerine etkin moda bakar.
- Produces: `departures.save(input)` → `input.salesMode` (`"demand"|"online"|null|undefined`; undefined = eskisini koru, yeni kayıtta null).
- Produces: `departures.hasActiveBookings(groupId) → Promise<boolean>` (gruptaki herhangi bir aracın aktif rezervasyonu).

- [ ] **Step 1: Failing tests** (`tests/talep-tarihi.test.mjs`; talep turu `guneydogu`, satış turu `ani-cildir`, tarih `2026-10-24`, `price: 250000`)

```js
test("a departure on a demand tour is a demand date; salesMode overrides the tour mode", async (t) => {
  const { store, call, departure } = await fixture(t);
  const d = await departure("guneydogu", { price: 250000 });
  assert.equal(d.mode, "demand"); assert.equal(d.demand, true); assert.equal(d.salesOpen, false);
  const online = await departure("guneydogu", { id: d.id, price: 250000, salesMode: "online" });
  assert.equal(online.mode, "online"); assert.equal(online.salesOpen, true);
  const a = await departure("ani-cildir", { salesMode: "demand" });
  assert.equal(a.demand, true); assert.equal(a.salesOpen, false);
  await assert.rejects(store.hold(a.id, [1]), (e) => e.status === 409);
  // salesMode gönderilmeyen kayıt eski değeri korur.
  const kept = await departure("ani-cildir", { id: a.id });
  assert.equal(kept.sales_mode, "demand");
});

test("sales mode is shared across the vehicles of a date", async (t) => {
  const { store, departure } = await fixture(t);
  const d = await departure("guneydogu", { price: 250000 });
  const v2 = await store.departures.addVehicle(d.id);
  assert.equal(v2.demand, true);
  await departure("guneydogu", { id: d.id, price: 250000, salesMode: "online" });
  assert.equal((await store.departures.get(v2.id, { allowClosed: true })).sales_mode, "online");
});

test("a date with bookings cannot become a demand date", async (t) => {
  // ani-cildir seferine admin rezervasyonu (store.adminReserve ya da HTTP /admin/reservations), sonra salesMode "demand" → 409 /rezervasyon var/
});

test("a demand date with pre-registrations cannot be deleted; date change carries them over", async (t) => {
  // interest_list'e departure_id = d.id, status "waiting" kayıt (HTTP /interest, Task 2'den önce: store.db.insert ile)
  // store.departures.remove(d.id) → 409 /ön kayıt var/
  // departure("guneydogu", { id: d.id, price: 250000, date: "2026-10-31" }) → kaydın departure_date === "2026-10-31"
});
```

- [ ] **Step 2: Run** `node --test tests/talep-tarihi.test.mjs` — Expected: FAIL (`d.mode` undefined / `salesMode` yok sayılıyor).

- [ ] **Step 3: Implement**
  - `enrich`: `const mode = row.sales_mode || base.mode;` alanlar `sales_mode: row.sales_mode ?? null, mode, demand: mode === "demand"`; `salesOpen: base.salesOpen && mode !== "demand" && ...`.
  - `save`: `fields.sales_mode = input.salesMode === undefined ? (old?.sales_mode ?? null) : input.salesMode;` Etkin mod `demand`'a dönüyorsa (`(fields.sales_mode || tourMode) === "demand"` ve önceki etkin mod online) ve `hasActiveBookings(old.group_id)` → 409 "Bu tarihte rezervasyon var; talep toplamaya alınamaz.". Kardeş `updateMany`'ye `sales_mode` eklenir. Yeni kayıtta `group` verilmişse `sales_mode` 1. araçtan gelir (addVehicle `salesMode: base.sales_mode` geçer). Tarih/saat değişince `db.updateMany("interest_list", { departure_id: old.group_id }, { departure_date: input.date })`.
  - `remove`: `db.one("interest_list", { departure_id: d.group_id, status: { $in: ["waiting","notified"] } })` varsa 409 "Bu tarihte ön kayıt var; önce kayıtları kapatın." (yalnız 1. araç ya da tek araç silinirken).
  - `advanced-api.mjs`: şemaya `salesMode: z.enum(["demand","online"]).nullable().optional()`.

- [ ] **Step 4: Run** `node --test tests/talep-tarihi.test.mjs tests/ikinci-arac.test.mjs tests/interest.test.mjs` — Expected: PASS.

- [ ] **Step 5: Commit** `git commit -m "Seferde satış modu: talep tarihi ve ortak alan"`

### Task 2: Tarihli ön kayıt ve haber verme (sunucu)

**Files:**
- Modify: `server/interest.mjs` (add, demandCount, openSales, yeni `notifyDemandDates`, `openDate`, `demandDates`)
- Modify: `server/app.mjs` (POST `/api/admin/departures/:id/open-sales`, GET `/api/admin/interest` yükü)
- Modify: `server/index.mjs` (dakikalık işe `notifyDemandDates`)
- Test: `tests/talep-tarihi.test.mjs`

**Interfaces:**
- Consumes: Task 1 `d.demand`, `d.group_id`, `d.salesOpen`, `departures.save({salesMode})`.
- Produces: `interest.demandCount(tourId, departureId?) → number` (departureId yoksa yalnız `departure_id: null` kayıtlar).
- Produces: `interest.demandDates(tourId, { withCount }) → [{ id, date, start_time, price, count? }]` — gruptan tek satır (1. araç id'si), `demand && active && !departed && date >= bugün`, aktif rezervasyonu olan grup hariç, tarih+saat sırası.
- Produces: `interest.notifyDemandDates() → { notified }`; `interest.openDate(departureId) → { notified }`.
- Produces: `GET /api/admin/interest` → her tur `{ ..., preregCount (tarihsiz), dates: [{ id, date, start_time, count, salesOpen, demand }] }`.

- [ ] **Step 1: Failing tests**

```js
test("pre-registration for a demand date binds to the date's first vehicle", async (t) => {
  // d = departure("guneydogu",{price:250000}); v2 = addVehicle(d.id)
  // POST /interest { kind:"prereg", tourId:"guneydogu", departureId: v2.id, ...person() } → 201
  // kayıt: departure_id === d.id, departure_date === "2026-10-24"; demandCount("guneydogu", d.id) === 2; demandCount("guneydogu") === 0
  // müşteri e-postası ve acenta bildirimi gövdesinde /2026-10-24/
  // satıştaki seferle (ani-cildir, salesMode yok) departureId → 409 /ön kayıt alınmıyor/
});

test("an undated pre-registration does not overwrite a dated one from the same e-mail", async (t) => {
  // önce departureId ile count 2, sonra departureId'siz count 3 → iki ayrı kayıt; tarihli kayıt count 2
});

test("opening a date e-mails only that date's waiting guests, once", async (t) => {
  // iki talep tarihi d1 (10-24), d2 (10-31); d1'e a@, d2'ye b@, d1'e c@ (sonra c@ setStatus "cancelled")
  // POST /admin/departures/:d1/open-sales → { notified: 1 }; d1 ve 2. aracı salesOpen
  // outbox: kind "interest_open" yalnız a@, actionUrl içinde "?date=2026-10-24"
  // await store.interest.notifyDemandDates() iki kez → yeni e-posta yok
  // fiyatı olmayan talep tarihinde open-sales → 409 /fiyat/
});

test("a date that becomes sellable another way still notifies its guests", async (t) => {
  // d talep tarihi + a@ kayıt; departure(... id:d.id, salesMode:"online") → notifyDemandDates() → { notified: 1 }
});

test("tour-wide open keeps pinned demand dates collecting", async (t) => {
  // d1 (null), d2 (salesMode "demand"), tarihsiz u@, d1'e a@, d2'ye b@
  // POST /admin/operations/guneydogu/open-sales → u@ ve a@ e-posta alır, b@ almaz; d2 hâlâ demand
});
```

- [ ] **Step 2: Run** `node --test tests/talep-tarihi.test.mjs` — Expected: FAIL (departureId prereg'de yok sayılıyor; open-sales rotası 404).

- [ ] **Step 3: Implement**
  - `add`: prereg + `departureId` → `departures.get(id, {allowClosed:true})`; tur eşleşmeli, `d.demand && d.active && !d.departed` değilse 409 "Bu tarih için ön kayıt alınmıyor."; `departure = { ...d, id: d.group_id }`. Tarihsiz prereg bugünkü gibi `ops.mode === "demand"` ister. Tekilleştirme sorgusu her zaman `departure_id: departure?.id ?? null` içerir. E-posta `what`: tarihliyse `${tourName} · ${date} ${start_time} için ön kayda`; acenta gövdesi zaten tarihi yazıyor.
  - `notifyDemandDates`: `interest_list` `{kind:"prereg", status:"waiting", departure_id:{$ne:null}}` → departure_id'ye göre grupla → `departures.get(id,{allowClosed:true})` (yoksa atla) → `salesOpen` ise her kayda e-posta (konu `Rota Kars · ${tur} · ${date} kesinleşti, rezervasyon açıldı`, `actionUrl: bookingUrl(tourId, date)`, `kind: "interest_open"`, `dedupeKey: "interest-open:"+row.id`) ve `status:"notified", notified_at`.
  - `openDate(id)`: `tx` içinde d = get; `!d.demand` → 409 "Bu tarih zaten satışta."; `!d.active` → 409 "Önce seferi aktif yapın."; fiyat ≤ 0 → 409 "Satışa açmadan önce bu tarihe fiyat girin."; tur `salesOpen` kapalı → 409 "Tur satışa kapalı; önce turu satışa açın."; `db.updateMany("departures",{$or:[{_id:gid},{group_id:gid}]},{sales_mode:"online"})`; sonra `notifyDemandDates()` döner.
  - `openSales(tourId)` (tur geneli): modu online yaptıktan sonra tarihsiz bekleyenlere bugünkü e-posta (yalnız `departure_id: null`), ardından `notifyDemandDates()`; `notified` = ikisinin toplamı.
  - `app.mjs`: `POST /api/admin/departures/:id/open-sales` (requireAdmin) → `store.interest.openDate(id)`; `/api/admin/interest` turlara `dates` ekler (admin listesi: `departures.list({tourId})` içinden `demand` ya da bekleyen kaydı olan gruplar, 1. araç satırı, `count = demandCount(tourId, gid)`).
  - `index.mjs`: `await store.interest.notifyDemandDates();` `notifyOpenings`'ten sonra.

- [ ] **Step 4: Run** `node --test tests/talep-tarihi.test.mjs tests/interest.test.mjs` — Expected: PASS.

- [ ] **Step 5: Commit** `git commit -m "Tarihli ön kayıt, tarih bazında satışa açma ve haber verme"`

### Task 3: Katalogda talep tarihleri ve tarih bazlı satış görünümü (sunucu)

**Files:**
- Modify: `server/app.mjs` (`withNextDeparture` ~l.989)
- Test: `tests/talep-tarihi.test.mjs`

**Interfaces:**
- Consumes: Task 2 `interest.demandDates(tourId, { withCount })`, `interest.demandCount(tourId)`.
- Produces: katalog turu `demandDates: [{ id, date, start_time, price, count? }]` (boşsa alan yok ya da `[]`); talep turunda satılabilir sefer varsa `next` ve `fromPrice` satış turu gibi hesaplanır; `demand.count` yalnız tarihsiz kayıtlar.

- [ ] **Step 1: Failing tests**

```js
test("the catalog lists demand dates without leaking internals; an opened date sells like any tour", async (t) => {
  // guneydogu: d1 talep (10-24), d2 talep (10-31) pasif, d3 talep ama kesim geçmiş (advance ile)
  // catalog tur: demandDates yalnız d1; JSON'da plate|guide|closed_seats yok; count yok (showProgress kapalı)
  // showProgress açınca (POST /admin/operations/guneydogu/mode) d1.count === kayıtlı kişi
  // POST /interest departureId d2 → 409
  // d1 open-sales → catalog: demandDates boş, next.date === "2026-10-24", fromPrice === 250000; /tours/guneydogu/departures 1 satır
});
```

- [ ] **Step 2: Run** `node --test tests/talep-tarihi.test.mjs` — Expected: FAIL (`demandDates` undefined).

- [ ] **Step 3: Implement** `withNextDeparture`: `inquiryOnly` dalı aynı; diğer turlar için `open = listDepartures`, `demandDates = interest.demandDates(t.id, { withCount: t.demand.showProgress })`; satır = `{ ...t, fromPrice, ...(next), ...(demandDates.length ? { demandDates } : {}), ...(t.mode === "demand" ? { demand: { ...t.demand, ...(showProgress ? { count: demandCount(t.id) } : {}) } } : {}) }`. `fromPrice`: satılabilir sefer varsa onların en düşüğü, yoksa `t.price`.

- [ ] **Step 4: Run** `npm test > /tmp/x 2>&1; tail -5` (iki mod) — Expected: tümü PASS.

- [ ] **Step 5: Commit** `git commit -m "Katalogda talep tarihleri"`

### Task 4: Site — tur kartı, tur detayı, rezervasyon sayfası, ön kayıt formu

**Files:**
- Modify: `src/lib/types.ts` (Tour: `demandDates?: DemandDate[]`; `DemandDate = { id; date; start_time; price; count? }`)
- Modify: `src/components/TourCard.tsx`, `src/pages/TourDetail.tsx`, `src/pages/Booking.tsx`, `src/components/InterestForm.tsx`, `src/lib/en/*.ts` (ilgili sözlük dosyası), `src/postcard.css`

**Interfaces:**
- Consumes: Task 3 katalog `tour.demandDates`, `tour.next`; Task 2 `POST /interest` `departureId`.
- Produces: `InterestForm` prop'ları: `dates?: DemandDate[]`, `initialDateId?: string`, `allowUndated: boolean`.

- [ ] **Step 1: Implement**
  - TourCard: `tour.next` varsa bugünkü satış görünümü; yoksa `mode==="demand"` + `demandDates[0]` → "Ön kayıt açık · {date}" (`dateLabel`).
  - TourDetail: seferleri her modda yükle (`t.mode !== "demand"` koşulu kalkar); `demand` değişkeni "satılabilir sefer yok ve mod demand" anlamına gelir. `demandDates` varsa "Planlanan tarihler" listesi (tarih · saat · tahmini fiyat ya da "Fiyat için arayın" · `count` varsa "{count} / {threshold} kişi hazır" çubuğu · "Bu tarihe ön kayıt" düğmesi → InterestForm `initialDateId`). Satış turunda başlık "Talep toplanan tarihler".
  - Booking: seçiciye `tour.demandDates` seçenekleri tarih sırasıyla, metin `{date} · {time} · ön kayıt`. Seçili id bir talep tarihiyse koltuk planı/fiyat özeti/devam düğmesi gizlenir; "Bu tarih yeterli talep olursa yapılacak; şu an koltuk satılmıyor." notu + "Ücretsiz ön kayıt bırakın" (InterestForm `initialDateId`). `?date=` talep tarihlerini de eşler. Tur geneli talep notu yalnız satılabilir sefer yoksa ve seçili tarih talep tarihi değilse.
  - InterestForm (prereg): `dates?.length` ise "Tarih" `select`: tarihler + (`allowUndated` ise) "Başka bir tarih istiyorum" (değer `""`); `""` seçiliyken "Tercih ettiğiniz dönem" kutusu görünür. Gönderimde seçili tarih → `departureId`. Açıklama metni tarih seçiliyse "{tour} · {date} için ücretsiz ön kayıt…".
  - İngilizce karşılıklar: "Planlanan tarihler" → "Planned dates", "Talep toplanan tarihler" → "Dates collecting interest", "Bu tarihe ön kayıt" → "Pre-register for this date", "ön kayıt" → "pre-registration", "Başka bir tarih istiyorum" → "I'd like another date", "Tarih" → "Date", "Ön kayıt açık · {date}" → "Pre-registration open · {date}", "Bu tarih yeterli talep olursa yapılacak; şu an koltuk satılmıyor." → "This date runs if enough people sign up; seats aren't on sale yet.", "{tour} · {date} için ücretsiz ön kayıt bırakın. Ödeme alınmaz; tarih kesinleşince size haber verip rezervasyonu açarız." → "Leave a free pre-registration for {tour} · {date}. No payment is taken; we'll let you know and open booking once the date is confirmed."

- [ ] **Step 2: Run** `npm run build` — Expected: hatasız.

- [ ] **Step 3: Browser check** (`.claude/launch.json`'a port 5203, `MONGODB_DB rota-kars-talep` yapılandırması; demo verisinde `guneydogu` için iki talep tarihi oluştur): kartta "Ön kayıt açık · …", detayda liste ve düğme, formda tarih seçimi ve "Başka tarih", rezervasyon sayfasında talep tarihi seçilince koltuk planı yok; bir tarihi açınca kart/detay/rezervasyon satış görünümüne geçer. Mobil genişlikte (375) taşma yok.

- [ ] **Step 4: Commit** `git commit -m "Sitede talep tarihleri ve tarihli ön kayıt"`

### Task 5: Panel — sefer düzenleyici, sefer listesi/takvim, ön kayıt sekmesi

**Files:**
- Modify: `src/components/OperationsDesk.tsx` (DepartureEditor, liste satırı), `src/components/admin/DepartureCalendar.tsx`, `src/components/admin/InterestManager.tsx`, `src/admin.css`
- Modify: `src/lib/types.ts` (Departure: `sales_mode?`, `mode?`, `demand?`)

**Interfaces:**
- Consumes: Task 1 `sales_mode/mode/demand`, `salesMode` kaydı; Task 2 `POST /admin/departures/:id/open-sales`, `/admin/interest` `dates`.

- [ ] **Step 1: Implement**
  - DepartureEditor: "Satış" `select` (`name="salesMode"`): `""` = "Turun ayarı (şu an: {talep toplama|online satış})", `"online"` = "Online satış", `"demand"` = "Talep toplama"; gönderimde `""` → `null`. Ek araçlı grupta "Tarih, saat, fiyat, buluşma ve satış modu tüm araçlarda ortaktır." notu. Talep tarihinde kayıtlı kişi varken tarih/saat değişiyorsa kaydetmeden `feedback.confirm`: "Bu tarihe kayıtlı {n} kişi var; tarih değişikliğini onlara siz bildirin." (n: `/admin/interest` `dates`'ten).
  - Sefer listesi satırı ve takvim çipi: `d.demand` ise "Talep · {count}/{threshold} kişi" etiketi; satırda "Satışa aç" düğmesi → `feedback.confirm({ title: "{tarih} satışa açılsın mı?", body: "Bu tarihe kayıtlı {n} kişiye rezervasyon bağlantısı e-postayla gider.", confirmLabel: "Satışa aç" })` → POST, toast "{tarih} satışa açıldı; {notified} kişiye haber verildi.".
  - InterestManager ModeCard: tarihsiz sayaç ("Tarih belirtmeyen ön kayıt: {n} / {eşik}") ve altında `t.dates` satırları: tarih · saat · `{count}/{eşik}` çubuğu · talepteyse "Satışa aç", satıştaysa "Satışta" etiketi. Tur başlığındaki "Satışı aç ve haber ver" onay metni: "Tur online satışa geçer; tarih belirtmeyen {n} kişiye ve satışa geçen tarihlere kayıtlı olanlara e-posta gider. 'Talep toplama' olarak işaretli tarihler talepte kalır."

- [ ] **Step 2: Run** `npm run build` — Expected: hatasız.

- [ ] **Step 3: Browser check** (panel, `sahip@rotakars.test`): düzenleyicide satış seçimi ve kaydı, ek araçta mod eşitlenmesi, listede etiket ve "Satışa aç" akışı (onay → toast → satır "Satışta"), ön kayıt sekmesinde tarih satırları.

- [ ] **Step 4: Full suite** `npm test` (iki mod) — Expected: tümü PASS.

- [ ] **Step 5: Commit** `git commit -m "Panelde talep tarihleri: satış modu, sayaç ve Satışa aç"`
