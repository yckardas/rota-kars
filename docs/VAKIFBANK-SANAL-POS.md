# Vakıfbank sanal POS (VPOS 724 + 3D Secure)

Kartla kapora / tam ödeme altyapısı hazır. Gerçeğe geçmek için yalnızca bankanın vereceği üye işyeri bilgileri gerekiyor. Altyapı Peynişar'daki Vakıfbank entegrasyonunun Rota Kars'a uyarlanmış hâlidir.

Kod:

- `server/vakifbank.mjs`: banka bağlantısı, kart doğrulama ve bellekteki şifreli kart kasası.
- `server/payments.mjs`: ödeme akışı ve rezervasyona tahsilat.
- `server/bank-simulator.mjs`: yerel banka simülatörü.
- `src/pages/Payment.tsx`: kart formu ve sonuç sayfası.

## Akış

1. Müşteri ön rezervasyon yapar. Rezervasyon sayfasında veya "Rezervasyonum"da **Kartla öde** düğmesine basar.
2. `/odeme/kart/:id` sayfası açılır. Burada kart üzerindeki isim, kart numarası (Luhn ve Visa/Mastercard/Troy kontrolü), AA/YY ve CVV girilir.
3. Sunucu kartı bankanın **MPI** servisine gönderir (3D Secure kayıt sorgusu). Kart 3D Secure'a kayıtlı değilse ödeme alınmaz.
4. Müşteri `/odeme/3d/:id` sayfasından kartı veren bankanın SMS doğrulama sayfasına (ACS) geçer. Ödeme oturumu bu sırada en az 15 dakika açık tutulur.
5. Banka müşteriyi `/api/payments/vakifbank/return` adresine geri gönderir. Sunucu sırasıyla şunları yapar:
   - Denemeyi **tek kullanımlık** işler. Aynı dönüş iki kez gelirse ikinci çekim olmaz.
   - Üye işyeri numarasını, `VerifyEnrollmentRequestId` değerini ve tutarı (`PurchAmount`) karşılaştırır. Biri eksik veya farklıysa reddeder.
   - Yalnızca tam doğrulanmış sonucu kabul eder: `Status=Y`, tam doğrulama ECI'si (Visa/Troy `05`, Mastercard `02`) ve dolu `Cavv`.
   - Rezervasyonun hâlâ aynı tutarı beklediğini kontrol eder. Bu, arada iptal ya da elle tahsilat olmadığını gösterir.
   - Satışı bankanın **VPOS** servisine sunucudan sunucuya onaylatır (`ResultCode 0000`).
   - Ancak bundan sonra tahsilatı kaydeder. Kapora karşılandıysa rezervasyon **otomatik onaylanır** ve QR'lı bilet geçerli olur.
6. **Reddedilen kart:** Müşteri kart formuna döner ve bankanın gerekçesini görür. Rezervasyon beklemede kalır, başka kartla tekrar denenebilir. Rezervasyon başına 30 dakikada en fazla 6 deneme yapılabilir; ayrıca IP başına 15 dakikada en fazla 12 kart denemesi vardır.
7. **Bankadan satış yanıtı alınamazsa veya kart çekildiği halde rezervasyona işlenemezse:** Ödeme **askıya alınır** (`unverified`). Acenteye "Ödeme sonucu doğrulanamadı" e-postası ve uygulama bildirimi gider. Banka panelinden kontrol edin:
   - Çekildiyse tahsilatı yönetimden elle kaydedin.
   - Çekilmediyse müşteriyi arayın.
8. **İade:** Şimdilik Vakıfbank üye işyeri panelinden yapılır, ardından yönetimdeki iade kaydı girilir. Bağlantı modülünde `reverse` (aynı gün Cancel, sonraki günler Refund) hazırdır; yönetim paneline bağlanması ayrı bir adımdır.

## Kart verisi ve güvenlik

- Kart numarası, son kullanma ve CVV **veritabanına ve loglara yazılmaz**.
  - 3D Secure süresince (en fazla 15 dakika) sunucu belleğinde, süreç dışına çıkmayan bir anahtarla AES-256-GCM şifreli tutulur ve ilk kullanımda silinir.
  - Sunucu yeniden başlarsa müşteri kartı yeniden girer.
  - Testler kart numarasının hiçbir koleksiyonda bulunmadığını doğrular.
- Veritabanında yalnızca maskeli numara (`411111******1111`), kart markası, banka işlem numarası, onay kodu ve RRN saklanır.
- Bu model kart bilgisini sitede aldığı için banka **PCI-DSS öz değerlendirme anketi (SAQ)** isteyebilir. Bankaya "Ortak Ödeme Sayfası" seçeneğini de sorun; bu modelde kart banka sayfasında girilir. Tercih edilirse bağlantı o modele uyarlanır.
- Yalnızca 3D Secure'lu ödeme kabul edilir; 3D'siz satış kapalıdır.
- 3D yönlendirme sayfası, kart veren bankanın adresi değiştiği için her `https:` adrese form gönderebilir. Diğer sayfaların güvenlik politikası değişmez.

## Ortamlar (`VAKIFBANK_ENV`)

| Değer | Ne yapar | Nerede |
| --- | --- | --- |
| `simulator` | Siteye gömülü banka simülatörü. Kimlik bilgisi gerekmez, tahsilat olmaz. | Yerel, deneme, banka sunumu. Canlıda yalnızca `PAYMENT_ALLOW_TEST=1` ile açılır. |
| `test` | Vakıfbank test sunucuları, bankanın verdiği test üye işyeri bilgileri. | Deneme. Canlıda yalnızca `PAYMENT_ALLOW_TEST=1` ile açılır. |
| `production` | Gerçek tahsilat. Üye işyeri bilgileri ve `https` `PUBLIC_BASE_URL` zorunludur. | Canlı |

Ayarlar eksik veya hatalıysa ödeme kendiliğinden kapalı kalır. Bu durumda site "Online ödeme henüz aktif değil" der ve ön rezervasyon acenteye düşer.

**Simülatör kartları:**

- Luhn'a uygun her Visa/Mastercard/Troy başarılı olur. Örnek: `4111 1111 1111 1111`, ileri bir tarih, herhangi bir CVV.
- `4111 1111 1115 0002` satışta reddedilir. Genel kural: 0002 ile biten kart reddedilir.
- `4000 0000 0000 0101` 3D Secure'a kayıtlı değildir.
- Banka sayfası açıkça "SİMÜLASYON" yazar.

## Banka incelemesi için önizleme (`PAYMENT_PREVIEW=1`)

Banka başvuruyu incelerken ödeme ekranını canlı sitede görmek ister. Gerçek ödeme kapalıyken Railway'de `PAYMENT_PREVIEW=1` ayarlanırsa:

- Rezervasyon sayfasında ve "Rezervasyonum"da **Kartla öde** düğmesi görünür. Altında "Kartla ödeme banka onayının ardından açılacak; şimdilik ödeme alınmaz." notu yer alır.
- `/odeme/kart/:id` kart formu açılır; üstünde "Önizleme" etiketi bulunur.
- Form gönderildiğinde kart bilgisi **sunucuya hiç gönderilmez**. Form temizlenir ve "Kartınızdan çekim yapılmadı; ön rezervasyonunuz kayıtlı" mesajı çıkar. Rezervasyon acente onayı bekleyen ön rezervasyon olarak kalır.
- Ödeme ekranında ödenen rezervasyonun özeti (tur, tarih, yolcu/koltuk, toplam bedel, şimdi ödenecek tutar), kabul edilen kartlar (Visa, Mastercard, Troy) ile 3D Secure işareti ve şirket künyesi yer alır.
- Rezervasyonun son adımında dört ayrı **zorunlu onay kutusu** vardır: Ön Bilgilendirme Formu, Tur Hizmet Sözleşmesi (mesafeli satış), İptal ve İade Koşulları, KVKK Aydınlatma Metni. Havale/nakit ödeyen müşteri de bu adımdan geçtiği için yasal dayanak buradadır. Metinler bu rezervasyonun bilgileriyle açılır pencerede okunur.
- Kart ödeme ekranında **tek birleşik onay kutusu** vardır ("Ön Bilgilendirme Formu, Tur Hizmet Sözleşmesi ve İptal ve İade Koşulları okudum, onaylıyorum"); metinler yine açılır pencerede okunur, rezervasyondaki onay tarihi not olarak görünür. KVKK aydınlatma metni burada kutu değil, bilgi satırıdır.
- Onaylar sunucuda kaydedilir: rezervasyonda `booking_consents`, ödeme oturumunda `consents` (tarih, metin sürümü, IP) ve `consents` koleksiyonunda tür başına kayıt (`source: booking | payment`). Kart adımı (`/api/payments/card/:id`) ödeme ekranı onayı (`/api/payments/consent/:id`, `{ terms: true }`) olmadan başlamaz; önizlemede de onay kaydedilir.
- Gerçek sağlayıcı açıldığında (`PAYMENT_PROVIDER=vakifbank`) önizleme kendiliğinden devre dışı kalır. Yine de değişkeni silmek iyi olur.

Bankaya göstermek için: sitede bir sefere ön rezervasyon yapın, ardından "Kartla öde" düğmesine basın.

## Bankaya başvururken

Bankanın sanal POS başvurusunda genelde istedikleri ve sitede durumları:

- **HTTPS ve alan adı:** Başvuruyu `rotakarsturizm.com` üzerinden yapın. Alan adı Railway'e taşınmadan canlı ödeme açılmamalı, çünkü banka dönüş adresini alan adıyla tanımlar.
- **Sabit IP:** Banka VPOS'a bağlanacak sunucu IP'sini ister. Railway'in giden IP'si varsayılan olarak sabit değildir. Railway'de **Static Outbound IPs** özelliğini açıp o IP'yi bankaya bildirin.
- **Yasal metinler:** Mesafeli satış sözleşmesi, ön bilgilendirme formu, iptal/iade koşulları, KVKK ve gizlilik metinleri `/bilgilendirme` sayfasında olmalı. `docs/yasal/` altındaki taslaklar avukat onayından sonra yayına alınmalıdır.
- **Künye:** Ticaret unvanı, adres, vergi no, MERSİS, TÜRSAB no ve iletişim bilgileri sitede görünür olmalı.
- **Kart logoları:** Visa, Mastercard ve Troy adları ödeme adımında yazılıdır. Banka logo görselleri isterse eklenir.
- **Dönüş adresi:** Bankaya tanımlatılacak 3D Secure dönüş adresi `https://rotakarsturizm.com/api/payments/vakifbank/return`. Başarılı ve başarısız için aynı adres kullanılır.

## Gerçeğe geçirme (banka bilgileri gelince)

Railway → `rota_kars` servisi → **Variables**. Değerleri sohbete yazmayın.

1. **Banka test ortamı** (bankanın test bilgileriyle):
   - `PAYMENT_PROVIDER=vakifbank`
   - `VAKIFBANK_ENV=test`
   - `PAYMENT_ALLOW_TEST=1`
   - `VAKIFBANK_MERCHANT_ID`, `VAKIFBANK_MERCHANT_PASSWORD`, `VAKIFBANK_TERMINAL_NO`

   Bankanın test kartlarıyla başarılı, reddedilen ve 3D iptal senaryolarını deneyin.
2. **Canlı:**
   - `VAKIFBANK_ENV=production`
   - Gerçek üye işyeri bilgilerini girin.
   - `PAYMENT_ALLOW_TEST` değişkenini **silin**.
   - `PUBLIC_BASE_URL=https://rotakarsturizm.com`

   Önce küçük tutarlı gerçek bir rezervasyon ödeyip banka panelinden iade ederek doğrulayın.

## Bankanın dokümanıyla doğrulanacaklar

Uç noktalar ve alan adları VPOS 724 / MPI modeline göre yazıldı (`vakifbankEndpoints`). Banka entegrasyon dokümanını verdiğinde aşağıdakiler karşılaştırılmalı; kod değişikliği gerekirse küçüktür:

- MPI ve VPOS adresleri. Gerekirse `VAKIFBANK_MPI_URL` ve `VAKIFBANK_VPOS_URL` ile kod değiştirmeden ayarlanır.
- MPI istek alanları: `MerchantId`, `MerchantPassword`, `VerifyEnrollmentRequestId`, `Pan`, `ExpiryDate`, `PurchaseAmount`, `Currency=949`, `BrandName`, `SuccessUrl`, `FailureUrl`.
- MPI yanıt alanları: `Status`, `ACSUrl`, `PaReq`, `TermUrl`, `MD`.
- 3D dönüş alanları: `Status`, `MerchantId`, `VerifyEnrollmentRequestId`, `PurchAmount` biçimi, `Eci`, `Cavv`, `ErrorCode`.
- VPOS `Sale` / `Cancel` / `Refund` alanları ve `ResultCode`.
- Taksit kullanılacaksa (`InstallmentCount`) ayrıca eklenir; şu an tek çekim.

### 3D dönüşü için bankaya yazılı sorun

3D dönüşü müşterinin tarayıcısından gelen imzasız bir formdur. Uygulama alanların eksiksiz ve tutarlı olduğunu denetler, ama CAVV değerinin gerçekten kartı veren bankadan geldiğini yalnızca Vakıfbank doğrulayabilir. Şunları sorun:

- VPOS `Sale` isteğindeki `CAVV`/`ECI`/`MpiTransactionId`, banka tarafında MPI kaydıyla karşılaştırılıyor mu?
- Dönüşte hash/imza alanı veya MPI sonuç sorgulama servisi var mı? Varsa uygulamaya eklenmeli.
- Troy kartları için tam doğrulama ECI değeri nedir? Uygulama şu an `05` ve `02` kabul ediyor.

`VAKIFBANK_ENV=test` ile ilk gerçek denemede dönüş formunda `VerifyEnrollmentRequestId`, `PurchAmount`, `Eci` ve `Cavv` alanlarının geldiğini doğrulayın. Biri gelmiyorsa ödeme "Banka yanıtı ödemeyle eşleşmedi" ile reddedilir.
