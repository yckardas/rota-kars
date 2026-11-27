# Yarı 3D koltuk seçimi — tasarım

Tarih: 2026-11-26 · Kullanıcı isteği: araçların fotoğrafından koltuk planına animasyonlu geçiş ve
3D görünümde koltuk seçimi.

## Amaç ve neden

Müşteri koltuk seçerken yalnızca soyut bir plan görüyor. Aracın gerçek fotoğrafından kapıdan
içeri girip iç kabine, oradan aynı bakış açısıyla eğik bir koltuk planına geçen kısa bir animasyon,
"bu araca bineceğim" hissi veriyor ve VIP araç vaadini somutlaştırıyor. Deneme sayfaları
(`.impeccable/mocks/arac-3d/`) iki yolu gösterdi; kullanıcı **yarı 3D**'yi seçti ve **düz
görünüm** seçeneğinin kalmasını istedi (2026-11-26).

## Hedefler

1. Rezervasyon sayfasının koltuk adımında koltuk haritası varsayılan olarak yarı 3D (perspektifle
   eğik, kabarık koltuklu) görünür; "Düz görünüm" düğmesiyle bugünkü üstten plana geçilir. Seçim
   o cihazda hatırlanır.
2. Araç sınıfının fotoğrafları varsa, harita ekrana ilk girdiğinde dış fotoğraftan kapıya dalış →
   iç kabin → plan animasyonu bir kez oynar (~4 sn). "Atla" ve "Baştan oynat" düğmeleri olur.
3. Hareket azaltma tercihi açıksa animasyon oynamaz; plan doğrudan durağan hâlde gelir.
4. Fotoğrafı olmayan sınıflarda animasyon atlanır, plan doğrudan yarı 3D açılır.

## Hedef olmayanlar

- Gerçek 3D model (Three.js vb.). Denendi, kullanıcı yarı 3D'yi seçti.
- Panelden araç fotoğrafı yükleme: filo kodda tutuluyor; fotoğraflar koda eklenir.
- Panel ekranları (sefer, kapalı koltuk, yeni rezervasyon, tur operasyonları) ve ana sayfa
  önizlemesi: bugünkü düz harita aynen kalır.

## Kısıtlar

- Koltuklar bugünkü gibi `button`, aynı `aria-label` ve `aria-pressed` ile kalır; klavyeyle
  seçim değişmez. Mobilde sohbet düğmesini gizleyen görünürlük işareti korunur.
- Telefon önceliklidir: 375 px genişlikte 18 koltuklu araç tamamen sığar.
- Fotoğraflar webp, sayfa yükünü şişirmemek için harita ekrana yaklaşınca yüklenir.

## Yaklaşımlar

| Yol | Ne | Artı | Eksi |
|---|---|---|---|
| **Yarı 3D (seçilen)** | Fotoğraf geçişi + CSS perspektifle eğilen mevcut plan | Gerçek fotoğraflar, hafif, yeni araç için iki fotoğraf yeter | Gerçek 3D değil, döndürülemez |
| Gerçek 3D model | Three.js ile döndürülebilir araç, içinde 3D koltuklar | Gösterişli | Her araç için model, birkaç MB, ödeme öncesi adımda ağır |
| İç fotoğrafta tıklanır alanlar | Koltuklar doğrudan fotoğrafın üstünde | Tam gerçekçi | Arka sıralar öndekilerin arkasında kalıyor, araç başına elle işaretleme |

## Kararlar

- **Fotoğraflar sınıf bazında** (kullanıcı kararı): fotoğraf filo aracına değil araç sınıfına
  (`vehicleModels`: binek, vip-minibus, vip-midibus, midibus, coach) bağlanır. Sefere hangi
  araç atanmış olursa olsun o sınıfın fotoğrafı gösterilir. İlk fotoğraf: Sprinter/Crafter
  sınıfı (`vip-midibus`), kullanıcının gönderdiği görselden.
- Varsayılan görünüm yarı 3D; düz görünüm seçimi `localStorage`'da tutulur (erişilemezse
  varsayılan).

## Kurucuya bırakılanlar (Claude'un kararları)

- Fotoğraf alanı API'de `vehicle.photos = { exterior, interior }` olarak gelir; sefer, sınıfın
  fotoğrafını `vehicleModels`'tan alır. Sınıfı bilinmeyen eski kayıtlarda alan yoktur.
- Gönderilen iç fotoğrafta tekli koltuklar solda, plandaysa sağda. Sınıf fotoğrafı olduğu için
  plan değişmez; geçişte iç fotoğraf yatay aynalanarak plana uydurulur.
- Uzun araçlarda (Sultan 31, Travego 46) eğim azaltılır ve koltuk ölçüsü küçülür; plan sahnenin
  içinde kayar. Telefonda denenip ayarlanır.
- Animasyon araç başına ziyaret başına bir kez oynar; araç değişirse yeniden oynar.
