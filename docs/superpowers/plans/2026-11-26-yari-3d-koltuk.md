# Yarı 3D koltuk seçimi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rezervasyon sayfasındaki koltuk haritasını varsayılan yarı 3D yapmak, düz görünüm seçeneğini korumak ve araç sınıfının fotoğrafı varsa fotoğraftan plana geçiş animasyonu oynatmak.

**Architecture:** Sunucu, araç sınıfına (`vehicleModels`) bağlı fotoğrafları `makeVehicle` üzerinden her araca `photos` olarak ekler. İstemcide `SeatMap` bir `depth` kipi kazanır (aynı düğmeler, kabarık koltuk içeriği, CSS perspektif). Yeni `SeatStage` bileşeni görünüm düğmesini, tercihi, giriş animasyonunu (Web Animations API) yönetir ve yalnız `Booking.tsx`'te kullanılır.

**Tech Stack:** React 19 + TypeScript + Vite, Express 5, `node:test`, düz CSS.

**Spec:** `docs/superpowers/specs/2026-11-26-yari-3d-koltuk-design.md`

## Global Constraints

- Yalnız müşteri rezervasyon sayfası değişir; panel ekranları, `TourOperations`, ana sayfa önizlemesi düz kalır.
- Koltuklar `button` olarak kalır; `aria-label`, `aria-pressed`, `disabled` mantığı ve mobil `data-seatmap-visible` işareti aynen korunur.
- Hareket azaltma (`prefers-reduced-motion: reduce`) açıksa animasyon oynamaz.
- 375 px genişlikte 18 koltuklu araç yatay kaydırma olmadan tamamen sığar.
- Fotoğraflar webp; harita ekrana yaklaşmadan indirilmez (`loading="lazy"`).
- Görünüm tercihi `localStorage` anahtarı `rota.seatView`, değerler `"depth"` | `"flat"`; okuma/yazma `try/catch` içinde, hata olursa `"depth"`.
- Yeni Türkçe metinler `src/lib/en/booking.ts`'e İngilizce karşılıklarıyla eklenir.

## Review Focus

- Sefere filo aracı atanmışsa (`fleetVehicleLayout` yolu) `photos` kaybolmamalı → Task 1 testi.
- `localStorage` erişimi hata fırlatırsa (gizli sekme) sayfa çökmemeli, yarı 3D açılmalı → Task 3 tarayıcı kontrolü.
- Animasyon oynarken müşteri başka tarih/araç seçerse animasyon iptal olmalı, yeni araç için baştan oynamalı → Task 3.
- 46 koltuklu Travego 375 px'te sayfayı yatay kaydırmamalı; plan sahnenin içinde dikey kaymalı → Task 4.
- Sefer seçilmeden (`interactive={false}`) yarı 3D plan görünür ama koltuklar tıklanmaz → Task 4.

---

### Task 1: Sınıf fotoğrafları sunucuda

**Files:**
- Create: `public/images/fleet/vip-midibus-dis.webp`, `public/images/fleet/vip-midibus-ic.webp`
- Modify: `server/operations.mjs` (`vehicleModels`, `makeVehicle`)
- Modify: `src/lib/types.ts` (`Vehicle`)
- Test: `tests/fleet.test.mjs`

**Interfaces:**
- Produces: araç nesnelerinde isteğe bağlı `photos: { exterior: string; interior: string }`; TS'de `Vehicle.photos?: { exterior: string; interior: string }`.

- [ ] **Step 1: Görselleri üret.** Kaynak: `.impeccable/mocks/arac-3d/dis.jpg` ve `ic.jpg` (ana checkout'ta, `/Users/yck/rota-kars/.impeccable/mocks/arac-3d/`). `cwebp -q 80 -resize 1200 0` (dış) ve `cwebp -q 80 -resize 800 0` (iç). Her biri 200 KB altında olmalı.
- [ ] **Step 2: Failing test yaz** (`tests/fleet.test.mjs`):

```js
test("araç sınıfının fotoğrafları araca eklenir", async (t) => {
  const photos = {
    exterior: "/images/fleet/vip-midibus-dis.webp",
    interior: "/images/fleet/vip-midibus-ic.webp",
  };
  assert.deepEqual(makeVehicle("vip-midibus", 19).photos, photos);
  assert.deepEqual(makeVehicle("vip-midibus", 15).photos, photos);
  assert.equal(makeVehicle("coach", 46).photos, undefined);
  for (const p of Object.values(photos))
    assert.ok(existsSync(new URL("../public" + p, import.meta.url)), p);
  // Filo aracı atanmış seferde de fotoğraf korunur.
  const unit = fleetVehicles.find((v) => v.plan === "sprinter-19");
  assert.deepEqual(fleetVehicleLayout(unit, makeVehicle("vip-midibus", 19)).photos, photos);
});
```

- [ ] **Step 3:** `node --test tests/fleet.test.mjs` → FAIL (`photos` undefined).
- [ ] **Step 4: Uygula.** `vehicleModels`'taki `vip-midibus` kaydına yukarıdaki `photos` nesnesi; `makeVehicle` her iki dönüş yolunda `...(model.photos && { photos: model.photos })`. `fleetVehicleLayout` ve test importlarına `fleetVehicleLayout` eklenir. `Vehicle` tipine alan eklenir.
- [ ] **Step 5:** `node --test tests/fleet.test.mjs` → PASS; `npm run typecheck` → hatasız.
- [ ] **Step 6: Commit** — `Araç sınıfına fotoğraf: Sprinter/Crafter dış ve iç görsel`.

### Task 2: SeatMap derinlik kipi

**Files:**
- Modify: `src/components/SeatMap.tsx`
- Create: `src/components/seat-stage.css` (yarı 3D stilleri; `SeatMap.tsx` içinden import edilir)

**Interfaces:**
- Produces: `SeatMap` yeni prop `depth?: boolean` (varsayılan `false`). `depth` iken kök sınıfa `is-depth`, gövdeye `--rows: <yolcu sıra sayısı>` eklenir; yolcu koltuğu içeriği `<span className="seat-cushion" />` + `<span className="seat-back"><span>{n}</span></span>` olur (Armchair ikonu yok, seçiliyken `seat-check` yine var). Şoför/rehber koltukları ve kapı aynı yapıyla kalır.

- [ ] **Step 1: Uygula.** `depth=false` iken DOM bugünküyle birebir aynı kalır.
- [ ] **Step 2: Stil.** Değerler deneme sayfasından (`.impeccable/mocks/arac-3d/yari-3d.html`): `.seat-map.is-depth .vehicle-body` için `transform: rotateX(var(--tilt))`, `transform-origin: 50% 100%`, `transform-style: preserve-3d`; `--tilt` varsayılan `40deg`; yolcu sırası 8 ve üstüyse `SeatMap` köke `data-long` koyar ve `--tilt: 26deg` olur. Ebeveyn `.seat-map.is-depth` `perspective: 1000px; perspective-origin: 50% 8%`. `.seat-back` `transform-origin: 50% 100%; transform: rotateX(-82deg)`, hover `-74deg`, seçili altın (`#c08f45` gövde, `#e6c58c` başlık), dolu koyu. Koltuğa `:focus-visible` halkası `.seat-back` üzerinde. Bugünkü açık renkli araç gövdesi korunur.
- [ ] **Step 3:** `npm run typecheck` → hatasız.
- [ ] **Step 4: Commit** — `Koltuk haritasına yarı 3D kip`.

### Task 3: SeatStage ve rezervasyon sayfası

**Files:**
- Create: `src/components/SeatStage.tsx`
- Modify: `src/components/seat-stage.css`, `src/pages/Booking.tsx:1032` (`SeatMap` → `SeatStage`, aynı proplar), `src/lib/en/booking.ts`

**Interfaces:**
- Consumes: `SeatMap` `depth` propu (Task 2), `Vehicle.photos` (Task 1).
- Produces: `export function SeatStage(props: Parameters<typeof SeatMap>[0])`.

- [ ] **Step 1: Uygula.**
  - Görünüm: `useState<"depth" | "flat">` başlangıcı `rota.seatView`'dan; düğme metni `depth` iken "Düz görünüm", `flat` iken "3D görünüm"; `aria-pressed` düz görünümde `true`.
  - Giriş: `vehicle.photos` varsa, görünüm `depth`, hareket azaltma kapalı ve bu `vehicle.id` bu sayfa oturumunda oynamadıysa (modül düzeyinde `Set<string>`), sahne `IntersectionObserver` (`threshold: 0.5`) ile görünür olunca oynar. Zamanlama deneme sayfasıyla aynı: dış foto 1300 ms kapıya yaklaşma (`transform-origin: 67% 46%`, ölçek 1→3.4, bulanıklaşıp kaybolur), iç foto 850 ms gecikmeyle 2900 ms (yatay aynalı: `scaleX(-1)` her karede), plan 2950 ms'de `rotateX(68deg)`'den yerine, koltuklar arkadan öne 70 ms aralıkla.
  - "Atla" yalnız animasyon sürerken; "Baştan oynat" fotoğraf varsa ve görünüm `depth` iken görünür.
  - `vehicle.id` değişince veya bileşen kalkınca tüm animasyonlar `cancel()`.
- [ ] **Step 2: Çeviriler.** "Düz görünüm" → "Flat view", "3D görünüm" → "3D view", "Atla" → "Skip", "Baştan oynat" → "Replay", "Aracın dışı" → "Vehicle exterior", "Aracın içi" → "Vehicle interior" (foto `alt` metinleri).
- [ ] **Step 3:** `npm run typecheck && npm run build` → hatasız.
- [ ] **Step 4: Commit** — `Rezervasyonda yarı 3D koltuk sahnesi ve fotoğraftan geçiş`.

### Task 4: Uçtan uca doğrulama

- [ ] **Step 1:** `npm test` → tümü geçer.
- [ ] **Step 2:** Worktree'de demo sunucusu (`SEED_DEMO=1 PAYMENT_PROVIDER=test`), tarayıcıda 375×812:
  - 18 koltuklu turda animasyon bir kez oynar, plan tamamen sığar, koltuk seçimi özete düşer, "Atla" ve "Baştan oynat" çalışır.
  - "Düz görünüm" bugünkü haritayı verir; sayfa yenilenince tercih kalır; `localStorage` engellenince (`Storage.prototype.getItem` hata fırlatacak şekilde) sayfa açılır.
  - Sefer seçilmeden koltuklar tıklanmaz.
  - Panelden bir sefere 46 koltuklu Travego atanır: animasyon yok (fotoğraf yok), yarı 3D plan sahnede dikey kayar, sayfa yatay kaymaz.
  - Hareket azaltma emülasyonunda animasyon oynamaz.
- [ ] **Step 3:** Sorun yoksa dal hazır; PR açmak kullanıcının onayına kalır.
