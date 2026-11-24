# Tur kopyalama — tasarım (PR 2)

Onay: kullanıcı yaklaşım A'yı seçti ("hepsinde senin önerinle gidelim"). Genel tasarım:
`2026-11-24-belgeler-cark-altbilgi-kopya-design.md`. Bu not ayrıntıları ve kurucu kararlarını içerir.

## Amaç
Müşteri mevcut bir turu (ör. Tiflis) kopyalayıp rotası, gezilecek yerleri, süresi/türü (konaklamalı →
günübirlik) farklı yeni bir tur olarak yayınlar. Kopya her yerde kendi turu gibi davranır.

## Bugünkü durum
- Turlar `server/catalog.mjs`'deki ortak `tours` dizisinde; panel yalnız içerik alanlarını `site_content`'e yazar.
- Kodun çoğu turu çalışırken `tours.find(...)` ile bulur → diziye eklenen kopya kendiliğinden çalışır
  (rezervasyon, e-posta, U-ETDS, ödeme, iş akışı, sohbet, SEO sayfası).
- Engeller: açılışta kurulan `z.enum(tours.map(...))` doğrulamaları (11 yer), açılışta tura göre kurulan
  `DEFAULT_TOURS` ve `tour_operations` satırı.

## Kararlar
- **Kayıt:** `custom_tours` koleksiyonu: `{ id, source_id, hidden, base, defaults, created_at, created_by }`.
  `base` = içerik dışı alanlar (kaynaktan: `inquiryOnly`, `demandByDefault`), `defaults` = kopyalandığı
  andaki içerik (yeni adla). Düzenlemeler bugünkü gibi `site_content: tour:<id>`'e yazılır; "Varsayılana dön"
  kopyalandığı hâle döner.
- **Açılış:** `createContent` kopyaları okuyup `tours` dizisine (kaynağın hemen arkasına) ekler ve
  `DEFAULT_TOURS`'a yazar; `apply()` içeriği bindirir. `abroad` kopyada kategoriden türetilir
  (`category === "Yurt dışı"`): iptal süresi ve sözleşme dili doğru kalır.
- **Doğrulama:** `z.enum(tours…)` yerine çalışırken bakan `knownTourId` (bilinmeyen id → 400).
- **Araç planı:** kopyalanırken kaynağın `tour_operations` satırı (araç, satış modu, eşik, transfer) çoğaltılır.
  Seferler kopyalanmaz.
- **Taslak (kurucu kararı):** Kopya **taslak** başlar (`hidden: true`): sitede, site haritasında ve sohbet
  botunda görünmez; müşteri rotayı/metni düzenleyip "Yayınla" der. Aynı içerikli ikinci sayfanın yanlışlıkla
  yayına çıkmasını ve Google'da kopya içerik görünmesini önler.
- **Adres:** panelde ad girilince adres önerilir (`tiflis-gunubirlik`); düzenlenebilir;
  `^[a-z0-9]+(-[a-z0-9]+)*$`, 3–60 karakter, benzersiz.
- **Silme:** yalnız kopyalar; seferi hiç yoksa silinir, varsa "Yayından kaldır" (taslağa al) önerilir.
  Kod içindeki turlar silinemez/gizlenemez (kapsam dışı).
- **İngilizce:** kopyanın çevirisi yok; /en altında Türkçe metinle görünür.
- **Panel:** Site içerikleri listesi `GET /api/admin/content/tours`'tan gelir (taslaklar dahil, "Taslak"
  etiketiyle). Tur düzenleyicide "Bu turu kopyala" (ad + adres), kopyalarda "Yayınla / Taslağa al" ve "Sil".
  Taslak tur sefer planında görünmez (sefer, yayınlandıktan sonra açılır).

## Uç noktalar
- `GET  /api/admin/content/tours` → `[{ id, name, custom, hidden, sourceId }]`
- `POST /api/admin/content/tours/:id/copy` `{ id, name }` → yeni turun içerik bilgisi (201)
- `POST /api/admin/content/tours/:id/visibility` `{ hidden }` (yalnız kopya)
- `DELETE /api/admin/content/tours/:id` (yalnız kopya, seferi yoksa)

## Kapsam dışı
Kod içindeki turları gizleme, kopyaya otomatik İngilizce çeviri, yorum (Google) eşlemesi.
