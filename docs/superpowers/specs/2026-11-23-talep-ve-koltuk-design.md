# Tur bilgi talebi, panelden koltuk kapatma, özel talep kartı — tasarım

Müşteri (acente) isteği, 22-23.11.2026. Kullanıcı tasarımı onayladı ("Çok iyi mükemmel devam").

## 1. Tur sayfasından gelen bilgi/fiyat talebi
- **Neden:** Sarıkamış sayfasından "Bu tur için bilgi alın" diyen müşterinin talebi panele "Özel tur talebi" olarak düşüyor; acente hangi tur için arandığını göremiyor.
- **Ne:** Yeni talep türü `tour-info` ("Tur bilgi / fiyat talebi"). Tur sayfası formu bu türle ve `tourId` ile açar. Form başlığı "{tur} için bilgi ve fiyat", panel kartı ve acente e-postası "Tur bilgi / fiyat talebi · {tur}".
- Sunucu `tourId`'yi zaten kabul ediyor; form şimdiye dek yalnız konaklamada gönderiyordu. `tour-info` için `tourId` zorunlu.
- Panel filtresine yeni tür eklenir. Eski kayıtlar değişmez.

## 2. Panelden koltuk kapatma (telefonla alınan rezervasyon)
- **Neden:** Telefonda satılan koltuğun sitede satışa açık kalmaması; yolcu adı, kimlik, ödeme tutarı ve şekli sisteme girilsin.
- **Mevcut:** Rezervasyonlar ekranında "Yeni rezervasyon" formu (sefer, koltuk, yolcu adları, ödeme şekli/tutarı/yöntemi) var. Eksik: kimlik (uyruk, T.C./pasaport, cinsiyet) ve bulunabilirlik.
- **Ne:**
  - Forma her yolcu için uyruk / T.C.-pasaport / cinsiyet alanları. **İsteğe bağlı** (kullanıcı onayladı): boş bırakılan yolcu "kimlik eksik" kalır. Doldurulan T.C. numarası doğrulanır.
  - Sunucu: `passengerDetails` dizisinde boş (null) girdiye izin; pii seal/open null girdiyi korur. U-ETDS zaten `missingIds` ile eksikleri gösteriyor.
  - Rezervasyon kartındaki "Yolcu adları" sekmesi "Yolcular" olur ve kimlikler sonradan tamamlanabilir (`/passengers` uç noktası isteğe bağlı `details` alır).
  - Kartta kimliği eksik koltuklar işaretlenir.
  - Bulunabilirlik: Seferler tablosunda her sefere "Koltuk kapat" düğmesi; aynı formu o sefer seçili açar. Rezervasyonlar ekranındaki düğme "Koltuk kapat / rezervasyon" olur.
- **Kapsam dışı:** Yolcusuz "boş koltuk bloke etme" (acente kararı: bilgi her zaman girilsin).

## 3. "Bir sonraki rotanız" sonunda özel talep kartı
- **Neden:** Listede olmayan bir yere (ör. tek başına Ağrı) gitmek isteyen kişi doğrudan bireysel talep bırakabilsin.
- **Ne:** Turlar sayfasının (ve boş arama sonucunun) altına "Aradığınız rota burada yok mu?" kartı → "Özel tur ve hizmet talebi" düğmesi → mevcut `private-tour` formu. Arama metni varsa nota önden yazılır. Sitenin renkli bant diline uyar; İngilizce çevirisi eklenir.

## Yaklaşımlar
- 1 için ayrı tür (seçildi) vs. `private-tour` + `tourId`: ayrı tür panelde filtrelenebilir ve "özel tur" etiketi tamamen kalkar.
- 2 için mevcut formu genişletmek (seçildi) vs. ayrı "koltuk bloke" kaydı: ayrı kayıt U-ETDS ve tahsilatı bypass eder; acente bilgilerin girilmesini istiyor.
