---
name: Rota Kars (halka açık site)
description: Eski çok görüntülü Kars hatıra kartı; kar zemini, beyaz kart kartonu, mavi-siyah mürekkep, uçak postası kırmızısı.
colors:
  snow: "#e9eef1"
  card: "#ffffff"
  card-press: "#eef2f5"
  ink: "#1a2846"
  ink-2: "#47536e"
  rule: "#c9d2dc"
  hair: "#e3e8ee"
  paper: "#f3f6f8"
  sky: "#e3e9ee"
  stamp: "#e6ecf1"
  red: "#c2342b"
  red-deep: "#9f271f"
  gold: "#8a6128"
  logo-gold: "#a87835"
  rating-star: "#b9862f"
  scrim: "rgba(12, 20, 38, 0.6)"
  scrim-deep: "rgba(12, 20, 38, 0.82)"
  band-shade: "rgba(0, 0, 0, 0.55)"
  mask-opaque: "#000"
typography:
  display:
    fontFamily: "Marcellus, Georgia, serif"
    fontSize: "clamp(40px, 5.2vw, 76px)"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "-0.01em"
  display-phone:
    fontFamily: "Marcellus, Georgia, serif"
    fontSize: "38px"
    fontWeight: 400
    lineHeight: 1.02
  page-title:
    fontFamily: "Marcellus, Georgia, serif"
    fontSize: "clamp(40px, 5vw, 64px)"
    fontWeight: 400
    lineHeight: 1.16
    letterSpacing: "-1.8px"
  booking-title:
    fontFamily: "Marcellus, Georgia, serif"
    fontSize: "clamp(38px, 4.4vw, 56px)"
    fontWeight: 400
  headline:
    fontFamily: "Marcellus, Georgia, serif"
    fontSize: "clamp(34px, 3.6vw, 50px)"
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: "-0.5px"
  booking-headline:
    fontFamily: "Marcellus, Georgia, serif"
    fontSize: "clamp(28px, 2.8vw, 36px)"
    fontWeight: 400
    letterSpacing: "-0.3px"
  back-headline:
    fontFamily: "Marcellus, Georgia, serif"
    fontSize: "clamp(28px, 2.6vw, 34px)"
    fontWeight: 400
  band-headline:
    fontFamily: "Marcellus, Georgia, serif"
    fontSize: "clamp(24px, 2.6vw, 34px)"
    fontWeight: 400
  price-stamp:
    fontFamily: "Marcellus, Georgia, serif"
    fontSize: "40px"
    fontWeight: 400
  price-total:
    fontFamily: "Marcellus, Georgia, serif"
    fontSize: "36px"
    fontWeight: 400
  price-total-compact:
    fontFamily: "Marcellus, Georgia, serif"
    fontSize: "30px"
    fontWeight: 400
  seat-heading:
    fontFamily: "Marcellus, Georgia, serif"
    fontSize: "28px"
    fontWeight: 400
  price:
    fontFamily: "Marcellus, Georgia, serif"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 1
    fontFeature: "tnum"
  ribbon:
    fontFamily: "Marcellus, Georgia, serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1
  title:
    fontFamily: "Marcellus, Georgia, serif"
    fontSize: "21px"
    fontWeight: 400
  field-value:
    fontFamily: "Marcellus, Georgia, serif"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.3
  intro:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 400
  lead:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.75
  section-body:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.7
  card-title:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  body-small:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  caption:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  label:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 400
  micro:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.08em"
rounded:
  none: "0px"
  label: "2px"
  chip: "3px"
  sm: "4px"
  card: "5px"
  round: "999px"
spacing:
  view-gap: "10px"
  view-gap-phone: "6px"
  card-pad: "14px"
  card-pad-phone: "8px"
  frame-pad: "12px"
  strip-gap: "26px"
  form-gap: "36px"
  container-gutter: "56px"
  section: "92px"
  summary-column: "340px"
components:
  button-primary:
    backgroundColor: "{colors.red}"
    textColor: "{colors.card}"
    rounded: "{rounded.sm}"
    padding: "14px 24px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.red-deep}"
    textColor: "{colors.card}"
  button-small:
    backgroundColor: "{colors.red}"
    textColor: "{colors.card}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
    height: "42px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  button-outline-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card}"
  button-white:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  button-white-hover:
    backgroundColor: "{colors.card-press}"
    textColor: "{colors.ink}"
  filter-chip:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  filter-chip-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card}"
  postcard:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
    padding: "14px"
  title-band:
    backgroundColor: "{colors.red}"
    textColor: "{colors.card}"
    typography: "{typography.display}"
    rounded: "{rounded.none}"
    padding: "13px 28px 16px 30px"
  inset-label:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.label}"
    padding: "7px 10px 6px"
  caption-field:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.field-value}"
    rounded: "{rounded.none}"
    height: "44px"
  tour-card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.sm}"
    padding: "10px 10px 0"
  tour-ribbon:
    backgroundColor: "{colors.red}"
    textColor: "{colors.card}"
    typography: "{typography.ribbon}"
    rounded: "{rounded.none}"
    padding: "9px 14px 10px"
  back-of-card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
    padding: "44px 48px 30px"
  ruled-strip:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
    padding: "22px 6px"
  service-cell-hover:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.chip}"
  story-postcard:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.sm}"
    padding: "8px"
  photo-frame:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.sm}"
    padding: "12px"
  vip-back:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
    padding: "52px 56px"
  private-band:
    backgroundColor: "{colors.red}"
    textColor: "{colors.card}"
    typography: "{typography.band-headline}"
    rounded: "{rounded.none}"
    padding: "12px 26px 14px 34px"
  map-fallback:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "24px 28px"
  chat-button:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card}"
    rounded: "{rounded.round}"
    padding: "0 17px"
    height: "58px"
  booking-step:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.round}"
    size: "28px"
  booking-step-current:
    backgroundColor: "{colors.card}"
    textColor: "{colors.red}"
  booking-step-complete:
    backgroundColor: "{colors.red}"
    textColor: "{colors.card}"
  booking-form-card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
    padding: "36px 40px 32px"
  booking-field:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "48px"
  seat-selected:
    backgroundColor: "{colors.red}"
    textColor: "{colors.card}"
  booking-summary:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.sm}"
    padding: "10px"
  summary-ribbon:
    backgroundColor: "{colors.red}"
    textColor: "{colors.card}"
    typography: "{typography.field-value}"
    rounded: "{rounded.none}"
    padding: "8px 12px 9px"
  booking-mini:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.sm}"
    padding: "8px 14px 8px 8px"
---

# Design System: Rota Kars (halka açık site)

Bu dosya halka açık siteyi (ana sayfa, tur listesi, tur detayı, rezervasyon) anlatır. Acente paneli (`/yonetim`, `.rk-admin`) ayrı bir dünyadır ve `docs/DESIGN-PANEL.md` dosyasında tanımlıdır. Önceki halka açık görünüm (kar beyazı / bazalt lacivert / altın, lacivert düğmeler) git dalı `yedek/mevcut-site-tasarimi` içinde saklıdır.

## Overview

**Creative North Star: "Hatıra Kartı" (çok görüntülü Kars kartpostalı)**

Site, eski usul çok görüntülü bir Kars hatıra kartı gibi kurulur: bir büyük manzara, yanında küçük manzaralar, fotoğrafın üstüne binen kırmızı başlık şeridi ve altta beyaz bir açıklama bandı. Kart, kar renginde soğuk açık bir zeminin üstünde 14px beyaz kenarlı bir karton olarak durur; yumuşak, aşağı düşen bir gölgeyle kâğıt gibi kalkar. Tur sayfaları kartın arka yüzüdür: program tek kesintisiz kırmızı rota çizgisinde okunur, fiyat dişli kenarlı bir pul ve üstüne vurulmuş bir posta damgasıyla gösterilir. Rezervasyon da aynı masada sürer: adımlar bir rota çizgisi üstündeki duraklardır, form kartın arka yüzüdür, özet tek görüntülü küçük bir hatıra kartıdır.

Dünyanın tüm stilleri `src/postcard.css` içinde, `.kp` kapsayıcısıyla sınırlıdır (`Layout.tsx` halka açık sayfaları `.kp` ile sarar). Bu dosya aynı zamanda `src/styles.css` içindeki eski site jetonlarını (`--navy`, `--ink`, `--muted`, `--line`, `--paper`, `--sky`, `--gold`, `--gold-text`) yeni dünyanın değerlerine eşler. Bu dünyada tasarlanmış yüzeyler: üst kenar ve menü, ana sayfa hatıra kartı ve alt bölümleri (güven şeridi, hikâye kartpostalları, VIP araç arka yüzü, hizmetler şeridi, filo ve konaklama çerçeveleri, özel tur bandı, Instagram ve yorumlar), tur listesi kartları, tur detayı kartı ve arka yüzü, pul fiyat, rezervasyonun 1. ve 2. adımları (adım çizgisi, form kartı, koltuk seçimi, özet kartı, mobil özet şeridi), sohbet düğmesi ve alt bilgi.

Hâlâ eski düzende kalanlar (yalnız jeton eşlemesiyle renklenir, bu dünyanın örneği sayılmaz): rezervasyonun 3. adımı (ön rezervasyon onayı), başarı / bilet sayfası (`.booking-success`), koltuk planının temel koltuk çizimi (yalnız seçili koltuk yeniden boyanmıştır) ve Instagram şeridinin altındaki dipnot metni.

Reddedilen kalıp: tam genişlikte hero fotoğrafı ve üstünde yüzen arama kutusu (her tur acentesinin varsayılanı).

**Key Characteristics:**
- Soğuk kar zemini üstünde beyaz kart kartonu; fotoğraflar kartın içine 10px aralıkla yerleşir.
- Mavi-siyah mürekkep metin; kırmızı başlık şeridi ve eylem; logo altını fiyat ve pul için.
- Sayfanın üstünde ve alt bilginin üstünde ince uçak postası şeridi.
- Marcellus başlıklar, form değerleri ve fiyatlar; Onest etiketler ve gövde.
- Küçük, düz köşeler (0–5px); hap biçimi yok (tek istisna yüzen sohbet düğmesi).
- Masaya bırakılmış kartlar: hikâye kartpostalları ve fotoğraf çerçeveleri 1 dereceye kadar eğik durur.

## Colors

Soğuk mavi-gri bir kâğıt dünyası; sıcaklık yalnız kırmızı mürekkepte ve altında.

### Primary
- **Uçak Postası Kırmızısı** (red): başlık şeridi (hero `h1`, tur kartı şeridi, rezervasyon özet şeridi, özel tur bandı), birincil düğme, etkin menü alt çizgisi, seçili manzara çerçevesi ve işareti, seçili koltuk, rezervasyon adımlarında geçerli durak halkası, tamamlanan durak ve tamamlanan çizgi parçası, klavye ve alan odağı, tur programındaki rota çizgisi ve saatleri, eylem bağlantıları ("Hizmeti keşfet", özetteki üyelik bağlantısı) ve liste ikonları. Üzerine her zaman beyaz yazılır.
- **Koyu Posta Kırmızısı** (red-deep): birincil düğmenin üzerine gelme durumu ve seçili koltuğun kenarı.

### Secondary
- **Logo Altını** (gold): metin olarak kullanılan altın; tüm fiyatlar (pul, tur kartı, bilgi bandı, manzara etiketleri, mobil rezervasyon çubuğu, rezervasyon özetindeki toplam, mobil özet şeridi). Beyaz kartta okunur kontrast sağlar.
- **Logo Altını, açık ton** (logo-gold): sabitlenmiş marka altını; eski `--gold` jetonu olarak logoda ve eski bölümlerdeki dekoratif altın vurgularda kalır. Metin için kullanılmaz.
- **Puan Yıldızı** (rating-star): yalnız basılı satırdaki canlı Google puanının dolu yıldız ikonu. Tek kullanımlık; metin veya fiyat için kullanılmaz.

### Neutral
- **Kar** (snow): sayfa zemini ve `body` arka planı; kartlar bunun üstünde durur.
- **Kart Kartonu** (card): hatıra kartı, tur kartları, arka yüz, pul, şeritler, çerçeveler, rezervasyon formu ve özeti, harita yedeği, alt bilgi, beyaz düğme.
- **Bastırılmış Karton** (card-press): beyaz düğmenin üzerine gelme durumu.
- **Mavi-Siyah Mürekkep** (ink): ana metin, çerçeveli düğme, etkin filtre, sohbet düğmesi, metin seçimi arka planı, posta damgası.
- **Soluk Mürekkep** (ink-2): etiketler, ikincil metin, alan alt çizgisi, basılı küçük satır, ikonlar, özet toplamının üst çizgisi.
- **Çizgi** (rule): filtre, arama ve rezervasyon alanlarının kenarı, bekleyen adım halkası ve adım çizgisi, pul içindeki çerçeve, koltuk etiketi kenarı.
- **Kıl Çizgi** (hair): basılı satırın ve VIP basılı satırının ayırıcıları, şerit sütunları arasındaki ince çizgiler, `details` ayırıcıları.
- **Kâğıt** (paper): arka yüz içindeki sakin kutular (dahil olanlar, bilgi notu, buluşma, sonraki hareketler), VIP koltuk planı zemini, hizmet hücresinin üzerine gelme durumu.
- **Gök** (sky): fotoğraflar yüklenmeden önceki yer tutucu zemin.
- **Pul Zemini** (stamp): yalnız fiyat pulunun delikli kenar bandı.

### Overlay
- **Mürekkep Karartma** (scrim): büyük manzaranın alt yarısındaki karartma (alt %55, şeffaftan bu tona).
- **Koyu Mürekkep Karartma** (scrim-deep): hikâye kartpostalının fotoğrafında alttan %62'ye kadar karartma; beyaz başlık bunun üstünde okunur.
- **Şerit Gölgesi** (band-shade): kırmızı başlık şeridinin, yapıştırılmış fotoğrafın gölgesi ve şerit altındaki beyaz satırın metin gölgesi. Yüzey rengi değildir.
- **Maske** (mask-opaque): yalnız pulun dişli kenar maskesinde opaklık değeri; hiçbir yüzeye boya olarak verilmez.

### Named Rules
**The Kırmızı Mürekkep Rule.** Kırmızı başlık şeridi, eylem, seçim/odak, ilerleme (tamamlanan rezervasyon adımı) ve rota çizgisi içindir. Gövde metninde, büyük yüzey dolgularında veya süslemede kullanılmaz; bir ekranda tek bir dolu kırmızı eylem düğmesi vardır.

**The Altın Fiyat Rule.** Bir rakam para ise altın (gold) ve Marcellus ile yazılır; altın başka hiçbir metin için kullanılmaz.

**The Tur Bedeli Rule.** Rezervasyon özetindeki tutar ödeme değil tur bedelidir: etiket "Tur bedeli", üyelik indirimi uygulandıysa "İndirim sonrası tur bedeli" olur (demo veride başına "örnek" eklenir); hemen altında "Şimdi ödeme alınmaz." satırı durur. "Toplam", "Ödenecek" gibi etiketler kullanılmaz.

**The Soğuk Zemin Rule.** Zemin kar mavisi-gri kalır; kremaya veya sıcak beje çekilmez. Sıcaklık yalnız kırmızı ve altından gelir.

## Typography

**Display Font:** Marcellus (Georgia yedeği), @fontsource ile kendi sunucumuzda, yalnız 400.
**Body Font:** Onest (Arial yedeği), @fontsource ile 400 / 500 / 600.

**Character:** Marcellus kartpostal baskısının oyma harfli başlığıdır; Onest kartın arkasındaki sade, okunur yazı. Yazı tipleri kullanıcı tarafından sabitlenmiştir.

### Hierarchy
Marcellus basamakları (hep 400):
- **Display** (clamp(40px, 5.2vw, 76px), 1.02; telefonda 38px): yalnız hatıra kartı başlık şeridi (ana sayfa ve tur detayı `h1`).
- **Page title** (clamp(40px, 5vw, 64px)): tur listesi gibi kartsız sayfa girişleri. **Booking title** (clamp(38px, 4.4vw, 56px)): rezervasyon sayfası başlığı, altında 17px soluk mürekkep tur / tarih satırı.
- **Headline** (clamp(34px, 3.6vw, 50px), 1.08, `text-wrap: balance`): bölüm başlıkları. Kart içinde küçülür: rezervasyon form kartında clamp(28px, 2.8vw, 36px), tur detayı arka yüzünde clamp(28px, 2.6vw, 34px), özel tur bandında clamp(24px, 2.6vw, 34px).
- **Fiyat basamakları:** pul 40px, rezervasyon özeti toplamı 36px (950px altında 30px), tur kartı ve bilgi bandı 24px (tabular), mobil özet şeridi 22px.
- **Seat heading** (28px): koltuk seçimi yanındaki başlık.
- **Ribbon / Title** (20–22px): tur kartı şeridi, hizmet başlıkları, harita yedeği başlığı (22px); program adımları (21px); alt bilgi sütun başlıkları ve rezervasyon özet şeridi (20px). Rezervasyon özetinin tur adı 24px.
- **Field value** (20px, 1.3): açıklama bandındaki seçim ve tarih değerleri.

Onest basamakları:
- **Intro** (18px): tur listesi giriş metni.
- **Lead** (17px, 1.75): arka yüz giriş metni, hero alt satırı (telefonda 14px), rezervasyon alt başlığı.
- **Section body** (16px, 1.7): hikâye, VIP, filo ve konaklama giriş paragrafları; rezervasyon alan değerleri 16px.
- **Card title** (600, 16px, 1.3): tur kartı adı.
- **Body** (15px, 1.6; en çok 60–62ch): program metni, sık sorulanlar, düğmeler, VIP basılı satırı.
- **Body small** (14px): hizmet metinleri, kart alt satırları, rezervasyon adımları, özet satırları, onay kutusu ve bilgi notları, süre sayacı, alt bilgi bağlantıları, sohbet düğmesi yazısı.
- **Caption** (13px): basılı satır, breadcrumb, alan etiketleri (600), adım numaraları (600), koltuk açıklaması ve lejandı, hikâye kartı alt satırı, VIP olguları, "Tur bedeli" etiketi, mobil özet şeridi alt satırı, alt bilgi alt satırı.
- **Label** (12px): bilgi bandı `dt`, filo grup notları, konaklama fotoğraf etiketi; telefonda adım adları.
- **Micro** (600, 11px, 0.08em, büyük harf): pulun basılı yer yazısı; telefonda küçük manzara fiyatı (büyük harf değil).

### Named Rules
**The Kartpostal Baskısı Rule.** Marcellus başlık, değer ve fiyattır; Onest her şeyin geri kalanıdır. Başlıklarda seçili kelime italik veya renkle öne çıkarılmaz.

**The Kart İçi Ölçek Rule.** Bir başlık kartın içindeyse sayfa başlığından bir basamak küçüktür (28–36px aralığı); sayfa ölçeğindeki 50px başlık kartın içine girmez.

**The Etiketsiz Başlık Rule.** Bölüm başlıklarının üstünde küçük üst etiket (eyebrow) yoktur; eski `.section-note` bu dünyada gizlidir.

## Layout

Kapsayıcı en çok 1280px, iki yanda 56px boşluk (`calc(100% - 112px)`); telefonda hatıra kartı `calc(100% - 24px)` ile neredeyse kenara kadar uzanır. Hatıra kartında büyük manzara ve küçük manzaralar 1.85fr : 1fr oranında, 10px aralıkla; yükseklik ekrana göre `clamp(420px, calc(100svh - 300px), 560px)`, böylece ilk ekranda kartın tamamı ve açıklama bandı görünür. Küçük manzaralar ana sayfada 2x2, tur detayında tek sütun yığın.

Açıklama bandı dört sütunlu bir ızgaradır (rota / tarih / yolcu / düğme, 26px sütun aralığı), alta hizalı; altında kıl çizgiyle ayrılmış basılı küçük satır. Tur kartı ızgarası 36px x 30px aralıklı.

Ana sayfa alt bölümleri kar zemininde kartlar dizisidir; bölümlerin kendi arka plan rengi yoktur. Güven şeridi ve hizmetler tek beyaz şerit içinde eşit sütunlardır (700–950px arası 2x2, telefonda alt alta; ayırıcı çizgiler buna göre yataya döner). Hikâye kartpostalları üçlü ızgarada sırayla -1°, 0.8° (12px aşağı) ve -0.4° eğilir; telefonda düzleşir. Filo ve konaklama metin + çerçeveli fotoğraf ikilisidir. Eski bölümlerin dikey ritmi 92px'tir; hikâye 70px, VIP 40px / 70px.

Rezervasyon: sol form kartı + sağda 340px özet sütunu, 36px aralık (1200px altında 300px / 28px). 950px altında tek sütun: önce mobil özet şeridi ve form, tam özet en sonda (özet 220px fotoğraf + metin yan yana; 560px altında alt alta, fotoğraf 16:9). Form kartı iç boşluğu 36px 40px 32px, telefonda 24px 18px 22px. Adımlar tam genişlikte üç eşit durak; telefonda durak adı numaranın altına iner ve çizgi numaranın sağından geçer.

950px altında manzaralar alt alta iner, küçük manzaralar dört sütunlu bir şerit olur (170px), açıklama bandı iki sütuna ve tam genişlik düğmeye geçer. 700px altında üst bilgi şeridi gizlenir, kart iç boşluğu 8px, manzara aralıkları 6px olur, basılı satır alt alta dizilir. Menü 1350 / 1100 / 950px eşiklerinde küçülür, 700px altında açılır menüye döner.

## Elevation & Depth

Derinlik kâğıt mantığıyla verilir: kart kartonu kar zemininden yumuşak, aşağı uzanan, mürekkep tonlu bir gölgeyle kalkar. Gölge yalnız kartlara (hatıra kartı, tur kartı, arka yüz, fiyat kutusu, şeritler, hikâye kartpostalları, fotoğraf çerçeveleri, VIP arka yüzü, rezervasyon formu, özet ve mobil özet şeridi) ve kartın üstündeki yapıştırma öğelerine (başlık şeridi, tur kartı içindeki küçük fotoğraf) verilir. İç yüzeyler (kâğıt kutular, alanlar, etiketler, rezervasyon özet şeridi) düzdür. Fotoğraf üstündeki yazı, mürekkep tonlu karartma ile okunur hâle getirilir; renkli tül veya bulanıklık kullanılmaz.

### Shadow Vocabulary
- **Kart** (`box-shadow: 0 30px 60px -32px rgba(26,40,70,0.42), 0 2px 6px rgba(26,40,70,0.08)`): hatıra kartı, VIP arka yüzü, filo ve konaklama fotoğraf çerçeveleri; tur kartının üzerine gelme durumu.
- **Küçük kart** (`box-shadow: 0 18px 34px -24px rgba(26,40,70,0.45), 0 1px 3px rgba(26,40,70,0.08)`): tur kartı, arka yüz, fiyat kutusu, güven ve hizmet şeritleri, hikâye kartpostalı, özel tur bandı, rezervasyon formu, özeti ve mobil özet şeridi.
- **Şerit** (`box-shadow: 0 12px 26px -14px rgba(0,0,0,0.55)`): fotoğraf üstündeki kırmızı başlık şeridi.
- **Yapıştırma fotoğraf** (`box-shadow: 0 8px 16px -8px rgba(0,0,0,0.55)`): tur kartındaki 4px beyaz kenarlı küçük manzara.
- **Mobil çubuk** (`box-shadow: 0 -10px 30px -18px rgba(26,40,70,0.5)`): tur detayının sabit rezervasyon çubuğu.
- **Karartmalar:** büyük manzara `linear-gradient(transparent, scrim)` alt %55'te; hikâye kartpostalı `linear-gradient(0deg, scrim-deep, transparent 62%)`; şerit altı satırda `text-shadow: 0 1px 12px rgba(0,0,0,0.55)`.

### Named Rules
**The Kâğıt Gölgesi Rule.** Gölge hep aşağı ve mürekkep tonludur, ışık gibi yayılmaz; sert kaydırılmış gölge kullanılmaz.

**The Masaya Bırakılmış Kart Rule.** Eğim yalnız serbest duran kartlara verilir (hikâye kartpostalları, filo / konaklama çerçeveleri, ilk ekrandaki yerleşme hareketi) ve 1 dereceyi geçmez; form, özet, şerit ve metin kutuları düz durur.

## Shapes

Köşeler kâğıt kesimi gibi küçük ve düzdür: kart, şerit, VIP arka yüzü ve rezervasyon formu 5px; düğme / filtre / tur kartı / hikâye kartpostalı / fotoğraf çerçevesi / rezervasyon alanı / özet / mobil özet şeridi / harita yedeği 4px; hizmet hücresi ve etiketler 2–3px. Kartın içindeki fotoğraflar, başlık şeridi, tur kartı şeridi, özet şeridi ve özel tur bandı tamamen keskin köşelidir (0). Açıklama bandı alanları kutusuzdur: yalnız 1px alt çizgi. Tekrarlanan biçimler: uçak postası kenarı (kırmızı / beyaz / mürekkep / beyaz, -45° eğik, sayfa üstünde 8px, alt bilginin üstünde 6px), pulun dişli kenarı (radyal maske ile delikli 9px çerçeve), yuvarlak posta damgası (iki halka, -12° döndürülmüş, `multiply` karışım). Yuvarlak öğeler yalnız işaretlerdir: seçili manzara işareti (26px), program durakları (16px), rezervasyon adım numaraları (28px), yüzen sohbet düğmesi (58px daire; yazısı açılınca kapsül olur, bu dünyadaki tek kapsül).

## Components

### Buttons
Mürekkeple basılmış, sağlam ve düz.
- **Shape:** düz köşe (4px), en az 52px yükseklik, 15px Onest 600, ikonla 10px aralık.
- **Primary:** kırmızı dolgu, beyaz yazı, 14px 24px. Üzerine gelince koyu kırmızı; gölge yok. VIP arka yüzündeki eylem de kırmızıdır.
- **Small:** 42px yükseklik, 10px 16px, 14px yazı.
- **Outline / üst menü eylemi / özel tur bandı eylemi:** şeffaf, 1.5px mürekkep kenar, mürekkep yazı; üzerine gelince mürekkep dolgu, beyaz yazı.
- **White:** kart beyazı dolgu, mürekkep yazı; üzerine gelince bastırılmış karton.
- **Text link:** mürekkep, 15px 600, 1px alt çizgi 5px açıklıkta; üzerine gelince kırmızı. Kart içindeki eylem bağlantısı ("Hizmeti keşfet") 14px 600 kırmızı ve okludur.
- **Focus:** tüm etkileşimli öğelerde 2px kırmızı dış çizgi, 3px açıklık.

### Chips
- **Style:** tur listesi filtreleri; kart beyazı, 1px çizgi (rule) kenar, 4px köşe, 14px 500, 8px 14px. Üzerine gelince kenar soluk mürekkep.
- **State:** etkin filtre mürekkep dolgu, beyaz yazı.
- **Bilgi etiketleri** (filo grup büyüklükleri): 1px çizgi kenar, 3px köşe, 13px mürekkep; tıklanmaz.

### Cards / Containers
- **Hatıra kartı:** kart beyazı, 5px köşe, 14px iç boşluk (telefonda 8px), kart gölgesi. İçinde büyük manzara, küçük manzaralar, açıklama bandı, basılı satır.
- **Tur kartı:** kart beyazı, 4px köşe, 10px kenar (alt boşluk yok), küçük kart gölgesi. Fotoğraf 4:3, keskin köşe; sol altta kırmızı yer adı şeridi (Marcellus 22px; yer adı güzergâhta geçen ve tur adında yer alan ilk Kars dışı durak, yoksa son durak), sağ üstte 4px beyaz kenarlı ikinci manzara (genişliğin %30'u). Alt satırda Onest ad ve süre, sağda altın fiyat ve "kişi başı". Üzerine gelince 4px yukarı ve -0.4° dönerek kart gölgesine geçer (0.45s, `cubic-bezier(0.16,1,0.3,1)`).
- **Arka yüz (tur detayı içeriği):** kart beyazı, 5px köşe, küçük kart gölgesi, 44px 48px 30px iç boşluk (telefonda 26px 18px 14px). İçindeki kutular kâğıt zeminli, 4px köşe, gölgesiz.
- **Çizgili şerit (güven satırı ve hizmetler):** tek beyaz kart (5px, küçük kart gölgesi), içinde eşit sütunlar 1px kıl çizgiyle ayrılır; görsel yok. Güven sütunu: kırmızı ince çizgili ikon, Onest 15px başlık, 14px soluk metin. Hizmet hücresi: Marcellus 22px başlık, 14px / 1.6 soluk metin, altta kırmızı "Hizmeti keşfet"; üzerine gelince hücre kâğıt zemine döner (0.25s).
- **Hikâye kartpostalı:** 8px beyaz kenarlı, 4px köşeli dikey fotoğraf kartı, küçük kart gölgesi, sırayla hafif eğik. Fotoğrafta koyu mürekkep karartma; sol üstte beyaz zeminli oynat işareti; altta yalnız hikâye başlığı ve 13px "Hikâyeyi keşfet" satırı (konum veya biçim etiketi yok). Üzerine gelince düzleşip 4px kalkar.
- **VIP araç bölümü (kartın arka yüzü):** kart beyazı, 5px köşe, kart gölgesi, 52px 56px (telefonda 28px 20px); solda başlık, 16px paragraf, **basılı satır** (`.vip-caption`: üst ve alt 1px kıl çizgi arasında 15px mürekkep, araç adı · misafir koltuğu · rehber notu, katalogdaki araçtan okunur) ve kırmızı eylem; sağda kâğıt zeminli koltuk planı önizlemesi, 13px soluk etiket ve dipnot.
- **Filo ve konaklama çerçevesi:** fotoğraf 12px beyaz kenarlı, 4px köşeli karton içinde, kart gölgeli; filo -1°, konaklama 0.8° eğik. Fotoğraf keskin köşeli.
- **Özel tur bandı:** beyaz şerit kart (5px, küçük kart gölgesi, sol kenarda boşluk yok); başlık kenardan taşan kırmızı şerittir (Marcellus clamp(24px, 2.6vw, 34px), en çok 34ch), sağda çerçeveli eylem. Telefonda şerit tam genişlik, eylem altında.
- **Harita yedeği (yorumlar):** Google haritası yüklenene kadar altında görünen beyaz kart (4px, 24px 28px): Marcellus 22px işletme adı, 14px adres ve yol tarifi bağlantısı. Instagram ve yorumlar bölümleri kar zemininde durur; görselleri 4px köşelidir.

### Inputs / Fields
- **Açıklama bandı alanı:** kutusuz; 12px soluk mürekkep etiket, altında Marcellus 20px değer, 1px soluk mürekkep alt çizgi, en az 44px. Odakta alt çizgi kırmızı olur ve 1px kırmızı gölgeyle kalınlaşır.
- **Rezervasyon alanı:** formda okunurluk için kutuludur: kart beyazı, 1px çizgi kenar, 4px köşe, en az 48px, Onest 16px mürekkep değer; etiket üstte 13px 600 soluk mürekkep. Üzerine gelince kenar soluk mürekkep; odakta kenar kırmızı ve 1px kırmızı halka. Onay kutuları kırmızı (`accent-color`), 14px.
- **Arama kutusu (tur listesi):** kart beyazı, 1px çizgi kenar, 4px köşe.
- **Süre sayacı / uyarı:** kart beyazı, 1px çizgi kenar, 4px köşe, 14px; ikon kırmızı.

### Navigation
Üst bilgi şeridi (12px, soluk mürekkep, 28px) ve şeffaf başlık (70px, logo 140x51) kar zemininde durur; kenar çizgisi yok. Menü Onest 15px 500, 30px aralık; etkin bağlantının altında kırmızı çizgi. Sağda üyelik ve rezervasyon bağlantıları (13px) ve çerçeveli "Birlikte planlayalım" düğmesi. 700px altında açılır menü kart beyazı zeminde. Rezervasyonda başlığın üstünde 14px soluk "Tur detayına dön" bağlantısı.

### Rezervasyon adımları (rota çizgisi)
Üç durak tek yatay çizgi üstündedir. Durak: 28px daire, 2px kenar, 13px 600 numara, yanında 14px 500 ad. Bekleyen: çizgi kenar, soluk mürekkep. Geçerli: kırmızı halka ve kırmızı numara, ad mürekkep (`aria-current="step"`). Tamamlanan: dolu kırmızı daire içinde beyaz onay; o duraktan sonraki 2px çizgi parçası kırmızı, bekleyen parçalar çizgi (rule) renginde. İlerleme böylece programdaki rota çizgisiyle aynı dili konuşur.

### Rezervasyon form kartı ve koltuk seçimi
Form kartın arka yüzüdür: kart beyazı, 5px köşe, küçük kart gölgesi; başlık clamp(28px, 2.8vw, 36px), altında 15px soluk açıklama. Koltuk planında seçili koltuk dolu kırmızı, koyu kırmızı kenarlı, beyaz ikonlu; boş koltuğun üzerine gelince kenar soluk mürekkep. Lejant 13px, 14px kareler; "Seçili" karesi kırmızı. Yanda Marcellus 28px başlık, 15px açıklama, seçim özeti (16px koltuk, 13px sayaç).

### Rezervasyon özeti (tek görüntülü hatıra kartı)
10px beyaz kenarlı, 4px köşeli kart, küçük kart gölgesi. Üstte 4:3 keskin köşeli tur fotoğrafı, sol altında kırmızı yer adı şeridi (Marcellus 20px). Altında Marcellus 24px tur adı; ikonlu 14px satırlar (tarih, saat, yolcu ve araç, koltuk, buluşma), ikonlar soluk mürekkep. Ardından 1px soluk mürekkep çizgi, 13px "Tur bedeli" etiketi ve altın Marcellus 36px tutar, en altta kırmızı kalkan ikonlu 14px "Şimdi ödeme alınmaz." (The Tur Bedeli Rule). İndirim varsa üstte "Tur bedeli … / Üyelik indirimi −…" satırı. Masaüstünde sağ sütundadır; telefonda sayfanın sonuna iner.

### Mobil özet şeridi
Yalnız 950px altında, formun üstünde: beyaz kart (4px, küçük kart gölgesi), solda 64x48 tur fotoğrafı, ortada 15px tur adı ve 13px soluk tarih · saat · koltuk satırı, sağda altın Marcellus 22px tutar. Ekran okuyucudan gizlidir (tam özet sayfada durur).

### Hatıra kartı manzaraları (imza bileşeni)
Büyük manzara, alt yarısında mürekkep karartma ve sol altta fotoğrafın kenarından taşan kırmızı başlık şeridi; altında beyaz 17px tek satırlık açıklama. Küçük manzaralar düğmedir (`aria-pressed`): sol altta beyaz etiket (Marcellus 17px yer adı, altında 12px 600 altın "…'den" fiyat), seçilince içten 4px kırmızı çerçeve ve sağ üstte kırmızı daire içinde onay işareti; seçim açıklama bandındaki rota alanını doldurur. Üzerine gelince fotoğraf 1.05 büyür (0.9s).

İlk ekran hareketi: kart masaya yerleşir (`kp-settle`, 16px aşağıdan ve -0.7°'den düze, 0.9s), başlık şeridi kenardan oturur (`kp-band`, 14px soldan, 0.8s, 0.15s gecikme); ikisi de `cubic-bezier(0.16,1,0.3,1)`. İçerik baştan görünürdür, yalnız konum değişir. Azaltılmış hareket tercihinde ikisi de kapanır.

### Pul fiyat ve posta damgası (imza bileşeni)
Tur detayındaki fiyat kutusunda fiyat bir puldur: delikli kenarlı pul zemini çerçeve içinde beyaz alan, 1px çizgi kenar; üstte tur adı pulun basılı yer yazısı olarak (micro), altında Marcellus 40px altın fiyat. İlk hareket varsa pulun sağına SVG posta damgası vurulur: iki halka, üstte "KARS", ortada tarih (Marcellus 16px), altta saat; mürekkep, %82 opaklık, -12°.

### Rota çizgisi (tur programı)
Program tek kesintisiz 2px kırmızı dikey çizgidir. Her adım: kırmızı 13px 600 tabular saat, 16px beyaz dolgulu kırmızı halkalı durak, Marcellus 21px adım adı, 15px soluk mürekkep metin. Son durak dolu kırmızı.

### Basılı satır ve bilgi bandı
Hatıra kartının en altında, kıl çizgiyle ayrılmış 13px soluk mürekkep satır: TÜRSAB, Kars'ta kaç yıldır, ödeme notu, Google puanı yalnız API döndürdüğünde (14px puan, puan yıldızı renginde dolu yıldız, altı çizili soluk bağlantı). Tur detayında açıklama bandı bilgi listesidir (güzergâh, süre, araç, altın fiyat) ve sağda kırmızı eylem.

### Sohbet düğmesi ve yüzen düğmelerin geri çekilmesi
Asistan düğmesi 58px mürekkep daire, içinde beyaz ikon; yazısı (14px) gizlidir ve üzerine gelince ya da klavye odağında 0.4s içinde açılır (en çok 260px), böylece kart fiyatlarını kapatmaz. Telefonda (700px ve altı) WhatsApp ve asistan düğmeleri her sayfada görünür; telefonda kart yüksekliği eylem düğmesi bu düğmelerin üstünde kalacak şekilde ayarlıdır (yalnız eski koltuk planı kuralı, koltuk haritası ekrandayken onları çeker). Geniş ekranda 24px aşağı kayıp gizlenirler (0.25s): ana sayfada hatıra kartı ve tur detayında kart bandı ekrandayken (`body[data-cta-visible]`, 701px ve üstü); rezervasyon özeti ekrandayken (`body[data-summary-visible]`, 951px ve üstü). Tur detayının mobil rezervasyon çubuğu da karttaki düğme görünürken saklanır. Azaltılmış hareket tercihinde bu geçişler kapanır.

## Do's and Don'ts

### Do:
- **Do** yeni halka açık yüzeyleri `.kp` içinde ve `--kp-*` jetonlarıyla kur; eski jetonları doğrudan yeniden tanımlama.
- **Do** ana ilk görünümü kar zemininde beyaz bir kart olarak kur: kart içinde fotoğraflar 10px aralıkla, keskin köşeli; kartın kendisi 5px köşeli ve kart gölgeli.
- **Do** yeni bir bölümü kendi zemin rengiyle değil, kar zemininde beyaz bir kart, şerit veya çerçeve olarak kur.
- **Do** her fiyatı Marcellus ve altın (gold) ile, tabular rakamlarla yaz.
- **Do** açıklama bandı alanlarını kutusuz, alt çizgili ve Marcellus 20px tut; uzun formlarda (rezervasyon) kutulu 48px Onest alanı kullan.
- **Do** kırmızıyı başlık şeridi, eylem, seçim/odak, tamamlanan ilerleme ve rota çizgisiyle sınırla.
- **Do** rezervasyon tutarını "Tur bedeli" / "İndirim sonrası tur bedeli" diye etiketle ve altına "Şimdi ödeme alınmaz." satırını koy.
- **Do** yüzen düğmeleri, sayfanın ana eylemi veya özeti ekrandayken geri çek.
- **Do** Google puanını yalnız canlı veriden göster; veri yoksa satırı gösterme.

### Don't:
- **Don't** tam genişlikte hero fotoğrafı ve üstünde yüzen arama kutusu kullanma.
- **Don't** hap biçimli düğme, etiket veya filtre yapma; 5px üstü köşe yok (yüzen sohbet düğmesi tek istisnadır).
- **Don't** bölüm başlıklarına veya kartpostallara üst etiket (eyebrow) ekleme.
- **Don't** kartları 1 dereceden fazla eğme; formu, özeti ve şeritleri eğme.
- **Don't** zemini kremaya ısıtma veya panelin tüf siyahını, kırmızısını getirme; panel sistemi `docs/DESIGN-PANEL.md` içindedir.
- **Don't** logo altınını (logo-gold) veya puan yıldızı rengini metin rengi olarak kullanma; metin altını gold'dur.

## Araç

18 yolcu + 1 sürücü koltuğu (18+1 VIP midibüs). Şoför yanındaki ön koltuk varsayılan olarak rehbere ayrılır ve satışa kapalıdır. 17 satış koltuğu: ilk sıra 2 koltuk + kapı, ardından beş adet 2+1 sıra. Fiziksel sıra yerleşimi varsayımdır; gerçek araç fotoğrafıyla teyit edilir ve `server/catalog.mjs` içindeki `vehicle.layout` ile değiştirilebilir. Kapasite ve rehber kısıtı hem istemci hem sunucuda uygulanır.
