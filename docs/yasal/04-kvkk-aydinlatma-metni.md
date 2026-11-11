# Kişisel Verilerin Korunması Aydınlatma Metni

> **Taslak — avukat onayı gerekiyor.** 6698 sayılı KVKK md. 10 ve Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ esas alındı.

## Mevcut /bilgilendirme metniyle karşılaştırma

Mevcut metin (`src/pages/OtherPages.tsx` → `Information`) iyi bir temel: veri kategorileri, amaçlar, hukuki sebepler, saklama süreleri ve md. 11 hakları doğru kurulmuş. Eksik ya da düzeltilmesi gerekenler:

| # | Konu | Mevcut | Öneri |
|---|---|---|---|
| 1 | Veri sorumlusu | "Rota Kars Turizm" | Tam ticaret unvanı, MERSİS ve KEP yazılmalı. "Rota Kars Turizm" işletme belgesindeki acenta unvanı, tüzel kişinin adı değil. |
| 2 | Toplama yöntemi | Yok | Tebliğ "kişisel veri toplamanın yöntemi"ni zorunlu sayıyor. Eklendi (site formları, telefon/WhatsApp, ofis, araç). |
| 3 | **Yurt dışına aktarım** | Yalnız Anthropic (ABD) yurt dışı olarak anılıyor | Railway (barındırma), Cloudflare (Turnstile), Google (harita, giriş, Firebase bildirimleri), Meta (Instagram gömme, Facebook girişi), Apple (giriş) ve e-posta sağlayıcısı büyük olasılıkla yurt dışında. 7499 sayılı Kanunla değişen KVKK md. 9 (1 Haziran 2024'ten beri) uyarınca **sürekli aktarımlar açık rızaya dayandırılamaz**; standart sözleşme imzalanıp 5 iş günü içinde Kurul'a bildirilmesi gibi uygun güvenceler gerekir. **Avukatla en öncelikli konu bu.** |
| 4 | Çerez cümlesi | "Reklam veya izleme çerezi kullanılmaz" | Sitenin kendi çerezleri için doğru; ancak sayfaya gömülü **Google Haritalar** ve **Instagram** çerçeveleri ile **Cloudflare Turnstile** üçüncü taraf çerezi/cihaz verisi işleyebilir. Ayrıntı `06-cerez-politikasi.md`'de. |
| 5 | Teknik veriler | Yok | IP adresi, onay kayıtları, oturum ve güvenlik kayıtları işleniyor (Turnstile, hız sınırı, denetim kaydı). Eklendi. |
| 6 | Sosyal giriş | Yok | Google / Facebook / Apple ile girişte alınan ad, e-posta ve hesap kimliği eklendi. |
| 7 | Yolcu listesi bildirimi | "Turizm mevzuatından doğan kayıtlar" | **Yeni özellik (geliştiriliyor):** rezervasyonda her yolcunun uyruğu, T.C. kimlik / pasaport numarası ve cinsiyeti alınıyor ve U-ETDS'ye bildiriliyor. Kategori, amaç, alıcı (Ulaştırma ve Altyapı Bakanlığı) ve ayrı saklama süresi metne eklendi. |
| 8 | Başvuru yolu | Yalnız e-posta | Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ: yazılı başvuru, KEP, güvenli elektronik imza veya sistemde kayıtlı e-posta. Eklendi. |
| 9 | Personel bildirimleri | Yok | Yeni rezervasyon bildirimleri müşteri adıyla ekip telefonlarına Firebase (Google) üzerinden iletiliyor. Aktarım listesine eklendi. |
| 10 | Sayfa yapısı | KVKK, iptal, üyelik, kampanya, asistan, Google yorumları aynı sayfada | Aydınlatma metni ayrı ve sade kalmalı; iptal-iade, kampanya kuralları ve çerez politikası ayrı başlık/sayfa olmalı. Öneri: `/bilgilendirme` bir dizin sayfası, altında `#kvkk`, `#cerez`, `#iptal`, `#sozlesme`, `#kampanya` bölümleri (mevcut bağlantılar bozulmasın diye çapalar korunur). |
| 11 | Online ödeme | "Kart bilgisi alınmaz" | **Yeni özellik:** kapora online ödenebilecek; kart bilgisi ödeme kuruluşunun sayfasında girilir, bize ulaşmaz. Ödeme kuruluşu aktarım listesine eklendi `[doldurulacak: iyzico / PayTR / diğer]`. |
| 12 | Yol arkadaşlarım | Yok | **Yeni özellik:** üyeler aile ve arkadaşlarının kimlik bilgilerini kaydedebiliyor. Başkasının verisini girenin o kişiyi bilgilendirmesi gerektiği metne eklendi; ayrıca kayıt anında bir teyit kutusu öneriliyor (`05-acik-riza-metni.md` §3). |
| 13 | Şifreleme ve maskeleme | Yok | Kimlik numaralarının şifreli saklandığı ve belgelerde maskeli gösterildiği eklendi; güven veren ve doğru bir bilgi. |

---

## Önerilen metin

### 1. Veri sorumlusu

6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca kişisel verileriniz, veri sorumlusu sıfatıyla **Rota Kars Turizm Taşımacılık Seyahat Acentası Limited Şirketi** ("Rota Kars Turizm") tarafından aşağıda açıklanan şekilde işlenir.

- Adres: Yeni Mah. Cumhuriyet Cad. Köşk Apt. No: 26 İç Kapı No: 13, Merkez / Kars
- MERSİS: 0735187296600001
- E-posta: info@rotakarsturizm.com · KEP: rotakarsturizm@hs01.kep.tr
- Telefon: 0474 223 91 63

### 2. Hangi kişisel verileri işliyoruz

| Kategori | Veriler | Kimden |
|---|---|---|
| Kimlik | Ad soyad; yolcuların adı soyadı, uyruğu, cinsiyeti, T.C. kimlik numarası (T.C. vatandaşları) veya pasaport numarası (yabancılar) | Rezervasyonu yapan kişi |
| İletişim | E-posta, telefon | Siz |
| Müşteri işlem | Tur, tarih, koltuk, tutar, kapora, tahsilat ve iade kayıtları, online ödemede ödeme kuruluşunun ilettiği işlem sonucu ve referansı (kart numarası değil), rezervasyon notları, iptal talepleri, bilet ve biniş kayıtları | Siz, acente ve ödeme kuruluşu |
| Talep | Konaklama, araç kiralama ve özel tur formlarına yazdıklarınız | Siz |
| Üyelik | Hesap bilgileri, güvenli özetlenmiş parola, kupon ve davet kayıtları; sosyal girişte sağlayıcının ilettiği ad, e-posta ve hesap kimliği; "Yol arkadaşlarım" bölümüne kaydettiğiniz en çok 10 kişinin adı, uyruğu, cinsiyeti ve kimlik / pasaport numarası | Siz / Google, Facebook, Apple |
| İşlem güvenliği | IP adresi, tarayıcı bilgisi, oturum kayıtları, bot doğrulama sonucu, onay kayıtlarının zamanı | Otomatik |
| Pazarlama | Ticari elektronik ileti izniniz ve izin tarihi | Siz (isteğe bağlı) |

Kart bilgileriniz ödeme kuruluşunun güvenli sayfasında girilir; sunucumuza ulaşmaz, tarafımızca görülmez ve saklanmaz. T.C. kimlik ve pasaport numaraları veritabanımızda şifrelenmiş olarak tutulur; size gönderilen bilet ve belgelerde yalnız son 3 hanesi, rehberimizin uygulamasında yalnız son 4 hanesi görünür.

**Başkası adına bilgi verirseniz:** Rezervasyonda diğer yolcuların veya "Yol arkadaşlarım" bölümünde aile ve arkadaşlarınızın bilgilerini girdiğinizde, bu kişileri bilgilendirdiğinizi ve bilgilerini paylaşmaya yetkili olduğunuzu kabul etmiş olursunuz. Bu metni onlarla paylaşmanızı rica ederiz. 18 yaşından küçük yolcuların bilgileri veli veya vasileri tarafından girilmelidir. `[avukat]` Özel nitelikli kişisel veri (sağlık, din vb.) talep etmiyoruz; özel bir ihtiyacınızı (ör. erişilebilirlik) bildirirseniz yalnız o hizmet için kullanırız. `[avukat: sağlık bilgisi bildirilirse açık rıza gerekip gerekmediği]`

### 3. Toplama yöntemi

Verileriniz; sitemizdeki rezervasyon, üyelik, talep ve iletişim formları, telefon, WhatsApp ve e-posta görüşmeleri, ofisimizde ve tur sırasında yapılan işlemler aracılığıyla, kısmen otomatik (site formları ve güvenlik kayıtları) ve otomatik olmayan (telefon, ofis) yollarla toplanır.

### 4. Amaçlar ve hukuki sebepler

| Amaç | Hukuki sebep (KVKK md. 5) |
|---|---|
| Ön rezervasyonun alınması, onaylanması; turun, konaklamanın ve transferin sunulması; bilet, yolcu ve koltuk listelerinin hazırlanması; ödeme ve iadelerin takibi; üyelik hesabının yönetimi | Sözleşmenin kurulması ve ifası (5/2-c) |
| Fatura, muhasebe kayıtları; yetkili kurumların talepleri | Hukuki yükümlülük (5/2-ç), kanunlarda açıkça öngörülme (5/2-a) |
| Turizm taşımacılığında yolcu listesinin (ad soyad, uyruk, T.C. kimlik / pasaport no, cinsiyet) Ulaştırma Elektronik Takip ve Denetim Sistemi'ne (U-ETDS) bildirilmesi | Hukuki yükümlülük (5/2-ç) `[avukat: dayanak mevzuat — Karayolu Taşıma Yönetmeliği ve U-ETDS düzenlemesi — madde numarasıyla yazılmalı]` |
| Online kapora ödemesinin alınması, ödemenin rezervasyonla eşleştirilmesi ve iadeler | Sözleşmenin kurulması ve ifası (5/2-c) |
| Üyenin kaydettiği yol arkadaşı bilgilerinin sonraki rezervasyonlarda hazır gelmesi | Sözleşmenin ifası (5/2-c) — üyelik hizmeti `[avukat: kayıtlı kişi açısından dayanak; meşru menfaat veya açık rıza mı?]` |
| Hukuki uyuşmazlıklarda hakların korunması | Bir hakkın tesisi, kullanılması veya korunması (5/2-e) |
| Site güvenliği, kötüye kullanımın ve sahte kayıtların önlenmesi, yönetici işlemlerinin denetim kaydı, müşteri şikâyetlerinin takibi | Meşru menfaat (5/2-f) |
| Kampanya ve yeni rotalar hakkında e-posta/SMS gönderimi | Açık rıza (5/1) ve 6563 sayılı Kanun kapsamında ticari elektronik ileti onayı |

### 5. Kimlere aktarıyoruz

**Yurt içinde:**
- **Ulaştırma ve Altyapı Bakanlığı (U-ETDS)** — her sefer öncesinde yolcu listesi: ad soyad, uyruk, T.C. kimlik / pasaport no, cinsiyet. Aynı bildirimde araç şoförü ve rehberin bilgileri de yer alır.
- Diğer yetkili kamu kurum ve kuruluşları (vergi idaresi, Kültür ve Turizm Bakanlığı, emniyet, yargı mercileri) — mevzuatın gerektirdiği hâllerde ve ölçüde.
- Ödeme kuruluşu `[doldurulacak: iyzico / PayTR / diğer]` — online ödemenin alınması ve iadesi için tutar, rezervasyon numarası, ad soyad, e-posta ve telefon. Kart bilgilerinizi ödeme kuruluşu kendi sayfasında doğrudan sizden alır ve kendi aydınlatma metnine göre işler.
- Konaklamalı turlarda otel ve tesisler — yalnız konaklama için gereken ad ve tarih bilgisi.
- Sigorta şirketi — zorunlu sigorta kapsamında. `[doldurulacak]`
- Muhasebe ve hukuk danışmanlarımız — sır saklama yükümlülüğü altında.

**Yurt dışında (hizmet sağlayıcılar):** `[avukat: her biri için md. 9 dayanağı belirlenmeli]`

| Sağlayıcı | Ne için | Ülke |
|---|---|---|
| Railway | Sitenin ve veritabanının barındırılması, dosya depolama | `[doldurulacak: Railway'deki bölge — ABD veya AB]` |
| Cloudflare | Formlarda bot doğrulaması (Turnstile) | ABD / küresel |
| Google | Harita gösterimi, Google ile giriş, ekip telefonlarına anlık bildirim (Firebase) | ABD |
| Meta | Instagram gönderisi gösterimi, Facebook ile giriş | ABD |
| Apple | Apple ile giriş | ABD |
| E-posta sağlayıcısı | Rezervasyon, doğrulama ve bildirim e-postaları | `[doldurulacak: SMTP sağlayıcısı ve ülkesi]` |
| Anthropic | Yalnız sohbet asistanında, sohbet penceresinde açık rıza vermeniz hâlinde, yerel asistanın yanıtlayamadığı soru metni (onay, siz geri alana kadar o tarayıcıda geçerli kalır) | ABD |

### 6. Saklama süreleri

| Kayıt | Süre |
|---|---|
| T.C. kimlik / pasaport numaraları | Tur tarihinden **1 yıl** sonra otomatik silinir (uyruk ve cinsiyet rezervasyon kaydıyla birlikte saklanır) `[avukat: U-ETDS ve vergi denetimi açısından 1 yıl yeterli mi]` |
| Ödemesiz ön rezervasyonlar | 1 yıl |
| Ödemeli rezervasyon, tahsilat ve fatura kayıtları | 10 yıl (Vergi Usul Kanunu, Türk Ticaret Kanunu) |
| Konaklama ve özel tur talepleri | 2 yıl |
| Gönderilmiş bildirimler | 90 gün |
| Üyelik hesabı | Hesap silinene kadar; silindikten sonra yasal saklama gerektiren kayıtlar hariç |
| Yol arkadaşlarım kayıtları | Siz silene veya hesabınız silinene kadar; Hesabım'daki veri dökümüne dahildir |
| Ticari elektronik ileti onayı ve ret kayıtları | `[avukat: Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik'teki süre]` |
| Güvenlik kayıtları | `[doldurulacak]` |

Süresi dolan kayıtlar silinir, yok edilir veya anonim hâle getirilir.

### 7. Haklarınız (KVKK md. 11)

Kişisel verilerinizin işlenip işlenmediğini öğrenme; işlenmişse bilgi talep etme; işlenme amacını ve amaca uygun kullanılıp kullanılmadığını öğrenme; yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme; eksik veya yanlış işlenmişse düzeltilmesini isteme; md. 7 çerçevesinde silinmesini veya yok edilmesini isteme; düzeltme ve silme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme; münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonucun ortaya çıkmasına itiraz etme; kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın giderilmesini talep etme haklarına sahipsiniz.

### 8. Başvuru

Başvurunuzu; kimliğinizi gösteren bilgilerle birlikte
- yazılı olarak yukarıdaki adresimize,
- KEP adresimize (rotakarsturizm@hs01.kep.tr),
- güvenli elektronik veya mobil imzalı olarak ya da daha önce bize bildirdiğiniz ve sistemimizde kayıtlı e-posta adresinizden info@rotakarsturizm.com adresine

iletebilirsiniz. Başvurular en geç 30 gün içinde ücretsiz sonuçlandırılır; işlemin ayrıca bir maliyet gerektirmesi hâlinde Kurul'un belirlediği tarife uygulanabilir. Üyelerimiz Hesabım sayfasından verilerinin bir kopyasını indirebilir veya hesaplarını silebilir.

*Son güncelleme: [doldurulacak]*
