---
name: Rota Kars (halka açık site)
description: Rota Renkleri; beyaz zemin, turuncu-kırmızı eylem, her tur türüne kendi rengi, Baloo 2 başlıklar ve hareketli, renk kodlu fotoğraf kartları.
colors:
  flame: "#d63a12"
  flame-deep: "#b12f0c"
  kultur: "#a3401f"
  doga: "#0b7db8"
  doga-ink: "#0a6fa3"
  kis: "#3b5bdb"
  konak: "#0f7a50"
  gun: "#f59e0b"
  gun-ink: "#b45309"
  yurtdisi: "#c2255c"
  aktivite: "#6d28d9"
  night: "#16224a"
  ink: "#1b1f2a"
  ink-2: "#545b6b"
  rule: "#dde1e8"
  hair: "#eceef2"
  paper: "#f5f6f9"
  sky: "#eef3fa"
  white: "#ffffff"
  gold-text: "#c2410c"
  gold: "#e3801f"
typography:
  display:
    fontFamily: "Baloo 2, Onest, Arial, sans-serif"
    fontSize: "clamp(52px, 7.6vw, 112px)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.025em"
  display-phone:
    fontFamily: "Baloo 2, Onest, Arial, sans-serif"
    fontSize: "clamp(46px, 13vw, 64px)"
    fontWeight: 800
    lineHeight: 0.95
  headline:
    fontFamily: "Baloo 2, Onest, Arial, sans-serif"
    fontSize: "clamp(32px, 3.6vw, 52px)"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.015em"
  band-headline:
    fontFamily: "Baloo 2, Onest, Arial, sans-serif"
    fontSize: "clamp(28px, 3vw, 42px)"
    fontWeight: 800
    lineHeight: 1.04
  tile-name:
    fontFamily: "Baloo 2, Onest, Arial, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1
  price:
    fontFamily: "Baloo 2, Onest, Arial, sans-serif"
    fontSize: "27px"
    fontWeight: 800
    lineHeight: 1
  sticker-price:
    fontFamily: "Baloo 2, Onest, Arial, sans-serif"
    fontSize: "clamp(20px, 1.75vw, 26px)"
    fontWeight: 800
    lineHeight: 1
    fontFeature: "tnum"
  hero-greeting:
    fontFamily: "Baloo 2, Onest, Arial, sans-serif"
    fontSize: "clamp(20px, 2vw, 28px)"
    fontWeight: 800
    lineHeight: 1.15
  title:
    fontFamily: "Baloo 2, Onest, Arial, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.1
  card-title:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "16.5px"
    fontWeight: 600
  lead:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.45
  body:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  button:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 700
  chip:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 600
  label:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.3
rounded:
  pill: "999px"
  hero: "30px"
  page-card: "28px"
  tile: "22px"
  inner: "18px"
  bar: "8px"
  circle: "50%"
spacing:
  field: "8px 20px"
  tile-info: "16px 18px 18px"
  grid-row: "34px"
  grid-col: "28px"
  band: "46px 56px"
  section-lg: "96px"
  section-md: "90px"
  section-gap: "56px"
components:
  button-primary:
    backgroundColor: "{colors.flame}"
    textColor: "{colors.white}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "14px 24px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.flame-deep}"
    textColor: "{colors.white}"
  button-white:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    height: "48px"
    padding: "0 22px"
  search-bar:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.pill}"
    padding: "10px"
  search-field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "{spacing.field}"
  search-field-hover:
    backgroundColor: "{colors.paper}"
  filter-chip:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  hero-chip:
    textColor: "{colors.white}"
    typography: "{typography.chip}"
    rounded: "{rounded.pill}"
    padding: "3px 11px"
  tour-tile:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tile}"
    padding: "{spacing.tile-info}"
  category-badge:
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.circle}"
    width: "108px"
  price-sticker:
    backgroundColor: "{colors.flame}"
    textColor: "{colors.white}"
    typography: "{typography.sticker-price}"
    rounded: "{rounded.circle}"
    width: "clamp(134px, 12vw, 168px)"
  hero-stage:
    backgroundColor: "{colors.night}"
    rounded: "{rounded.hero}"
    height: "clamp(460px, calc(100svh - 250px), 640px)"
  trust-band:
    backgroundColor: "{colors.flame}"
    textColor: "{colors.white}"
    padding: "18px 0"
  story-section:
    backgroundColor: "{colors.night}"
    textColor: "{colors.white}"
    padding: "96px 0"
---

# Design System: Rota Kars (halka açık site)

Bu dosya halka açık siteyi anlatır. Acente paneli (`/yonetim`, `.rk-admin`) ayrı bir dünyadır, `docs/DESIGN-PANEL.md` ve `.impeccable/design.json` dosyalarında tanımlıdır ve bu yeniden tasarımdan etkilenmemiştir. Halka açık sitenin yan dosyası `.impeccable/design-public.json`'dur.

Önceki halka açık görünüm "Hatıra Kartı" (kar zemini, beyaz kart kartonu, mavi-siyah mürekkep, Marcellus, kırmızı başlık şeridi; 2026-11-03) git dalı `yedek/hatira-karti` içinde saklıdır. Ondan önceki görünüm `yedek/mevcut-site-tasarimi` dalındadır.

## Overview

**Creative North Star: "Rota Renkleri" (her rotanın kendi rengi var)**

Site parlak, hareketli bir seyahat dükkânıdır. Kars çıkışlı rotalar renk kodlu fotoğraf kartları, dönen bir vitrin ve yuvarlak tür rozetleri olarak gelir; ziyaretçi daha okumadan rengin söylediğinden günün türünü anlar: kültür kiremit, doğa buz mavisi, kış çivit, konaklamalı çam yeşili, günübirlik kehribar, yurt dışı macenta. Zemin beyazdır, metin koyu mürekkeptir, eylem tek bir turuncu-kırmızıdır. Başlıklar yuvarlak, kalın Baloo 2'dir; gövde sakin Onest'tir. Köşeler cömert (22–30px), düğmeler haptır, fiyatlar yuvarlak döner etiketlerde durur.

Renk tek bir mekanizmayla dağıtılır: bir tura, filtreye ya da rozete `src/lib/tone.ts` üç CSS değişkeni verir (`--tone` zemin, `--on-tone` üstündeki yazı, `--tone-ink` beyaz zeminde okunan yazı); bileşenler yalnız bu değişkenleri okur. Değerlerin tamamı `src/renkli.css` içinde, `.kp` kapsayıcısıyla sınırlıdır. Bu dosya `src/postcard.css`'ten sonra yüklenir ve kartpostal jetonlarını (`--kp-*`, `--paper`, `--sky`, `--gold`, `--gold-text`, `--display`) yeni dünyaya eşler; postcard.css hâlâ yeniden kurulmamış sayfaların yapısını sağlar.

Bu dünyada kurulmuş yüzeyler: üst şerit ve menü; ana sayfa (vitrin, arama çubuğu, güven satırı, tür rozetleri, tek satır akan güven bandı, tur filtreleri ve kartları, keşif hikâyeleri, koltuk bölümü, "Kars'ta başka neler var" kartları, özel tur bandı); tur listesi; fotoğraflı sayfa başları (`.kp-card`: tur detayı, hizmetler, hizmet detayı, keşif) ve konaklama başlığı: beyaz çerçevesiz 30px köşeli fotoğraf, üstünde kalın beyaz başlık, altında beyaz bilgi hapı; tur detayında sayfa turun tonunu alır, fiyat pul yerine tonlu fiyat kartındadır; sıralı adımlar (konaklama, hizmet süreci) ve hizmet rehberi kartları sırayla doga / konak / yurtdisi (/ kis) tonlarındadır; eğik, beyaz çerçeveli fotoğraflar düz ve 26px köşelidir; bilet pulu yuvarlak fotoğraf kartı, posta damgası dolu alev etiket, durum damgası dolu durum hapıdır (renk anlamı aynı); rezervasyon, ödeme, sorgu, iletişim ve üyelik kutuları 20–28px köşelidir; alt bilgi. Instagram ve yorum bölümlerinin yapısı postcard.css'ten gelir, yalnız jetonla renklenir.

Sonradan eklenen parçalar (2026-11-21):
- **Duyuru şeridi** (`.rk-announce`): sitenin en üstünde alevden kafkas pembesine geçen şerit; metin ve bağlantı panelden (Site içerikleri → Duyuru şeridi, yalnız sahip). Ziyaretçi kapatınca o oturumda aynı metin yeniden çıkmaz; İngilizce metin boşsa /en'de görünmez. Telefonda simgesiz tek blok.
- **Sabit üst menü**: kaydırınca yukarıda kalır, 76px'den 62px'e (telefonda 56px) incelir ve gölge alır; bağlantılara kayan sayfa `scroll-padding-top: 84px` ile menünün altında durur. Telefon menüsünde bağlantılar Baloo 2 700, her birinin önünde bir rota renginde nokta.
- **Yaklaşan seferler** (`.rk-upcoming`, ana sayfa): satıştaki turların ilk seferi tarih sırasıyla yatay kaydırılan kartlarda; tarih kutusu turun tonunda, az koltukta alev rengi "Son n koltuk" hapı, kart rezervasyonu o tarih seçili açar.
- **Tur kartı koltuk etiketi** (`.tour-seat-badge`): ilk seferde 3 ve daha az koltuk kaldıysa fotoğrafın sol üstünde nabız noktalı alev hap; dolu seferde mürekkep.
- **Koltuk planı**: boş koltuklar doga mavisi tonda, seçili koltuk alev, rehber koltuğu amber; lejant aynı renklerde.
- **Tur listesi başlığı** (`.rk-tours-hero`): 30px köşeli, köşelerinde amber ve doga ışıması olan açık alev zeminli bant; içinde tür rozetleri (ana sayfadakiyle aynı bileşen, `CategoryBadges`), seçim aşağıdaki filtreyle eşleşir.
- **Fotoğraf görüntüleyici** (`.rk-lightbox`, tur detayı): ana fotoğraftaki "Büyüt" hapı ya da fotoğrafa tıklama tam ekran açar; oklar, klavye ve parmakla kaydırma, altta küçük resim şeridi, etkin küçük resim alev çerçeveli.

**Key Characteristics:**
- Beyaz zemin, mürekkep metin, tek turuncu-kırmızı eylem rengi.
- Her tur türüne bir renk; kart, filtre, rozet, vitrin örtüsü ve fiyat etiketi o rengi alır.
- Sayfanın üstünde ve alt bilginin üstünde beş rota renginden 6px rota şeridi.
- Baloo 2 ExtraBold başlıklar, yer adları ve fiyatlar; Onest gövde ve etiketler.
- Cömert yuvarlaklık: 22px kart, 30px vitrin ve bant, hap düğmeler, yuvarlak rozet ve etiketler.
- Hareket canlıdır ama durdurulabilir: vitrin geçişi ve yavaş yakınlaşma, yaylı rozetler, ekrana gelince yükselme; hepsi `prefers-reduced-motion` ile kapanır.

## Colors

Beyaz bir zemin üstünde doygun, ama yazı taşıyacak kadar koyulaştırılmış rota renkleri; sıcaklık turuncu-kırmızı eylemden, çeşitlilik tür renklerinden gelir.

### Primary
- **Rota Alevi** (flame): eylem rengi. Dolu düğmeler, menüdeki etkin bağlantı ve alt çizgisi, metin bağlantıları, arama alanı ikonları, odak halkası (3px, 3px boşluk), seçim, imleç, "son N koltuk" uyarısı ve tam genişlik kayan güven bandı. Beyaz yazıyla AA geçer.
- **Koyu Alev** (flame-deep): dolu düğme ve menü eyleminin üzerine gelme durumu; renkli bant üstündeki beyaz düğmenin yazısı.

### Secondary (tür renkleri)
Her biri `--rk-<tür>`, `--rk-<tür>-on`, `--rk-<tür>-ink` üçlüsüyle tanımlıdır. Ad eşleme `src/lib/tone.ts` içindedir; Türkçe ve İngilizce kategori adları aynı renge düşer, kategorisi tanınmayan tur günübirlikse kehribar, değilse kiremit alır.
- **Kiremit** (kultur): kültür turları. Beyaz yazı; metin rengi olarak da kendisi.
- **Buz Mavisi** (doga): doğa turları. Beyaz yazı; beyaz zeminde metin için biraz koyusu **doga-ink**.
- **Çivit** (kis): kış turları. Beyaz yazı.
- **Çam** (konak): konaklamalı turlar. Beyaz yazı.
- **Kehribar** (gun): günübirlik turlar. Tek açık tür rengidir: üstündeki yazı mürekkeptir (beyaz değil), beyaz zeminde metin olarak **gun-ink** kullanılır. Ayrıca koltuk bölümünün zemini, vitrindeki selam etiketi ve koyu zeminlerde ikon vurgusu.
- **Macenta** (yurtdisi): yurt dışı turları; özel tur bandı geçişinin bitiş rengi.
- **Mor** (aktivite): aktivite / rehber kategorisi. Yön sözleşmesinde yoktu; katalogda bu kategori olduğu için yapıda eklendi.

### Neutral
- **Mürekkep** (ink): başlık ve gövde metni, üst şerit zemini, kehribar üstündeki yazı.
- **İkinci Mürekkep** (ink-2): yardımcı metin, alan etiketleri, rozet altı sayılar.
- **Çizgi** (rule) ve **Kıl** (hair): arama alanı ayırıcıları, filtre ve form kenarları.
- **Kâğıt** (paper): alan üzerine gelme dolgusu, dar ekranda arama alanlarının zemini, alt bilgi zemini.
- **Gök** (sky): devralınan sayfalarda açık bilgi kutuları.
- **Beyaz** (white): sayfa zemini, kartlar, arama çubuğu.
- **Gece** (night): vitrin sahnesinin yükleme zemini ve keşif hikâyeleri bölümü; orada doğa ve macenta radyal ışıklarla yumuşatılır.
- **Fiyat Turuncusu** (gold-text): devralınan sayfalarda fiyat ve vurgu metni (eski altının yerini alır). **gold** yalnız eski site düzenlerinde dolgu rengidir, metin rengi değildir.

### Named Rules
**The Bir Tür Bir Renk Rule.** Bir tur türünün rengi sabittir ve yalnız `tone.ts` üzerinden atanır; bileşen ham tür rengini kendisi seçmez, `--tone` / `--on-tone` / `--tone-ink` okur. Rengin bir anlamı vardır: türü söyler. Tür olmayan bir şeyi tür renkleriyle boyamak yalnız bilinçli yerlerde yapılır: "Kars'ta başka neler var" kartlarının sırayla buz mavisi, çam ve macenta alması, renkli bölüm zeminleri ve beş rota renginden oluşan rota şeridi.

**The Okunur Ton Rule.** Her tür renginin üstündeki yazı AA geçer: kehribar dışındakiler beyaz, kehribar mürekkep yazı alır. Beyaz zeminde tür rengiyle yazılan metin (`--tone-ink`) de AA geçer; açık kalan tonlar için ayrı koyu metin değeri vardır (doga-ink, gun-ink). Yeni bir tür eklenirse önce bu iki değer bulunur.

**The Tek Alev Rule.** Turuncu-kırmızı eylem, odak, seçim ve aciliyettir. Tür veya süs için kullanılmaz; tur kartında fiyat tür rengindedir, alev değil (rengi tanınmayan kart alev varsayılanına düşer).

## Typography

**Display Font:** Baloo 2 700/800 (Onest, Arial yedekli)
**Body Font:** Onest 400/500/600 (Arial yedekli)

**Character:** Baloo 2'nin yuvarlak, dolgun kalınlığı dükkânın neşesini taşır; Onest'in düz, açık harfleri tarih, koltuk ve fiyat ayrıntısını sakin tutar. İki yazı da latin-ext ile yüklenir (`src/main.tsx`); Türkçe harfler eksiksizdir.

### Hierarchy
- **Display** (800, clamp(52px, 7.6vw, 112px), 0.95; telefonda clamp(46px, 13vw, 64px)): vitrindeki yer adı (Ani, Sarıkamış). Sayfada tek.
- **Hero greeting** (800, clamp(20px, 2vw, 28px), 1.15): vitrinin sayfa başlığı (h1, "Kars'tan selamlar."), kehribar hap etiket içinde -3° eğik. Yalnız vitrinde.
- **Headline** (800, clamp(32px, 3.6vw, 52px), 1.04, -0.015em): bölüm başlıkları (h1, h2).
- **Band headline** (800, clamp(28px, 3vw, 42px)): renkli bant içindeki başlık.
- **Tile name** (800, 28px; telefonda 25px): tur kartı fotoğrafının altındaki yer adı.
- **Price** (800, 27px): tur kartı fiyatı, tür metin renginde. Döner etikette **Sticker price** (clamp(20px, 1.75vw, 26px), tabular rakam).
- **Title** (Baloo 2 700, 19px; telefonda 16px): tür rozeti adı; alt bilgi başlıkları 20px 700; renkli kart başlıkları 26px 800.
- **Card title** (Onest 600, 16.5px): tur kartındaki tur adı; genel h3 Onest 600.
- **Lead** (Onest 400, 18px, 1.45, en çok 46ch): vitrindeki tur adı.
- **Body** (Onest 400, 16px): gövde.
- **Button** (Onest 700, 15–16px), **Chip** (Onest 600, 13px), **Label** (Onest 600, 12px): düğme, tür etiketi, arama alanı etiketi. Büyük harf ve harf aralığı yok.

### Named Rules
**The Yuvarlak Ses Rule.** Baloo 2 yalnız 700 ve 800 kalınlıktadır ve yer adı, başlık, fiyat içindir; açıklama, form değeri ve etiket her zaman Onest'tir. Baloo 2 gövde metnine inmez.

**The Etiketsiz Başlık Rule.** Bölüm başlıklarının üstünde küçük üst etiket (eyebrow) yoktur. Vitrindeki kehribar selam etiketi bir üst etiket değil, sayfanın kendi h1'idir ve başka bölüme çoğaltılmaz.

## Layout

Kapsayıcı postcard.css'ten devralınır (en çok 1280px, iki yanda 56px). Vitrin kapsayıcı genişliğinde, 16px üst boşlukla başlar; sahne yüksekliği `clamp(460px, calc(100svh - 250px), 640px)`, böylece ilk ekranda vitrin, üstüne binen arama çubuğu ve güven satırı birlikte görünür. Vitrin metni solda (sol boşluk clamp(24px, 5vw, 72px), en çok 680px / %68), döner fiyat etiketi sağ üstte, denetimler sağ altta durur.

Arama çubuğu vitrinin alt kenarına 46px biner, en çok 1100px genişliğindedir ve dört sütunludur (rota 1.45fr / tarih 1fr / yolcu 0.8fr / düğme). Altında ortalanmış güven satırı, ardından ortalanmış yuvarlak tür rozetleri sırası (aralık clamp(12px, 3vw, 46px), 48px üst boşluk). Güven bandı kapsayıcıyı aşıp tam genişlikte akar (56px üst boşluk).

Tur ızgarası 34px x 28px aralıklıdır. Bölüm ritmi: hikâye 96px, koltuk bölümü 90px dikey boşluk; özel tur bandı 46px 56px iç boşluklu.

950px altında arama çubuğu iki sütuna ve 28px köşeli kutuya döner: rota alanı ve düğme tam genişlik, alanlar kâğıt zeminli 18px köşeli kutucuklar. 760px altında vitrin kenara kadar uzanır (yalnız alt köşeleri 30px, yükseklik min(540px, 64svh)), oklar gizlenir ve yalnız durdur düğmesi kalır, tür rozetleri yatay kaydırılan, yakalamalı bir şeride döner (88px), bölüm boşlukları 70px / 60px'e iner.

## Elevation & Depth

Derinlik yumuşak, aşağı düşen, mürekkep tonlu gölgeyle verilir; renkli öğelerde gölge o öğenin rengine boyanır. Yüzeyler dinlenirken hafifçe kalkar, üzerine gelince yükselir ve gölgesi tür rengini alır. Fotoğraf üstündeki yazı iki örtüyle okunur: soldan koyu bir karartma ve alttan rota renginde bir tül.

### Shadow Vocabulary
- **Kart** (`box-shadow: 0 30px 60px -34px rgba(27,31,42,0.5), 0 2px 6px rgba(27,31,42,0.06)`): büyük kartlar; devralınan sayfaların ana kartı.
- **Küçük kart** (`box-shadow: 0 18px 40px -28px rgba(27,31,42,0.45), 0 1px 3px rgba(27,31,42,0.06)`): tur kartı ve renkli kartlar dinlenirken.
- **Tür gölgesi** (`box-shadow: 0 34px 50px -30px color-mix(in srgb, var(--tone) 80%, transparent), 0 2px 6px rgba(27,31,42,0.06)`): kart üzerine gelince, 6px yükselmeyle birlikte.
- **Alev düğme** (`box-shadow: 0 14px 26px -14px rgba(214,58,18,0.75)`; üzerine gelince `0 18px 30px -14px rgba(214,58,18,0.85)`): dolu düğme.
- **Arama çubuğu** (`box-shadow: 0 26px 50px -22px rgba(27,31,42,0.42), 0 2px 6px rgba(27,31,42,0.06)`): vitrine binen beyaz çubuk.
- **Etiket** (`box-shadow: 0 22px 40px -18px rgba(0,0,0,0.6)`): fotoğraf üstündeki döner fiyat etiketi.
- **Örtüler:** vitrin `linear-gradient(90deg, rgba(10,12,22,0.72), rgba(10,12,22,0.28) 52%, transparent 78%)` + alttan 20° tür tülü (%78); tur kartı fotoğrafının alt %32'sinde tür tülü (%0 → %72 → %88).

### Named Rules
**The Renkli Gölge Rule.** Gölge hep aşağıdır ve renkli bir öğenin altında kendi rengini alır (alev düğme, tür kartı, amber bölümdeki kart, macenta bant). Sert kaydırılmış gölge kullanılmaz.

**The Üzerine Gelince Kalk Rule.** Etkileşimli yüzey üzerine gelince 2px (düğme) ile 6px (kart) arası yükselir; kart fotoğrafı 1.07 yakınlaşır. Kart yükselmesi yalnız gerçek imleçli cihazlarda (`hover: hover` ve `pointer: fine`) olur.

## Shapes

Yuvarlak bir dünya: kart 22px, vitrin ve renkli bantlar 30px, devralınan sayfaların ana kartı 28px, iç fotoğraflar ve küçük kutular 18px. Düğmeler, arama çubuğu ve alanları, filtreler, etiketler ve rozetler haptır (999px); tür rozetleri, fiyat etiketi ve denetim okları tam daire. İlerleme çubukları 8px yuvarlak uçludur. Fiyat etiketi -10°, selam etiketi -3° eğiktir; eğim yalnız bu iki yapıştırma etikette ve hikâye kartının üzerine gelme durumunda (-1°) vardır. Fiyat etiketinin içinde 11px içeride kesik çizgili bir halka durur.

## Components

### Buttons
Dolgun, dostça, dokununca yaylanan.
- **Shape:** hap (999px), en az 52px yükseklik.
- **Primary:** alev zemin, beyaz Onest 700, alev gölge.
- **Hover / Focus:** koyu alev, 2px yükselme ve daha güçlü gölge; basınca 0.98 küçülme; odakta 3px alev halka, 3px boşluk.
- **White:** beyaz zemin, mürekkep yazı, nötr gölge. Vitrinde "Turu incele" (48px, sağ ok) üzerine gelince slaydın tür rengine boyanır ve ok 4px kayar. Renkli bant üstündeki beyaz düğme koyu alev yazılıdır, üzerine gelince kehribara döner.
- **Outline / menü eylemi:** 2px kenarlı; menüdeki eylem düğmesi dolu alevdir.
- **Metin bağlantısı:** alev renkli, alt çizgisiz, sağ oklu; üzerine gelince ok 4px kayar.

### Chips
- **Tür etiketi (vitrin):** dolgusuz, 1px yarı saydam beyaz kenarlı hap, 13px; başında beyaz halkalı 8px tür noktası. Düğme gibi görünmemesi bilinçlidir.
- **Tur filtreleri:** beyaz hap, 2px kenarı tür renginin %28'i; üzerine gelince kenar tam tür rengi ve 2px yaylı yükselme; etkin filtre tür rengiyle dolu, `--on-tone` yazılı. "Tüm rotalar" mürekkep tonunu alır.
- **Kart üstü rozetler:** "Turu keşfet" sağ üstte, "satışa kapalı" / "ön kayıt açık" sol üstte, ikisi de hap.

### Cards / Containers
- **Tur kartı (imza):** 22px köşe, taşma gizli, küçük kart gölgesi. 4:3 fotoğrafın alt kısmında tür tülü ve üstünde `--on-tone` renginde Baloo 2 28px yer adı; altında 16px 18px 18px iç boşlukla tur adı, süre, ilk hareket ve koltuk satırı, sağa hizalı tür renginde fiyat. Üzerine gelince 6px yükselir, gölgesi tür rengini alır, fotoğraf yavaşça yakınlaşır. Rengi `tourTone(tour)` ile gelir; yoksa alev.
- **Renkli kart ("Kars'ta başka neler var"):** tamamı tür rengiyle dolu, üstte kenarsız fotoğraf, beyaz Baloo 2 26px başlık.
- **Hikâye kartı:** gece zemininde, 4px'lik konik renk halkası (alev → macenta → kehribar) içinde 18px köşeli fotoğraf.
- **Renkli bölümler:** gece laciverti hikâye bölümü, kehribar koltuk bölümü (içinde 30px köşeli beyaz kart), alevden macentaya 110° geçişli özel tur bandı (sağ üstünde yavaş dönen kesik çizgili halka).

### Inputs / Fields
- **Arama alanı:** beyaz hap çubuk içinde kutusuz alanlar; ikon solda alev renginde, üstte 12px etiket, altta 16px 600 değer; alanlar arasında 1px çizgi ayırıcı. Üzerine gelince ve odakta kâğıt dolgu; klavye odağında alanın içine 2px alev halka.
- **Devralınan form alanları:** kartpostal düzeni korunur; odakta alt çizgi alev olur.

### Navigation
Üstte 34px mürekkep şerit (bağlantılar üzerine gelince kehribar), altında %94 opak, bulanık arka planlı 76px beyaz menü. Menü bağlantıları Onest 600, 22px aralıklı; üzerine gelince ve etkinken alev, etkin bağlantının altında 3px yuvarlak alev çizgi. Sağda dolu alev eylem düğmesi. Dar ekran davranışı postcard.css'ten devralınır.

### Vitrin (HeroSlider, imza bileşeni)
Dört rota, 6.5 saniyede bir 0.9s çapraz geçiş; etkin slaytın fotoğrafı 9s boyunca 1.14'ten 1.02'ye yavaşça yakınlaşır, metin 0.1s aralıklarla yükselir, fiyat etiketi yaylı belirip yavaşça süzülür. Denetimler: buzlu cam yuvarlak oklar, ilerlemesi dolan çubuk noktalar (etkin olan 58px), durdur / sürdür. Üzerine gelince veya odakta durur; hareket azaltılmışsa otomatik geçiş ve durdur düğmesi yoktur. Etkin olmayan slaytlar `inert`'tir. Yapay zekâ ile üretilmiş görsellerde sağ üstte "Temsili · Yapay zekâ" notu durur.

### Döner fiyat etiketi (imza bileşeni)
Slaydın tür renginde, -10° eğik daire; içinde kesik çizgili halka, Baloo 2 "{fiyat}'den" ve altında "kişi başı". Satışa kapalı veya fiyatsız turda fiyat yerine o durumu yazar.

### Yuvarlak tür rozetleri (imza bileşeni)
108px daire fotoğraf, tür renginden konik geçişli 5px halka ve 3px beyaz kenar; altında Baloo 2 tür adı ve "N rota". Üzerine gelince yaylı 5px yükselir ve halka döner; seçiliyken halka düz tür rengi, ad tür metin renginde. Dokunmak tur listesini o türe süzer ve listeye kayar. Ekrana gelince 70ms arayla sırayla belirir.

### Rota şeridi
Sayfanın en üstünde ve alt bilginin üst kenarında 6px yatay şerit: alev, kehribar, çam, buz mavisi, macenta eşit beşte birler. Dünyanın imzasıdır; başka yerde tekrarlanmaz.

## Do's and Don'ts

### Do:
- **Do** yeni halka açık yüzeyleri `.kp` içinde kur ve rengi `toneStyle(tourTone(tour))` / `toneStyle(filterTone(f))` ile ver; bileşende yalnız `--tone`, `--on-tone`, `--tone-ink` oku.
- **Do** tür renginin üstüne beyaz yazı koy, kehribarın üstüne mürekkep; beyaz zeminde tür rengiyle metin yazarken `-ink` değerini kullan.
- **Do** düğme, filtre, alan ve etiketleri hap biçiminde; kartları 22px, büyük bantları 30px köşeli kur.
- **Do** yer adlarını, başlıkları ve fiyatları Baloo 2 800 ile, geri kalan her şeyi Onest ile yaz.
- **Do** fotoğraf üstündeki yazıyı koyu karartma ve tür tülüyle okunur kıl.
- **Do** her hareketi `prefers-reduced-motion: no-preference` içine koy ve kendiliğinden ilerleyen her şeye durdur düğmesi ver.
- **Do** rezervasyon tutarını "Tur bedeli" / "İndirim sonrası tur bedeli" diye etiketle ve altına "Şimdi ödeme alınmaz." satırını koy (devralınan rezervasyon sayfalarında yürürlükte).
- **Do** Google puanını yalnız canlı veriden göster; veri yoksa satırı gösterme.
- **Do** yapay zekâ ile üretilmiş görsele "Temsili · Yapay zekâ" notunu koy.

### Don't:
- **Don't** ham tür rengini bileşen içinde sabit yazma veya bir türün rengini başka bir tür için kullanma.
- **Don't** turuncu-kırmızıyı tür veya süs rengi olarak kullanma; o yalnız eylem, odak, seçim ve aciliyettir.
- **Don't** bölüm başlıklarının üstüne küçük üst etiket (eyebrow) koyma; vitrindeki selam etiketini başka bölümlere çoğaltma.
- **Don't** sert kaydırılmış gölge kullanma.
- **Don't** Baloo 2'yi gövde metni, form değeri veya uzun açıklama için kullanma.
- **Don't** panelin tüf siyahını, kırmızısını veya bileşenlerini halka açık siteye getirme; panel sistemi `docs/DESIGN-PANEL.md` içindedir.
- **Don't** QR koduna renk, filtre, karışım veya yuvarlatma uygulama.

## Araç

18 yolcu + 1 sürücü koltuğu (18+1 VIP midibüs). Şoför yanındaki ön koltuk varsayılan olarak rehbere ayrılır ve satışa kapalıdır. 17 satış koltuğu: ilk sıra 2 koltuk + kapı, ardından beş adet 2+1 sıra. Fiziksel sıra yerleşimi varsayımdır; gerçek araç fotoğrafıyla teyit edilir ve `server/catalog.mjs` içindeki `vehicle.layout` ile değiştirilebilir. Kapasite ve rehber kısıtı hem istemci hem sunucuda uygulanır.
