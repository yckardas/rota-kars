# Android yönetici uygulaması

Uygulama, canlı sitedeki yönetim panelini (`/yonetim`) kendi penceresinde açan bir Android
uygulamasıdır (Capacitor). Panel ekranları sunucudan geldiği için **panelde yapılan her
değişiklik Railway deploy'uyla telefonlara anında gelir; APK yeniden kurulmaz.**
Yeni APK yalnız uygulamanın kendisi değişince gerekir (ikon, izin, yeni telefon özelliği).

Kod: `mobile/` · Paket adı: `com.rotakars.yonetim`

## Telefonda neler var

- Altta sekme çubuğu: Rezervasyon, Seferler, Günlük, Turlar, Diğer (tüm menü).
- **Turlar:** her turda tek dokunuşla satış aç/kapat anahtarı.
- **Seferler / Günlük:** "Yolcu listesi" → koltuk sırasıyla yolcular, Ara / WhatsApp düğmeleri,
  bugünkü onaylı turda "Bindi" işaretleme. Rehber rolü de bu listeyi görür.
- **Bildirimler** (yalnız sahip ve operasyon rolü): yeni ön rezervasyon, iptal, gelen talep,
  yeni Google yorumu. Bildirime dokununca panel açılır. Hesabım → "Telefon bildirimleri"
  kartında test bildirimi gönderilebilir ve kayıtlı telefonlar görülür.
- Çıkış yapınca telefon bildirim listesinden çıkar. Bağlantı yoksa "İnternet bağlantısı yok"
  ekranı açılır.

## 1. Firebase (bildirimler için, ücretsiz)

1. https://console.firebase.google.com → **Proje ekle** (ör. "Rota Kars Yönetim"). Analytics gerekmez.
2. Proje içinde **Android uygulaması ekle** → paket adı `com.rotakars.yonetim` → `google-services.json`
   dosyasını indirin ve `mobile/android/app/google-services.json` konumuna koyun (repoya girmez).
3. Proje ayarları → **Hizmet hesapları** → "Yeni özel anahtar oluştur" → inen JSON dosyasının
   içeriğini Railway'de `FIREBASE_SERVICE_ACCOUNT` değişkenine yapıştırın (tek satır veya base64).
   Bu dosya gizlidir; kimseyle paylaşmayın, repoya koymayın.

`google-services.json` olmadan derlenen APK çalışır ama bildirim alamaz (uygulama bunu söyler).

## 2. Google yorum bildirimi

Google Cloud'da **Places API (New)** etkinleştirilip bir API anahtarı alınır (anahtarı yalnız
Places API ile sınırlayın). Railway'e:

- `GOOGLE_PLACES_API_KEY` — API anahtarı
- `GOOGLE_PLACE_ID` — işletmenin yer kimliği (Google'ın "Place ID Finder" sayfasından)
- `GOOGLE_REVIEW_POLL_MINUTES` — kontrol aralığı, varsayılan 60 (en az 15)

Sunucu her kontrolde toplam yorum sayısına bakar; artınca bildirim gider. Yeni yorum Google'ın
döndürdüğü 5 yorum arasındaysa yazarı, puanı ve metni de eklenir; 3 yıldız ve altı "Dikkat: düşük
puan" diye başlar. İlk çalıştırma yalnız mevcut durumu kaydeder (eski yorumlar bildirilmez).

**Maliyet:** her kontrol bir Place Details (Enterprise + Atmosphere) çağrısıdır. Saatlik kontrol
ayda ~744 çağrı eder; Google'ın bu ürün için aylık ücretsiz kotasının altında kalır. Faturalandırma
hesabı açık olmalıdır. Kotayı Google Cloud → Faturalandırma ekranından izleyin ve bir bütçe
uyarısı tanımlayın. Not: Google, işletme sahibine yeni yorumları zaten e-postayla da bildirir.

## 3. APK derleme

Gerekenler: Node 20+, JDK 21, Android SDK (Android Studio ile gelir).

```bash
cd mobile
npm install
npm run apk:debug          # deneme sürümü: mobile/dist/rota-kars-yonetim-<sürüm>-debug.apk
```

Uygulamanın açacağı adres varsayılan `https://rotakarsturizm.com`. Alan adı bağlanmadan önce
Railway adresiyle denemek için:

```bash
ROTA_APP_URL=https://uygulama-adi.up.railway.app npm run apk:debug
```

### Dağıtılacak (imzalı) sürüm

İmza anahtarı bir kez oluşturulur ve **asla kaybedilmemelidir** (kaybolursa güncellemeler eski
uygulamanın üstüne kurulamaz; herkes kaldırıp yeniden kurmak zorunda kalır). Anahtarı ve
parolasını şifre yöneticisinde saklayın; repoya koymayın.

```bash
keytool -genkey -v -keystore ~/rota-yonetim.jks -alias rota -keyalg RSA -keysize 4096 -validity 10000
ROTA_KEYSTORE=~/rota-yonetim.jks ROTA_KEYSTORE_PASSWORD=… ROTA_KEY_ALIAS=rota ROTA_KEY_PASSWORD=… npm run apk:release
```

## 4. Telefonlara kurulum

- APK dosyasını telefona gönderin (WhatsApp/Drive/e-posta) ve açın. Android "bilinmeyen
  kaynaklardan yükleme" izni ister; o uygulama (ör. Dosyalar/Chrome) için bir kez izin verin.
- Girişte kendi yönetici hesabınız ve 2FA kodunuzla giriş yapın; bildirim izni sorulunca **İzin ver**.
- Alternatif: Google Play Console (tek seferlik 25$) → "Dahili test" kanalı; uygulama yalnız
  eklediğiniz e-posta adreslerine görünür ve güncellemeler Play Store'dan otomatik gelir.

## 5. Uygulama güncelleme

1. `mobile/package.json` içindeki `version` değerini artırın (ör. 1.0.0 → 1.1.0).
2. İmzalı APK'yı derleyin ve erişilebilir bir HTTPS adresine koyun (ör. yönetim → dosya yükleme
   veya Google Drive "bağlantıya sahip herkes").
3. Railway'e: `ANDROID_APP_VERSION=1.1.0`, `ANDROID_APK_URL=https://…/rota-kars-yonetim-1.1.0.apk`,
   isteğe bağlı `ANDROID_APP_NOTES="Yolcu listesine not alanı eklendi"`.
   Eski sürümü kullanılmaz yapmak için `ANDROID_APP_MIN_VERSION=1.1.0`.
4. Uygulama açılışta bunu görür ve üstte "Yeni sürüm hazır · Güncelle" uyarısı gösterir.

## Güvenlik notları

- Uygulama yalnız yapılandırılan site adresini açar; başka adresler telefonun tarayıcısında açılır.
  Düz HTTP kapalı, uygulama yedeği (allowBackup) kapalı.
- Bildirim cihaz kaydı yalnız kendi hesabıyla giriş yapmış sahip/operasyon kullanıcılarına açıktır;
  rehber rolü ve ilk kurulum parolası bildirim alamaz. Kullanıcı devre dışı bırakılınca o kişiye
  bildirim gitmez; 120 gün açılmayan telefonlar listeden silinir.
- Bildirim metninde müşteri adı ve tur bilgisi bulunur; kilit ekranında içerik gizlemek için
  telefonun bildirim ayarlarından "hassas içeriği gizle" seçilebilir.
