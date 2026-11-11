# Yasal metinler — taslaklar

> ⚖️ **Bu klasördeki hiçbir metin hukuki danışmanlık değildir.** Hepsi bir avukatın gözden geçirmesi için hazırlanmış taslaklardır.
>
> **11 Kasım 2026:** Acentenin isteğiyle metinler siteye bağlandı (aşağıda "Siteye bağlananlar"). Avukat incelemesi hâlâ önerilir; değişiklik olursa `server/legal.mjs` içindeki `LEGAL_VERSION` yükseltilir. Kanun ve yönetmelik maddelerine yapılan atıflar da avukatça doğrulanmalıdır. Belgede olmayan hiçbir bilgi eklenmedi; bilinmeyenler `[doldurulacak]`, avukata sorulacaklar `[avukat: …]` olarak işaretli.

| Dosya | İçerik |
|---|---|
| [00-sirket-bilgileri.md](00-sirket-bilgileri.md) | Belgelerden doğrulanmış şirket bilgileri tablosu, sitedeki tutarsızlıklar |
| [01-on-bilgilendirme-formu.md](01-on-bilgilendirme-formu.md) | Rezervasyonda gösterilecek ön bilgilendirme formu (dinamik alanlı) |
| [02-tur-hizmet-sozlesmesi.md](02-tur-hizmet-sozlesmesi.md) | Mesafeli satış + paket tur sözleşmesi (onay e-postasıyla gider) |
| [03-iptal-iade-kosullari.md](03-iptal-iade-kosullari.md) | Mevcut iptal metninin sorunları ve önerilen yeni metin |
| [04-kvkk-aydinlatma-metni.md](04-kvkk-aydinlatma-metni.md) | Mevcut /bilgilendirme ile karşılaştırma ve önerilen aydınlatma metni |
| [05-acik-riza-metni.md](05-acik-riza-metni.md) | Ticari ileti onayı, yapay zekâ asistanı açık rızası, başkası adına bilgi girme beyanı |
| [06-cerez-politikasi.md](06-cerez-politikasi.md) | Koddan çıkarılmış çerez listesi ve politika metni |
| [07-yasal-kunye.md](07-yasal-kunye.md) | Altbilgi ve İletişim sayfası için yasal künye |

## Avukata götürülecek öncelikli sorular

1. **Yurt dışına aktarım (KVKK md. 9, 1 Haziran 2024 değişikliği):** Railway, Cloudflare, Google (harita, giriş, Firebase), Meta, Apple, e-posta sağlayıcısı. Sürekli aktarımlar açık rızaya dayanamıyor; standart sözleşme ve Kurul'a bildirim gerekebilir. Sohbet asistanının (Anthropic) "arızi" sayılıp sayılmayacağı.
2. **Hangi mevzuat:** Günübirlik rehberli tur Mesafeli Sözleşmeler Yönetmeliği'ne mi, yoksa "yolcu taşıma" istisnasına mı girer? Konaklamalı Van turu paket tur; Paket Tur Sözleşmeleri Yönetmeliği'nin zorunlu içeriği sözleşmede eksiksiz mi?
3. **Cayma hakkı istisnası** (md. 15/1-g) ifadesi doğru mu?
4. **İptal kesinti oranları** ve gelmeme kuralı: makul ve "haksız şart" sayılmayacak düzey.
5. **İYS** kaydı ve ticari ileti onaylarının saklama süresi.
6. **VERBİS** kayıt yükümlülüğü (çalışan sayısı ve bilanço eşiğine göre muafiyet).
7. **U-ETDS** yolcu bildiriminin dayanak mevzuatı (madde numarası) ve kimlik numaralarının tur tarihinden 1 yıl sonra silinmesinin yeterli olup olmadığı.
8. **Yol arkadaşlarım:** üyenin, rezervasyon yapmadan aile/arkadaşlarının kimlik bilgilerini saklamasının hukuki dayanağı; 18 yaş altı kişiler.
9. **Online ödeme ile otomatik onay:** sözleşmenin kurulma anı, son dakika rezervasyonlarında iptal hakkı, ödeme kuruluşunun veri sorumlusu/veri işleyen rolü.
10. **Şoför ve rehber verileri:** U-ETDS'ye bildirilen T.C. no, ad, cinsiyet ve telefon için müşteri aydınlatma metni değil, ayrı bir **çalışan aydınlatma metni** gerekir (bu klasörde yok).
11. **İngilizce sürüm (/en):** yabancı turistler için aydınlatma metni, çerez politikası ve iptal koşullarının İngilizce özeti; hangi dilin bağlayıcı olduğu.
12. **Şans çarkı:** Her dilim bir indirim (boş dilim yok), nakit veya eşya ödülü yok, katılım ücretsiz ve satın alma şartı yok; çevirmek için üyelik de gerekmiyor, kullanmak için gerekiyor. Bunun Milli Piyango İdaresi iznine tabi bir "çekiliş / ikramiyeli kampanya" değil, indirim kampanyası sayıldığını teyit edin. Ağırlıklı şanslar sitede yazılı.

## Acenteden beklenen bilgiler

- Yurt içi 3 gün / yurt dışı 5 gün süresi geçtikten sonraki kesinti ve gelmeme kuralı.
- Kalan bakiyenin son ödeme zamanı; asgari katılımcı sayısı ve iptal bildirim süresi (her tur için).
- Havale bilgileri (banka, IBAN, hesap sahibi).
- Zorunlu koltuk ferdi kaza sigortası poliçe bilgisi.
- Railway sunucu bölgesi ve e-posta (SMTP) sağlayıcısı.
- Ödeme kuruluşu seçimi (iyzico / PayTR / diğer) ve komisyonun iadede kesilip kesilmeyeceği.
- Son dakika online ödemelerinde iptal kuralı.
- İYS kaydı var mı; SMS gönderilecek mi?

## Siteye bağlananlar (11 Kasım 2026, sürüm 2026-11)

Acentenin kararları: süre sonrası iptalde **yalnız kapora** kesilir; **gelmemede** ödenen tutar iade edilmez; kalan bakiye **tur günü hareketten önce** ödenir; ticari ileti onayı **e-posta ve SMS**'i kapsar.

| Ne | Nerede |
|---|---|
| Künye (unvan, MERSİS, vergi, sicil, oda, KEP) | `server/catalog.mjs` → `business`; altbilgi, `/iletisim#kunye` |
| Aydınlatma metni, çerez politikası, iptal-iade, sözleşme özeti, açık rıza metinleri | `/bilgilendirme` (`#kvkk`, `#cerez`, `#iptal`, `#sozlesme`, `#acik-riza`, `#asistan`, `#uyelik`); İngilizcede üstte kısa özet |
| Kişiye özel ön bilgilendirme formu ve tur hizmet sözleşmesi | `server/legal.mjs`; rezervasyon 3. adımında gösterilir, onay anında kayda yazılır (`pre_info_text`, `legal_version`, `pre_info_accepted_at`), oluşturma e-postasına eklenir; onayda sözleşme kurulur (`contract_text`) ve onay e-postasıyla gider; Rezervasyonum'da "Belgeleriniz" |
| Onay kutuları | Rezervasyon: ön bilgilendirme + sözleşme + iptal (zorunlu), diğer yolcular beyanı (2+ yolcuda zorunlu), ticari ileti (isteğe bağlı). Üyelik: koşullar (zorunlu), ticari ileti (isteğe bağlı). Yol arkadaşı ekleme: beyan (zorunlu, sunucuda da denetlenir). Talep formu: aydınlatma okundu. Sohbet asistanı: risk bilgisi eklenmiş açık rıza |
| Onay kayıtları | `consents`: `kvkk_notice`, `pre_info`, `others_declaration`, `marketing`; sürüm `2026-11`, e-posta yalnız karma olarak |
| Google Haritalar | Tıklayınca yüklenir |
| Kart verisi metni | Taslaktaki "sunucumuza ulaşmaz" ifadesi Vakıfbank modeline uymadığı için düzeltildi: kart sitedeki formda girilir, bankaya iletilir, 3D süresince bellekte şifreli tutulur, veritabanına yazılmaz |

Anonimleştirmede (üye silme, KVKK silme) `pre_info_text` ve `contract_text` da temizlenir; sürüm ve onay zamanı kalır.

## Hâlâ açık olanlar

- **Avukat incelemesi** (yukarıdaki 11 soru), özellikle yurt dışı aktarımlar için KVKK md. 9 güvenceleri (standart sözleşme ve Kurul'a bildirim).
- **İYS kaydı:** kampanya e-postası/SMS'i göndermeden önce. Gönderim altyapısı kurulurken iletilere ret bağlantısı eklenmeli; Hesabım'da onayı geri alma düğmesi henüz yok.
- **Asgari katılımcı sayısı** ve acentenin iptal bildirim süresi her tur için belirlenmedi; metinler süre vermeden "hemen bilgilendiririz" diyor.
- **Havale bilgileri (IBAN)** sitede yok; metin "acentenin bildireceği hesap" diyor.
- **Sigorta poliçe bilgisi**, **e-posta sağlayıcısı ve ülkesi**, **Railway bölgesi** metinlerde genel ifadeyle geçiyor.
- **Çalışan aydınlatma metni** (şoför ve rehber verileri, U-ETDS) yazılmadı.

## Siteye bağlama (onaydan sonra, tasarım işi bittiğinde)

1. `server/catalog.mjs` → `business` alanlarına künye bilgileri, `cancellationPolicy` ve `features[1]` güncellemesi.
2. Online ödeme, kimlik bilgisi ve yol arkadaşları özellikleri canlıya çıkmadan önce aydınlatma metni güncellenmiş olmalı (veri toplanmaya başlamadan önce aydınlatma yapılmalı).
3. `/bilgilendirme` sayfası: aydınlatma, çerez, iptal, sözleşme, kampanya kuralları ayrı bölümler; mevcut çapalar (`#kvkk`, `#iptal`, `#haklar`) korunur.
4. Rezervasyon 3. adım: ön bilgilendirme formu özeti + "okudum" kutusu; formun metni ve onay zamanı rezervasyon kaydına yazılır.
5. Acente onayı e-postasına sözleşme ve ön bilgilendirme formu eklenir.
6. Google Haritalar ve Instagram gömmeleri "tıklayınca yükle" olur.
7. Altbilgi ve İletişim sayfasına künye.
