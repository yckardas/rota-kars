# Entegrasyon kararları

## Google yorumları

Kullanıcının sağladığı işletme bağlantısından çıkan CID: `1539703208462618989`.

İşletme bağlantısı: https://www.google.com/maps?cid=1539703208462618989

### Tercih edilen yol: Google Business Profile

Tüm yorumları, güncelleme tarihine göre sayfalar halinde okumak için firma işletmesine yetkili Google hesabı ve API erişimi gerekir. İşletme doğrulanmış olmalı; Google projesinin ilgili API erişimi onaylanmalıdır.

`.env` alanları:

- `GOOGLE_REVIEWS_PROVIDER=business`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_ACCOUNT_ID`
- `GOOGLE_LOCATION_ID`

Önceden yetkilendirilmiş OAuth refresh token sunucuda tutulur, otomatik access token yenileme uygulanır. Bu yerel sürüm OAuth izin ekranı/bağlama sihirbazı içermez; token ve işletme kimlikleri yetkili Google projesinden güvenli biçimde sağlanmalıdır. Kod yalnızca okuma yapar; yorum yanıtı göndermez.

### Alternatif: Places API (New)

- `GOOGLE_REVIEWS_PROVIDER=places`
- `GOOGLE_PLACES_API_KEY`
- `GOOGLE_PLACE_ID`

Anahtar sunucuda kalır. Places API Google'ın seçtiği en fazla 5 yorumu döndürür, tüm yorum geçmişini sağlamaz. Haritalar CID numarası Place ID yerine doğrudan kullanılamaz; doğru Place ID Google projesinden bulunmalıdır. Kullanım Google ücretlendirmesine tabidir.

### Eşleştirme

Türkçe harfleri normalize eden kelime eşleştirme Ani/Çıldır, Sarıkamış, Batum ve Van rotalarını bulur. `Ani` kelimesi `organizasyon` veya `anılar` gibi kelimelerin içinde aranmaz. Google'ın tur kimliği alanı yoktur; otomatik eşleştirme metne dayalı öneridir. Yönetici `reviewId → tourIds` atamasıyla düzeltir. Yorum metni düzenlenmez ve olumsuz puanlar gizlenmez.

Ana sayfa tüm işletme yorumlarını, tur sayfası yalnızca ilgili eşleşmeleri gösterir. Google'ın seçimi / sıralaması ve tur filtresi ziyaretçiye açıklanır. İşletme ortalaması tur ortalaması diye sunulmaz. Yazar adı, mevcutsa fotoğraf ve profil bağlantısı ile kaynak bağlantısı korunur. Business Profile'da doğrudan yorum URL'si olmadığından işletmenin yorum sayfasına bağlantı verilir.

Yorum içerikleri yalnızca sunucu belleğinde 15 dakika tutulur. Kalıcı veritabanına yalnızca tur eşleme kimlikleri yazılır. Bir hata halinde eski içeriği süresiz servis etmek yerine Google bağlantısı gösterilir. API kuralları ve gösterim şartları yayına geçerken tekrar kontrol edilmelidir.

Kaynaklar:

- https://developers.google.com/my-business/content/review-data
- https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list
- https://developers.google.com/maps/documentation/places/web-service/place-details
- https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places
- https://developers.google.com/maps/documentation/places/web-service/policies

## Ödeme sınırı

`server/payments.mjs` sağlayıcıdan bağımsız başlangıç sınırıdır, gerçek bankacılık entegrasyonu değildir. Başarılı ödeme simülasyonu bile üretim API'sinde açılmaz. `PAYMENT_PROVIDER` ayarını değiştirmek tek başına ödeme açmaz. Banka seçilince adapter ayrıca yazılır.

Sağlayıcı belli olduğunda imza doğrulaması, sipariş/tutar/para birimi kontrolü, tekrar gönderilen callback için idempotency, 3D Secure dönüşleri, başarısız ödeme, süre aşımı ve iade akışları uygulanmalıdır. İstemcinin başarı yönlendirmesi ödeme kanıtı kabul edilmemelidir. Gerçek ödeme aktif olmadan `pending_agency` kaydı kesin bilete çevrilmez.

## Oteller

Firma tarafından doğrulanmış oteller yönetim panelinde taslak veya aktif olarak kaydedilir. İsim, konum, açıklama, özellikler ve yerel görsel yolu desteklenir. Görsel yükleme ve otel stok/channel-manager bağlantısı bu sürümde yoktur. Talep kaydı, otelde otomatik rezervasyon yapmaz. Müsaitlik/fiyat acente teyidi gerektirir.

## Eklenti araştırması

Frontend Design, Sites'in yerel önizleme rehberi ve Plugin Management kullanıldı. Google Business Profile erişimi için Windsor.ai gibi üçüncü taraf bağlayıcılar araştırıldı. Sitenin kalıcı entegrasyonunun bu tür sohbet eklentilerine bağlanması gerekmediğinden ek ücretli eklenti kurulmadı. Google'ın resmi API'lerine sunucu tarafında doğrudan bağlantı tercih edildi. Kod bağımlılıkları proje içinde kuruludur.
