export const business = {
  name: "Rota Kars Turizm",
  phone: "0474 223 91 63",
  mobile: "0545 935 34 10",
  email: "info@rotakarsturizm.com",
  address:
    "Yeni Mah. Cumhuriyet Cad. Köşk Apt. No:26 İç Kapı:13, Merkez / Kars",
  mapsUrl: "https://www.google.com/maps?cid=1539703208462618989",
  instagram: "https://www.instagram.com/rotakarstur/",
  facebook: "https://www.facebook.com/profile.php?id=100063759990737",
  whatsapp: "905464802136",
  whatsappLabel: "0546 480 21 36",
  hours: "Her gün · 22:00'ye kadar",
  tursabNo: "13948",
  founded: 2010,
};
export const features = [
  {
    icon: "sparkles",
    title: "Yeni açılan turlar",
    text: "Kars, Van, Batum ve Kafkasya'ya her sezon yeni rotalar.",
  },
  {
    icon: "shield",
    title: "Koşulsuz iptal",
    text: "Yurt içinde son 3 güne, yurt dışında son 5 güne kadar kesintisiz iade.",
  },
  {
    icon: "lira",
    title: "Türk Lirası ile ödeme",
    text: "Yurt dışı turlar dahil tüm ödemeler TL ile, kur riski yok.",
  },
  {
    icon: "heart",
    title: "Müşteri memnuniyeti",
    text: "Google'da 456 değerlendirmede 4,9 puan.",
  },
];
export const services = [
  {
    id: "turizm-tasimaciligi",
    title: "Turizm taşımacılığı",
    image: "/images/service-tur.webp",
    text: "Yerli ve yabancı misafirlerimizin transferlerinde zamanlama, konfor ve emniyeti ön planda tutan uzman bir kadro.",
  },
  {
    id: "vip-transfer",
    title: "VIP transfer",
    image: "/images/service-vip.webp",
    text: "Özel üretilmiş, prestijli ve konforlu VIP araç filomuzla dilediğiniz destinasyona eğitimli personelle ulaşım.",
  },
  {
    id: "kongre-toplanti",
    title: "Kongre ve toplantı",
    image: "/images/service-kongre.webp",
    text: "Fuar, seminer ve toplantı katılımcılarınızın transferleri için dakik ve güvenilir çözüm ortağı.",
  },
  {
    id: "express-tur",
    title: "Express tur",
    image: "/images/service-express.webp",
    text: "Gezi, eğitim, kültür, sanat ve eğlence etkinlikleri için size özel planlanan ulaşım.",
  },
];
export const fleet = {
  note: "Araçlarımız şoförlü olarak kiralanır. Kaptanlarımız bölgeye hâkim, işinde profesyoneldir.",
  tourism: [
    "13+1",
    "16+1",
    "19+1",
    "27+1",
    "29+1",
    "31+1",
    "35+1",
    "38+1",
    "46+1",
  ],
  vip: ["4+1", "9+1", "11+1"],
  perks: ["D2 ve B2 belgeli", "Lüks ve klimalı", "Mikrofonlu", "Buzdolaplı"],
};
export const cancellationPolicy =
  "Yurt dışı paket turlarımızda son 5 güne, yurt içi paketlerimizde son 3 güne kadar hiçbir koşul aranmadan turunuzu iptal edebilirsiniz. Yurt içi paketlerde iptal güvence paketi ile 72 saate kadar koşulsuz iptal hakkı bulunur (uçaklı paketlerde geçerli değildir). Ödediğiniz ücreti kesintisiz geri alırsınız.";
export const vehicle = {
  id: "vip-18-plus-1",
  name: "VIP midibüs",
  passengerSeats: 18,
  driverSeats: 1,
  guideSeats: 1,
  sellableSeats: 17,
  // Sütunlar: sol çift koltuk, koridor, sağ tekli koltuk. İlk sıranın sağı kapı.
  layout: [
    ["driver", null, null, "guide"],
    [1, 2, null, "door"],
    [3, 4, null, 5],
    [6, 7, null, 8],
    [9, 10, null, 11],
    [12, 13, null, 14],
    [15, 16, null, 17],
  ],
  description:
    "18 yolcu + 1 şoför. Şoför yanındaki ön koltuk rehbere ayrılır. 17 koltuk rezervasyona açıktır.",
};
export const tours = [
  {
    id: "ani-cildir",
    name: "Ani, Çıldır ve Kars",
    subtitle: "Bir gün, binlerce yıllık hikâye.",
    category: "Kültür",
    duration: "Günübirlik",
    location: "Kars · Ani · Çıldır",
    image: "/images/tours/ani.webp",
    gallery: [
      "/images/tours/ani.webp",
      "/images/cildir.webp",
      "/images/kars.webp",
    ],
    price: 100000,
    departure: "08:30",
    end: "17:00",
    inquiryOnly: false,
    season: "Kış rotası",
    summary:
      "Ani’nin taş yapılarından Çıldır Gölü’nün kıyısına, Kars’ın sokaklarından yerel hikâyelere uzanan bir gün. Bölgeyi rehberinizin anlatımıyla keşfedin.",
    included: [
      "Profesyonel kokartlı rehberlik",
      "VIP araç ile ulaşım",
      "Acente refakati",
    ],
    excluded: [
      "Müze ve ören yeri girişleri",
      "Öğle ve akşam yemekleri",
      "Atlı kızak ve Kafkas gecesi",
    ],
    itinerary: [
      {
        time: "08:30",
        title: "Kars’ta buluşma",
        text: "Kars merkezden hareket ve rehberinizle tanışma.",
      },
      {
        time: "Sabah",
        title: "Ani’nin izinde",
        text: "Harp Tarihi Müzesi ve Ani Antik Kenti. Rehber anlatımı ve fotoğraf için serbest zaman.",
      },
      {
        time: "Öğlen",
        title: "Çıldır Gölü kıyısında",
        text: "Göl çevresinde gezi ve ekstra ücretli yemek molası. Kızak deneyimi uygun mevsim koşullarına bağlıdır.",
      },
      {
        time: "17:00",
        title: "Kars şehir gezisi",
        text: "Tarihi yapılar ve panoramik şehir gezisi sonrasında programın tamamlanması.",
      },
    ],
    note: "Program hava ve yol koşullarına göre değişebilir. Çıldır’da buz ve atlı kızak deneyimi garanti edilmez.",
    source:
      "https://rotakarsturizm.com/tur/gunubirlik-ani-antik-kenti-cildir-golu-ve-kars-sehir-turu/",
  },
  {
    id: "sarikamis",
    name: "Sarıkamış Kayak Turu",
    subtitle: "Kışın en güzel molası.",
    category: "Kış",
    duration: "Günübirlik",
    location: "Kars · Sarıkamış",
    image: "/images/tours/sarikamis.webp",
    gallery: ["/images/tours/sarikamis.webp"],
    price: 135000,
    departure: "08:30",
    end: "Akşam",
    inquiryOnly: false,
    season: "Kış rotası",
    summary:
      "Günü Sarıkamış’ın kayak pistlerinde geçirin. Kars çıkışlı programda ulaşım, kayak ekipmanları ve öğle yemeği bir arada.",
    included: [
      "Kayak kıyafeti, kayak ve kask",
      "Öğle yemeği",
      "Ulaşım ve seyahat sigortası",
    ],
    excluded: [
      "Teleferik çıkışları",
      "Eldiven, bere ve gözlük",
      "Kahvaltı ve akşam yemeği",
    ],
    itinerary: [
      {
        time: "08:30",
        title: "Kars’tan hareket",
        text: "Sarıkamış’a yolculuk.",
      },
      {
        time: "Sabah",
        title: "Ekipman ve kayak",
        text: "Kayak ekipmanlarının teslimi ve pistlerde serbest zaman.",
      },
      {
        time: "12:00",
        title: "Öğle molası",
        text: "Sucuk ekmek ve ayran ile öğle yemeği.",
      },
      {
        time: "Akşam",
        title: "Kars’a dönüş",
        text: "Ekipman iadesinin ardından dönüş yolculuğu.",
      },
    ],
    note: "Program ve pist koşulları hava durumuna bağlıdır. Teleferik çıkışları ekstra ücretlidir.",
    source: "https://rotakarsturizm.com/tur/sarikamis-kayak-turu/",
  },
  {
    id: "batum",
    name: "Günübirlik Batum",
    subtitle: "Sınırın ötesinde yeni bir rota.",
    category: "Yurt dışı",
    duration: "Günübirlik",
    location: "Kars · Artvin · Batum",
    image: "/images/tours/batum.webp",
    gallery: ["/images/tours/batum.webp"],
    price: 250000,
    departure: "00:00",
    end: "Gece",
    inquiryOnly: false,
    season: "Şehir rotası",
    summary:
      "Kars’tan Batum’a uzanan yolculukta meydanları, sahili ve şehrin simgelerini yerel rehber eşliğinde keşfedin.",
    included: [
      "Sabah kahvaltısı",
      "Profesyonel rehberlik ve ulaşım",
      "Araç içi ikram ve seyahat sigortası",
    ],
    excluded: [
      "Öğle ve akşam yemekleri",
      "Müze girişleri ve teleferik",
      "Yurt dışı çıkış harcı",
    ],
    itinerary: [
      {
        time: "00:00",
        title: "Kars’tan hareket",
        text: "Ardahan ve Artvin güzergâhı üzerinden yolculuk.",
      },
      {
        time: "07:00",
        title: "Hopa’da kahvaltı",
        text: "Kahvaltı ve sınır geçiş işlemleri.",
      },
      {
        time: "Gün boyu",
        title: "Batum’u keşif",
        text: "Gonio Kalesi, sahil, meydanlar ve şehrin simgeleri.",
      },
      {
        time: "16:00",
        title: "Dönüş yolculuğu",
        text: "Sınır kapısına hareket. Yoğunluğa göre saatler değişebilir.",
      },
    ],
    note: "Giriş belgeleri, sınır koşulları ve güncel harçlar seyahat öncesinde acente tarafından teyit edilir.",
    source: "https://rotakarsturizm.com/tur/gunubirlik-batum-turu/",
  },
  {
    id: "van-gunubirlik",
    name: "Günübirlik Van Turu",
    subtitle: "Şelaleden Akdamar'a, tek günde Van.",
    category: "Kültür",
    duration: "Günübirlik",
    location: "Kars · Muradiye · Van",
    image: "/images/tours/van-day.webp",
    gallery: ["/images/tours/van-day.webp", "/images/akdamar.webp"],
    price: 300000,
    departure: "03:00",
    end: "Gece",
    inquiryOnly: false,
    season: "Yaz rotası",
    summary:
      "Tendürek Geçidi'nden Muradiye Şelalesi'ne, meşhur Van kahvaltısından Akdamar Adası'na ve Van Kalesi'ne uzanan dolu dolu bir gün.",
    included: [
      "Sabah kahvaltısı",
      "Ulaşım ve profesyonel rehberlik",
      "Araç içi ikramlar ve seyahat sigortası",
    ],
    excluded: [
      "Öğle ve akşam yemekleri",
      "Van Kalesi, müze ve ören yeri girişleri",
      "Akdamar Adası tekne ücreti",
    ],
    itinerary: [
      {
        time: "03:00",
        title: "Kars'tan hareket",
        text: "Tendürek Geçidi (2.644 m) ve Çaldıran Ovası üzerinden yolculuk.",
      },
      {
        time: "Sabah",
        title: "Muradiye Şelalesi ve Van kahvaltısı",
        text: "Şelalede serbest zaman, ardından meşhur Van kahvaltısı.",
      },
      {
        time: "Öğlen",
        title: "Gümüş Atölyesi, Kedi Evi, Akdamar",
        text: "Urartu gümüş sanatı, Van kedileri ve tekneyle Akdamar Adası'ndaki Kutsal Haç Kilisesi.",
      },
      {
        time: "Akşamüstü",
        title: "Van Müzesi ve Van Kalesi",
        text: "Urartu medeniyetinin izleri, Tuşba ve gün batımında göl manzarası. Ardından dönüş.",
      },
    ],
    note: "Program hava ve yol koşullarına göre değişebilir.",
    source: "https://rotakarsturizm.com/tur/gunubirlik-van-turu/",
  },
  {
    id: "van",
    name: "Konaklamalı Van Turu",
    subtitle: "Tuz Mağarası ve İshak Paşa Sarayı dahil.",
    category: "Konaklamalı",
    duration: "2 gün · 1 gece",
    location: "Iğdır · Doğubayazıt · Van",
    image: "/images/tours/van.webp",
    gallery: [
      "/images/tours/van.webp",
      "/images/tuz-magarasi.webp",
      "/images/akdamar.webp",
    ],
    price: 600000,
    departure: "07:00",
    end: "2. gün akşam",
    inquiryOnly: false,
    season: "Konaklamalı rota",
    summary:
      "Tuzluca Tuz Mağarası ve İshak Paşa Sarayı ile başlayıp Muradiye, Akdamar ve Van Kalesi ile tamamlanan iki günlük program.",
    included: [
      "2 sabah kahvaltısı ve 1 gece konaklama",
      "Ulaşım, profesyonel rehberlik ve acente refakati",
      "Araç içi ikramlar ve seyahat sigortası",
    ],
    excluded: [
      "Öğle ve akşam yemekleri",
      "Van Kalesi, müze ve ören yeri girişleri",
      "Akdamar Adası tekne ücreti",
    ],
    itinerary: [
      {
        time: "1. gün 07:00",
        title: "Tuz Mağarası ve İshak Paşa Sarayı",
        text: "Iğdır yönüne hareket, Tuzluca Tuz Mağarası ve Doğubayazıt'ta İshak Paşa Sarayı.",
      },
      {
        time: "1. gün öğleden sonra",
        title: "Muradiye, Gümüş Atölyesi, Kedi Evi",
        text: "Tendürek Geçidi, Muradiye Şelalesi ve Van'da otele yerleşme.",
      },
      {
        time: "2. gün",
        title: "Akdamar ve Van Kalesi",
        text: "Otelde kahvaltı, tekneyle Akdamar Adası, Van Müzesi ve Van Kalesi. Ardından Kars'a dönüş.",
      },
    ],
    note: "Otel ve kesin program tur tarihinden önce acente tarafından teyit edilir.",
    source:
      "https://rotakarsturizm.com/tur/konaklamali-van-turu-tuz-magarasi-ve-ishak-pasa-sarayi-dahil/",
  },
  {
    id: "van-havzasi",
    name: "Van Havzası Turu",
    subtitle: "Nemrut Krater Gölü'nden Ahlat'a üç gün.",
    category: "Konaklamalı",
    duration: "3 gün · 2 gece",
    location: "Van · Tatvan · Bitlis · Ahlat",
    image: "/images/tours/van-havza.webp",
    gallery: [
      "/images/tours/van-havza.webp",
      "/images/tuz-magarasi.webp",
      "/images/akdamar.webp",
    ],
    price: 700000,
    departure: "Acente onayı",
    end: "3. gün akşam",
    inquiryOnly: true,
    season: "Konaklamalı rota",
    summary:
      "Tuz Mağarası, İshak Paşa Sarayı, Muradiye, Akdamar, Van Kalesi, Ahlat Selçuklu Mezarlığı, Nemrut Krater Gölü, Bitlis ve Tatvan'ı kapsayan geniş program.",
    included: [
      "3 sabah kahvaltısı",
      "2 gece konaklama (Tatvan – Van)",
      "Ulaşım, rehberlik, acente refakati ve seyahat sigortası",
    ],
    excluded: [
      "Öğle ve akşam yemekleri",
      "Müze ve ören yeri girişleri",
      "Akdamar Adası tekne ücreti",
    ],
    itinerary: [],
    note: "Güncel tarih ve kontenjan için bizimle iletişime geçin.",
    source: "https://rotakarsturizm.com/tur/van-havzasi-turu/",
  },
];
export const stories = [
  {
    id: "ani",
    tourId: "ani-cildir",
    title: "Ani’nin sessiz hikâyesi",
    image: "/images/tours/ani.webp",
    location: "Ani Antik Kenti",
    scenes: [
      {
        title: "Taşların anlattığı bir şehir",
        text: "Ani’nin yapıları arasında rehberinizin anlatımıyla geçmişin izini sürün.",
      },
      {
        title: "Kendi gözünüzden Ani",
        text: "Serbest zamanda mimariyi ve manzarayı fotoğraflamak için bir mola.",
      },
      {
        title: "Rotanın devamında",
        text: "Aynı programda Çıldır Gölü ve Kars şehir gezisi de sizi bekliyor.",
      },
    ],
  },
  {
    id: "cildir",
    tourId: "ani-cildir",
    title: "Çıldır’ın kış masalı",
    image: "/images/cildir.webp",
    location: "Çıldır Gölü",
    scenes: [
      {
        title: "Gölün kıyısında bir gün",
        text: "Kışın geniş beyaz manzarası, temiz hava ve göl kenarında bir mola.",
      },
      {
        title: "Mevsimin izin verdiği kadar",
        text: "Buz ve atlı kızak deneyimleri hava koşullarına bağlıdır. Kızak tur ücretine dahil değildir.",
      },
      {
        title: "Sofraya uzanan rota",
        text: "Göl kenarındaki ekstra ücretli öğle yemeği molasıyla günü yavaşlatın.",
      },
    ],
  },
  {
    id: "sarikamis",
    tourId: "sarikamis",
    title: "Sarıkamış’ta kış zamanı",
    image: "/images/tours/sarikamis.webp",
    location: "Sarıkamış",
    scenes: [
      {
        title: "Bir günlüğüne karın peşinde",
        text: "Kars çıkışlı programla Sarıkamış kayak merkezine yolculuk.",
      },
      {
        title: "Ekipmanlar programa dahil",
        text: "Kayak, kıyafet ve kask dahil. Bere, eldiven ve gözlüğünüzü yanınıza alın.",
      },
      {
        title: "Dolu dolu bir kış günü",
        text: "Ulaşım ve öğle yemeği dahil, teleferik çıkışları ekstra ücretlidir.",
      },
    ],
  },
];
