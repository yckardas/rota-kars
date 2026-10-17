# Railway hazırlığı ve acente operasyonları

Bu değişiklik Railway'e dağıtım veya domain taşıma yapmaz. Yerel demo SQLite kullanmayı sürdürür. MySQL uyumluluğu ayrı, geçici bir MySQL 8.4 veritabanında doğrulanır; mevcut müşteri verisi Railway'e aktarılmaz.

## Uygulama servisi değişkenleri

Railway'de Node uygulaması ile MySQL aynı projede olmalıdır. MySQL servisinin adı gerçekten `MySQL` ise uygulama servisinin Variables alanına aşağıdaki referanslar girilir. Servisin adı farklıysa referanstaki ad değiştirilir. Bunlar parola değil, Railway'in dağıtım sırasında çözdüğü ifadelerdir; yerel `.env` dosyasına çözülmemiş olarak kopyalanmaz.

```dotenv
MYSQL_DATABASE="${{MySQL.MYSQL_DATABASE}}"
MYSQL_ROOT_PASSWORD="${{MySQL.MYSQL_ROOT_PASSWORD}}"
MYSQL_URL="${{MySQL.MYSQL_URL}}"
MYSQLDATABASE="${{MySQL.MYSQLDATABASE}}"
MYSQLHOST="${{MySQL.MYSQLHOST}}"
MYSQLPASSWORD="${{MySQL.MYSQLPASSWORD}}"
MYSQLPORT="${{MySQL.MYSQLPORT}}"
MYSQLUSER="${{MySQL.MYSQLUSER}}"
```

Uygulama önce `MYSQL_URL`, yoksa `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE` (alternatif `MYSQL_DATABASE`) kullanır. Root kullanıcısında parola alternatifi `MYSQL_ROOT_PASSWORD` olur. MySQL seçilmişken bağlantı hatası SQLite'a sessiz geçiş yapmaz. Çözülmemiş referanslar açık hata verir. Sunucu kimlik bilgilerini loglamayın.

Ek değişkenler: güçlü benzersiz `ADMIN_PASSWORD`, `PUBLIC_BASE_URL=https://firmanin-domaini`, `TRUST_PROXY=1` (tek güvenilir reverse proxy), `PAYMENT_PROVIDER=disabled`. `PORT` Railway tarafından verilir, sunucu `0.0.0.0` dinler. `railway.toml` ve Dockerfile Node 24 ile derleme/başlatma ve `/api/health` kontrolünü hazırlar. Gerçek üretimde `DEMO_MODE` ve `SEED_DEMO` kapalı kalmalıdır; örnek seferler otomatik eklenmez.

İleride taşımadan önce mevcut SQLite yedeği alınmalı, mevcut kayıtlar için ayrı veri aktarımı yürütülüp sayımlar/tahsilat/koltuklar karşılaştırılmalıdır. Bu sürüm MySQL şemasını oluşturur; eski SQLite verisini kendiliğinden içeri taşımaz. MySQL yedekleri Railway veritabanı tarafında ayrıca yapılandırılmalıdır. Dağıtım öncesinde tek seferlik şema açılışı çalıştırın; yeni şema sürümünün ilk açılışında eşzamanlı çoklu replika başlatmayın. Normal rezervasyon işlemleri MySQL işlem kilidiyle korunur.

## Yönetim akışı

- **Sefer planı:** Tur başına gün, saat, fiyat, buluşma, rehber ve araç/kapasite. Kapasite rehber dahil yolcu sayısıdır: 9+1 araçta 1 şoför, 1 rehber ve 8 satılabilir misafir koltuğu vardır. Dolu seferde fiyat/tarih/araç değişikliği engellenir; ayrı sefer oluşturup rezervasyon taşınır. Turun genel satış anahtarı bütün seferlerin üzerinde geçerlidir.
- **Rezervasyonlar:** Dışarıda gerçekleşmiş havale/nakit tahsilatı dekont referansıyla kaydedilir. Acente onayı için seçilen kapora veya tam ödeme tutarı gerekir. Tarih ve koltuk değişimi çakışmada eski kaydı korur; yeni fiyat arşivlenen indirim oranıyla hesaplanır. Yolcu adları ve işlem geçmişi korunur. İptal tahsilat iadesi yapmaz; dışarıda gerçekleşen iade ayrıca kaydedilir. Aynı dekont referansı tekrar tahsilat yazmaz.
- **Günlük operasyon:** Seferler, kapasite, onaylı misafirler, net tahsilat ve iadeler. Yolcu listesi CSV yalnız yönetici oturumuyla indirilir. QR doğrulama sayfası kişisel iletişim verisi yayımlamaz; bugünkü onaylı tura katılım yönetici tarafından kaydedilir. Belgeler tarayıcıdan yazdırılabilir/PDF kaydedilebilir; mali e-fatura değildir.
- **Kampanyalar:** Altı eşit olasılıklı çark dilimi, kupon süresi, minimum tutar, tur kapsamı ve e-posta doğrulama koşulu. Yeni kuponlar oluşturuldukları tarihteki süre/kapsamı taşır. Varsayılan davet ödülü arkadaşın tam ödemeli turu tamamlanınca verilir; yönetici tam ödeme olayını seçebilir. Aynı arkadaş için bir kez. Gerçekleşmiş ödüller sonraki iptal/iade işleminde otomatik geri alınmaz; gerektiğinde kampanya politikası ayrıca genişletilmelidir.

## E-posta, hesap güvenliği ve bildirimler

`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` ve mutlak `PUBLIC_BASE_URL` tanımlanır. Gönderim hizmeti tanımlı değilse e-postalar kuyrukta bekler, gönderilmiş sayılmaz. SMTP sağlayıcısında gönderici adresini ve domainin SPF/DKIM kayıtlarını doğrulayın. SMS hizmeti henüz bağlı değildir.

Kayıt sonrası e-posta doğrulaması (24 saat), parola yenileme (1 saat), ön rezervasyon, acente onayı, tarih/buluşma güncellemesi, hareketten önce hatırlatma ve tamamlanan tur sonrası Google yorum isteği kuyruğa yazılır. Arka plan işi 30 saniyede bir kuyruğu işler; geçici hatalarda artan aralıklarla en fazla 5 deneme yapar. Yönetici başarısız mesajı yeniden kuyruğa alabilir. SMTP teslimatı alıcının gelen kutusuna düşme garantisi değildir; ağ kopmasıyla belirsiz teslimat durumunda tekrar mesaj ihtimali vardır.

Güvenlik tokenları tek kullanımlı, süreli ve doğrulama tablosunda özetlenmiş saklanır. Parola değişimi tüm üye oturumlarını kapatır. Üretim yönetim ekranı hesap güvenliği bağlantılarını gizler. Yerel/demoda yalnız yönetici bildirim kuyruğundan bağlantıları önizleyebilir. Yönetici oturumları veritabanında özetlenmiş tokenlarla 8 saat saklanır.

Google yorum isteği `GOOGLE_REVIEW_URL` tanımlıysa o adrese, yoksa mevcut işletme Haritalar bağlantısına gider. Canlı Google yorum senkronizasyonu ve sosyal girişler için ilgili OAuth bilgileri hâlâ gerekir; `GOOGLE-BUSINESS-SETUP.md` ve `INTEGRATIONS.md` dosyalarına bakın.

## Sanal POS sınırı

Banka anlaşması henüz yoktur. Kart bilgisi alınmaz, checkout 503 döner, müşteri yönlendirmesi ödeme onayı sayılmaz. Şimdiki tahsilat/iade defteri dışarıda gerçekleşmiş işlemler içindir. Banka seçilince imzalı sunucu bildirimi, tutar/TRY doğrulaması, idempotent işlem kimliği, başarısız ödeme ve gerçek sağlayıcı iade adaptörü o bankanın sözleşmesine göre eklenmelidir. Bu bağlantı olmadan otomatik kart tahsilatı/iadesi yapılmaz.

## Doğrulama

`npm test`, `npm run build`. MySQL sözleşme testi yalnız açıkça belirlenmiş geçici test veritabanında `MYSQL_TEST_URL=... node --test tests/mysql-contract.test.mjs` ile çalışır. Üretim URL'si kullanmayın. E-posta testlerinde gerçek gönderim yerine kontrollü sahte taşıyıcı kullanılır.
