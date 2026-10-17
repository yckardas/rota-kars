# Rota Kars

Kars merkezli turizm acentesi için yerelde çalışan müşteri sitesi ve rezervasyon altyapısı. Bu proje, önceki mobil uygulama demosundan bağımsız yeni geliştirme deposudur. Canlı siteye veya önceki Sites yayınına değişiklik yapılmadı.

## Başlatma

Node.js 22.13+ gerekir. Proje Node 26.5 ile test edildi.

```sh
npm install
cp .env.example .env
npm run dev
```

Adres: http://127.0.0.1:5173 (`PORT` değerine göre değişir; mevcut yerel kurulum 5174 kullanır).

Ön yüz değişiklikleri otomatik yenilenir. `server/` veya `.env` değişince sunucuyu yeniden başlatın. Yerel sunucu `127.0.0.1` üzerinde, normal üretim sunucusu `0.0.0.0` üzerinde dinler.

```sh
npm test
npm run build
npm start
```

`npm start`, aynı bilgisayarda derlenmiş sürümü sunar. Bu komutlar tek başına internete yayın yapmaz.

## Yönetim paneli

Adres: http://127.0.0.1:5173/yonetim

`.env` içindeki `ADMIN_PASSWORD` alanına güçlü bir parola koyup sunucuyu yeniden başlatın. Parola boşsa yönetim girişi kapalıdır. Parolayı depoya eklemeyin. Oturumlar HttpOnly / SameSite=Strict çerez kullanır ve sekiz saat sonra sona erer.

Panelde ön rezervasyonlar ve talepler görüntülenir; oteller ve Instagram videoları yönetilir, Google yorumlarının tur eşleşmeleri düzeltilir. **Tur ve araç planı** sekmesinde tur satışını açıp kapatabilir, araç sınıfı ve kapasite seçebilirsiniz. Koltuk haritası ve sunucu kapasite kontrolü bu ayara uyar. Ayrılmış koltuk bulunan turda araç düzeni değiştirilmez. **Sefer planı**, **Rezervasyonlar**, **Günlük operasyon**, **Kampanyalar** ve **Bildirim kuyruğu** sekmeleri tarih bazında planlama, tahsilat/iade defteri, acente onayı, yolcu listesi ve QR katılım yönetimini sunar.

Railway MySQL değişkenleri, dağıtım hazırlığı, hesap güvenliği, kampanyalar ve bildirim kurulumu: [RAILWAY-AND-OPERATIONS.md](docs/RAILWAY-AND-OPERATIONS.md). Henüz Railway taşıması yapılmadı.

## Tamamlanan kapsam

- Responsive ana sayfa, tur listesi ve detayları, kısa fotoğraflı hikâyeler.
- Tur bazında değişen araç kapasitesi ve satış durumu. Varsayılan 18+1 midibüs: 1 şoför, 1 rehber ve 17 misafir. Örneğin 9+1 seçilirse 8 misafir koltuğu oluşur.
- Sunucuda kontrol edilen koltuk seçimi, 10 dakikalık tutma, tarih bazında doluluk ve çakışma engeli.
- Yolcu/iletişim bilgileri, %30 veya tam ödeme tercihi; gerçek tahsilat yapılmadan ön rezervasyon.
- Referans + e-posta ile sorgulama ve bekleyen ön rezervasyonu iptal etme.
- Onaylanmayan ön rezervasyonlarda koltukları 24 saat sonra serbest bırakma.
- Otel, özel tur ve araç kiralama taleplerini yerel veritabanında saklama.
- Google Business Profile ve Places API (New) bağlantı kodu, otomatik tur eşleştirmesi ve yönetici düzeltmesi.
- Ana sayfanın en sonunda “Müşterilerimizin gözünden Rota Kars” bölümü: Google puanı (4,9 / 456), gerçek Google yorumları ve canlı Google Haritalar kartı.
- Canlı siteden taşınan içerik: Yeni açılan turlar / Koşulsuz iptal / TL ile ödeme / Müşteri memnuniyeti şeridi, Hizmetlerimiz (turizm taşımacılığı, VIP, kongre, express), şoförlü araç kiralama filosu, Günübirlik Van ve Van Havzası turları, tur iptali koşulları, TÜRSAB 13948 rozeti.
- Sağ altta akıllı asistan: `ANTHROPIC_API_KEY` tanımlıysa Claude (`CHAT_MODEL`, varsayılan `claude-opus-5-5`) katalog bilgisiyle yanıt verir; anahtar yoksa yerleşik kural tabanlı Türkçe asistan çalışır. Her iki durumda da gerektiğinde WhatsApp'a (0546 480 21 36) devir düğmesi çıkar; ayrıca kalıcı WhatsApp butonu vardır.
- Parola korumalı yerel yönetim paneli.
- Dört hizmet için tıklanabilir detay ve teklif talebi sayfaları.
- E-posta/parola ile üyelik, e-posta doğrulama/parola yenileme altyapısı, profil, hesap başına tek şans çarkı, yönetilebilir %5/%10/%15 kuponlar, davet sonrası iki hesaba %10 ödül ve rezervasyonda tek kuponla sunucuda fiyat hesabı.
- Google, Apple ve Facebook sosyal giriş/hesap bağlama kodu; firma OAuth bilgileri yokken butonlar hazırlık durumundadır.
- Gerçek destinasyon fotoğrafları ve `/gorsel-kaynaklari` altında yazar/lisans atıfları.

## Henüz bağlanmayan servisler

**Banka/POS:** Kullanıcının talebiyle sağlayıcı bağlantısı kapsam dışında. Kart alanı yoktur; ödeme servisi 503 `PAYMENT_NOT_CONFIGURED` döndürür. Kapora/tam tutar seçimi yalnızca ödeme tercihidir, tahsilat değildir.

**Google yorumları:** API anahtarı veya işletme OAuth yetkisi yokken `server/reviews-snapshot.json` kullanılır: Google Haritalar'daki herkese açık işletme sayfasından 16 Ekim 2026'da alınan gerçek puan (4,9 / 456) ve Google'ın öne çıkardığı 5 yorum. Yorumlar Google'ın sınırlı görünümünden alındığı için tam liste değildir; puan ve yorum sayısı zamanla eskir. `.env` içinde Business Profile veya Places API bilgileri tanımlanınca canlı veri otomatik olarak devreye girer, hata olursa yine bu kayda düşer. Kurulum için `docs/INTEGRATIONS.md`.

**Anlaşmalı oteller:** Otel adları ve ortaklık teyitleri henüz verilmedi. Liste boş bırakıldı. Konaklama talebi çalışır; gerçek oteller panelden eklenebilir. Konaklama fotoğrafı temsilidir.

**Sosyal girişler:** Google/Apple/Meta uygulama anahtarları tanımlı değildir. E-postayla üyelik çalışır; e-posta doğrulama ve parola sıfırlama gönderimi bağlı değildir. Kurulum ve kampanya kuralları: [MEMBERSHIP-AND-OPERATIONS.md](docs/MEMBERSHIP-AND-OPERATIONS.md).

**Bildirimler:** Kuyruklu e-posta altyapısı rezervasyon/onay/hareket hatırlatması/buluşma güncellemesi ve tur sonrası yorum isteği üretir. SMTP tanımlı değilken mesajlar bekler, gönderilmiş sayılmaz. SMS sağlayıcısı bağlı değildir.

## Veri ve sınırlar

SQLite dosyası varsayılan olarak `data/rota-kars.sqlite` içindedir ve Git tarafından yok sayılır. `.env` ve gerçek veri dosyalarını paylaşmayın. Geliştirme temizliği yapmadan önce veri dosyasını yedekleyin. API fiyatları kuruş cinsinden tutar ve toplamı sunucuda hesaplar.

Tarih ve fiyatlar yerel örnek veridir. Kaynak web fiyatları canlı teklif sayılmaz. Araç yerleşimleri seçilen sınıfa göre 1+1, 2+1 veya 2+2 kapasite şablonlarıdır; fiziksel aracın onaylı şemasıyla teyit edilmelidir. Yolcu kapasitesi rehberi içerir, şoför ayrıdır.

Müşteri yayını öncesinde gerçek sefer takvimi ve fiyatlar, araç şeması, onaylı sözleşme/aydınlatma metinleri, yönetici rolleri, bildirimler, yedekleme, dışa açık sunucu güvenliği ve ilgili servis hesapları tamamlanmalıdır. Mevcut bilgilendirme sayfası hukuken onaylanmış nihai metin değildir.

## Teknoloji

React + TypeScript, Vite, Express, Node SQLite. Fontlar yerel `@fontsource` paketlerinden gelir; font için üçüncü tarafa istek yapılmaz. Google sırrı ön yüze gönderilmez. Ödemeler için ayrı adapter sınırı korunur.

## Doğrulama

`npm test`: koltuk/kupon yarışları, süre dolumu, dinamik kapasite, satışın kapanması, sunucu fiyatı/indirim, iptal, yönetici/üye oturumu, davet ödülleri, kaynak kontrolü, otel teyidi ve Google yorum eşleşmeleri. Sosyal girişler, sağlayıcıya bağlantı kurmadan imzalı test kimlikleriyle state/nonce/imza/audience ve tekrar kullanım yönünden doğrulanır.

Tarayıcıda masaüstü ve 390px mobil genişlikte tur keşfi, koltuk, yolcu bilgisi, ön rezervasyon, sorgulama/iptal, konaklama formu, hikâye ve menü akışları kontrol edildi. Google/POS canlı servisleri yetki olmadan doğrulanmış sayılmaz.

## Paylaşılabilir canlı demo

`npm run build` ardından `npm run demo`, ana `.env` ve müşteri verilerinden ayrı bir production demo başlatır. Yönetici parolası `.env.demo`, veritabanı `data/live-demo.sqlite` içindedir. Geçici HTTPS tüneli ve yeniden başlatma adımları için [LIVE-DEMO.md](docs/LIVE-DEMO.md).
