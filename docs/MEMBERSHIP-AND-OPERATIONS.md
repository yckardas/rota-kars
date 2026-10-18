# Üyelik, kampanyalar ve tur operasyonu

## Yerelde inceleme

- `/hizmetler`: dört tıklanabilir hizmet; her hizmetin detayında hizmet adıyla başlayan teklif talebi.
- `/uyelik`: e-posta/parolayla kayıt ve giriş. Sosyal seçenekler yalnız ilgili firma uygulaması yapılandırıldığında açılır.
- `/hesabim`: şans çarkı, kuponlar, davet bağlantısı ve üyeye ait ön rezervasyonlar.
- `/yonetim` → **Tur ve araç planı**: her turun satış durumu, araç sınıfı ve yolcu kapasitesi.
- Yönetim parolası yerel, Git tarafından hariç tutulan `.env` dosyasındaki `ADMIN_PASSWORD` değeridir. Bu dosyayı paylaşmayın.

İlk ziyarette üyelik daveti gösterilir. Kapatıldığında aynı tarayıcıda tekrar açılmaz (`rota-membership-invite-v1` localStorage kaydı). Üyeler, üyelik ve yönetim sayfalarında gösterilmez.

## Araç / satış kuralları

Araç sınıfları `server/operations.mjs` içindedir: 4–11 yolcu VIP minibüs, 12–19 VIP midibüs, 20–35 turizm midibüsü, 36–54 turizm otobüsü. Kapasite yolcu + rehber toplamıdır; şoför ayrıdır. Örneğin **9+1 = 8 misafir + 1 rehber + 1 şoför**.

Yerleşim sınıfa göre 1+1, 2+1 veya 2+2 oluşturulur. Bunlar kapasite planı şablonlarıdır; fiziksel aracın onaylı koltuk yerleşimiyle eşleştirilmelidir. Ön rehber ve şoför koltukları seçilemez.

Satışı kapatılan tur listede görünür, tarih/koltuk rezervasyonu alamaz; önceden açılmış tarayıcıdan gelen yeni ayırma veya talep de sunucuda reddedilir. Mevcut kayıtlar sorgulanabilir/iptal edilebilir. Aktif koltuk kilidi bulunan bir turun modeli veya kapasitesi değiştirilemez. Her ön rezervasyon araç düzeninin bir kopyasını saklar.

Bu ayarlar tur şablonudur. **Sefer planı** sekmesinde her tarihe ayrı fiyat, saat, araç/kapasite, rehber ve buluşma noktası tanımlanır. Mevcut demo tarih/fiyatları örnektir; kart tahsilatı kapalıdır.

## Kampanya kuralları

- Çark üyelik başına bir kez; sonuç istemciden alınmaz. Altı eşit olasılıklı dilim: `%5, %10, %5, %15, %10, %5`.
- Kuponların varsayılan süresi 30 gündür; yönetici süreyi, minimum tutarı ve tur kapsamını belirler. Kuponlar tek kullanımlı ve hesaba özeldir. Bir rezervasyonda tek kupon uygulanır. Toplam ve kapora, sunucu fiyatı ve kuponuyla kuruş cinsinden hesaplanır.
- Davet kodu yalnız kayıt sırasında atanır. Aynı e-posta büyük/küçük harf farkıyla tekrar kaydedilemez; mevcut hesap sonradan davetliye dönüştürülemez.
- Davet edilen üye varsayılan olarak tam ödemeli turunu tamamladığında (yönetici tam ödeme olayını da seçebilir) iki hesaba birer `%10` kupon verilir. Bunlar sonraki rezervasyonda kullanılabilir. Aynı arkadaş ikinci ödül oluşturmaz.
- Ön rezervasyon iptal olur veya süresi dolarsa kullanılan ve henüz süresi geçmemiş kupon serbest kalır. Davet ödülü tekrarlanmaz. Kampanya koşulları sitede `/bilgilendirme#uyelik` altında da görünür.

Davet ödülü yalnız doğrulanmış tam ödeme/tur tamamlama olayından sonra verilir. E-posta doğrulama ve parola yenileme altyapısı hazırdır; gerçek gönderim için SMTP hesabı gerekir. Ayrıntılı operasyon ve Railway değişkenleri: [RAILWAY-AND-OPERATIONS.md](RAILWAY-AND-OPERATIONS.md).

## Hesap ve oturum

Parolalar scrypt + rastgele salt ile özetlenir; üyelik oturumlarının veritabanında yalnız SHA-256 özeti tutulur. Oturum çerezi HttpOnly, SameSite=Lax, üretimde Secure ve 7 gün sürelidir. Çıkış oturumu iptal eder. Yönetici ve müşteri oturumları ayrıdır. Üye hesabı yalnız kendi kuponlarına ve rezervasyonlarına erişir. Kaydetme/giriş uçları IP başına 15 dakikada 10 istek sınırına tabidir.

## Google ile giriş

[Google OpenID Connect rehberi](https://developers.google.com/identity/openid-connect/openid-connect) üzerinden **Web application** OAuth istemcisi oluşturun. Google Business Profile anahtarlarından ayrı ortam değişkenleri kullanılır:

```dotenv
PUBLIC_BASE_URL=http://127.0.0.1:5174
GOOGLE_AUTH_CLIENT_ID=
GOOGLE_AUTH_CLIENT_SECRET=
```

Yetkili dönüş adresi yerelde `http://127.0.0.1:5174/api/auth/callback/google`, yayında `https://ALAN_ADI/api/auth/callback/google` olmalı. İzin ekranı test modundaysa deneme hesaplarını ekleyin. Google yanıtında PKCE, tarayıcıya bağlı state, nonce, JWKS imzası, issuer/audience ve süre doğrulanır.

## Apple ile giriş

[Apple web kurulum rehberi](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web) üzerinden uygun bir App ID'ye bağlı Services ID, domain/return URL ve Sign in with Apple özel anahtarı gerekir:

```dotenv
PUBLIC_BASE_URL=https://ALAN_ADI
APPLE_CLIENT_ID=
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=
```

Return URL: `https://ALAN_ADI/api/auth/callback/apple`. Özel anahtar PEM biçiminde, `.env` içinde tırnaklı ve satır sonları `\n` olacak şekilde saklanır. Private key tarayıcıya gönderilmez. Kısa ömürlü client secret sunucuda imzalanır; Apple token imzası/nonce doğrulanır. `form_post` callback tarayıcıya bağlı, tek kullanımlık state ile korunur.

[Apple dokümanına göre](https://developer.apple.com/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple) localhost veya IP adresi dönüş adresi olamaz. Bu nedenle Apple, yerel HTTP origin ile etkinleştirilmez; gerçek HTTPS alan adında sağlayıcı hesabıyla test edilmelidir.

## Facebook ile giriş

[Meta Login kurulumunda](https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow/) uygulamanın Web sitesi ve Facebook Login ayarlarını, izin ekranını ve **Valid OAuth Redirect URIs** alanını tamamlayın:

```dotenv
PUBLIC_BASE_URL=https://ALAN_ADI
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
```

Dönüş: `https://ALAN_ADI/api/auth/callback/facebook`. Uygulama `email public_profile` ister; kullanıcının e-posta sağlamadığı durumda e-postayla üyelik seçeneğine döner. Kod sunucuda access token ile değiş tokuş edilir, profil `appsecret_proof` ile alınır. Graph v23.0 kullanılır. Geliştirme modunda izinli test hesaplarıyla, canlı modda Meta'nın yayın/inceleme koşullarına göre test edin.

## Mevcut üyeliği sosyal hesaba bağlama

Bir sağlayıcı aynı e-postayı döndürse bile mevcut e-posta/parola üyeliğine otomatik bağlanmaz. Kullanıcı önce mevcut hesabına giriş yapar; **Hesabım → Giriş seçeneklerim** üzerinden aynı e-postalı sosyal hesabını bağlar. Başka üyeye ait sağlayıcı kimliği yeniden atanmaz.

Sosyal girişlerin kriptografik akışı imzalı test tokenlarıyla doğrulanmıştır; gerçek Google/Apple/Meta uygulama bilgileri bu projede tanımlı değildir. Butonlar bu nedenle bağlantı bekliyor durumundadır. Anahtarlar tanımlanıp sunucu yeniden başlatılınca ilgili seçenek açılır; bu, sağlayıcının canlı uygulama onayı yerine geçmez.
