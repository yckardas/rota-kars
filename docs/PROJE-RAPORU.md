# Rota Kars · Proje raporu

Tarih: 27 Ekim 2026 · Kapsam: müşteri sitesi, yönetim paneli (`/yonetim`), Android yönetim uygulaması, sunucu ve güvenlik.

## 1. Kısa özet

- Proje çalışır ve test edilmiş durumda: **143 otomatik test**, tek düğüm ve replica set olmak üzere iki MongoDB modunda da geçiyor. TypeScript ve üretim derlemesi temiz.
- Bu turda düzeltilenler:
  - Telefonun karanlık modunda sitenin zorla koyulaşması
  - Android uygulamasında panelden siteye düşüp geri dönememe
  - Kod incelemesindeki bulguların hepsi (giriş kilitleme saldırısı, chatbot maliyeti, Facebook e-postası ve küçük bulgular)
  - Tüm bağımlılık açıkları: body-parser, nodemailer güncellendi, zod 4'e geçildi; `npm audit` sıfır açık
- Açık güvenlik bulgusu kalmadı; yalnız Railway'de yapılması gereken ayar kontrolleri var (bölüm 6).
- **Yayında değil:** Ani Taşı panel tasarımı ve bu turdaki düzeltmeler henüz commit edilmedi ve gönderilmedi. Ayrıca yereldeki iki commit (`b632d57`, `c270f88`) `origin`'e, biri (`c270f88`) `scs`'ye gitmemiş.

## 2. Projenin yapısı

| Parça | Teknoloji | Boyut |
|---|---|---|
| Sunucu | Node 22+, Express 5, MongoDB 7 (zod doğrulama) | ~8.100 satır, `server/` |
| Arayüz | React 19, Vite 6, TypeScript 5.9, lucide ikonlar | ~13.200 satır TS/TSX, ~9.500 satır CSS |
| Testler | `node:test`, bellek içi Mongo | 19 dosya, ~4.300 satır, 143 test |
| Android | Capacitor 8, canlı `/yonetim` sayfasını açan kabuk | `mobile/` |
| Yayın | Railway (tek kopya), Railway Storage Bucket, Firebase bildirim | `docs/RAILWAY-AND-OPERATIONS.md` |

**Müşteri sitesi:** turlar, koltuk seçimli ön rezervasyon, rezervasyon sorgulama, üyelik (e-posta, Google, Apple, Facebook), çark ve davet kampanyası, konaklama ve özel tur talepleri, Google yorumları, Instagram, chatbot, KVKK sayfaları.

**Yönetim paneli:**
- Operasyon: Özet, rezervasyonlar (onay, tahsilat ve iade kaydı, taşıma, gelmedi, geçmiş), sefer planı (takvim ve toplu sefer), günlük operasyon (QR bilet okutma, yolcu listesi, yazdırma)
- Satış ve kayıt: aylık rapor, kampanyalar, bildirim kuyruğu, talepler
- İçerik: site içerikleri, oteller, Google yorumları, Instagram
- Yönetim: kullanıcılar ve roller, denetim kaydı, KVKK araçları
- Genel: Ctrl+K hızlı arama ve menü rozetleri

**Android:** bildirimler, kamera ile bilet okutma, "bu cihazı hatırla", çevrimdışı sayfa.

## 3. Bu turda düzeltilen hatalar

### 3.1 Karanlık modda bozuk görünüm

**Sebep:** Sitede `color-scheme` tanımı yoktu. Telefon karanlık moddayken Chrome (otomatik karartma) ve Android uygulamasındaki WebView (uygulama teması `DayNight` olduğu için algoritmik karartma) sayfayı kendi kafalarına göre koyulaştırıyordu. Site yalnız açık tema için tasarlandığından sonuç kötü görünüyordu.

**Düzeltme:**
- `index.html` ve `src/styles.css` → sayfa `color-scheme: only light` ile açık temaya kilitlendi.
- Android → uygulama teması açık temaya alındı (`Theme.AppCompat.Light.NoActionBar`). `MainActivity` WebView'da algoritmik karartmayı kapatıyor.

**Doğrulama:** Tarayıcıda karanlık mod taklit edilirken site açık renkte kaldı.

**Sınır:** Samsung Internet'in kendi "karanlık mod" ayarı bazı sürümlerde bu işareti yok sayabiliyor. Kalıcı çözüm, istenirse gerçek bir karanlık tema tasarlamak.

### 3.2 Uygulamada siteye düşüp geri dönememe

**Sebep:** Panelde siteye götüren bağlantılar vardı: menüdeki "ROTA KARS" yazısı, giriş ve iki adımlı doğrulama ekranındaki logo, rezervasyon penceresindeki "QR belge". Uygulama aynı alan adındaki sayfaları kendi içinde açıyor. Sitenin hiçbir yerinde panele dönüş yolu olmadığı için tek çıkış telefonun geri tuşuydu.

**Düzeltme:**
- Uygulamada menü yazısı ve giriş logoları artık bağlantı değil.
- Uygulama içinde sitenin herhangi bir sayfası açılırsa üstte sabit bir **"Yönetim paneline dön"** çubuğu çıkıyor (`src/components/NativeReturnBar.tsx`).

**Doğrulama:** Tarayıcıda uygulama ortamı taklit edildi: çubuk görünüyor ve panele geri götürüyor. Gerçek telefonda denenmedi.

## 4. Güvenlik denetimi

### 4.1 Yapılan testler

Yeni dosya `tests/security.test.mjs`, 12 test. Her `npm test` çalıştırmasında tekrarlanıyor:

| Test | Sonuç |
|---|---|
| Uygulamadaki **tüm** `/api/admin` yolları oturumsuz çağrılır (40'tan fazla yol) | Hepsi 401 |
| Rehber rolü: rezervasyon, tahsilat, silme, içerik, kullanıcı yolları | Hepsi 403 |
| Operasyon rolü: kullanıcılar, denetim, KVKK, kampanya; kendini sahip yapma | Hepsi 403 |
| CSRF: özel başlıksız istek ve başka siteden gelen istek | 403 |
| NoSQL enjeksiyonu (`{"$ne": null}` ile parola atlatma), düzenli ifade araması, 32 kb üstü gövde | 400 / boş sonuç / 413 |
| Kaba kuvvetle giriş denemesi | En geç 11. denemede 429 |
| Oturum çerezi bayrakları, güvenlik başlıkları, hata mesajında iç bilgi sızması | HttpOnly, SameSite=Strict, Secure; CSP, nosniff, X-Frame-Options; sızıntı yok |
| `/media` ile dosya yolu taşma | Engelli |
| Sayfaya gömülü katalog verisiyle `</script>` enjeksiyonu | Engelli |
| HEAD isteğiyle sahibe özel uçlar, şablonda `$` dizileri, doğrulanmamış Facebook e-postası | Düzeltildi ve test edildi |
| Kilitli yönetici hesabı: yalnız parola yetmez, parola + 2FA kodu geçer | Doğrulandı |
| Zayıf ilk kurulum parolası; gönderilen sıfırlama bağlantısının kuyrukta kalması | Reddediliyor / siliniyor |
| Chatbot günlük bütçesi (ziyaretçi başına ve toplam) | Sınırda duruyor (`tests/chat.test.mjs`) |

**Bağımlılık taraması (`npm audit`):** Açık kalmadı. body-parser 2.4.0 ve nodemailer 10.2.1'e güncellendi, zod 4.6.7'ye geçildi; şemalar uyumluydu, tüm testler geçiyor. Mobil taraftaki uyarılar yalnız derleme aracında (Capacitor CLI); APK'ya girmiyor.

### 4.2 Kod incelemesi bulguları

| # | Önem | Bulgu | Durum |
|---|---|---|---|
| 1 | Orta | **Girişi kilitleyerek hizmet engelleme:** Çok sayıda IP'den 200 hatalı deneme, 15 dakika boyunca doğru parolayla bile tüm yönetici girişlerini engelliyor. Sahibin e-postasını bilen biri de 15 dakikada bir 5 yanlış parola göndererek o hesabı sürekli kilitli tutabiliyor. | **Düzeltildi.** Kilit veya toplu deneme sınırında yönetici girişi kapanmıyor: yalnız parola + geçerli 2FA kodu geçiyor. Üye girişine Turnstile eklendi; Turnstile açıkken toplu denemeler üye girişlerini kilitlemiyor. |
| 2 | Orta | Facebook girişinde gelen e-posta "doğrulanmış" sayılıyordu. Kurbanın doğrulanmamış e-postası eklenmiş bir Facebook hesabıyla misafir rezervasyonları indirilebilirdi. | **Düzeltildi.** Facebook üyesi e-postasını kendi doğrulama bağlantımızla onaylıyor. |
| 3 | Düşük–Orta | **Chatbot maliyeti:** IP değiştirilerek ücretli model çağrıları sınırsız yaptırılabilir (IP başına 60 / 15 dk). | **Düzeltildi.** Ücretli model çağrıları günlük bütçeyle sınırlı: ziyaretçi başına 20, toplam 300 (`CHAT_CLIENT_DAILY_LIMIT`, `CHAT_DAILY_LIMIT`). Modele yalnız son 7 mesaj gidiyor. |
| 4 | Düşük | Operasyon rolü, HEAD isteğiyle sahibe özel uçların varlığını ve yanıt boyutunu görebiliyordu. | **Düzeltildi** |
| 5 | Düşük | Tur metninde `` $` `` geçerse sunucunun ürettiği sayfa bozuluyordu. | **Düzeltildi** |
| 6 | Bilgi | Parolası çalınmış ve 2FA kurulmamış bir yönetici hesabına saldırgan kendi doğrulayıcısını ekleyebilir. | **Düzeltildi.** 2FA açılınca ekibe bildirim gidiyor. |
| 7 | Bilgi | Kilitli hesap için yanıt daha hızlı dönüyor; bu, e-postanın yönetici olduğunu ele veriyor. | **Düzeltildi.** Parola her durumda önce kontrol ediliyor. |
| 8 | Bilgi | Parola sıfırlama bağlantısı bildirim kuyruğunda düz metin duruyor (1 saat geçerli). | **Düzeltildi.** Gönderilince kuyruktan siliniyor. |
| 9 | Bilgi | Railway'de `TRUST_PROXY=1` yoksa herkes tek IP sayılır ve HSTS gönderilmez. | Railway'de ayarlı olduğunu kontrol et. |
| 10 | Bilgi | `ADMIN_PASSWORD` için güç kontrolü yok. | **Düzeltildi.** 16 karakterden kısa ilk kurulum parolası reddediliyor. İlk sahip oluşturulunca Railway'den kaldır. |
| 11 | Bilgi | Uygulama tüm `rotakarsturizm.com` alanına yerel köprü açıyor; sitedeki olası bir XSS bildirim eklentisine erişebilir. | Şu an XSS bulunmadı (`dangerouslySetInnerHTML` yok). Android dosya paylaşımı (FileProvider) yalnız uygulama önbelleğiyle sınırlandı. |
| 12 | Bilgi | Yolcu listesi yazdırma penceresindeki satır içi betik CSP'ye takılıyordu. | **Düzeltildi** |

**Sağlam bulunanlar:**
- **Oturumlar:** rastgele kimlik, veritabanında özet; girişte yenileniyor.
- **Parolalar:** scrypt.
- **2FA (TOTP):** aynı kodun tekrar kullanımı engelli.
- **OAuth:** state, nonce, PKCE ve JWKS imza doğrulaması; açık yönlendirme engelli.
- **Doğrulama ve dışa aktarma:** zod ile her girdi doğrulanıyor; CSV'de formül enjeksiyonu engelli.
- **Dosya yükleme:** tür, dosya içeriğinden anlaşılıyor; SVG kabul edilmiyor.
- **Gizli bilgiler:** `google-services.json` ve imza anahtarı Git'te değil.
- **Android:** düz HTTP, yedekleme ve WebView hata ayıklaması kapalı.
- **Chatbot:** araç ve veri erişimi yok.

## 5. Ani Taşı tasarımı (commit bekliyor)

- **Kapsam:** Panelin yeni görsel dili `src/admin.css` (yalnız panelde geçerli), taş sırası bileşeni `src/components/admin/SeatCourse.tsx`.
- **Belgeler:** Tasarım sistemi `docs/DESIGN-PANEL.md`, ürün bilgisi `PRODUCT.md`. Sitenin `docs/DESIGN.md` dosyasına dokunulmadı.
- **Android kabuğu:** ikon, açılış ekranı, siyah tüf sistem çubukları, çevrimdışı sayfa. APK: `mobile/dist/rota-kars-yonetim-1.1.2-debug.apk`.
- **Doğrulanmayan:** İkon, açılış ekranı ve çevrimdışı sayfa gerçek telefonda görülmedi. Bu bilgisayardaki öykünücü görüntü vermedi.
- **Bilinen eksikler:** Durum etiketlerinden ikisinin kontrastı 4,5:1 sınırının biraz altında (4,48 ve 4,33). Android 8 öncesi cihazlar eski ikon resimlerini kullanır.

## 6. Önerilen sıradaki işler

1. **Railway'den sonra telefonda dene:** karanlık mod, "Yönetim paneline dön" çubuğu, yeni panel tasarımı ve APK 1.1.2.
2. **Railway ayarları:**
   - `TRUST_PROXY=1` ayarlı olsun.
   - `ADMIN_PASSWORD` ilk sahip oluşturulduysa silinsin, değilse en az 16 karakter olsun.
   - `ADMIN_REQUIRE_2FA=0` geçici olarak açıldıysa geri kapatılsın. Kilitli hesaba yalnız 2FA koduyla girilebildiği için 2FA'nın açık olması önemli.
3. **Turnstile:** `TURNSTILE_SITE_KEY` ve `TURNSTILE_SECRET_KEY` Railway'de tanımlı değilse tanımla. Üye girişi ve formlardaki bot koruması bunlarla devreye girer.
4. **İmzalı sürüm (release) APK:** Telefona kalıcı kurulum ve güncelleme için imza anahtarı oluşturulmalı.
5. **Gerçek karanlık tema (isteğe bağlı):** Site ve panel için tasarlanmış bir koyu tema.

## 7. Yerel geliştirme notları

- **MongoDB:** Yerel sunucu Docker'daki Mongo'yu bekliyor; bugün Docker kapalıydı (`docker compose up -d mongo`). Testler Mongo olmadan, bellek içi veritabanıyla çalışıyor.
- **Hesaplar:** Yerel veritabanı canlıdan ayrı; canlı hesaplar yerelde çalışmaz. İlk kurulum parolası yerel `.env` dosyasında (Git'e girmiyor).
