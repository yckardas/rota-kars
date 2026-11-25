# Tarih bazında talep toplama — tasarım

Tarih: 2026-11-25 · Müşteri isteği (acenta): talep toplamayı tur adı **ve tarihiyle** yapmak.

## Amaç ve neden

Bugün "talep toplama" tur bazındadır: müşteri yalnız turu görür, tarih yerine serbest "Tercih
ettiğiniz dönem" yazar; eşik (14 kişi) ve "Satışı aç ve haber ver" bütün tur için tektir. Canlıda 7
tur bu modda (Butik Mardin, Güneydoğu, Nahçıvan, Sivas-Kemaliye, Karadeniz, Narman-Tortum, Büyük
Azerbaycan), hiçbirinde tarih yok.

Acenta "Butik Mardin · 14–16 Şubat" gibi belirli bir tarih ilan edip **o tarihe** kayıt toplamak,
tarih başına kaç kişi olduğunu görmek ve eşiği dolan tarihi tek başına satışa açmak istiyor
(kullanıcı seçimi: "Tarih bazında talep", 2026-11-25).

## Hedefler

1. Acenta talep toplanacak tarihi sefer olarak açar; sitede tur bu tarihlerle görünür.
2. Müşteri ön kayıtta tarih seçer; kayıt o tarihe bağlanır.
3. Panelde tarih başına sayaç ("14 Şub · 9/14 kişi").
4. Acenta tek bir tarihi "Satışa aç"ar: sefer online satışa geçer, e-posta yalnız o tarihe
   kaydolanlara gider (bağlantı o tarihi seçili açar).
5. Satıştaki bir turda (ör. Tiflis) tek bir tarih de talep toplamaya alınabilir.

## Hedef olmayanlar

- Tarih başına ayrı eşik (eşik turun ayarıdır, her tarih için ayrı sayılır).
- Ön kayıtlıyı satış açılınca kendiliğinden rezervasyona çevirmek / koltuk tutmak.
- Talep tarihinde bekleme listesi (bekleme listesi dolu satış seferi içindir).

## Anti-hedefler (çalışsa bile başarısızlık sayılır)

- Müşteri talep tarihinde koltuk seçip rezervasyon/ödeme yapabiliyorsa.
- Bir tarihi satışa açmak başka tarihe kaydolanlara "rezervasyon açıldı" e-postası gönderiyorsa.
- Tarihsiz (bugünkü) ön kayıtlar kayboluyor ya da panelde görünmüyorsa.
- Talep tarihi, satış seferi bekleyen yerlerde (ana sayfa "yaklaşan seferler", tur kartındaki
  "ilk hareket / son n koltuk", arama, sohbet botunun koltuk listesi, "başka sefere taşı") satılabilir
  sefer gibi görünüyorsa.

## Yaklaşımlar

- **A · Talep seferin kendisine bağlı (seçilen).** Talep tarihi normal bir `departures` kaydıdır;
  seferde satış modu alanı vardır. Satışa geçerken sefer, fiyat, araç, buluşma noktası, ikinci araç
  zaten hazırdır; e-posta bağlantısı o tarihi açar. Bedeli: aynı turda satıştaki ve talep toplayan
  tarihler bir arada olabilir; site bu karışık durumu göstermeli.
- **B · Turun altında ayrı tarih listesi.** Yalnız tarih yazılır, araç/fiyat gerekmez. Satışa geçerken
  acenta ayrıca sefer açar; tarih iki yerde tutulur, e-posta bağlantısı tura gider.
- Satışı bütün tur için açmak (kullanıcı eledi); talebi sahte koltuk rezervasyonu olarak tutmak
  (koltuk/ödeme koduna gereksiz risk).

Kullanıcı A'yı seçti (2026-11-25).

## Tasarım

### Veri

- `departures.sales_mode`: `"demand" | "online" | null`. `null` = turun moduna uyar (göç yok).
  Seferin etkin modu = `sales_mode ?? tur modu`. Grup (ek araçlar) içinde **ortak alan**: tarih,
  saat, fiyat, buluşma noktası gibi `updateMany` ile eşitlenir.
- Talep toplama modundaki turda açılan yeni sefer `null` kalır → talep tarihidir.
- Etkin modu `demand` olan sefer: `salesOpen = false` (bugünkü kural), ek olarak `demand = true`.
- `interest_list` (prereg): `departure_id` = grubun 1. aracının id'si, `departure_date` dolu.
  Tarihsiz kayıtta ikisi `null` (bugünkü gibi).

### Talep tarihi listesi (site verisi)

- `/api/tours/:id/departures` **değişmez** (yalnız satılabilir seferler). Böylece bu uç noktayı
  kullanan arama, yaklaşan seferler, sohbet botu, kart ve rezervasyon akışı talep tarihini satılabilir
  sanmaz.
- Katalog turuna (`/api/catalog`, HTML'e gömülen aynı veri) `demandDates` eklenir:
  `[{ id, date, start_time, price, count? }]` — gruptan tek satır (1. aracın id'si), tarih sırasına
  göre, yalnız `active`, fiyatı olan ya da olmayan (fiyat "tahmini", 0 ise "Fiyat için arayın"),
  bugünden sonraki ve satış kesimi geçmemiş seferler. `count` yalnız turun "ilerleme görünsün"
  ayarı açıksa. Plaka, rehber, kapalı koltuk yer almaz.
- Talep toplama modundaki turun katalog satırı bugünkü `demand.count`'u korur (tarihsiz +
  tarihli tüm bekleyen ön kayıtların toplamı değil, **tarihsiz** kayıtların toplamı; tarihli
  sayaçlar `demandDates[].count`'ta).

### Ön kayıt (sunucu)

- `POST /api/interest` (prereg) `departureId` alabilir:
  - Verilirse: sefer bu turun olmalı, etkin modu `demand`, aktif, kalkmamış; değilse 409
    ("Bu tarih için ön kayıt alınmıyor."). Kayıt grubun 1. aracına bağlanır. Aynı e-posta aynı tarih
    için bekliyorsa güncellenir (bugünkü tekilleştirme `departure_id` ile).
  - Verilmezse: bugünkü gibi yalnız tur modu `demand` ise kabul (tarihsiz kayıt).
- E-postalar (müşteri onayı ve acenta bildirimi) tarihi yazar: "Butik Mardin · 14 Şubat 2027 08:30
  için ön kayda …".
- `demandCount(tourId, departureId?)`: tarih verilirse o tarihin, verilmezse tarihsiz kayıtların
  bekleyen+haber verilen toplamı.

### Tarihi satışa açmak

- `POST /api/admin/departures/:id/open-sales` (yeni): grubun `sales_mode`'u `"online"` olur
  (tüm araçlara). Koşullar: sefer aktif, fiyatı > 0, kalkmamış, tur satışı (`salesOpen`) açık; değilse
  409 ile neyin eksik olduğu söylenir. Ardından o tarihe bağlı `waiting` ön kayıtlara "Butik Mardin ·
  14 Şubat kesinleşti, rezervasyon açıldı" e-postası (bağlantı `/rezervasyon/<tur>?date=<tarih>`),
  durumları `notified`. Yanıt `{ notified }`. (Haber verme kuralının tamamı aşağıda: "tarih
  satılabilir olunca".)
- Turun bugünkü "Satışı aç ve haber ver"i: tur `online` olur; `sales_mode` `null` olan tarihler
  böylece satışa geçer, `"demand"` olarak işaretli tarihler talep toplamaya devam eder. Haber:
  tarihsiz bekleyenlere bugünkü e-posta (açılan tarihlerin listesi); tarihli bekleyenlerden yalnız
  **satışa geçen** tarihlere bağlı olanlara kendi tarihli e-postaları. Talepte kalan tarihlerin
  kayıtlarına dokunulmaz. Turda hiç satılabilir sefer yoksa bugünkü 409 kalır.
- Panelde sefer düzenleyiciden mod `demand`'a geri alınabilir (rezervasyonu olan seferde 409:
  "Bu tarihte rezervasyon var; talep toplamaya alınamaz.").

### Site

- **Tur kartı:** talep toplama turunda talep tarihi varsa "Ön kayıt açık · 14 Şub" (ilk tarih).
  Satıştaki turda kart değişmez.
- **Tur detayı:** talep toplama turunda "Planlanan tarihler" listesi: tarih · saat · tahmini fiyat,
  ilerleme açıksa "9 / 14 kişi hazır" çubuğu, "Bu tarihe ön kayıt" düğmesi. Tarih yoksa bugünkü görünüm.
  Satıştaki turda talep tarihi varsa satış bilgisinin altında küçük bir "Talep toplanan tarihler"
  bölümü aynı düğmelerle.
- **Rezervasyon sayfası:** tarih seçicide satılabilir seferlerin yanında talep tarihleri tarih
  sırasıyla "· ön kayıt" etiketiyle yer alır. Talep tarihi seçilince koltuk planı, fiyat özeti ve
  devam düğmesi yerine "Bu tarih yeterli talep olursa yapılacak" notu ve "Ücretsiz ön kayıt bırakın"
  düğmesi (form o tarih seçili açılır). `?date=` bir talep tarihini de seçebilir. Talep toplama
  turunda hiç tarih yoksa bugünkü not ve tarihsiz form.
- **Ön kayıt formu:** talep tarihi olan turda "Tarih" seçimi: planlanan tarihler + "Başka bir tarih
  istiyorum". "Başka tarih" seçilirse bugünkü serbest "Tercih ettiğiniz dönem" kutusu görünür ve kayıt
  tarihsiz gider — yalnız tur modu `demand` ise (satıştaki turda bu seçenek yok). Tarihi olmayan turda
  form bugünkü gibi.
- **İngilizce:** yeni müşteri metinleri `src/lib/en/` sözlüğüne.

### Panel

- **Sefer düzenleyici:** "Satış" seçimi: "Turun ayarı (şu an: talep toplama/online satış)" ·
  "Online satış" · "Talep toplama". Ek araçlarda ortak alan notuyla.
- **Sefer listesi ve takvim:** talep tarihinde "Talep · 9/14 kişi" etiketi ve "Satışa aç" düğmesi
  (onay penceresi: "14 Şub satışa açılsın mı? Bu tarihe kayıtlı N kişiye e-posta gider.").
- **Bekleme ve ön kayıt sekmesi:** tur kartında tarihsiz sayaç (bugünkü) ve altında talep tarihleri
  satır satır: tarih · sayaç/eşik · "Satışa aç". Ön kayıt kartlarında "Sefer: 14 Şub" (alan zaten var).
- Talep tarihleri "başka sefere taşı" ve yeni rezervasyon ekranında satılabilir sefer olarak
  görünmez (bugünkü `salesOpen` süzgeci korunur).

### Okuyucu kontrolünden sonra verilen kararlar (uygulayıcının kararı, kullanıcıya sunuldu)

- **Siteyi tarih belirler, tur modu değil.** Talep toplama turunda bir tarih satışa açılınca o tarih
  her yerde satılabilir sefer gibi davranır: katalogdaki `next`/`fromPrice`, tur kartındaki ilk
  hareket ve boş koltuk, tur detayındaki tarih bilgisi ve "Rezervasyon" düğmesi, rezervasyon sayfasında
  koltuk planı. Tur kartı: satılabilir tarih varsa bugünkü satış görünümü, yoksa ve talep tarihi varsa
  "Ön kayıt açık · 14 Şub". Tur detayı her modda seferleri yükler; "Planlanan tarihler" listesi satış
  bilgisinin yanında durur. Rezervasyon sayfasındaki "Bu tur yeterli talep olursa yapılacak" notu
  yalnız turda hiç satılabilir sefer yoksa görünür. Tarihsiz ön kayıt düğmesi tur modu `demand` olduğu
  sürece kalır.
- **Haber verme tek yerden: "tarih satılabilir olunca".** Hangi yolla olursa olsun (seferdeki "Satışa
  aç", düzenleyicide modu değiştirmek, turu online'a almak, fiyat girmek, seferi aktif yapmak) bir
  talep tarihi `salesOpen` olduğunda o tarihe bağlı `waiting` ön kayıtlara tarihli e-posta gider. Bunu
  mevcut dakikalık arka plan işi (`notifyOpenings` yanında) yapar; "Satışa aç" düğmesi ayrıca hemen
  çağırır, böylece yanıt `{ notified }` gerçek sayıyı verir. E-posta tekilleştirme anahtarı kayıt
  başına; aynı kişiye iki kez gitmez. Tarihsiz kayıtlar yalnız turun "Satışı aç ve haber ver"inde
  haber alır (bugünkü gibi).
- **Talep tarihinde kayıt varken düzenleme:** tarih/saat değişirse bağlı kayıtların
  `departure_date`'i yeni tarihe güncellenir (kayıtlar zaten sefer kimliğine bağlı); otomatik e-posta
  gitmez, panel kaydetmeden önce "Bu tarihe kayıtlı N kişi var; onlara siz haber verin" diye uyarır.
  Pasife almak serbest (tarih sitede gizlenir, kayıtlar durur). Silmek, bekleyen/haber verilen ön kayıt
  varsa 409: "Bu tarihte ön kayıt var; önce kayıtları kapatın."
- **Online turu talep toplamaya almak:** bugünkü gibi tüm `null` seferlerin satışı kapanır. Aktif
  rezervasyonu olan sefer `demandDates`'te (sitede "ön kayıt" tarihi olarak) görünmez; düzenleyicide
  "Talep toplama"ya elle alınması da 409 (yukarıdaki kural).

## Kısıtlar

- Eski kayıtlar alan olmadan çalışmalı (`sales_mode` yoksa tur moduna uyar).
- Mevcut testler bozulmamalı; MongoDB replset ve standalone modlarında geçmeli.
- Halka açık veride plaka, rehber ve kapalı koltuk bilgisi yer almaz.
- Sunucu hata metinleri Türkçe kalır (uygulamanın geneli gibi).

## Uygulayıcıya bırakılanlar

- Panel ve sitedeki görsel düzen (mevcut stile uygun).
- `demandDates`'in hangi katmanda hesaplanacağı (store ya da interest modülü).
- Grup içinde `sales_mode` eşitlemesinin mevcut ortak alan senkronuna nasıl ekleneceği.
