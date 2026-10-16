# Rota Kars tasarım yönü

Yerel kültürü tanıyan, az kişilik araçlarla yolculuk düzenleyen bir acentenin sitesi. Eski uygulama demosundan bağımsız, yeni müşteri sitesinin yerel geliştirme projesi.

## Görsel sistem

Kar beyazı #F8FAFA, bazalt lacivert #183847, açık gökyüzü #EAF1F4, logo altını #A87835, koyu metin #21323B. Altın renk yalnızca marka ve küçük vurgularda; ana eylemler lacivert. Büyük başlıklar Marcellus, arayüz ve metinler Onest. Başlıklarda seçili kelimeyi italik veya renkle öne çıkarma yok.

Yerleşim: tam genişlikte Ani manzarası, sessiz beyaz üst menü, manzaranın altında yolculuk araması. Ardından seçilmiş tur fotoğrafları, kısa destinasyon hikâyeleri, gerçek VIP araç yerleşimi, konaklama talebi ve sayfanın sonunda Google yorumları. Metinler sola hizalı, rota tanıtımı resim ağırlıklı. Aynı boy kutulardan oluşan bir ana sayfa yerine değişen görüntü ve metin oranları.

İlk tasarım incelemesi: önceki yeşil/turuncu uygulama paletinin yerine kar/bazalt/altın seçildi. Bu, firmanın altın logotipine ve Kars'ın taş mimarisine dayanır. Google puanı ve yorumlar yalnızca Google Haritalar'daki gerçek verilerden gelir; otel adı veya doğrulanmamış ortaklık eklenmez. Oteller listesi gelene kadar konaklama talebi kullanılır. API bağlantısı yokken Google puanı veya örnek övgü gösterilmez.

## Araç

18 yolcu + 1 sürücü koltuğu (18+1 VIP midibüs). Şoför yanındaki ön koltuk varsayılan olarak rehbere ayrılır ve satışa kapalıdır. 17 satış koltuğu: ilk sıra 2 koltuk + kapı, ardından beş adet 2+1 sıra. Fiziksel sıra yerleşimi varsayımdır; gerçek araç fotoğrafıyla teyit edilir ve `server/catalog.mjs` içindeki `vehicle.layout` ile değiştirilebilir. Kapasite ve rehber kısıtı hem istemci hem sunucuda uygulanır.
