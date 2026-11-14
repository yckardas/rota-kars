# Ön Bilgilendirme Formu

> **Taslak — avukat onayı olmadan yayımlanmamalı.**
> `{{...}}` alanları rezervasyondan otomatik dolar. `[doldurulacak]` alanlarını acente karar verip doldurmalı.
> Bu form, ön rezervasyon gönderilmeden önce rezervasyonun 3. adımında gösterilir ve "okudum, onaylıyorum" kutusuyla teyit alınır. Onaylanan metnin bir kopyası, ön rezervasyon e-postasıyla müşteriye gönderilir ve rezervasyon kaydında saklanır (kalıcı veri saklayıcısı).

---

**Ön rezervasyon no:** {{rezervasyon.no}}  ·  **Oluşturulma:** {{rezervasyon.tarih_saat}}

## 1. Hizmeti sunan (acente)

| | |
|---|---|
| Ticaret unvanı | Rota Kars Turizm Taşımacılık Seyahat Acentası Limited Şirketi |
| Acenta unvanı | Rota Kars Turizm |
| T.C. Kültür ve Turizm Bakanlığı belgesi | A Grubu Seyahat Acentası, belge no 13948 |
| Adres | Yeni Mah. Cumhuriyet Cad. Köşk Apt. No: 26 İç Kapı No: 13, Merkez / Kars |
| MERSİS no | 0735187296600001 |
| Vergi dairesi / no | Kars / 7351872966 |
| Ticaret sicil | Kars Ticaret Sicili Müdürlüğü, 8625 |
| Telefon | 0474 223 65 44 · 0545 935 34 10 |
| E-posta | info@rotakarsturizm.com |
| KEP | rotakarsturizm@hs01.kep.tr |

## 2. Müşteri

| | |
|---|---|
| Ad soyad | {{musteri.ad_soyad}} |
| E-posta | {{musteri.eposta}} |
| Telefon | {{musteri.telefon}} |

## 3. Tur

| | |
|---|---|
| Tur | {{tur.adi}} |
| Tür | {{tur.turu}} *(Günübirlik tur / Konaklamalı paket tur)* |
| Güzergâh | {{tur.guzergah}} |
| Tarih | {{kalkis.tarih}} |
| Hareket – dönüş | {{kalkis.saat}} – {{tur.bitis_saati}} *(yaklaşık)* |
| Buluşma noktası | {{kalkis.bulusma_noktasi}} |
| Araç | {{kalkis.arac_sinifi}} *(ör. VIP midibüs, 18+1)* |
| Rehber | Profesyonel kokartlı rehber {{kalkis.rehber_varsa}} |
| Konaklama *(yalnız konaklamalı turlarda)* | {{tur.konaklama_yeri}}, {{tur.konaklama_kategorisi}}, {{tur.gece_sayisi}} gece, {{tur.pansiyon_tipi}} |
| Program | {{tur.program}} |
| Fiyata dahil | {{tur.dahil}} |
| Fiyata dahil değil | {{tur.haric}} |
| Asgari katılımcı sayısı | {{tur.asgari_katilimci}} *[doldurulacak: her tur için sayı]* |
| Yurt dışı turlarda giriş belgesi | {{tur.giris_belgesi_notu}} *(ör. Batum: geçerli pasaport veya yeni tip çipli kimlik kartı — [doldurulacak: acente teyit etmeli, güncel kuralı Dışişleri Bakanlığı'ndan kontrol edin])* |

Program hava, yol, sınır ve mevsim koşullarına göre sıra veya içerik bakımından değişebilir; programın esaslı bir değişikliği söz konusu olursa 6. maddedeki haklarınız geçerlidir.

## 4. Yolcular ve koltuklar

| # | Yolcu adı | Uyruk | T.C. kimlik / pasaport no | Koltuk |
|---|---|---|---|---|
| {{#yolcular}} {{sira}} | {{ad_soyad}} | {{uyruk}} | •••••••{{kimlik_son3}} | {{koltuk_no}} {{/yolcular}} |

- Bir rezervasyonda en çok **4 koltuk** ayrılabilir; daha büyük gruplar için acenteyle iletişime geçin.
- Yolcuların ad soyad, uyruk, kimlik / pasaport numarası ve cinsiyet bilgileri, turizm taşımacılığı mevzuatı gereği sefer öncesinde Ulaştırma ve Altyapı Bakanlığı'nın U-ETDS sistemine bildirilir. Bilgilerin yolcunun kimlik belgesiyle aynı olması gerekir; yanlış bilgi aracın yolculuğa çıkmasını veya sınır geçişini engelleyebilir.
- Diğer yolcular adına bilgi girdiyseniz bu kişileri bilgilendirdiğinizi kabul edersiniz (Aydınlatma Metni).

## 5. Fiyat ve ödeme

| | |
|---|---|
| Kişi başı fiyat | {{fiyat.kisi_basi}} |
| Kişi sayısı | {{yolcu_sayisi}} |
| Kupon / indirim | {{fiyat.indirim}} |
| **Toplam (KDV dahil)** | **{{fiyat.toplam}}** |
| Ödeme tercihi | {{odeme.tercih}} *(%30 kapora / tam ödeme)* |
| Kapora (%30) | {{odeme.kapora}} |
| Kalan | {{odeme.kalan}} — son ödeme: {{odeme.kalan_son_tarih}} *[doldurulacak: ör. tur gününden önce ya da hareket anında]* |

- **Online kapora ödemesi:** Kaporayı (veya tamamını) kartla ödemeyi seçerseniz ödeme kuruluşunun `[doldurulacak: iyzico / PayTR / diğer]` güvenli sayfasına yönlendirilirsiniz. Kart bilgileriniz bu sayfada girilir; sunucumuza ulaşmaz ve tarafımızca saklanmaz. Ödeme başarıyla tamamlandığında rezervasyonunuz **otomatik olarak onaylanır** (6. madde).
- **Havale/EFT veya nakit:** Ödeme banka havalesi/EFT veya acente ofisinde nakit olarak da yapılabilir; bu durumda ödeme acente tarafından kaydedilip rezervasyon onaylanana kadar kaydınız bir ön rezervasyondur, kesin bilet değildir. Havale bilgileri: {{acente.iban_bilgisi}} *[doldurulacak: banka, şube, IBAN, hesap sahibi]*. Açıklamaya ön rezervasyon numaranızı yazın.
- Fiyatlar Türk lirasıdır. Sözleşme kurulduktan sonra toplam fiyat artırılmaz. *[avukat: Paket Tur Sözleşmeleri Yönetmeliği'ndeki fiyat değişikliği hükmünü kullanmak isteyip istemediğinize göre bu cümle korunabilir.]*
- Fatura, ödeme kaydedildikten sonra {{musteri.ad_soyad}} adına düzenlenir. *[doldurulacak: kurumsal fatura isteyenler için vergi bilgisi ne zaman alınacak]*

## 6. Sözleşmenin kurulması

1. Siteden gönderdiğiniz kayıt, ödeme yapılana kadar bir **ön rezervasyon talebidir.** Seçtiğiniz koltuklar 24 saat süreyle sizin için tutulur.
2. **Online ödemede:** kapora veya tam ödeme ödeme kuruluşu tarafından başarılı olarak bildirildiği anda rezervasyonunuz otomatik onaylanır ve **sözleşme bu anda kurulur.**
3. **Havale/EFT veya nakit ödemede:** acente müsaitliği teyit eder ve ödemeyi kaydeder; **sözleşme, acentenin onayı size e-posta ile bildirildiği anda kurulur.**
4. Her iki durumda da onay e-postası, Tur Hizmet Sözleşmesi'nin ve bu formun bir kopyasını içerir.
5. 24 saat içinde ödeme kaydedilmez ve acente süreyi uzatmazsa ön rezervasyon kendiliğinden düşer, koltuklar serbest kalır; size bir yükümlülük doğmaz.

## 7. Cayma hakkı

- **Günübirlik turlar:** Mesafeli Sözleşmeler Yönetmeliği md. 15/1-(g) uyarınca, belirli bir tarihte yapılması gereken ve boş zamanın değerlendirilmesine ilişkin hizmetlerde **14 günlük cayma hakkı bulunmaz.** *[avukat: günübirlik rehberli turun bu bende ve yönetmelik kapsamına girdiğini teyit edin; yönetmeliğin "yolcu taşıma hizmetleri" istisnası da tartışılabilir.]*
- **Konaklamalı paket turlar:** 6502 sayılı Kanun md. 51 ve Paket Tur Sözleşmeleri Yönetmeliği uygulanır; Mesafeli Sözleşmeler Yönetmeliği paket turları kapsamaz. Bu turlarda da 14 günlük cayma hakkı yoktur.
- Bunun yerine acentenin **iptal ve iade koşulları** geçerlidir (aşağıda özet, tam metin: rotakarsturizm.com/bilgilendirme#iptal):

{{iptal_kosullari_ozet}}

## 8. Turun devri (konaklamalı paket turlar)

Tura katılmanıza engel bir durum çıkarsa, tur başlangıcından en az 7 gün önce acenteye bildirerek yerinize turun koşullarını taşıyan başka birini gönderebilirsiniz. Devreden ve devralan, kalan bedelden ve devrin yol açtığı ek masraflardan birlikte sorumludur. Günübirlik turlarda yolcu adı değişikliği, kalkıştan önce acenteye bildirilerek ücretsiz yapılır. *[avukat: süre ve kapsam teyidi]*

## 9. Acentenin turu iptal etmesi veya değiştirmesi

- Asgari katılımcı sayısına ulaşılamazsa acente turu en geç {{tur.asgari_iptal_suresi}} *[doldurulacak: ör. kalkıştan 48 saat önce]* bildirerek iptal edebilir.
- Hava, yol, sınır kapısı kapanması, resmî karar gibi acentenin elinde olmayan sebeplerle tur yapılamazsa acente sizi derhâl bilgilendirir.
- Bu durumlarda dilerseniz başka bir tarihe aktarılır, dilerseniz **ödediğiniz tutarın tamamı kesintisiz iade edilir.**
- Turun esaslı bir unsuru (tarih, güzergâhın ana durakları, konaklama yeri, araç sınıfı) değişirse değişikliği kabul etmeyip sözleşmeden ücretsiz dönebilirsiniz.

## 10. Şikâyet ve uyuşmazlık

- Şikâyetlerinizi önce acenteye iletebilirsiniz: info@rotakarsturizm.com · 0474 223 65 44. Tur sırasında yaşanan sorunları rehbere veya acenteye hemen bildirmeniz çözümü kolaylaştırır.
- Ticaret Bakanlığı'nca her yıl belirlenen parasal sınırlar içinde **tüketici hakem heyetlerine**, bu sınırları aşan uyuşmazlıklarda **tüketici mahkemelerine** başvurabilirsiniz. Başvuru, yerleşim yerinizdeki veya işlemin yapıldığı yerdeki hakem heyetine yapılabilir; e-Devlet'teki TÜBİS üzerinden de başvurulabilir.
- Arabuluculuk: tüketici mahkemesinde dava açmadan önce, kanunda belirtilen hâllerde arabulucuya başvurmak dava şartıdır. *[avukat: güncel parasal sınırlar ve arabuluculuk şartı]*

## 11. Kişisel veriler

Kişisel verileriniz Kişisel Verilerin Korunması Aydınlatma Metni'nde açıklandığı şekilde işlenir: rotakarsturizm.com/bilgilendirme#kvkk

---

☐ **Ön Bilgilendirme Formu'nu ve iptal-iade koşullarını okudum. Online ödeme yaparsam rezervasyonun ödemeyle birlikte kesinleşeceğini; havale veya nakit ödemede ise sözleşmenin acente onayıyla kurulacağını biliyorum.**

Onay zamanı: {{onay.tarih_saat}} · IP: {{onay.ip}} *(kayıt için; e-postada gösterilmez)*
