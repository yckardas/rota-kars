# Rota Kars — Google yorumlarını canlı bağlama

Haritalar bağlantısı işletmeyi tanımlar; API yetkisi vermez. Projede yorum okuma, sayfalama, OAuth token yenileme ve turlarla eşleştirme hazırdır. Canlı bağlantı için aşağıdaki hesap işlemleri gerekir.

## 1. İşletme yetkisi ve erişim başvurusu

- Rota Kars sahibi, kullanacağınız Google hesabını Business Profile'a yönetici olarak davet etsin. Şifre paylaşımı gerekmez.
- Başvuruyu yapan hesabın yönettiği doğrulanmış işletme en az 60 gündür aktif olmalı ve profilinde işletmenin web sitesi bulunmalı.
- [Google Cloud Console](https://console.cloud.google.com/) içinde firma için proje oluşturun. Proje kimliği yerine **Project Number** değerini başvuruda kullanın.
- [Google'ın ön koşullar sayfasındaki](https://developers.google.com/my-business/content/prereqs) GBP API contact form üzerinden **Application for Basic API Access** başvurusu yapın. E-posta işletmede sahip/yönetici olarak listelenmeli.
- Onay bir Google değerlendirmesidir. Dokümana göre 0 QPM kota erişimin onaylanmadığını, 300 QPM onaylandığını gösterir.

## 2. API'ler ve OAuth

Onaydan sonra [Basic setup](https://developers.google.com/my-business/content/basic-setup) yönergesini uygulayın. Yorumlar için Google My Business API; işletme kimliklerini bulmak için Business Profile Account Management API ve Business Profile Business Information API kullanılır.

[OAuth izin ekranını ve OAuth Client ID'yi](https://developers.google.com/my-business/content/implement-oauth) oluşturun. Gerekli scope:

```text
https://www.googleapis.com/auth/business.manage
```

Bu izin Google tarafında yönetim yetkileri de kapsar; uygulamamız yalnız yorum okur, yanıt veya işletme değişikliği göndermez.

**Önerilen yol: bağlantı sihirbazı.** Google Cloud Console → APIs & Services → Credentials → *Create credentials* → *OAuth client ID* → Application type **Desktop app**. Çıkan Client ID ve Secret'ı `.env` dosyasında `GOOGLE_CLIENT_ID` ve `GOOGLE_CLIENT_SECRET` alanlarına yazın, sonra:

```sh
npm run google:connect
```

Tarayıcıda Google onay ekranı açılır; işletmede yönetici olan hesapla izin verin. Sihirbaz refresh token'ı alır, hesap ve işletmeleri listeler, Rota Kars'ı Haritalar kaydından (CID) bulur, yorum API'sine deneme isteği atar ve `GOOGLE_REVIEWS_PROVIDER`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_ACCOUNT_ID`, `GOOGLE_LOCATION_ID` alanlarını `.env`'e yazar. Gizli değerleri ekrana basmaz. Kota 0 hatası alırsanız 1. adımdaki erişim başvurusu henüz onaylanmamıştır. Railway'de aynı altı değeri servis değişkenlerine girin.

Alternatif olarak [OAuth Playground](https://developers.google.com/oauthplayground/) kullanılabilir:

1. OAuth istemci türünü Web application seçin. Yetkili redirect URI olarak `https://developers.google.com/oauthplayground` ekleyin.
2. Playground ayarlarında kendi OAuth credentials seçeneğini açıp kendi Client ID / Client Secret bilgilerinizi kullanın; offline erişimi seçin.
3. Yukarıdaki scope ile, işletmeye yetkili Google hesabında izin verin. İzin ekranı test modundaysa hesabı test kullanıcılarına ekleyin.
4. Authorization code'u token ile değiştirin; dönen refresh token'ı yalnız yerel `.env` dosyasına kaydedin.

Canlı yayından önce Google'ın OAuth yayınlama/doğrulama gereksinimlerini tamamlayın. İzin ekranı "Testing" modunda kalırsa refresh token 7 gün sonra geçersiz olur; uygulamayı "In production" durumuna alın.

## 3. Account ID ve Location ID

Playground'da yetkili access token ile şu GET isteklerini kullanın:

```text
https://mybusinessaccountmanagement.googleapis.com/v1/accounts
https://mybusinessbusinessinformation.googleapis.com/v1/accounts/ACCOUNT_ID/locations?readMask=name,title,storefrontAddress
```

İlk yanıtta `name: accounts/123` biçimindeki kaydın sayısal kısmı Account ID'dir. İkinci yanıttaki **Rota Kars adresini doğruladığınız** `name: locations/456` kaydının sayısal kısmı Location ID'dir. Birden fazla hesap/işletme varsa doğru kaydı seçin.

[Hesap listeleme](https://developers.google.com/my-business/reference/accountmanagement/rest/v1/accounts/list) · [İşletme listeleme](https://developers.google.com/my-business/reference/businessinformation/rest/v1/accounts.locations/list)

Haritalar CID değeri `1539703208462618989`, Account ID veya Location ID yerine kullanılamaz.

## 4. Projeyi yapılandırma

`.env.example` dosyasından yerel `.env` oluşturun ve şu alanları doldurun. Var olan dosya varsa diğer ayarları koruyun:

```dotenv
GOOGLE_REVIEWS_PROVIDER=business
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_ACCOUNT_ID=
GOOGLE_LOCATION_ID=
```

Secret veya token değerlerini sohbet mesajı, ekran görüntüsü ya da GitHub'a koymayın. Sunucu bunları tarayıcıya göndermez. Sunucuyu yeniden başlatın.

Yorum çağrısı sunucuda [reviews.list](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list) üzerinden yapılır:

```text
https://mybusiness.googleapis.com/v4/accounts/ACCOUNT_ID/locations/LOCATION_ID/reviews
```

## 5. Doğrulama ve Ani yorumları

- `/api/reviews` yanıtında `status: connected` görünmeli; `.env` sağlayıcısı `business` olmalı. `snapshot` canlı bağlantı değildir.
- Yerel sürüm API ayarsız veya erişilemezse tarihli mevcut Google yorum kaydını gösterir. Yorumların görünmesi tek başına bağlantının çalıştığını kanıtlamaz.
- Tur sayfaları, yorum metninde o rotanın yerleri geçen yorumları gösterir (Ani/Çıldır → Ani turu; Van/Akdamar/Muradiye → Van turları; İshak Paşa/Tuzluca → konaklamalı Van ve Van Havzası; Nemrut/Ahlat/Tatvan → Van Havzası; Batum/Gonio → Batum; Sarıkamış/kayak → Sarıkamış). Eşleşen kelimeler vurgulanır; eşleşme yoksa acentenin genel yorumları gösterilir. Türkçe olmayan yorumlarda Google çevirisi yerine misafirin özgün metni kullanılır.
- Yönetim panelinin Google yorumları sekmesinden tur eşlemelerini kontrol edin. Google tur kimliği sağlamaz; Ani/Çıldır gibi kelimeler metinden eşleştirilir. Belirsiz eşlemeler panelden düzeltilir.
- Access token otomatik yenilenir, sayfalı yorumlar okunur ve canlı sonuç 15 dakika sunucu belleğinde tutulur.
- `invalid_grant`: izin iptal edilmiş/token geçersiz olabilir; yeniden OAuth yetkilendirmesi gerekir. `403`: API erişim onayı, etkin API'ler ve işletme yetkisini kontrol edin. `404`: hesap/işletme kimliklerini kontrol edin.

Kurulum tamamlanana kadar Google canlı API bağlantısı yapılmış sayılmaz.
