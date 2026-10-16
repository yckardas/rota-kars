export const business = {
  name: "Rota Kars Turizm",
  phone: "0474 223 91 63",
  mobile: "0545 935 34 10",
  email: "info@rotakarsturizm.com",
  address:
    "Yeni Mah. Cumhuriyet Cad. Köşk Apt. No:26 İç Kapı:13, Merkez / Kars",
  mapsUrl: "https://www.google.com/maps?cid=1539703208462618989",
  instagram: "https://www.instagram.com/rotakarstur/",
};
export const vehicle = {
  id: "vip-9-plus-1",
  name: "VIP minibüs",
  passengerSeats: 9,
  driverSeats: 1,
  guideSeats: 1,
  sellableSeats: 8,
  layout: [
    ["driver", null, "guide"],
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, null],
  ],
  description:
    "9 yolcu + 1 şoför. Şoför yanı rehbere ayrılır. 8 koltuk rezervasyona açıktır.",
};
export const tours = [
  {
    id: "ani-cildir",
    name: "Ani, Çıldır ve Kars",
    subtitle: "Bir gün, binlerce yıllık hikâye.",
    category: "Kültür",
    duration: "Günübirlik",
    location: "Kars · Ani · Çıldır",
    image: "/images/ani.jpg",
    gallery: ["/images/ani.jpg", "/images/cildir.jpg", "/images/kars.webp"],
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
    image: "/images/sarikamis.png",
    gallery: ["/images/sarikamis.png"],
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
    image: "/images/batum.jpg",
    gallery: ["/images/batum.jpg"],
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
    id: "van",
    name: "Konaklamalı Van Turu",
    subtitle: "Yolculuğa biraz daha zaman ayırın.",
    category: "Konaklamalı",
    duration: "Programa bağlı",
    location: "Van ve çevresi",
    image: "/images/van.webp",
    gallery: ["/images/van.webp"],
    price: 600000,
    departure: "Acente onayı",
    end: "Programa bağlı",
    inquiryOnly: true,
    season: "Konaklamalı rota",
    summary:
      "Van, Tuz Mağarası ve İshak Paşa Sarayı’nı kapsayan programın güncel tarih ve konaklama seçenekleri için bize ulaşın.",
    included: ["Güncel kapsam teklif aşamasında paylaşılır"],
    excluded: ["Program ve otel seçimine göre belirlenir"],
    itinerary: [],
    note: "Güncel program, otel, süre ve fiyat acente teyidi gerektirir.",
    source: "https://rotakarsturizm.com/",
  },
];
export const stories = [
  {
    id: "ani",
    tourId: "ani-cildir",
    title: "Ani’nin sessiz hikâyesi",
    image: "/images/ani.jpg",
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
    image: "/images/cildir.jpg",
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
    image: "/images/sarikamis.png",
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
