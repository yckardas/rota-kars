# Railway hazırlığı ve acente operasyonları

Veritabanı **MongoDB**'dir. Rezervasyon, koltuk kilidi, kupon ve ödeme defteri çok belgeli transaction kullanır; bu yüzden Mongo **replica set** olarak çalışmalıdır. Uygulama açılışta bunu kontrol eder, replica set değilse net bir hatayla durur.

## Railway'de MongoDB (replica set) kurulumu

1. Railway projesine **MongoDB** servisini ekleyin (Railway şablonu `mongo` imajını, kullanıcı adı/parola ve `/data/db` volume'üyle kurar).
2. Mongo servisinin **Settings → Deploy → Custom Start Command** alanına aşağıdakini yazın. Bu komut kalıcı volume üzerinde bir kez keyFile üretir ve mongod'u replica set olarak başlatır:

   ```sh
   bash -c 'if [ ! -f /data/db/rs.key ]; then openssl rand -base64 756 > /data/db/rs.key; fi; chmod 400 /data/db/rs.key; chown 999:999 /data/db/rs.key; exec docker-entrypoint.sh mongod --replSet rs0 --bind_ip_all --keyFile /data/db/rs.key'
   ```

3. Servis yeniden başladıktan sonra replica set'i **bir kez** başlatın. Mongo servisinin bağlantı bilgileriyle kendi bilgisayarınızdan (Railway TCP proxy adresi) veya Railway'in servis kabuğundan:

   ```sh
   mongosh "mongodb://KULLANICI:PAROLA@ADRES:PORT/?authSource=admin&directConnection=true" \
     --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"mongodb.railway.internal:27017"}]})'
   ```

   `host` değeri, uygulama servisinin Mongo'ya ulaştığı **özel ağ adresi** olmalıdır (servis adınız farklıysa `<servis-adı>.railway.internal`). `rs.status().ok` 1 dönmelidir.
4. Uygulama servisinin **Variables** alanına Mongo servisinin bağlantı değişkenini referansla verin ve replica set parametresini ekleyin:

   ```dotenv
   MONGODB_URI="${{MongoDB.MONGO_URL}}/?replicaSet=rs0&authSource=admin"
   MONGODB_DB=rota-kars
   ```

   Referanstaki servis adı (`MongoDB`) ve değişken adı (`MONGO_URL`), Railway'deki Mongo servisinizin Variables sekmesindekilerle aynı olmalıdır; şablon sürümüne göre değişebilir, oradan kontrol edin. Çözülmemiş `${{...}}` ifadesi açık hata verir. Bağlantı adresini loglara yazmayın.
5. **Yedek:** Mongo servisinin volume'ü için Railway'de otomatik yedeklemeyi açın. Ayrıca belirli aralıklarla `mongodump --uri "$MONGODB_URI" --archive=rota-kars-$(date +%F).gz --gzip` ile yedeği Railway dışına alın.

İndeksler (benzersiz e-posta, rezervasyon referansı, ödeme işlem referansı vb.) uygulama açılışında otomatik oluşturulur; ayrıca migration komutu yoktur.

Ek değişkenler: güçlü benzersiz `ADMIN_PASSWORD`, `SITE_URL` ve `PUBLIC_BASE_URL=https://firmanin-domaini`, `TRUST_PROXY=1` (tek güvenilir reverse proxy), `PAYMENT_PROVIDER=disabled`. `PORT` Railway tarafından verilir, sunucu `0.0.0.0` dinler. Gerçek üretimde `DEMO_MODE` ve `SEED_DEMO` kapalı kalmalıdır; örnek seferler otomatik eklenmez.

## Docker ve Railway

- **Yerelde üretim benzeri çalıştırma:** `docker compose up -d --build` → http://localhost:8080. Mongo tek düğümlü replica set olarak `mongo-data` volume'ünde çalışır ve ilk açılışta kendini başlatır. Geliştirme sunucusu (`npm run dev`) için `.env` içinde `MONGODB_URI=mongodb://127.0.0.1:27017/?replicaSet=rs0&directConnection=true` kullanın.
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

`npm test`, `npm run build`. Testler her test için ayrı bir veritabanıyla bellek içi Mongo replica set (`mongodb-memory-server`, ilk çalıştırmada mongod indirir) üzerinde koşar; üretim veritabanına bağlanmaz. E-posta testlerinde gerçek gönderim yerine kontrollü sahte taşıyıcı kullanılır.
