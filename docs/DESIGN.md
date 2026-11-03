---
name: Rota Kars (halka açık site)
description: Eski çok görüntülü Kars hatıra kartı; kar zemini, beyaz kart kartonu, mavi-siyah mürekkep, uçak postası kırmızısı.
colors:
  snow: "#e9eef1"
  card: "#ffffff"
  ink: "#1a2846"
  ink-2: "#47536e"
  rule: "#c9d2dc"
  hair: "#e3e8ee"
  paper: "#f3f6f8"
  sky: "#e3e9ee"
  red: "#c2342b"
  red-deep: "#9f271f"
  gold: "#8a6128"
  logo-gold: "#a87835"
typography:
  display:
    fontFamily: "Marcellus, Georgia, serif"
    fontSize: "clamp(40px, 5.2vw, 76px)"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "-0.01em"
  page-title:
    fontFamily: "Marcellus, Georgia, serif"
    fontSize: "clamp(40px, 5vw, 64px)"
    fontWeight: 400
    lineHeight: 1.16
    letterSpacing: "-1.8px"
  headline:
    fontFamily: "Marcellus, Georgia, serif"
    fontSize: "clamp(34px, 3.6vw, 50px)"
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: "-0.5px"
  price-stamp:
    fontFamily: "Marcellus, Georgia, serif"
    fontSize: "40px"
    fontWeight: 400
  price:
    fontFamily: "Marcellus, Georgia, serif"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 1
    fontFeature: "tnum"
  title:
    fontFamily: "Marcellus, Georgia, serif"
    fontSize: "21px"
    fontWeight: 400
  field-value:
    fontFamily: "Marcellus, Georgia, serif"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.3
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
  lead:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 400
rounded:
  none: "0px"
  label: "2px"
  chip: "3px"
  sm: "4px"
  card: "5px"
spacing:
  view-gap: "10px"
  view-gap-phone: "6px"
  card-pad: "14px"
  card-pad-phone: "8px"
  strip-gap: "26px"
  container-gutter: "56px"
  section: "92px"
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
    rounded: "{rounded.none}"
    padding: "9px 14px 10px"
  back-of-card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
    padding: "44px 48px 30px"
---

# Design System: Rota Kars (halka açık site)

Bu dosya halka açık siteyi (ana sayfa, tur listesi, tur detayı, rezervasyon) anlatır. Acente paneli (`/yonetim`, `.rk-admin`) ayrı bir dünyadır ve `docs/DESIGN-PANEL.md` dosyasında tanımlıdır. Önceki halka açık görünüm (kar beyazı / bazalt lacivert / altın, lacivert düğmeler) git dalı `yedek/mevcut-site-tasarimi` içinde saklıdır.

## Overview

**Creative North Star: "Hatıra Kartı" (çok görüntülü Kars kartpostalı)**

Site, eski usul çok görüntülü bir Kars hatıra kartı gibi kurulur: bir büyük manzara, yanında küçük manzaralar, fotoğrafın üstüne binen kırmızı başlık şeridi ve altta beyaz bir açıklama bandı. Kart, kar renginde soğuk açık bir zeminin üstünde 14px beyaz kenarlı bir karton olarak durur; yumuşak, aşağı düşen bir gölgeyle kâğıt gibi kalkar. Tur sayfaları kartın arka yüzüdür: program tek kesintisiz kırmızı rota çizgisinde okunur, fiyat dişli kenarlı bir pul ve üstüne vurulmuş bir posta damgasıyla gösterilir.

Dünyanın tüm stilleri `src/postcard.css` içinde, `.kp` kapsayıcısıyla sınırlıdır (`Layout.tsx` halka açık sayfaları `.kp` ile sarar). Bu dosya aynı zamanda `src/styles.css` içindeki eski site jetonlarını (`--navy`, `--ink`, `--muted`, `--line`, `--paper`, `--sky`, `--gold`, `--gold-text`) yeni dünyanın değerlerine eşler. Tam olarak tasarlanmış yüzeyler: üst kenar ve menü, ana sayfa hatıra kartı, tur listesi kartları, tur detayı kartı ve arka yüzü, pul fiyat, alt bilgi. Ana sayfanın alt bölümleri (hikâye, VIP araç ve koltuk planı, hizmetler, filo, konaklama, Instagram, yorumlar) ve rezervasyon akışı eski düzenlerini korur; yalnız jeton eşlemesi, 4px köşe normalizasyonu ve düğme stilleriyle bu dünyaya oturtulmuştur. Onlar yeni dünyanın örneği sayılmaz.

Reddedilen kalıp: tam genişlikte hero fotoğrafı ve üstünde yüzen arama kutusu (her tur acentesinin varsayılanı).

**Key Characteristics:**
- Soğuk kar zemini üstünde beyaz kart kartonu; fotoğraflar kartın içine 10px aralıkla yerleşir.
- Mavi-siyah mürekkep metin; kırmızı başlık şeridi ve eylem; logo altını fiyat ve pul için.
- Sayfanın üstünde ve alt bilginin üstünde ince uçak postası şeridi.
- Marcellus başlıklar, form değerleri ve fiyatlar; Onest etiketler ve gövde.
- Küçük, düz köşeler (0–5px); hap biçimi yok.

## Colors

Soğuk mavi-gri bir kâğıt dünyası; sıcaklık yalnız kırmızı mürekkepte ve altında.

### Primary
- **Uçak Postası Kırmızısı** (red): başlık şeridi (hero `h1`, tur kartı şeridi), birincil düğme, etkin menü alt çizgisi, seçili manzara çerçevesi ve işareti, klavye odağı, tur programındaki rota çizgisi ve saatleri, liste ikonları (dahil olanlar, notlar, buluşma, sık sorulan oku). Üzerine her zaman beyaz yazılır.
- **Koyu Posta Kırmızısı** (red-deep): yalnız birincil düğmenin üzerine gelme durumu.

### Secondary
- **Logo Altını** (gold): metin olarak kullanılan altın; tüm fiyatlar (pul, tur kartı, bilgi bandı, manzara etiketleri, mobil rezervasyon çubuğu). Beyaz kartta okunur kontrast sağlar.
- **Logo Altını, açık ton** (logo-gold): sabitlenmiş marka altını; eski `--gold` jetonu olarak logoda ve eski bölümlerdeki dekoratif altın vurgularda kalır. Metin için kullanılmaz.

### Neutral
- **Kar** (snow): sayfa zemini ve `body` arka planı; kartlar bunun üstünde durur.
- **Kart Kartonu** (card): hatıra kartı, tur kartları, arka yüz, pul, alt bilgi, manzara etiketleri, beyaz düğme.
- **Mavi-Siyah Mürekkep** (ink): ana metin, çerçeveli düğme, etkin filtre, metin seçimi arka planı, posta damgası.
- **Soluk Mürekkep** (ink-2): etiketler, ikincil metin, alan alt çizgisi, basılı küçük satır, ikonlar.
- **Çizgi** (rule): filtre ve arama kutusu kenarı, pul içindeki çerçeve.
- **Kıl Çizgi** (hair): basılı satırın üst ayırıcısı, `details` ayırıcıları.
- **Kâğıt** (paper): arka yüz içindeki sakin kutular (dahil olanlar, bilgi notu, buluşma, sonraki hareketler).
- **Gök** (sky): fotoğraflar yüklenmeden önceki yer tutucu zemin.

### Named Rules
**The Kırmızı Mürekkep Rule.** Kırmızı başlık şeridi, eylem, seçim/odak ve rota çizgisi içindir. Gövde metninde, büyük yüzey dolgularında veya süslemede kullanılmaz; bir ekranda tek bir dolu kırmızı eylem düğmesi vardır.

**The Altın Fiyat Rule.** Bir rakam para ise altın (gold) ve Marcellus ile yazılır; altın başka hiçbir metin için kullanılmaz.

**The Soğuk Zemin Rule.** Zemin kar mavisi-gri kalır; kremaya veya sıcak beje çekilmez. Sıcaklık yalnız kırmızı ve altından gelir.

## Typography

**Display Font:** Marcellus (Georgia yedeği), @fontsource ile kendi sunucumuzda, yalnız 400.
**Body Font:** Onest (Arial yedeği), @fontsource ile 400 / 500 / 600.

**Character:** Marcellus kartpostal baskısının oyma harfli başlığıdır; Onest kartın arkasındaki sade, okunur yazı. Yazı tipleri kullanıcı tarafından sabitlenmiştir.

### Hierarchy
- **Display** (Marcellus 400, clamp(40px, 5.2vw, 76px), 1.02; telefonda 38px): yalnız hatıra kartı başlık şeridi (ana sayfa ve tur detayı `h1`).
- **Page title** (Marcellus 400, clamp(40px, 5vw, 64px)): tur listesi gibi kartsız sayfa girişleri.
- **Headline** (Marcellus 400, clamp(34px, 3.6vw, 50px), 1.08, `text-wrap: balance`): bölüm başlıkları; arka yüzde clamp(28px, 2.6vw, 34px).
- **Title** (Marcellus 400, 20–22px): program adımları (21px), alt bilgi sütun başlıkları (20px), tur kartı şeridi (22px), harita yedeği (22px).
- **Field value** (Marcellus 400, 20px): açıklama bandındaki seçim ve tarih değerleri.
- **Price** (Marcellus 400, 24px, tabular; pulda 40px): her fiyat, altın.
- **Card title** (Onest 600, 16px, 1.3): tur kartı adı.
- **Body** (Onest 400, 15px, 1.6; en çok 60–62ch): program metni, sık sorulanlar, kart metinleri. **Lead** 17px / 1.75 arka yüz giriş metni.
- **Label** (Onest 400, 12px, ink-2): alan ve bilgi etiketleri, `dt`; basılı satır 13px.

### Named Rules
**The Kartpostal Baskısı Rule.** Marcellus başlık, değer ve fiyattır; Onest her şeyin geri kalanıdır. Başlıklarda seçili kelime italik veya renkle öne çıkarılmaz.

**The Etiketsiz Başlık Rule.** Bölüm başlıklarının üstünde küçük üst etiket (eyebrow) yoktur; eski `.section-note` bu dünyada gizlidir.

## Layout

Kapsayıcı en çok 1280px, iki yanda 56px boşluk (`calc(100% - 112px)`); telefonda hatıra kartı `calc(100% - 24px)` ile neredeyse kenara kadar uzanır. Hatıra kartında büyük manzara ve küçük manzaralar 1.85fr : 1fr oranında, 10px aralıkla; yükseklik ekrana göre `clamp(420px, calc(100svh - 300px), 560px)`, böylece ilk ekranda kartın tamamı ve açıklama bandı görünür. Küçük manzaralar ana sayfada 2x2, tur detayında tek sütun yığın.

Açıklama bandı dört sütunlu bir ızgaradır (rota / tarih / yolcu / düğme, 26px sütun aralığı), alta hizalı; altında kıl çizgiyle ayrılmış basılı küçük satır. Tur kartı ızgarası 36px x 30px aralıklı.

950px altında manzaralar alt alta iner, küçük manzaralar dört sütunlu bir şerit olur (170px), açıklama bandı iki sütuna ve tam genişlik düğmeye geçer. 700px altında üst bilgi şeridi gizlenir, kart iç boşluğu 8px, manzara aralıkları 6px olur, basılı satır alt alta dizilir. Menü 1350 / 1100 / 950px eşiklerinde küçülür, 700px altında açılır menüye döner. Eski bölümlerin dikey ritmi 92px'tir.

## Elevation & Depth

Derinlik kâğıt mantığıyla verilir: kart kartonu kar zemininden yumuşak, aşağı uzanan, mürekkep tonlu bir gölgeyle kalkar. Gölge yalnız kartlara (hatıra kartı, tur kartı, arka yüz, fiyat kutusu) ve kartın üstündeki yapıştırma öğelerine (başlık şeridi, tur kartı içindeki küçük fotoğraf) verilir. İç yüzeyler (kâğıt kutular, alanlar, etiketler) düzdür.

### Shadow Vocabulary
- **Kart** (`box-shadow: 0 30px 60px -32px rgba(26,40,70,0.42), 0 2px 6px rgba(26,40,70,0.08)`): hatıra kartı; tur kartının üzerine gelme durumu.
- **Küçük kart** (`box-shadow: 0 18px 34px -24px rgba(26,40,70,0.45), 0 1px 3px rgba(26,40,70,0.08)`): tur kartı, arka yüz, fiyat kutusu.
- **Şerit** (`box-shadow: 0 12px 26px -14px rgba(0,0,0,0.55)`): fotoğraf üstündeki kırmızı başlık şeridi.
- **Yapıştırma fotoğraf** (`box-shadow: 0 8px 16px -8px rgba(0,0,0,0.55)`): tur kartındaki 4px beyaz kenarlı küçük manzara.
- **Mobil çubuk** (`box-shadow: 0 -10px 30px -18px rgba(26,40,70,0.5)`): tur detayının sabit rezervasyon çubuğu.

### Named Rules
**The Kâğıt Gölgesi Rule.** Gölge hep aşağı ve mürekkep tonludur, ışık gibi yayılmaz; sert kaydırılmış gölge kullanılmaz.

## Shapes

Köşeler kâğıt kesimi gibi küçük ve düzdür: kart 5px, düğme / filtre / tur kartı / eski bölüm görselleri 4px, etiketler 2–3px. Kartın içindeki fotoğraflar, başlık şeridi ve tur kartı şeridi tamamen keskin köşelidir (0). Açıklama bandı alanları kutusuzdur: yalnız 1px alt çizgi. Tekrarlanan biçimler: uçak postası kenarı (kırmızı / beyaz / mürekkep / beyaz, -45° eğik, sayfa üstünde 8px, alt bilginin üstünde 6px), pulun dişli kenarı (radyal maske ile delikli 9px çerçeve), yuvarlak posta damgası (iki halka, -12° döndürülmüş, `multiply` karışım). Tek yuvarlak öğe seçili manzara işaretidir (26px daire).

## Components

### Buttons
Mürekkeple basılmış, sağlam ve düz.
- **Shape:** düz köşe (4px), en az 52px yükseklik, 15px Onest 600, ikonla 10px aralık.
- **Primary:** kırmızı dolgu, beyaz yazı, 14px 24px. Üzerine gelince koyu kırmızı; gölge yok.
- **Small:** 42px yükseklik, 10px 16px, 14px yazı.
- **Outline / üst menü eylemi:** şeffaf, 1.5px mürekkep kenar, mürekkep yazı; üzerine gelince mürekkep dolgu, beyaz yazı.
- **White:** kart beyazı dolgu, mürekkep yazı; üzerine gelince #eef2f5.
- **Text link:** mürekkep, 15px 600, 1px alt çizgi 5px açıklıkta; üzerine gelince kırmızı.
- **Focus:** tüm etkileşimli öğelerde 2px kırmızı dış çizgi, 3px açıklık.

### Chips
- **Style:** tur listesi filtreleri; kart beyazı, 1px çizgi (rule) kenar, 4px köşe, 14px 500, 8px 14px. Üzerine gelince kenar soluk mürekkep.
- **State:** etkin filtre mürekkep dolgu, beyaz yazı.

### Cards / Containers
- **Hatıra kartı:** kart beyazı, 5px köşe, 14px iç boşluk (telefonda 8px), kart gölgesi. İçinde büyük manzara, küçük manzaralar, açıklama bandı, basılı satır.
- **Tur kartı:** kart beyazı, 4px köşe, 10px kenar (alt boşluk yok), küçük kart gölgesi. Fotoğraf 4:3, keskin köşe; sol altta kırmızı yer adı şeridi (Marcellus 22px), sağ üstte 4px beyaz kenarlı ikinci manzara (genişliğin %30'u). Alt satırda Onest ad ve süre, sağda altın fiyat ve "kişi başı". Üzerine gelince 4px yukarı ve -0.4° dönerek kart gölgesine geçer (0.45s, `cubic-bezier(0.16,1,0.3,1)`).
- **Arka yüz (tur detayı içeriği):** kart beyazı, 5px köşe, küçük kart gölgesi, 44px 48px 30px iç boşluk (telefonda 26px 18px 14px). İçindeki kutular kâğıt zeminli, 4px köşe, gölgesiz.

### Inputs / Fields
- **Açıklama bandı alanı:** kutusuz; 12px soluk mürekkep etiket, altında Marcellus 20px değer, 1px soluk mürekkep alt çizgi, en az 44px. Odakta alt çizgi kırmızı olur ve 1px kırmızı gölgeyle kalınlaşır.
- **Arama kutusu (tur listesi):** kart beyazı, 1px çizgi kenar, 4px köşe.
- Rezervasyon formları eski düzenlerini korur; yalnız jeton eşlemesiyle renklenir.

### Navigation
Üst bilgi şeridi (12px, soluk mürekkep, 28px) ve şeffaf başlık (70px, logo 140x51) kar zemininde durur; kenar çizgisi yok. Menü Onest 15px 500, 30px aralık; etkin bağlantının altında kırmızı çizgi. Sağda üyelik ve rezervasyon bağlantıları (13px) ve çerçeveli "Birlikte planlayalım" düğmesi. 700px altında açılır menü kart beyazı zeminde.

### Hatıra kartı manzaraları (imza bileşeni)
Büyük manzara, alt yarısında mürekkep tonlu karartma (`rgba(12,20,38,0.6)`'ya iner) ve sol altta fotoğrafın kenarından taşan kırmızı başlık şeridi; altında beyaz 17px tek satırlık açıklama. Küçük manzaralar düğmedir (`aria-pressed`): sol altta beyaz etiket (Marcellus 17px yer adı, altında 12px 600 altın "…'den" fiyat), seçilince içten 4px kırmızı çerçeve ve sağ üstte kırmızı daire içinde onay işareti; seçim açıklama bandındaki rota alanını doldurur. Üzerine gelince fotoğraf 1.05 büyür (0.9s).

### Pul fiyat ve posta damgası (imza bileşeni)
Tur detayındaki fiyat kutusunda fiyat bir puldur: delikli kenarlı #e6ecf1 çerçeve içinde beyaz alan, 1px çizgi kenar; üstte tur adı pulun basılı yer yazısı olarak (11px 600, büyük harf, 0.08em), altında Marcellus 40px altın fiyat. İlk hareket varsa pulun sağına SVG posta damgası vurulur: iki halka, üstte "KARS", ortada tarih (Marcellus 16px), altta saat; mürekkep, %82 opaklık, -12°.

### Rota çizgisi (tur programı)
Program tek kesintisiz 2px kırmızı dikey çizgidir. Her adım: kırmızı 13px 600 tabular saat, 16px beyaz dolgulu kırmızı halkalı durak, Marcellus 21px adım adı, 15px soluk mürekkep metin. Son durak dolu kırmızı.

### Basılı satır ve bilgi bandı
Hatıra kartının en altında, kıl çizgiyle ayrılmış 13px soluk mürekkep satır: TÜRSAB, Kars'ta kaç yıldır, ödeme notu, Google puanı yalnız API döndürdüğünde. Tur detayında açıklama bandı bilgi listesidir (güzergâh, süre, araç, altın fiyat) ve sağda kırmızı eylem.

### Yüzen düğmelerin geri çekilmesi
WhatsApp ve asistan düğmeleri, hatıra kartının eylem bandı ekrandayken (`body[data-cta-visible]`) 24px aşağı kayıp gizlenir (0.25s); tur detayının mobil rezervasyon çubuğu da karttaki düğme görünürken saklanır. Azaltılmış hareket tercihinde geçişler kapanır.

## Do's and Don'ts

### Do:
- **Do** yeni halka açık yüzeyleri `.kp` içinde ve `--kp-*` jetonlarıyla kur; eski jetonları doğrudan yeniden tanımlama.
- **Do** ana ilk görünümü kar zemininde beyaz bir kart olarak kur: kart içinde fotoğraflar 10px aralıkla, keskin köşeli; kartın kendisi 5px köşeli ve kart gölgeli.
- **Do** her fiyatı Marcellus ve altın (gold) ile, tabular rakamlarla yaz.
- **Do** form değerlerini açıklama bandı gibi kutusuz, alt çizgili ve Marcellus 20px tut.
- **Do** kırmızıyı başlık şeridi, eylem, seçim/odak ve rota çizgisiyle sınırla.
- **Do** Google puanını yalnız canlı veriden göster; veri yoksa satırı gösterme.

### Don't:
- **Don't** tam genişlikte hero fotoğrafı ve üstünde yüzen arama kutusu kullanma.
- **Don't** hap biçimli düğme, etiket veya filtre yapma; 5px üstü köşe yok.
- **Don't** bölüm başlıklarına üst etiket (eyebrow) ekleme.
- **Don't** zemini kremaya ısıtma veya panelin tüf siyahını, kırmızısını getirme; panel sistemi `docs/DESIGN-PANEL.md` içindedir.
- **Don't** logo altınını (logo-gold) metin rengi olarak kullanma; metin altını gold'dur.

## Araç

18 yolcu + 1 sürücü koltuğu (18+1 VIP midibüs). Şoför yanındaki ön koltuk varsayılan olarak rehbere ayrılır ve satışa kapalıdır. 17 satış koltuğu: ilk sıra 2 koltuk + kapı, ardından beş adet 2+1 sıra. Fiziksel sıra yerleşimi varsayımdır; gerçek araç fotoğrafıyla teyit edilir ve `server/catalog.mjs` içindeki `vehicle.layout` ile değiştirilebilir. Kapasite ve rehber kısıtı hem istemci hem sunucuda uygulanır.
