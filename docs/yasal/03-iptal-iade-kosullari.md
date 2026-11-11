# İptal ve İade Koşulları

> **Taslak — avukat onayı ve acente kararı gerekiyor.**
> Mevcut sitedeki süreler (yurt içi 3 gün, yurt dışı 5 gün) aynen korundu; yeni bir ticari koşul uydurulmadı. Sürelerin dışında kalan iptaller için kesinti oranları `[doldurulacak]`.

## Sitede bugün yazan metin

`server/catalog.mjs` → `cancellationPolicy` (ve aynısı `src/pages/OtherPages.tsx` içinde sabit yazılı):

> Yurt dışı paket turlarımızda son 5 güne, yurt içi paketlerimizde son 3 güne kadar hiçbir koşul aranmadan turunuzu iptal edebilirsiniz. Yurt içi paketlerde iptal güvence paketi ile 72 saate kadar koşulsuz iptal hakkı bulunur (uçaklı paketlerde geçerli değildir). Ödediğiniz ücreti kesintisiz geri alırsınız.

Ana sayfadaki özellik kartı: *"Koşulsuz iptal: Yurt içinde son 3 güne, yurt dışında son 5 güne kadar kesintisiz iade."*

## Mevcut metindeki sorunlar

| # | Sorun | Neden önemli |
|---|---|---|
| 1 | **"İptal güvence paketi"** sitede satılmıyor, rezervasyonda seçilemiyor. | Var olmayan bir ürün vaat ediliyor; müşteri bunu talep edebilir. |
| 2 | **"72 saate kadar"** = 3 gün; zaten genel kuralla aynı. Güvence paketi ek bir hak sağlamıyor gibi okunuyor. | Çelişkili ve anlamsız; muhtemelen eski bir şablondan kalmış. |
| 3 | **"Uçaklı paketler"** — acente uçaklı tur satmıyor. | Aynı şekilde şablon kalıntısı. |
| 4 | Süre geçtikten sonra ne olacağı yazmıyor (son 3 gün / son 5 gün içinde iptal, gelmeme). | En çok uyuşmazlık çıkan durum tam olarak bu; metin sessiz. |
| 5 | "Paket" kelimesi: Batum ve Van günübirlik turlar paket tur değil. | "Yurt dışı paket" ifadesi günübirlik Batum'u kapsıyor mu belirsiz. |
| 6 | Kaporanın da iade kapsamında olup olmadığı açık değil. | "Ödediğiniz ücret" muhtemelen kaporayı da kapsıyor; açıkça yazılmalı. |
| 7 | Acentenin iptal ettiği durum (hava, sınır, asgari katılımcı) yazmıyor. | Paket turlarda zorunlu bilgi; günübirlikte de güven verir. |
| 8 | "Gün" nasıl sayılıyor belli değil (takvim günü mü, saat mi, tur saati mi). | "Son 3 güne kadar" iki farklı biçimde okunabilir. |

## Önerilen tam metin (/bilgilendirme#iptal ve sözleşme Madde 6)

### Ödeme yapılmamış ön rezervasyonlar
Henüz ödeme kaydedilmemiş ön rezervasyonunuzu **istediğiniz zaman ücretsiz iptal edebilirsiniz** (Rezervasyonum sayfasından ya da bizi arayarak). 24 saat içinde ödeme yapılmayan ön rezervasyonlar kendiliğinden düşer.

### Online ödeme ile otomatik onaylanan rezervasyonlar
Kaporayı veya tamamını kartla online öderseniz rezervasyonunuz ödemeyle birlikte **otomatik onaylanır** ve aşağıdaki "onaylanmış rezervasyon" kuralları uygulanır.

- **Son dakika rezervasyonu:** Kesintisiz iptal süresinin içinde kalan bir tur için (yurt içinde hareketten 3 gün, yurt dışında 5 gün öncesinden daha geç) online ödeme yaparsanız `[doldurulacak: ör. ödemeden itibaren … saat içinde kesintisiz iptal hakkı tanınır / süre sonrası kurallar hemen uygulanır]`. *Öneri: ödeme düğmesinden önce bu durum ayrıca ve açıkça gösterilmeli; aksi hâlde müşteri iptal hakkı olmadan ödediğini sonradan öğrenir.*
- **Otomatik onaydan sonra acentenin turu yapamaması** (ör. aynı koltuğun başka kanaldan satılması, sistem hatası, araç arızası): ödediğiniz tutarın **tamamı** kesintisiz iade edilir veya dilerseniz başka bir tarihe geçersiniz.
- **İade yolu:** Kartla yapılan ödemeler ödeme kuruluşu aracılığıyla aynı karta iade edilir. İadenin hesabınıza yansıma süresi bankanıza bağlıdır. Kesintisiz iade hâllerinde ödeme kuruluşu komisyonu sizden kesilmez. `[doldurulacak: komisyon kararı]`
- **Yarım kalan ödeme:** Ödeme sayfasında işlem tamamlanmaz veya başarısız olursa rezervasyon onaylanmaz; koltuklar 24 saatlik tutma süresi sonunda serbest kalır. Kartınızdan çekim yapılmış ama rezervasyon onaylanmamışsa tutar ödeme kuruluşu üzerinden iade edilir. `[doldurulacak: ödeme kuruluşu seçilince bu süreç teyit edilmeli]`

### Onaylanmış rezervasyonlarda sizin iptaliniz

| Tur | Kesintisiz iptal | Bu süreden sonra | Gelmeme |
|---|---|---|---|
| **Yurt içi turlar** (Ani–Çıldır, Sarıkamış, Van günübirlik, konaklamalı Van vb.) | Tur hareketinden **3 gün (72 saat) öncesine kadar**: kapora dahil ödediğiniz tutarın **tamamı** iade edilir. | `[doldurulacak: ör. kaporanın tamamı / toplamın %…'i kesilir]` | `[doldurulacak]` |
| **Yurt dışı turlar** (Batum) | Tur hareketinden **5 gün (120 saat) öncesine kadar**: tamamı iade edilir. | `[doldurulacak]` | `[doldurulacak]` |

- Süre, iptal talebinizin bize ulaştığı an ile turun hareket saati arasında hesaplanır.
- Bu süreler geçtikten sonra da, koltuğunuz başka bir misafire satılabilirse `[doldurulacak: kesinti alınmaması / yalnız … kesilmesi]`. *(Öneri: müşteri lehine ve koltuk bazlı satışa uygun bir hüküm.)*
- Yolcu adı değişikliği kalkıştan önce bildirilirse ücretsizdir; konaklamalı turlarda devir hakkı için sözleşmenin 8.2 maddesine bakın.
- Konaklamalı turlarda otelin kendi iptal kuralları nedeniyle iade edilemeyen tutar olursa `[doldurulacak / avukat: bu yansıtılacak mı? yansıtılacaksa satıştan önce açıkça gösterilmeli]`.

### Bizim iptalimiz
Asgari katılımcı sayısına ulaşılamaz, hava, yol veya sınır koşulları turu güvenle yapmamıza izin vermez ya da resmî bir karar turu engellerse sizi hemen ararız. **Başka bir tarihe geçebilir ya da ödediğiniz tutarın tamamını kesintisiz geri alabilirsiniz.**

### İade nasıl yapılır
İadeler, iptal kesinleştikten sonra en geç **14 gün** içinde; kartla online ödediyseniz aynı karta, havale ile ödediyseniz bildirdiğiniz IBAN'a, nakit ödediyseniz ofisimizde ya da IBAN'ınıza yapılır. *[doldurulacak: 14 gün öneri]*

## Kısa metin önerisi (`cancellationPolicy` için)

> Ödeme yapılmamış ön rezervasyonları istediğiniz zaman ücretsiz iptal edebilirsiniz. Online ödeme yaptığınızda rezervasyonunuz hemen onaylanır. Onaylanmış rezervasyonlarda yurt içi turlarda hareketten 3 gün, yurt dışı turlarda 5 gün öncesine kadar iptal ederseniz kapora dahil ödediğiniz tutarın tamamı iade edilir. Turu biz iptal edersek tutarın tamamını geri alırsınız ya da başka bir tarihe geçersiniz. Ayrıntılar ve süre sonrası koşullar için iptal ve iade koşullarına bakın.

Ana sayfa özellik kartı aynı kalabilir ("Yurt içinde son 3 güne, yurt dışında son 5 güne kadar kesintisiz iade"); yeni metinle çelişmiyor. Başlıktaki **"Koşulsuz iptal"** ise süre sınırı olduğu için *"Kesintisiz iptal"* olarak değiştirilmeli öneririm: "koşulsuz" tüketiciye süresiz bir hak gibi okunabilir.

## Siteye bağlarken değişecek yerler (onaydan sonra)

- `server/catalog.mjs` → `cancellationPolicy` ve `features[1]`
- `src/pages/OtherPages.tsx` → `#iptal` bölümü (şu an metin sabit yazılı; `catalog.cancellationPolicy`'den okunması iki kopyanın ayrışmasını önler)
- `server/seo.mjs:175` → /bilgilendirme sayfasının açıklaması da "Koşulsuz iptal hakkı" diyor
- Rezervasyon e-postası ve bilet sayfası, metni gösteriyorsa
