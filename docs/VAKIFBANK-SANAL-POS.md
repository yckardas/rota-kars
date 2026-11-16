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
8. **İade:** Yönetimde rezervasyonun **İade** sekmesinde **Karta iade (bankaya gönderilir)** seçilerek ya da **İptal et** penceresinde iptalle birlikte yapılır. Ayrıntı aşağıda, "Karta iade / iptal" bölümünde.
9. **Kalan bakiye:** Kapora ödenip rezervasyon onaylandıktan sonra kalan tutar da kartla ödenebilir. Müşteri **Rezervasyonum**'da "Kalanı kartla öde" düğmesini görür. Acente **Tahsilat** sekmesindeki "Müşteri kartla ödesin" kutusundan ödeme bağlantısını (`/odeme/bakiye/<bilet belirteci>`) kopyalayabilir, WhatsApp'tan ya da e-postayla gönderebilir. Ödeme aynı 3D Secure akışından geçer, rezervasyona kendiliğinden işlenir ve acenteye "Kalan ödeme kartla alındı" bildirimi gider. Ödeme planı bu ödemede değiştirilemez; tur tarihi geçtiyse bağlantı ödeme açmaz.

## Tahsilat yöntemleri (yönetim)

- **Online kart (Vakıfbank):** Müşteri sitede öder; kayıt kendiliğinden yazılır (`online:vakifbank`).
- **Havale / EFT, Nakit, Kredi kartı (POS cihazı):** Dışarıda yapılan işlemin kaydıdır, bankaya bir şey göndermez. Ofisteki fiziksel POS'tan çekilen tutar "Kredi kartı (ofis POS cihazı)" olarak kaydedilir (`pos`). Aylık rapor ve CSV, POS ile online kartı ayrı satırlarda gösterir.

## Karta iade / iptal (yönetim)

Kartla alınmış tahsilat, rezervasyon penceresindeki **İade** sekmesinde iade edilir. Kartla (Vakıfbank) ödenmiş rezervasyonda sekmenin üstünde iki seçenek vardır: **Karta iade (bankaya gönderilir)** ve **Havale / nakit / POS iadesini kaydet**. İkincisi bankaya hiçbir şey göndermez; kartla ödenmiş rezervasyonda seçildiğinde bu açıkça uyarılır.

**İptal penceresi:** **İptal et** düğmesi bir pencere açar:

- İptal edeni seçersiniz. **Müşteri isteği** seçilirse iade iptal ve iade koşullarına göre önerilir: süre içindeyse tamamı, süre geçtiyse kapora (toplam bedelin %30'u) düşülür. Süre, müşterinin iptal talebinin geldiği andan hesaplanır. **Acente** seçilirse (asgari katılımcı, hava, yol, araç…) tamamı önerilir. Önerilen tutar değiştirilebilir.
- İade yöntemi: karta iade, havale / nakit / POS kaydı ya da "iadeyi sonra yapacağım".
- Karta iade tutarı kart tahsilatlarına dağıtılır (her biri ayrı banka işlemi). Bugün alınan ödeme yalnızca tamamıyla iptal edilebildiği için, bugün yapılamayacak bir kısmi iade **iptal yapılmadan** reddedilir; tam iade seçilebilir ya da iade ertesi gün yapılır.
- İptal yapılır, sonra iade. Karta iade askıya alınır veya reddedilirse rezervasyon iptal edilmiş olarak kalır; iade **İade** sekmesinden sonuçlandırılır ya da yeniden denenir.
- Müşteriye giden iptal e-postası iadenin karta yapıldığını veya acentece yapıldığını söyler.

- **Yetki:** Bankaya iade göndermek ve askıdaki iadeyi sonuçlandırmak yalnızca **Sahip** rolündedir. Operasyon rolü sekmeyi ve iade durumunu görür, düğmeleri görmez; uç noktalar da 403 döner. Rehber sekmeyi göremez.
- **Aynı gün → iptal (Cancel):** Ödeme bugün (İstanbul saatiyle) alındıysa bankanın gün sonu henüz alınmamıştır. Bu durumda yalnızca tutarın **tamamı** iptal edilebilir; kısmi tutar reddedilir.
- **Sonraki günler → iade (Refund):** Tam veya kısmi tutar girilebilir. Aynı tahsilattan birden çok kısmi iade yapılabilir; toplamı tahsilatı ve rezervasyonun net tahsilatını aşamaz.
- **Önce banka, sonra kayıt:** İade kaydı (`payment_ledger`, `kind: refund`, `method: online:vakifbank`) yalnızca banka `ResultCode 0000` döndükten sonra yazılır. Kayıttaki referans iade işleminin kendi numarasıdır (`RF…`); bankanın iade işlem numarası `card_refunds` kaydında durur.
- **Çift iade olmaz:** Rezervasyon başına aynı anda yalnızca bir kart iadesi bankaya gider (`card_refund_locks` kilidi). Kilit alındıktan sonra iade edilebilir tutar yeniden hesaplanır. Aynı anda gelen ikinci istek 409 alır.
- **Banka reddederse:** İade kaydı yazılmaz, kilit açılır, bankanın gerekçesi gösterilir. Yeniden denenebilir.
- **Bankadan yanıt alınamazsa:** İade **askıya alınır** (`unknown`). Acenteye "Kart iadesi doğrulanamadı" e-postası ve uygulama bildirimi gider. Kilit açılmaz; sonuçlanana kadar o rezervasyonda yeni kart iadesi yapılamaz. Vakıfbank üye işyeri panelinden kontrol edin, sonra **İade** sekmesindeki **Karta iade** bölümünde:
  - İade panelde görünüyorsa **Gerçekleşti** deyin. İade kaydı yazılır.
  - Görünmüyorsa **Gerçekleşmedi** deyin. İade düşer, yeniden iade yapılabilir.
- **Banka onaylayıp kayıt yazılamazsa** (`not_recorded`): Bu da askıya alınır ve "Kart iadesi kaydedilemedi" bildirimi gider. Bu durumda yalnızca **Gerçekleşti** seçilebilir, çünkü para karta dönmüştür.
- 2 dakikadan uzun süre "Bankada işleniyor" kalan iade de sonuçlandırılabilir. Bu, sunucunun banka isteği sırasında yeniden başladığı durum içindir.
- İade sekmesinden yapılan iade rezervasyonun durumunu değiştirmez. Tur iptal edilecekse **İptal et** penceresi iptal ile iadeyi birlikte yapar.
- Simülatörde alınmış ödeme (işlem numarası `SIM…`) gerçek bankaya, gerçek ödeme simülatöre iade gönderilmez.

Kod: `server/payments.mjs` (`cardPayments`, `refundCard`, `refundToCard`, `cancelQuote`, `resolveRefund`, `startByTicket`), `server/legal.mjs` (`cancellationQuote`); uçlar `server/app.mjs` (`/api/admin/reservations/:reference/card-payments`, `.../card-refunds`, `.../cancel-quote`, `.../cancel`, `.../payment-link`, `/api/admin/card-refunds/:id/resolve`, `/api/payments/start-ticket`); ekranlar `src/components/admin/CardRefunds.tsx`, `CancelDialog.tsx`, `PaymentLink.tsx`.

**Canlıda ilk iade:** Kodla gerçek iade henüz denenmedi. İlk kez küçük tutarlı bir ödemede deneyin ve sonucu banka panelinde karşılaştırın. Aşağıdaki "Bankanın dokümanıyla doğrulanacaklar" listesindeki Cancel/Refund maddeleri doğrulanmadan büyük tutarlı iade yapmayın.

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
- İptal ve iade simülatörde satış tutarına göre denetlenir. İptal edilmiş veya iadesi başlamış satış iptal edilemez; iadelerin toplamı satışı aşamaz. Sunucu yeniden başladıktan sonra simülatör eski `SIM…` satışlarını tanımaz ve iadelerini denetimsiz kabul eder.
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
- VPOS `Sale` / `Cancel` / `Refund` alanları ve `ResultCode`. İptal ve iade için şunlar ayrıca doğrulanmalı:
  - `ReferenceTransactionId` olarak satış yanıtındaki `TransactionId` gönderiliyor. Banka bunu mu bekliyor?
  - Gün sonu öncesi kısmi iptal/iade gerçekten yapılamıyor mu? Uygulama aynı gün yalnızca tam iptale izin veriyor. Gün sonu saati İstanbul gece yarısından farklıysa "aynı gün" kuralı ona göre ayarlanmalı.
  - `ClientIp` alanına iadeyi yapan yöneticinin IP'si gönderiliyor. Banka sunucu IP'si mi istiyor?
- Taksit kullanılacaksa (`InstallmentCount`) ayrıca eklenir; şu an tek çekim.

### 3D dönüşü için bankaya yazılı sorun

3D dönüşü müşterinin tarayıcısından gelen imzasız bir formdur. Uygulama alanların eksiksiz ve tutarlı olduğunu denetler, ama CAVV değerinin gerçekten kartı veren bankadan geldiğini yalnızca Vakıfbank doğrulayabilir. Şunları sorun:

- VPOS `Sale` isteğindeki `CAVV`/`ECI`/`MpiTransactionId`, banka tarafında MPI kaydıyla karşılaştırılıyor mu?
- Dönüşte hash/imza alanı veya MPI sonuç sorgulama servisi var mı? Varsa uygulamaya eklenmeli.
- Troy kartları için tam doğrulama ECI değeri nedir? Uygulama şu an `05` ve `02` kabul ediyor.

`VAKIFBANK_ENV=test` ile ilk gerçek denemede dönüş formunda `VerifyEnrollmentRequestId`, `PurchAmount`, `Eci` ve `Cavv` alanlarının geldiğini doğrulayın. Biri gelmiyorsa ödeme "Banka yanıtı ödemeyle eşleşmedi" ile reddedilir.
