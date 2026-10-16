# Rota Kars

Kars merkezli turizm acentesi için yerelde çalışan müşteri sitesi ve rezervasyon altyapısı. Bu proje, önceki mobil uygulama demosundan bağımsız yeni geliştirme deposudur. Canlı siteye veya önceki Sites yayınına değişiklik yapılmadı.

## Başlatma

Node.js 22.13+ gerekir. Proje Node 26.5 ile test edildi.

```sh
npm install
cp .env.example .env
npm run dev
```

Adres: http://127.0.0.1:5173

Ön yüz değişiklikleri otomatik yenilenir. `server/` veya `.env` değişince sunucuyu yeniden başlatın. Sunucu yalnızca `127.0.0.1` üzerinde dinler.

```sh
npm test
npm run build
npm start
```

`npm start`, aynı bilgisayarda derlenmiş sürümü sunar. Bu komutlar tek başına internete yayın yapmaz.

## Yönetim paneli

Adres: http://127.0.0.1:5173/yonetim

`.env` içindeki `ADMIN_PASSWORD` alanına güçlü bir parola koyup sunucuyu yeniden başlatın. Parola boşsa yönetim girişi kapalıdır. Parolayı depoya eklemeyin. Oturumlar HttpOnly / SameSite=Strict çerez kullanır ve sekiz saat sonra sona erer.

Panelde ön rezervasyonlar ve talepler görüntülenir, gerçek anlaşmalı oteller taslak olarak eklenip yayımlanabilir, Google yorumlarının tur eşleşmeleri düzeltilebilir. Bu sürümde sefer/fiyat düzenleme, kesin rezervasyon onaylama ve tahsilat yönetimi paneli yoktur. Seferler yerel örnek veriyle açılır.

## Tamamlanan kapsam

- Responsive ana sayfa, tur listesi ve detayları, kısa fotoğraflı hikâyeler.
- VIP 9+1 minibüs: 1 şoför, şoför yanında 1 rehber, 8 satılabilir yolcu koltuğu.
- Sunucuda kontrol edilen koltuk seçimi, 10 dakikalık tutma, tarih bazında doluluk ve çakışma engeli.
- Yolcu/iletişim bilgileri, %30 veya tam ödeme tercihi; gerçek tahsilat yapılmadan ön rezervasyon.
- Referans + e-posta ile sorgulama ve bekleyen ön rezervasyonu iptal etme.
- Onaylanmayan ön rezervasyonlarda koltukları 24 saat sonra serbest bırakma.
- Otel, özel tur ve araç kiralama taleplerini yerel veritabanında saklama.
- Google Business Profile ve Places API (New) bağlantı kodu, otomatik tur eşleştirmesi ve yönetici düzeltmesi.
- Ana sayfanın en sonunda “Müşterilerimizin gözünden Rota Kars” bölümü.
- Parola korumalı yerel yönetim paneli.

## Henüz bağlanmayan servisler

**Banka/POS:** Kullanıcının talebiyle sağlayıcı bağlantısı kapsam dışında. Kart alanı yoktur; ödeme servisi 503 `PAYMENT_NOT_CONFIGURED` döndürür. Kapora/tam tutar seçimi yalnızca ödeme tercihidir, tahsilat değildir.

**Google yorumları:** İşletmenin doğru Haritalar bağlantısı eklendi. API anahtarı veya işletme OAuth yetkisi henüz verilmedi. Bağlantı yokken gerçekmiş gibi yorum, puan veya müşteri sayısı gösterilmez. Bu durumda işletmenin Google yorumlarına yönlendiren alan görünür. Kurulum için `docs/INTEGRATIONS.md`.

**Anlaşmalı oteller:** Otel adları ve ortaklık teyitleri henüz verilmedi. Liste boş bırakıldı. Konaklama talebi çalışır; gerçek oteller panelden eklenebilir. Konaklama fotoğrafı temsilidir.

**Bildirimler:** E-posta / SMS sağlayıcısı bağlı değil. Yerel talepler veritabanına kaydedilir, otomatik mesaj gönderilmez.

## Veri ve sınırlar

SQLite dosyası varsayılan olarak `data/rota-kars.sqlite` içindedir ve Git tarafından yok sayılır. `.env` ve gerçek veri dosyalarını paylaşmayın. Geliştirme temizliği yapmadan önce veri dosyasını yedekleyin. API fiyatları kuruş cinsinden tutar ve toplamı sunucuda hesaplar.

Tarih ve fiyatlar yerel örnek veridir. Kaynak web fiyatları canlı teklif sayılmaz. Araç iç sıralaması 2+1, 2+1, 2 olarak modellenmiştir; gerçek aracın fotoğrafı veya şemasıyla teyit edilmelidir. Rehber dahil 9 yolcu ve sürücüyle toplam 10 kişi vardır.

Müşteri yayını öncesinde gerçek sefer takvimi ve fiyatlar, araç şeması, onaylı sözleşme/aydınlatma metinleri, yönetici rolleri, bildirimler, yedekleme, dışa açık sunucu güvenliği ve ilgili servis hesapları tamamlanmalıdır. Mevcut bilgilendirme sayfası hukuken onaylanmış nihai metin değildir.

## Teknoloji

React + TypeScript, Vite, Express, Node SQLite. Fontlar yerel `@fontsource` paketlerinden gelir; font için üçüncü tarafa istek yapılmaz. Google sırrı ön yüze gönderilmez. Ödemeler için ayrı adapter sınırı korunur.

## Doğrulama

`npm test`: gerçek HTTP isteklerinde yarışan koltuk tutma, süre dolumu, kapasite, sunucu fiyatı, tekrar gönderim, iptal, yönetici oturumu, kaynak kontrolü, otel tarihi/tesis teyidi ve Google yorum eşleştirmeleri.

Tarayıcıda masaüstü ve 390px mobil genişlikte tur keşfi, koltuk, yolcu bilgisi, ön rezervasyon, sorgulama/iptal, konaklama formu, hikâye ve menü akışları kontrol edildi. Google/POS canlı servisleri yetki olmadan doğrulanmış sayılmaz.
