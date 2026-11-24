# İkinci araç ve satışa kapalı koltuklar — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seferde koltukları online satışa kapatmak ve aynı tarihe ek araç ekleyip müşteriyi sıradaki uygun araca kendiliğinden yönlendirmek.

**Architecture:** Her araç bugünkü gibi kendi `departures` kaydıdır; `group_id` (1. aracın id'si) ve `vehicle_no` ile bağlanır. Kapalı koltuklar seferin `closed_seats` dizisidir, kilit değildir. Halka açık liste grubu tek satıra indirger; sunucu doluluk sırasını `hold`'da korur.

**Tech Stack:** Node 22, Express 5, zod, MongoDB (testlerde `:memory:`), React 19 + Vite, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-24-ikinci-arac-design.md`

## Global Constraints

- Eski sefer kayıtları göçsüz çalışır: `group_id ?? id`, `vehicle_no ?? 1`, `closed_seats ?? []` okuma anında.
- Halka açık yanıtlarda plaka, `closed_seats`, `closed` ve `group_available` yer almaz.
- Panel metinleri Türkçe; yeni müşteri metinlerinin İngilizcesi `src/lib/en/booking.ts`'e eklenir.
- Testler `npm test` ile hem replset hem standalone modda geçer (tam paket: "ℹ fail 0" satırını oku, çıkış koduna güvenme).
- Worktree: `/Users/yck/rota-kars-ikinci-arac`, dal `feature/ikinci-arac`.

## Review Focus

1. Kapalı koltuğu olan araçta rezervasyon iptal edilince koltuk yeniden kapalı (müşteriye dolu) görünmeli, boş değil → Task 1 testi.
2. 1. araç satışa kapalıyken (`active: false`) 2. araç açıksa tarih listede görünmeli ve müşteri 2. araca gitmeli → Task 2 testi.
3. Grubun ortak tarihi değişirken 2. araçta kilit varsa 409 (yalnız 1. araca bakmak yetmez) → Task 2 testi.
4. Bekleme listesi: 1. araç tamamen dolu, "Araç ekle" sonrası bekleyen e-posta almalı → Task 2 testi.
5. Yolcu sayısı 1. araçta kalan yerden büyükse rezervasyon sayfası 2. aracı açmalı; hiçbir araca sığmıyorsa "tek araca sığmıyor" uyarısı → Task 3 tarayıcı kontrolü.

---

### Task 1: Satışa kapalı koltuklar (sunucu)

**Files:**
- Modify: `server/departures.mjs` (enrich, list, save, yeni `setClosedSeats`)
- Modify: `server/store.mjs` (`availability`, `hold`)
- Modify: `server/advanced-api.mjs` (yeni route)
- Modify: `server/app.mjs` (`publicDeparture`)
- Test: `tests/ikinci-arac.test.mjs` (yeni; fikstür `tests/tour-copy.test.mjs`'teki gibi app + owner cookie)

**Interfaces:**
- Produces: enrich edilmiş sefer `group_id: string`, `vehicle_no: number`, `closed_seats: number[]` (kapasite dışındakiler atılmış).
- Produces: `departures.list()` satırı `closed: number` (kilitsiz kapalı sayısı) ve `available = sellableSeats − kilitli − closed`.
- Produces: `departures.setClosedSeats(id: string, seats: number[]) → Promise<Departure>`.
- Produces: `store.availability(id, { agent })` koltuk durumu: `"available" | "occupied" | "closed"`; `"closed"` yalnız `agent: true`'da, halka açıkta `"occupied"`.
- Produces: `POST /api/admin/departures/:id/closed-seats` gövde `{ seats: number[] }` (0–53 tamsayı), yanıt sefer.

- [ ] **Step 1: Testleri yaz**

```js
test("closed seats look occupied online, closed to the agent, and are not sold online", async (t) => {
  // 19+1 Sprinter (18 satılabilir) aktif sefer aç; POST closed-seats { seats: [15,16,17,18] } → 200
  // GET /api/departures/:id/seats → 15..18 status "occupied"; body'de "closed_seats" metni yok
  // GET /api/admin/departures/:id/seats → 15..18 status "closed"
  // GET /api/tours/tiflis/departures → available === 14
  // POST /api/holds { seats: [15] } → 409, mesaj /satışa kapalı/
  // admin POST /api/admin/reservations seats [15] → 201 (acenta yazabilir)
});
test("a cancelled booking on a closed seat returns it to closed", async (t) => {
  // seats [15] kapalı, admin rezervasyon 15, iptal → admin seats 15 "closed", halka açık "occupied", available 14
});
test("closing a sold seat is refused; changing the vehicle drops closed seats beyond capacity", async (t) => {
  // seat 3'e hold al, closed-seats [3] → 409 /dolu/
  // closed-seats [17,18], kilitsiz; sefer aracını vip-minibus 9'a çevir → closed_seats deepEqual []
  // closed-seats [99] → 400
});
```

- [ ] **Step 2: Çalıştır, düşmeli** — `node --test tests/ikinci-arac.test.mjs` → FAIL (route yok).

- [ ] **Step 3: Uygula**
  - `enrich`: üç alanı okuma varsayılanlarıyla ekle; `closed_seats`'i `n <= vehicle.sellableSeats` ile süz.
  - `list`: kilitli koltuk numaralarını oku (bugünkü `count` yerine `find` + projection `seat`), `closed` = kilitli olmayan kapalılar.
  - `save`: araç değişince `closed_seats`'i yeni kapasiteye göre süzerek yaz.
  - `setClosedSeats`: tx içinde; numaralar 1..sellable değilse 400 "Yalnızca 1–N numaralı koltuklar kapatılabilir."; yeni eklenen numara aktif kilitliyse 409 "Bu koltuk dolu; önce rezervasyonu taşıyın.". Sıralı, tekil dizi yaz.
  - `availability`: durum sırası kilitli → `occupied`, kapalı → agent ise `closed` değilse `occupied`, yoksa `available`.
  - `hold`: `agent` değilse istenen koltuk `closed_seats`'teyse 409 "Seçtiğiniz koltuklardan biri satışa kapalı.".
  - `publicDeparture`: `closed_seats`, `closed`, `group_available` alanlarını çıkar.
  - `store.overview` ve panel listesindeki dolu sayısı: dolu = satılabilir − available − closed (kapalı koltuk dolu sayılmaz).

- [ ] **Step 4: Çalıştır, geçmeli** — aynı komut → PASS; `npm test` → "ℹ fail 0".

- [ ] **Step 5: Commit** — `git commit -m "Seferde koltukları online satışa kapatma"`

### Task 2: Ek araç ve grup (sunucu)

**Files:**
- Modify: `server/departures.mjs` (`addVehicle`, `save` senkron/çakışma, `remove`, `list` → `group_available`)
- Modify: `server/store.mjs` (`listDepartures` gruplama, `hold` sıra kontrolü)
- Modify: `server/interest.mjs` (`add`, `notifyOpenings`)
- Modify: `server/advanced-api.mjs` (yeni route)
- Test: `tests/ikinci-arac.test.mjs`

**Interfaces:**
- Consumes: Task 1'deki `group_id`, `vehicle_no`, `closed`, `available`.
- Produces: `departures.addVehicle(id: string) → Promise<Departure>` — kaynak grubun 1. aracına `group_id = id`'sini yazar; yeni kayıt: aynı tur, `group_id`, tarih, saat, `price` (null dahil), pickup, active, araç modeli/kapasitesi 1. araçtan; `vehicle_id: ""`, rehber boş, `closed_seats: []`, `vehicle_no = max + 1`.
- Produces: `POST /api/admin/departures/:id/vehicles` (gövde yok) → 201 yeni sefer.
- Produces: `departures.list()` satırı `group_available: number` = aynı `group_id`'deki `salesOpen` satırların `available` toplamı (list'in kendi sonuç kümesi içinde; tarih filtresi grubu bütün getirir).
- Produces: `store.listDepartures(tourId)` grup başına tek satır: seçilen aracın alanları + `available` (toplam) + `vehicles: { id: string, available: number }[]` (`vehicle_no` sırasıyla, yalnız satışı açıklar). Seçilen araç = ilk `available > 0` olan, yoksa ilk.

- [ ] **Step 1: Testleri yaz**

```js
test("added vehicle copies the shared plan and the date shows once", async (t) => {
  // 1. araç (vehicleId "36ABN916", rehber "Ali") → POST /:id/vehicles → 201
  // yeni: vehicle_no 2, group_id === ilk.id, vehicle_id "", guide_name "", tarih/saat/fiyat eşit
  // GET /api/tours/tiflis/departures → o tarih 1 satır, id === ilk.id, available 36, vehicles.length 2
  // ilk aracın 18 koltuğunu admin rezervasyonla doldur → satır id === ikinci.id, available 18
});
test("online holds fill vehicle 1 first; agents are exempt", async (t) => {
  // 1. araçta 2 boş kalsın; POST /api/holds 2. araç seats [1] → 409 /Önce diğer araç/
  // 2. araç seats [1,2,3] (3 kişi, 1. araca sığmaz) → 200
  // admin rezervasyon 2. araç seats [5] → 201
});
test("vehicle 2 alone is listed when vehicle 1 is inactive", async (t) => {
  // 1. araç active:false, 2. araç açık → listede tarih var, id === ikinci.id
});
test("shared fields sync across the group and respect locks on any vehicle", async (t) => {
  // 1. aracın saatini 07:00 yap → 2. aracın start_time 07:00, guide_name değişmez
  // 2. araçta hold al; 1. aracın tarihini değiştir → 409
  // aynı tur+tarih+saatte yeni sefer (id'siz save) → 409 /Araç ekle/
  // aynı tarih farklı saat → 200
  // 1. aracı sil (2. araç varken) → 409; 2. aracı sil (kayıtsız) → 200
});
test("waitlist hears about an added vehicle", async (t) => {
  // 1. araç dolu; POST /api/interest waitlist departureId = ilk.id count 2 → 201
  // store.interest.notifyOpenings() → { notified: 0 }
  // Araç ekle → notifyOpenings() → { notified: 1 }; kuyrukta kind "interest_opening"
});
```

- [ ] **Step 2: Çalıştır, düşmeli** — `node --test tests/ikinci-arac.test.mjs` → yeni testler FAIL.

- [ ] **Step 3: Uygula**
  - `save` (yeni kayıt ve tarih/saat değişimi): aynı tur + tarih + saatte başka gruptan sefer varsa 409 "Bu tarih ve saatte sefer var; ikinci araç için seferde 'Araç ekle'yi kullanın." `addVehicle` bu kontrolü atlar (iç bayrak).
  - `save` (düzenleme): tarih, saat, fiyat, pickup değiştiyse gruptaki diğer araçlara da yaz; tarih/saat/fiyat değişiminde gruptaki herhangi bir araçta aktif kilit varsa bugünkü 409 mesajı; yeni tarihte filo aracı çakışmasını her araç için ayrı kontrol et. Araç tipi kilit kuralı yalnız kendi kilitlerine bakar.
  - `remove`: `vehicle_no === 1` ve gruptan başka araç varsa 409 "Önce diğer araçları silin.".
  - `store.hold` (agent değil): aynı grupta `vehicle_no`'su küçük, `salesOpen` bir araçta `available >= seats.length` ise 409 "Önce diğer araç doluyor; sayfayı yenileyip yeniden seçin.".
  - `interest.add`: yer kontrolünde `listed.group_available`; kayıt `departure_id = d.group_id`.
  - `interest.notifyOpenings`: grubu `departures.list({ tourId, date })` ile oku; 1. aracın `salesOpen`'ına değil grubun `group_available`'ına ve `departed`'a bak; e-postadaki sayı `group_available`.

- [ ] **Step 4: Çalıştır, geçmeli** — aynı komut → PASS; `npm test` → "ℹ fail 0" (aynı tarih+saatte iki sefer açan eski test varsa farklı saate çek).

- [ ] **Step 5: Commit** — `git commit -m "Sefere ek araç: grup, doluluk sırası, bekleme listesi"`

### Task 3: Rezervasyon sayfası

**Files:**
- Modify: `src/lib/types.ts` (`Departure` + `group_id?`, `vehicle_no?`, `closed?`, `closed_seats?`, `vehicles?`; `Seat.status` + `"closed"`)
- Modify: `src/pages/Booking.tsx`
- Modify: `src/components/SeatMap.tsx`
- Modify: `src/lib/en/booking.ts`

**Interfaces:**
- Consumes: Task 2'deki `vehicles: { id, available }[]` ve sıra 409 mesajı.

- [ ] **Step 1: Uygula**
  - Booking: `departureId` tarih seçimi olarak kalır. `vehicleId = departure?.vehicles?.find(v => v.available >= count)?.id ?? departure?.vehicles?.[0]?.id ?? departureId`. Koltuk yükleme, `/holds`, `/reservations/quote`, `/reservations/pre-info` ve rezervasyon oluşturma `vehicleId` kullanır; koltuk yükleme etkisi `[vehicleId, step]`'e bağlanır; `vehicleId` değişince `selected` temizlenir.
  - Uyarı: `departure.available >= count` ama hiçbir `vehicles[i].available >= count` değilse: "Grubunuz tek araca sığmıyor; birlikte yolculuk için bizi arayın." + mevcut telefon/WhatsApp bağlantısı. Mevcut "Bu seferde {n} kişilik yer kaldı" kutusu bu durumda gösterilmez.
  - SeatMap: `closed` durumunu `vehicle-seat closed` sınıfıyla çiz, tıklanabilir bırak (yalnız panelde gelir); aria etiketi "satışa kapalı". Stil: `src/admin.css` altında `.rk-admin .vehicle-seat.closed` (çizgili gri).
  - en/booking.ts: iki yeni metin (uyarı ve "Önce diğer araç doluyor…"), aria "satışa kapalı".

- [ ] **Step 2: Doğrula** — `npm run build` hatasız. Tarayıcı (preview): 2 araçlı sefer, 1. araçta 2 yer kalmışken 3 yolcu seçince 2. aracın planı açılıyor; 1 yolcuda 1. araç; tüm araçlar 2'şer boşken 3 yolcuda uyarı.

- [ ] **Step 3: Commit** — `git commit -m "Rezervasyon sayfası grubun uygun aracını açar"`

### Task 4: Panel

**Files:**
- Modify: `src/components/OperationsDesk.tsx` (DepartureManager listesi, DepartureEditor, taşıma seçimi, DailyReport)
- Modify: `src/components/admin/NewReservation.tsx`
- Modify: `src/admin.css`

**Interfaces:**
- Consumes: Task 1 ve 2'deki route'lar ve alanlar.

- [ ] **Step 1: Uygula**
  - Sefer listesi: grubu birden fazla araçlı satırlarda "N. araç" etiketi; kontenjan altına kapalı varsa "· {closed} kapalı"; işlem sütununa "Araç ekle" (POST `/admin/departures/:id/vehicles`, sonra listeyi yenile ve yeni aracın düzenleyicisini aç, bildirim "2. araç eklendi; plakayı ve rehberi seçin.").
  - DepartureEditor (kayıtlı sefer): "Satışa kapalı koltuklar" bölümü; `/admin/departures/:id/seats` ile SeatMap; dolu koltuk tıklanmaz, diğerine tıklayınca açık↔kapalı (yerel taslak); "Arka sırayı kapat/aç" (düzenin son sırasındaki sayılar); "Kapalı koltukları kaydet" → POST closed-seats. Renk açıklaması: boş / dolu / satışa kapalı. Grubu olan seferde "Tarih, saat, fiyat ve buluşma noktası gruptaki tüm araçlara uygulanır." notu.
  - NewReservation ve taşıma seçimi: seçenek etiketine gruplu seferde " · N. araç"; SeatMap'te `closed` seçilebilir.
  - DailyReport: gruplu seferlerde satır başlığına "N. araç" ve plaka; grubun ilk satırının üstünde tarih/tur toplamı (onaylı misafir ve boş koltuk toplamı).

- [ ] **Step 2: Doğrula** — `npm run build`; tarayıcıda panelden: araç ekle → listede "2. araç"; arka sırayı kapat → kaydet → sitede 15–18 dolu; yeni rezervasyon ekranında 15 seçilip kaydediliyor; günlük raporda iki araç ve toplam.

- [ ] **Step 3: Commit** — `git commit -m "Panel: araç ekle, satışa kapalı koltuklar, araç etiketleri"`

### Task 5: Son kontrol ve PR

- [ ] `npm test` (replset + standalone) → "ℹ fail 0"; `npm run build` hatasız.
- [ ] Bütün dalı bir gözden geçiriciye okut (superpowers:requesting-code-review), bulguları düzelt.
- [ ] Push, PR aç (origin, `feature/ikinci-arac`), açıklama sonuna Claude Code satırı.
