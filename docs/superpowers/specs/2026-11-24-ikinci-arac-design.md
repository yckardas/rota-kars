# İkinci araç ve satışa kapalı koltuklar — tasarım

Tarih: 2026-11-24 · Müşteri isteği (acenta): 26–27 Aralık Tiflis gibi dolan seferlere ikinci aracı
eklemek; ikinci araç çıkacaksa arka dörtlüyü online satışa kapatıp en son telefonla doldurmak.

## Amaç ve neden

Acentanın doluluk sırası: **1. aracın arka dörtlü dışındaki koltukları → 2. araç → en son arka
dörtlü (telefonla)**. Arka sıra rahatsız olduğu için oraya online müşteri oturtmak istemiyor; yer
kalmazsa kendisi yazıyor. Bugün:

- Her sefer tek araçtır (koltuk kilitleri, yolcu listesi, rehber, plaka seferin kendisine bağlı).
- Aynı tarihe ikinci sefer açılabiliyor ama müşteri tarih listesinde aynı günü iki kez görüyor ve
  1. araç dolmadan 2. aracı seçebiliyor.
- "Satışa kapalı koltuk" yok; tek yol sahte isimli rezervasyon.

## Hedefler

1. Seferde koltuklar tek tek **satışa kapatılabilir**; "Arka sırayı kapat" kısayolu var.
2. Bir sefere **ek araç** eklenebilir (2., 3. …). Müşteri o tarihi tek satır görür; sistem onu
   kendiliğinden sıradaki boş araca yönlendirir.
3. Acenta kapalı koltuklara ve herhangi bir araca panelden ("Koltuk kapat / rezervasyon") yazabilir.

## Hedef olmayanlar

- Tur bazında varsayılan kapalı koltuk şablonu (her seferde elle; gerekirse sonra).
- Müşterinin aracı kendisinin seçmesi.
- Bir rezervasyonun koltuklarını iki araca bölmek.

## Anti-hedefler (çalışsa bile başarısızlık sayılır)

- Online müşteri kapalı bir koltuğu alabiliyorsa.
- 1. araçta grubun sığacağı yer varken müşteri 2. araca düşüyorsa (önce 1. araç dolmalı).
- Aynı tarih müşteriye iki ayrı seçenek olarak görünüyorsa.
- Bir aile/grup iki araca bölünüyorsa.

## Yaklaşımlar

- **A · Bağlı seferler, otomatik geçiş (seçilen).** Her araç kendi seferidir (bugünkü sefer kaydı
  aynen: kilitler, yolcu listesi, rehber, plaka, taşıma). Aynı gruba bağlanırlar; halka açık listede
  grup tek satırdır ve sıradaki uygun araca yönlendirir. Mevcut koltuk/ödeme/taşıma kodu değişmez.
- **B · Acenta açsın.** 2. araç ayrı sefer, kapalı başlar; 1. araç dolunca acenta açar. Kısa ama
  takip ister, geç kalınca satış kaçar ve aynı tarih iki satır görünür.
- **C · Tek seferde çok araç.** Koltuk kimliği "araç-koltuk" olur. Kilit, rezervasyon, yolcu
  listesi, ödeme ve rapor kodunun hepsine dokunur; gereksiz risk.

Kullanıcı A'yı seçti (2026-11-24).

## Tasarım

### Veri

`departures` kaydına iki alan:

- `group_id` — aynı tarihteki araçları bağlar. Yoksa seferin kendi `id`'si sayılır (eski kayıtlar
  göç gerektirmez). Grubun sırası `vehicle_no` ile.
- `vehicle_no` — 1, 2, 3 … (yoksa 1).
- `closed_seats` — online satışa kapalı koltuk numaraları (dizi, yoksa `[]`).

### Satışa kapalı koltuk

- Müşteriye `occupied` (dolu) görünür; halka açık yanıtta "kapalı" bilgisi sızmaz.
- Panelde (agent) koltuk durumu `closed` olarak ayrı görünür ve **seçilebilir**; acenta yazınca
  koltuk normal dolu olur. Rezervasyon iptal olursa koltuk yeniden kapalıya döner (kapalılık seferin
  ayarıdır, kilit değildir).
- `available` = satılabilir − kilitli − (kilitli olmayan kapalı). Panel ayrıca kapalı sayısını
  gösterir ("14 boş · 4 kapalı").
- Online `hold` kapalı koltuğu 409 ile reddeder; agent `hold` kabul eder.
- Araç tipi/kapasitesi değişince kapasite dışında kalan kapalı numaralar atılır.
- "Arka sırayı kapat" = aracın düzenindeki son sıranın koltuk numaraları (19+1 Sprinter'da 15–18).
  Aynı düğme kapalıysa "Arka sırayı aç" olur.
- Kapalı koltuk değiştirmek, kilit varken yapılabilir (tarih/araç kuralına girmez); ama kilitli
  (satılmış) bir koltuk kapatılamaz → 409 "Bu koltuk dolu".

### Ek araç

- Panelde seferin üstünde **"Araç ekle"**. Yeni sefer oluşur: aynı tur, `group_id`, tarih, saat,
  fiyat (özel fiyat dahil), buluşma noktası, aktiflik; `vehicle_no` = gruptaki en büyük + 1. Araç
  tipi ve koltuk sayısı 1. araçtan gelir, filo aracı (plaka) boş gelir; rehber adı/telefonu boş gelir
  (çoğu zaman ikinci araçta başka rehber olur). Kapalı koltuklar kopyalanmaz.
- **Ortak alanlar:** tarih, saat, fiyat, buluşma noktası grupta eşit tutulur; birinde değişince
  hepsine yazılır. Mevcut "kilit varken tarih/fiyat/araç değişmez" kuralı grubun herhangi bir
  aracında kilit varsa uygulanır (tarih, saat, fiyat için). Araç tipi kuralı yalnız o aracın
  kendi kilitlerine bakar.
- **Araca özel alanlar:** araç tipi/kapasite, filo aracı, rehber, aktiflik, kapalı koltuklar.
- Silme: bugünkü kural (kaydı olan silinmez). Silinen araçtan sonra kalanların `vehicle_no`'su
  değişmez; sıra yine numaraya göre.
- Gruptan araç çıkarma/başka tarihe taşıma yok; yolcu taşıma mevcut "başka sefere taşı" ile yapılır
  (gruptaki diğer araç da listede görünür). Acenta yolcuyu kapalı koltuğa da taşıyabilir.
- `group_id`, ilk ek araç eklendiğinde 1. araca da yazılır.
- Ortak tarih değişince filo aracı çakışması gruptaki her araç için ayrı kontrol edilir.
- **Gruba girmenin tek yolu "Araç ekle".** Normal "yeni sefer" ve toplu sefer açma, aynı tur + tarih +
  **saat** zaten varsa 409 verir: "Bu tarih ve saatte sefer var; ikinci araç için seferde 'Araç
  ekle'yi kullanın." (Toplu açma bugün zaten aynı tarih+saati atlıyor; o davranış kalır.) Aynı gün
  farklı saatteki sefer (sabah/öğleden sonra) ayrı sefer olarak kalır. Birleştirme/bağlama eylemi
  yok: canlıda 2026-11-24 itibarıyla Tiflis'in 25 Aralık 23:00 seferi tek kayıt (8 boş yer), yani
  ikinci araç doğrudan "Araç ekle" ile eklenebilir.

### Bekleme listesi

- Bekleme listesi kayıtları bugün sefer kimliğine bağlı ve "araç büyütme" bekleyenlere e-posta
  gönderiyor. Aynı mantıkla **"Araç ekle"** ve **kapalı koltuğun satışa açılması** gruptaki tüm
  araçlarda bekleyenler için "yer açıldı" sayılır ve e-posta gider (yalnız satış açıksa). Bekleme
  listesine katılırken kayıt grubun ilk aracına bağlanır.

### Halka açık liste ve yönlendirme

- `/api/tours/:id/departures` grup başına tek satır döner. Satırın `id`'si grubun **ilk boş yeri olan
  aracı** (yoksa 1. araç); `available` = gruptaki satışı açık araçların toplamı. Ek alan
  `vehicles: [{ id, available }]` sıra numarasına göre (müşteriye araç adı/plaka gösterilmez).
- Rezervasyon sayfası yolcu sayısı değişince **o sayının sığdığı ilk aracı** seçer ve koltuk
  planını onunla yükler. Müşteri araç seçmez; planın üstünde ufak not: araç numarası gösterilmez.
- Toplam yer yeterli ama tek araca sığmıyorsa: "Grubunuz tek araca sığmıyor; bizi arayın"
  uyarısı + mevcut telefon/WhatsApp yolu.
- **Sunucu sırayı korur:** online `hold`, aynı gruptaki daha küçük numaralı satışı açık bir araçta
  istenen sayı kadar boş (kapalı olmayan) yer varsa 409 verir ("Önce diğer araç doluyor, sayfayı
  yenileyin"). Agent bundan muaf.
- Tur kartındaki "Son n koltuk", sohbet botunun tarih listesi ve ilgi akışı grubu tek tarih gibi
  görür (toplam boş yer). Panel listeleri araç araç kalır. Günlük rapor (rehberin de gördüğü ekran):
  tarih satırında grup toplamı, altında araç başına satır (her rehber kendi aracını görür).
- Hangi aracın önce geleceği hesaplanırken ödeme adımındaki geçici kilitler de dolu sayılır.
- Genel bakıştaki dolu/kapasite sayılarında kapalı koltuklar dolu sayılmaz.
- Seferin kesimi (satışın kalkıştan önce kapanması) zaten tarih/saat üzerinden; grupta eşit.

### Panel

- Sefer listesinde aynı gruptaki araçlar tarih başlığı altında alt satır olarak: "1. araç · 36 ABN
  916 · 14/18 dolu · 4 kapalı", "2. araç · …". Tarih satırında "Araç ekle".
- Sefer düzenleyicide koltuk planı: koltuğa tıklayınca açık ↔ kapalı (dolu koltuk tıklanmaz),
  "Arka sırayı kapat/aç" düğmesi, renk açıklaması (boş / dolu / satışa kapalı).
- "Koltuk kapat / rezervasyon" (yeni rezervasyon) ekranında sefer seçimi araç araç ("26 Ara ·
  2. araç"); kapalı koltuklar farklı renkte ama seçilebilir.
- Yolcu listesi/manifest araç başına (zaten sefer başına).

### İngilizce

Yeni müşteri metinleri (`src/lib/en/booking.ts`): tek araca sığmama uyarısı, sıra 409 mesajı.

## Kısıtlar

- Eski seferler alan olmadan çalışmalı (göç yok, varsayılanlar okuma anında).
- Mevcut testler bozulmamalı; MongoDB replset ve standalone modlarında geçmeli.
- Halka açık yanıtta plaka ve "kapalı" bilgisi yer almaz.

## Uygulayıcıya bırakılanlar

- Panelde grubun görsel düzeni ve renkler (mevcut admin stiline uygun).
- Ortak alan senkronunun hangi katmanda yapılacağı (departures.save içinde, transaction ile).
- Halka açık satırın mevcut `publicDeparture` dönüşümüne nasıl ekleneceği.
