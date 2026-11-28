// Veriyle beslenen keşif sayfaları (Çıldır Gölü, Sarıkamış). Ani'nin kendine özgü
// yürüyüş haritalı sayfası Discover.tsx'tedir; buradakiler aynı hatıra kartı parçalarını
// paylaşır: açılış kartı, tanıtım ve fotoğraf, rota çizgisi, mevsim takvimi, öne çıkanlar,
// ipuçları, ilgili rehber yazıları ve tur kartı. Metinler Türkçedir; İngilizcesi
// src/lib/en/discover.ts'tedir (t() anahtarı Türkçe metnin kendisi).
export type PlaceTip = { icon: "sun" | "shirt" | "ice" | "ticket" | "camera" | "ski" | "mountain"; title: string; text: string };
export type Place = {
  slug: string;
  title: string;
  tagline: string;
  hero: { src: string; alt: string };
  credit: string;
  printed: string;
  facts: { label: string; value: string; icon: "pin" | "mountain" | "snow" | "calendar" }[];
  tourId: string;
  intro: { heading: string; paragraphs: string[]; photo: { src: string; alt: string; caption: string } };
  timeline: { heading: string; items: { time: string; title: string; text: string }[] };
  // Ay numaraları 1–12; "from > to" yıl sonundan başa sarar (ör. Aralık–Mart).
  seasons: { heading: string; note: string; rows: { label: string; from: number; to: number }[] };
  story?: { heading: string; paragraphs: string[]; photo: { src: string; alt: string; caption: string } };
  highlights: { heading: string; items: { title: string; text: string; image?: string }[] };
  tips: PlaceTip[];
  articles: string[];
  cta: { heading: string; text: string };
};

export const PLACES: Record<string, Place> = {
  cildir: {
    slug: "cildir",
    title: "Çıldır’ı keşfet",
    tagline: "Buzun üstünde bir kış masalı.",
    hero: { src: "/images/rehber/cildir-kizak.webp", alt: "Donmuş Çıldır Gölü’nde iki atlı kızak" },
    credit: "Fotoğraf: Linda M Caldwell, CC BY-SA 4.0",
    printed: "Kars ile Ardahan arasında, Doğu Anadolu’nun en büyük göllerinden",
    facts: [
      { label: "Konum", value: "Kars’a yaklaşık 1 saat", icon: "pin" },
      { label: "Yükseklik", value: "Yaklaşık 1.960 m", icon: "mountain" },
      { label: "Buz zamanı", value: "Genellikle ocak–mart", icon: "snow" },
    ],
    tourId: "ani-cildir",
    intro: {
      heading: "Kışın beyaz bir ovaya dönen göl.",
      paragraphs: [
        "Çıldır Gölü, Kars ile Ardahan arasında, deniz seviyesinden yaklaşık iki bin metre yükseklikte uzanır. Yazın kıyıları yeşillenir, göçmen kuşlar konaklar; kışın ise göl baştan sona donar ve uçsuz bucaksız beyaz bir ovaya dönüşür.",
        "Buz tuttuğunda kıyıdaki köylerden atlı kızaklar göle iner, balıkçılar buzu açıp ağ atar. Rüzgârın sesi ve atların nefesi dışında hiçbir şey duyulmaz. Kars’a kışın gelenlerin en çok anlattığı anlardan biri budur.",
      ],
      photo: {
        src: "/images/rehber/cildir-kis.webp",
        alt: "Karla kaplı Çıldır Gölü’nde kızak ve gezginler",
        caption: "Buz tutunca göl, kızakların ve yürüyüşçülerin olur.",
      },
    },
    timeline: {
      heading: "Göl kıyısında bir gün",
      items: [
        { time: "Varış", title: "Beyaz ova", text: "Ani’den sonra göle varılır. Önce kıyıdan buzun genişliğini seyredin." },
        { time: "Buz üstü", title: "Atlı kızak", text: "Kıyıdan kalkan kızaklar göl üstünde kısa bir tur atar. Kızak ücreti yerinde ödenir." },
        { time: "Kıyıda", title: "Buz balıkçıları", text: "Balıkçılar buzu açıp ağlarını atar; uzaktan izlemek bile ayrı bir deneyim." },
        { time: "Öğle", title: "Göl balığı", text: "Kıyıdaki lokantalarda göl balığı ve Kars mutfağından tatlar." },
        { time: "Akşamüstü", title: "Kars’a dönüş", text: "Gün batarken buzun rengi değişir; ardından Kars şehir gezisine geçilir." },
      ],
    },
    seasons: {
      heading: "Çıldır’ın takvimi",
      note: "Buzun tutması her yıl havaya göre değişir; tarihler yaklaşıktır.",
      rows: [
        { label: "Buz, atlı kızak ve buz balıkçılığı", from: 1, to: 3 },
        { label: "Kar manzarası", from: 12, to: 3 },
        { label: "Göçmen kuşlar", from: 4, to: 6 },
        { label: "Yeşil kıyılar ve göl yürüyüşü", from: 6, to: 9 },
      ],
    },
    highlights: {
      heading: "Gölde neler yapılır?",
      items: [
        { title: "Atlı kızak", text: "Kıyıdan kalkan kızaklarla donmuş gölün üstünde kısa bir yolculuk.", image: "/images/rehber/cildir-kizak.webp" },
        { title: "Buz altı balıkçılığı", text: "Çıldır’ın balıkçıları buzu açıp ağ atar; kışın gölün en eski geleneklerinden." },
        { title: "Akçakale Adası", text: "Gölün içindeki adada Orta Çağ’dan kale kalıntıları bulunur; kıyıdan seyredilir." },
        { title: "Göl kenarında sofra", text: "Göl balığı, sıcak çorba ve Kars peynirleriyle uzun bir öğle molası." },
      ],
    },
    tips: [
      { icon: "sun", title: "Ne zaman?", text: "Buz genellikle ocak–mart arasında tutar ama her yıl değişir. Turdan önce güncel durumu bizden öğrenin." },
      { icon: "shirt", title: "Ne giymeli?", text: "Göl üstünde rüzgâr kıyıdan çok daha serttir. Bere, eldiven, boyunluk ve su geçirmez bot şart." },
      { icon: "ice", title: "Buz güvenliği", text: "Buzun durumu günden güne değişir. Kızak sürücülerine ve rehberinize uyun, kendi başınıza buzun içlerine yürümeyin." },
      { icon: "ticket", title: "Ücretler", text: "Atlı kızak ve göl kenarındaki yemek tur fiyatına dahil değildir; yerinde ödenir." },
      { icon: "camera", title: "Fotoğraf", text: "Karın yansıması güçlüdür; güneş gözlüğü hem gözü hem kadrajı korur. Telefon pilleri soğukta çabuk biter." },
    ],
    articles: ["cildir-golunde-atli-kizak", "kars-kis-gezisi-hazirlik"],
    cta: {
      heading: "Çıldır’ı rehberle gezin.",
      text: "Ani, Çıldır Gölü ve Kars şehir turunu tek günde birleştiren rotamızda kışın buzun üstüne de çıkarsınız.",
    },
  },
  sarikamis: {
    slug: "sarikamis",
    title: "Sarıkamış’ı keşfet",
    tagline: "Sarıçamların arasında kristal kar.",
    hero: { src: "/images/kesfet/sarikamis-orman.webp", alt: "Sarıkamış’ta güneşte parlayan karlı sarıçamlar" },
    credit: "Fotoğraf: Karagozerkan, CC BY-SA 4.0",
    printed: "Allahuekber Dağları’nın eteğinde, Kars’ın batısında",
    facts: [
      { label: "Konum", value: "Kars’a yaklaşık 55 km", icon: "pin" },
      { label: "Kayak sezonu", value: "Genellikle aralık–nisan", icon: "calendar" },
      { label: "Kar", value: "Kuru, toz kıvamında “kristal kar”", icon: "snow" },
    ],
    tourId: "sarikamis",
    intro: {
      heading: "Ormanın içinden inen pistler.",
      paragraphs: [
        "Sarıkamış, Kars’ın batısında, Allahuekber Dağları’nın eteğinde kurulmuş bir orman kasabasıdır. Çevresini saran sarıçam ormanları, kışın karla birlikte bambaşka bir manzaraya dönüşür.",
        "Kayak merkezinin pistleri ormanın arasından iner. Buranın kuru, toz kıvamındaki karı kayakçıların dilinde “kristal kar” diye anılır. Kayak yapmayanlar için de kar motoru, kızak ve orman yürüyüşüyle kış burada çok renklidir.",
      ],
      photo: {
        src: "/images/tours/sarikamis.webp",
        alt: "Allahuekber Dağları’nda karlı yamaçlar",
        caption: "Allahuekber Dağları: kışın kar, yazın yayla.",
      },
    },
    timeline: {
      heading: "Sarıkamış’ın kısa hikâyesi",
      items: [
        { time: "1878", title: "Rus yönetimi", text: "Kars ve çevresi kırk yıl Rus yönetiminde kalır; Sarıkamış bu dönemde bir garnizon kasabasına dönüşür." },
        { time: "Aralık 1914", title: "Sarıkamış Harekâtı", text: "Allahuekber Dağları’nda ağır kış koşullarında on binlerce asker hayatını kaybeder." },
        { time: "1920", title: "Yeniden yurt", text: "Kars ve Sarıkamış yeniden Türkiye’nin olur." },
        { time: "Her ocak", title: "Anma yürüyüşü", text: "Binlerce kişi şehitleri anmak için karlı ormanlarda yürür." },
        { time: "Bugün", title: "Kış merkezi", text: "Sarıçam ormanlarının arasındaki kayak merkezi, Doğu Anadolu’nun sevilen kış rotalarından biridir." },
      ],
    },
    seasons: {
      heading: "Sarıkamış’ın takvimi",
      note: "Kayak sezonu kar durumuna göre değişir; tarihler yaklaşıktır.",
      rows: [
        { label: "Kayak, snowboard ve kar motoru", from: 12, to: 4 },
        { label: "Anma yürüyüşü", from: 1, to: 1 },
        { label: "Orman ve yayla yürüyüşü", from: 6, to: 9 },
        { label: "Sonbahar renkleri", from: 9, to: 10 },
      ],
    },
    story: {
      heading: "Ormanların hatırladığı kış.",
      paragraphs: [
        "1914 kışında Sarıkamış Harekâtı’nda Allahuekber Dağları’nın karlı geçitlerinde on binlerce asker hayatını kaybetti. Bu acı, kasabanın ve Kars’ın belleğinde bugün de yaşar.",
        "Her yıl ocak ayında binlerce kişi, şehitleri anmak için karlı ormanlarda yürür. Kasabadaki şehitlik ve anıtlar ziyaretçilere açıktır; sessizce gezmek yeter.",
      ],
      photo: {
        src: "/images/kesfet/sarikamis-anma.webp",
        alt: "Sarıkamış ormanlarında karlı yolda anma yürüyüşü",
        caption: "Sarıkamış ormanlarında anma yürüyüşü.",
      },
    },
    highlights: {
      heading: "Sarıkamış’ta neler yapılır?",
      items: [
        { title: "Kayak ve snowboard", text: "Ormanın arasından inen pistlerde kristal karın tadını çıkarın; turda ekipman dahildir." },
        { title: "Kar motoru", text: "Kayak merkezindeki işletmelerin parkurlarında, eğitmen eşliğinde sarıçamların arasından." },
        { title: "Katerina Köşkü", text: "Rus döneminden kalma, ormanın önündeki tarihi av köşkü; dışarıdan görmeye değer.", image: "/images/kesfet/sarikamis-katerina.webp" },
        { title: "Orman yürüyüşü", text: "Kayak yapmayanlar için karlı patikalarda sakin bir yürüyüş ve sıcak bir çay." },
      ],
    },
    tips: [
      { icon: "sun", title: "Ne zaman?", text: "Kayak için aralıktan nisana; kar durumuna göre değişir. Yazın serin yayla havası ve orman yürüyüşleri vardır." },
      { icon: "ski", title: "Ekipman", text: "Turda kayak, kıyafet ve kask dahildir. Bere, eldiven ve kayak gözlüğünüzü yanınıza alın." },
      { icon: "ticket", title: "Ücretler", text: "Teleferik çıkışları ve kar motoru gibi etkinlikler tur fiyatına dahil değildir." },
      { icon: "mountain", title: "Soğuk ve yükseklik", text: "Pistlerde hava kasabadan soğuktur. Katmanlı giyinin, su için ve molaları atlamayın." },
      { icon: "shirt", title: "Kayak yapmayanlar", text: "Grubunuzda kayak yapmayanlar kar motoru, kızak ya da orman yürüyüşüyle günü geçirebilir." },
    ],
    articles: ["sarikamista-kar-motoru", "kars-kis-gezisi-hazirlik"],
    cta: {
      heading: "Sarıkamış’a birlikte gidelim.",
      text: "Kars çıkışlı kayak turumuzda ulaşım, kayak, kıyafet, kask ve öğle yemeği dahildir; siz yalnız karın tadını çıkarın.",
    },
  },
};
