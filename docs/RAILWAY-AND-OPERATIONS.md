# Railway hazırlığı ve acente operasyonları

Veritabanı **MongoDB**'dir ve Railway'in varsayılan, **tek düğümlü** Mongo servisiyle çalışır; `--replSet` veya ek başlatma komutu gerekmez.

- **Tek düğüm (Railway varsayılanı):** Rezervasyon, koltuk kilidi, kupon ve ödeme işlemleri uygulama içinde sıraya alınır; aynı anda tek işlem çalışır. Her işlem yazmadan önce tüm kontrolleri yapar, böylece hata durumunda yarım kayıt kalmaz. Bu güvence **uygulamanın tek kopya çalışmasına** dayanır: `railway.toml` içinde `numReplicas = 1` kalmalı, Railway'de uygulama servisini yatay ölçeklemeyin.
- **Replica set:** Mongo ileride replica set olarak çalıştırılırsa uygulama bunu kendisi algılar ve gerçek Mongo transaction'ı kullanır.

`/api/health` yanıtındaki `mode` alanı hangi modda çalışıldığını gösterir (`serialized` = tek düğüm, `transactions` = replica set).

## Railway'de MongoDB

1. Railway projesine **MongoDB** servisini ekleyin (varsayılan ayarlarla; başlatma komutunu değiştirmeyin).
2. Uygulama servisinin **Variables** alanına Mongo servisinin bağlantı değişkenini referansla verin:

   ```dotenv
   MONGO_URL="${{MongoDB.MONGO_URL}}"
   MONGODB_DB=rota-kars
   ```

   Referanstaki servis adı (`MongoDB`) Railway'deki Mongo servisinizin adıyla aynı olmalıdır. Uygulama adrese `authSource=admin` ekler. Çözülmemiş `${{...}}` ifadesi açık hata verir. Bağlantı adresini loglara yazmayın.
3. **Yedek:** Mongo servisinin volume'ü için Railway'de otomatik yedeklemeyi açın. Ayrıca belirli aralıklarla `mongodump --uri "$MONGO_URL" --archive=rota-kars-$(date +%F).gz --gzip` ile yedeği Railway dışına alın.

İndeksler (benzersiz e-posta, rezervasyon referansı, ödeme işlem referansı vb.) uygulama açılışında otomatik oluşturulur; ayrıca migration komutu yoktur.

Ek değişkenler: güçlü benzersiz `ADMIN_PASSWORD`, `SITE_URL` ve `PUBLIC_BASE_URL=https://firmanin-domaini`, `TRUST_PROXY=1` (tek güvenilir reverse proxy), `PAYMENT_PROVIDER=disabled`. `PORT` Railway tarafından verilir, sunucu `0.0.0.0` dinler. Gerçek üretimde `DEMO_MODE` ve `SEED_DEMO` kapalı kalmalıdır; örnek seferler otomatik eklenmez.

## Dosya depolama (Railway Storage Bucket)

Yönetim panelinden yüklenen görseller ve videolar (Instagram kapakları/videoları vb.) S3 uyumlu Railway bucket'ında saklanır. Bucket özeldir; dosyalar sitede `/media/<id>.<uzantı>` adresiyle görünür ve bu adres 1 saatlik imzalı bağlantıya yönlendirir. Dosya türü uzantıya değil içeriğe bakılarak belirlenir (JPG, PNG, WebP, AVIF ≤ 8 MB; MP4, WebM ≤ 150 MB); SVG/HTML kabul edilmez.

Uygulama servisinin Variables alanına bucket servisinin değişkenlerini referansla verin (servis adı sizin bucket'ınızın adı, örn. `buffered-basket`):

```dotenv
ENDPOINT="${{buffered-basket.ENDPOINT}}"
REGION="${{buffered-basket.REGION}}"
ACCESS_KEY_ID="${{buffered-basket.ACCESS_KEY_ID}}"
SECRET_ACCESS_KEY="${{buffered-basket.SECRET_ACCESS_KEY}}"
BUCKET="${{buffered-basket.BUCKET}}"
```

`RAILWAY_BUCKET_NAME` S3 API'de kullanılmaz; `BUCKET` kullanılır. Bucket'ın Credentials sekmesi path-style URL istiyorsa `S3_FORCE_PATH_STYLE=true` ekleyin. Bucket tanımlı değilse yükleme düğmesi eksik değişkenleri söyleyen bir hata gösterir; site çalışmaya devam eder.

## Yönetici hesapları ve güvenlik

- **İlk kurulum:** `/yonetim` sayfasında "İlk kurulum" bölümünden `ADMIN_PASSWORD` ile girip **ilk sahip hesabını** (ad, e-posta, en az 12 karakter parola) oluşturun. Hesap oluşturulduğu anda paylaşılan parolayla giriş kapanır.
- **Roller:** *Sahip* (her şey; kullanıcılar, kampanya ayarları, KVKK araçları, denetim kaydı), *Operasyon* (rezervasyon, sefer, tahsilat, talepler, içerik, yolcu listesi), *Rehber* (günlük rapor, sefer listesi, bilet check-in). Son etkin sahip hesabı düşürülemez/kapatılamaz.
- **İki adımlı doğrulama:** Canlıda (`NODE_ENV=production`) zorunludur; her yönetici ilk girişte Google/Microsoft Authenticator vb. ile QR kodu taratır. Kapatmak için `ADMIN_REQUIRE_2FA=0` (önerilmez). Kodunu kaybeden kullanıcının 2FA'sını sahip sıfırlar.
- **Kilitleme:** 5 hatalı giriş hesabı 15 dakika kilitler; IP başına giriş limiti ayrıca uygulanır.
- **Denetim kaydı:** Yönetimdeki her değişiklik ve yolcu listesi (CSV) indirmeleri kim/ne zaman bilgisiyle kaydedilir. IP adresi açık saklanmaz (özet). Kayıtlar 2 yıl tutulur.

## KVKK

- **Rıza kayıtları:** Rezervasyon ve üyelikte aydınlatma onayı; isteğe bağlı ticari ileti izni (varsayılan kapalı) ayrı kaydedilir. Kayıtta e-posta yerine özeti, metin sürümü ve tarih tutulur.
- **Yurt dışı aktarım:** Chatbot, yerelde yanıtlayamadığı soruyu Anthropic'e (ABD) yalnız ziyaretçi onay verirse gönderir; onay yoksa yerel yanıt ve WhatsApp yönlendirmesi kullanılır. Chatbot mesajları saklanmaz.
- **İlgili kişi başvuruları (md. 11):** Üyeler `/hesabim` sayfasından verilerini JSON olarak indirip hesaplarını silebilir. Üye olmayanların başvuruları için yönetimdeki **KVKK** sekmesinden (yalnız sahip) e-postaya göre döküm alınır veya silme yapılır. Yaklaşan turu olan kayıt silinmez; tahsilatı olan rezervasyonlar yasal saklama süresince tutulur, diğerleri anonimleştirilir.
- **Saklama süreleri (günlük otomatik iş):** Ödemesiz iptal/süresi dolmuş ön rezervasyonlar 1 yıl, tahsilatlı kayıtlar 10 yıl sonra anonimleşir; talepler 2 yıl, gönderilmiş bildirimler 90 gün, denetim kaydı 2 yıl sonra silinir. Süreler `RETENTION_*` değişkenleriyle değiştirilebilir.
- **Hukuki not:** Aydınlatma metni ve süreler uygulamayı yansıtır; yayından önce bir KVKK danışmanıyla teyit edilmeli, gerekiyorsa VERBİS kaydı ve ticari ileti için İYS kaydı değerlendirilmelidir.

## Yönetim paneli özellikleri

- **Özet:** Bugün kalkan seferler, onay bekleyenler (süresi yaklaşan önce), iptal talepleri, yeni talepler, 7 günlük doluluk. "Yeni rezervasyon", "Sefer aç", "Bilet okut" kısayolları.
- **Panelden rezervasyon:** Telefon/WhatsApp müşterisi için sefer + koltuk seçimi; ödeme "turda / kapora / tam"; isteğe bağlı tahsilat kaydı ve anında onay. Satışı kapanmış (tarihi geçmemiş) sefere de eklenebilir. Bilet WhatsApp'tan tek tıkla gönderilir. Tek düğümlü Mongo'da işlem geri alınamadığı için önce doğrulanır, hata olursa yazılanlar telafi edilerek silinir.
- **Arama/filtre:** Referans, ad, yolcu adı, e-posta, telefon (farklı yazımlar dahil) ve durum.
- **Toplu sefer:** Tarih aralığı + hafta günleri (en fazla 6 ay / 200 sefer); aynı tur, gün ve saatte sefer varsa atlanır. Sefer planında takvim görünümü.
- **Talepler:** Durum (Yeni / Arandı / Teklif verildi / Rezervasyona döndü / Kapandı) ve kim-ne zaman bilgili not geçmişi.
- **Site içerikleri:** Tur adı, özet, program, dahil/hariç, fotoğraflar, başlayan fiyat (sahip + operasyon); iletişim bilgileri ve WhatsApp numarası (yalnız sahip). Düzenlemeler `site_content` koleksiyonunda tutulur; "Varsayılana dön" ile geri alınır.
- **Aylık rapor:** Tur tarihine göre doluluk/ciro, işlem tarihine göre net tahsilat (nakit/havale); Excel'e aktarma (noktalı virgüllü UTF-8 CSV, formül enjeksiyonu engelli).
- **Bilet okut:** Kamerayla bilet QR'ı okunur, bugünkü onaylı turda "Bindi" işaretlenir (rehber de kullanabilir). Kamera izni yalnız `/yonetim` sayfalarında açıktır.
- **Bu cihazı hatırla:** İki adımlı doğrulaması açık hesaplarda oturum `ADMIN_REMEMBER_DAYS` (varsayılan 14, en fazla 30) gün sürer; aksi halde 8 saat. Hesabım → "Açık oturumlar" ile cihazlar görülür, "Diğer tüm oturumları kapat" ile kaybolan telefonun oturumu kesilir.

## Güvenlik kontrol listesi (yayın öncesi)

- **`TRUST_PROXY=1` zorunlu.** Railway'in önündeki tek proxy gerçek istemci IP'sini ekler; bu ayar olmadan tüm kullanıcılar tek IP gibi görünür.
- **Giriş denemeleri:** IP başına (IPv6'da /64 blok), hesap başına (8 hatalı deneme) ve IP'den bağımsız toplam (`LOGIN_GLOBAL_LIMIT`, varsayılan 200 / 15 dk) sınır vardır. Yönetici hesapları yanlış parola veya yanlış 2FA koduyla 5 denemede 15 dk kilitlenir; kilitli ve olmayan hesaplar aynı mesajı alır.
- **Yetki:** Rol kontrolü yolları normalize ederek yapılır ve Express birebir eşleşir (büyük/küçük harf ve sondaki `/` ile sahibe özel uçlara erişilemez).
- **KVKK:** Üye, e-postası doğrulanmadıkça yalnız kendi üyeliğine bağlı kayıtları indirip silebilir; aynı e-postayla yapılmış misafir kayıtları ona verilmez.
- **Koltuk blokajı:** Bir e-postanın onay bekleyen toplam koltuğu `PENDING_SEATS_PER_EMAIL` (12) ile, bekleme süresi `PENDING_HOLD_HOURS` (24) ile sınırlıdır. Kötüye kullanım görülürse bu süreyi kısaltın.
- **Bot koruması (Cloudflare Turnstile):** Cloudflare panelinde Turnstile → Add widget (alan adı: `rotakarsturizm.com`, mod: Managed) oluşturun; `TURNSTILE_SITE_KEY` ve `TURNSTILE_SECRET_KEY` değişkenlerini Railway'e ekleyin. Ön rezervasyon, üyelik ve talep formları token'ı sunucuda Cloudflare'e doğrulatır; Cloudflare'e ulaşılamazsa form kabul edilmez (503). İki değişken boşsa koruma kapalıdır.
- **Bağlantı adresleri:** E-postadaki parola sıfırlama, doğrulama ve bilet bağlantıları yalnız `PUBLIC_BASE_URL`/`SITE_URL`'den kurulur; üretimde Host başlığına güvenilmez (ayarlı değilse `https://rotakarsturizm.com`).
- **Sosyal giriş:** OAuth durumu sunucu belleğinde değil, imzalı ve 10 dk geçerli httpOnly çerezde tutulur; her durum bir kez kullanılabilir (`oauth_used`). İsteğe bağlı `OAUTH_STATE_SECRET` ile imza anahtarı ayrıca verilebilir.
- **Üyelik e-postası:** Kayıt formu, e-posta zaten kayıtlıysa bunu açıkça söyler (kullanıcının giriş yapmaya yönlendirilmesi için bilinçli tercih). Toplu sorgulamayı giriş hız sınırı (IP başına 10 / 15 dk) ve Turnstile engeller; parola sıfırlama her durumda aynı yanıtı verir.
- **CSP:** Üçüncü taraf betik yalnız Turnstile (`challenges.cloudflare.com`); Instagram gönderileri betiksiz iframe ile gömülür. Katalog verisi HTML'e `application/json` olarak, `<`/`>`/`&` kaçışlı gömülür.
- **Herkese açık veride** rehber adı/telefonu yer almaz; çok uzun adresler (>512 karakter) 414 ile reddedilir.
- **Bağımlılıklar:** `npm audit` temiz tutulmalı; derleme araçları yalnız geliştirme bağımlılığıdır.

## Docker ve Railway

- **Yerelde üretim benzeri çalıştırma:** `docker compose up -d --build` → http://localhost:8080. Mongo, Railway'deki gibi tek düğüm olarak `mongo-data` volume'ünde çalışır. Geliştirme sunucusu (`npm run dev`) için `.env` içinde `MONGODB_URI=mongodb://127.0.0.1:27017/` kullanın.
- **İmaj:** Node 24, `node` kullanıcısı, durumsuz (veri Mongo'da). `HEALTHCHECK` `/api/health` uç noktasını çağırır; bu uç nokta Mongo'ya `ping` gönderir, erişilemezse 503 döner.
- **Railway:** `railway.toml` Dockerfile ile derler, tek replika çalıştırır (arka plan bildirim işi ve bellek içi limitler tek süreç varsayar). Uygulama servisine volume gerekmez.
- **Zorunlu değişkenler:** `ADMIN_PASSWORD`, `SITE_URL` ve `PUBLIC_BASE_URL` (ikisi de `https://alan-adi`), `TRUST_PROXY=1`, `AGENCY_EMAIL` (yeni rezervasyon, iptal ve talep bildirimleri), SMTP alanları.
- **Kötüye kullanım limitleri:** `SALES_CUTOFF_MINUTES` (varsayılan 60; kalkıştan bu kadar önce online satış kapanır), `GUEST_MAX_SEATS` (10), `IP_MAX_HELD_SEATS` (20), `HOLD_LIMIT_PER_15MIN` (20), `BOOKING_LIMIT_PER_15MIN` (6). Limitler süreç belleğindedir; bu yüzden tek replika önerilir.
- **Güvenlik başlıkları:** Tüm yanıtlarda `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-Request-Id`; yayında ayrıca `Content-Security-Policy` ve HTTPS üzerinde `Strict-Transport-Security`. Hata kayıtları JSON satırı olarak istek kimliğiyle yazılır; Railway log ekranında `requestId` ile aranabilir.
- **Kampanya:** Çark kuponu varsayılan olarak doğrulanmış e-posta ister (`requireVerified: true`). Var olan bir veritabanında ayar yönetim panelinden kontrol edilmelidir.

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

`npm test`, `npm run build`. Testler her test için ayrı bir veritabanıyla bellek içi Mongo üzerinde **iki kez** koşar: tek düğüm (Railway gibi, `npm run test:standalone`) ve replica set (`npm run test:replset`). `mongodb-memory-server` ilk çalıştırmada mongod indirir; testler üretim veritabanına bağlanmaz. E-posta testlerinde gerçek gönderim yerine kontrollü sahte taşıyıcı kullanılır.
