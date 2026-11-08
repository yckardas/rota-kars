// Genel site metinleri (üst menü, alt bilgi, ana sayfa, turlar, tur detayı, bilet).
// Anahtar sitedeki Türkçe metnin kendisidir; {ad} yer tutucuları korunur.
export const site: Record<string, string> = {
  // Üst menü ve alt bilgi
  Dil: "Language",
  "İçeriğe geç": "Skip to content",
  "Canlı demo · Örnek tarihler ve fiyatlar":
    "Live demo · Sample dates and prices",
  "Kars’tan başlayan güzel hikâyeler": "Good stories that begin in Kars",
  "Rota Kars ana sayfa": "Rota Kars home",
  "Ana menü": "Main menu",
  "Ana sayfa": "Home",
  Turlarımız: "Our tours",
  Hizmetler: "Services",
  Konaklama: "Stays",
  Hakkımızda: "About us",
  İletişim: "Contact",
  Hesabım: "My account",
  "Üye ol / Giriş": "Sign up / Log in",
  Rezervasyonum: "My booking",
  "Merhaba, rotakarsturizm.com sitesinden yazıyorum.":
    "Hello, I’m writing from the rotakarsturizm.com website.",
  "Birlikte planlayalım": "Let’s plan together",
  "Menüyü kapat": "Close menu",
  "Menüyü aç": "Open menu",
  "Rotayı biz biliyoruz.": "We know the way.",
  "Hikâyeyi birlikte yazıyoruz.": "We write the story together.",
  "Yolculuğumuza katılın": "Join our journey",
  "TÜRSAB üyesi, belge no {no}": "TÜRSAB member, license no. {no}",
  "Bir rota seçin": "Pick a route",
  "Yolculuğunuz için": "For your trip",
  "Konaklama seçenekleri": "Places to stay",
  "Rota Kars hakkında": "About Rota Kars",
  "Ön rezervasyon sorgulama": "Look up a pre-booking",
  "Tur iptali": "Tour cancellation",
  "Bilgilendirme ve gizlilik": "Information and privacy",
  "Fotoğraf kaynakları": "Photo credits",
  "Kars’tayız, bekleriz.": "We’re in Kars. Come say hello.",
  "Yol tarifi alın": "Get directions",
  "TÜRSAB A Grubu · Belge No {no} · {year}’dan beri":
    "TÜRSAB Group A · License No. {no} · Since {year}",
  // Ana sayfa
  "Ani Antik Kenti’nin kış manzarası": "Winter view of the ancient city of Ani",
  "Kars’tan selamlar.": "Greetings from Kars.",
  "Kendi VIP aracımızla, küçük gruplarla, rehberli günler. Bir manzara seçin, gerisini birlikte planlayalım.":
    "Guided days in small groups, aboard our own VIP vehicle. Pick a view, and we’ll plan the rest together.",
  "Rota seçin": "Choose a route",
  "{price}’den": "from {price}",
  "Şu an satışa kapalı": "Not on sale right now",
  Rota: "Route",
  "Nereye gitmek istersiniz?": "Where would you like to go?",
  Tarih: "Date",
  Yolcu: "Travelers",
  "1 kişi": "1 person",
  "{n} kişi": "{n} people",
  "Rotamı bul": "Find my route",
  "Ani Antik Kenti, Kars · Rota Kars Turizm, {year}’dan beri Kars’ta · TÜRSAB A Grubu {no}":
    "Ancient city of Ani, Kars · Rota Kars Turizm, in Kars since {year} · TÜRSAB Group A {no}",
  "{n} Google yorumu": "{n} Google reviews",
  "Google yorumları": "Google reviews",
  "Kaporayı kartla güvenle ödeyin; rezervasyonunuz anında onaylanır.":
    "Pay the deposit securely by card; your booking is confirmed instantly.",
  "Ödeme havale veya nakit; kart bilgisi istenmez.":
    "Pay by bank transfer or cash; no card details needed.",
  "Sizin için bir rota var.": "There’s a route for you.",
  "Bütün turları görün": "See all tours",
  "Tüm rotalar": "All routes",
  Tümü: "All",
  Kültür: "Culture",
  Kış: "Winter",
  "Yurt dışı": "Abroad",
  Konaklamalı: "Overnight",
  "Yola çıkmadan": "A small discovery",
  "küçük bir keşif.": "before you set out.",
  "Bir manzara, bir hikâye, bir sonraki yolculuğunuz.":
    "A view, a story, your next journey.",
  "Kars’ı yakından tanımaya buradan başlayın.":
    "Start getting to know Kars right here.",
  "Fotoğraflarla kısa rota hikâyeleri": "Short route stories in photos",
  "Hikâyeyi keşfet": "Explore the story",
  "Yolculuğunuza uygun,": "A seat that fits your trip,",
  "size ayrılmış bir yer.": "set aside just for you.",
  "Grubunuza uygun araçla yola çıkın. Araç ve koltuk düzenini tur sayfasında inceleyin; şoför yanındaki ön koltuk rehberinize ayrılmış olsun.":
    "Travel in a vehicle sized for your group. Check the vehicle and seat layout on the tour page; the front seat beside the driver is kept for your guide.",
  "{seats}+1 {vehicle} · {guests} misafir koltuğu · şoför yanı rehbere ayrılır":
    "{seats}+1 {vehicle} · {guests} guest seats · seat beside the driver kept for the guide",
  "Yeriniz şimdiden belli olsun": "Reserve your seat now",
  "Koltuk seçimi sizin elinizde.": "You choose your seat.",
  "Şoför ve rehber koltukları satışa kapalıdır.":
    "Driver and guide seats are not for sale.",
  Hizmetlerimiz: "Our services",
  "Merhaba, hizmetleriniz hakkında bilgi almak istiyorum.":
    "Hello, I’d like some information about your services.",
  "Teklif alın": "Get a quote",
  "Hizmeti keşfet": "Explore this service",
  "Rota Kars Tur logolu turizm otobüsü":
    "Tour coach with the Rota Kars Tur logo",
  "Grubunuz kaç kişi olursa olsun, aracı bizde.":
    "Whatever the size of your group, we have the vehicle.",
  "Turizm taşımacılığı": "Tourist transport",
  "VIP taşımacılık": "VIP transport",
  "Merhaba, şoförlü araç kiralama için teklif almak istiyorum.":
    "Hello, I’d like a quote for a vehicle with a driver.",
  "Araç için teklif alın": "Get a vehicle quote",
  "Konaklama planlaması için temsili otel odası":
    "Sample hotel room for planning your stay",
  "Temsili konaklama görseli": "Sample accommodation photo",
  "Bir gün daha": "Stay one more day",
  "Kars’ta kalın.": "in Kars.",
  "Anlaşmalı otellerimizde konaklamanızı planlayalım. Turunuzun öncesinde veya sonrasında Kars’a biraz daha zaman ayırın.":
    "Let us arrange your stay at our partner hotels. Give Kars a little more time before or after your tour.",
  "Tercihinize göre konaklama seçenekleri": "Accommodation options to suit you",
  "Müsaitlik ve fiyat için acente teyidi":
    "Availability and price confirmed by our agency",
  "Konaklamayı planla": "Plan your stay",
  "Talep bırakın": "Send a request",
  "Yol arkadaşlarınızı alın, gerisini bize bırakın.":
    "Bring your travel companions, leave the rest to us.",
  "Merhaba, kişiye özel bir tur planlamak istiyorum.":
    "Hello, I’d like to plan a private tour.",
  "Özel turunuzu konuşalım": "Let’s talk about your private tour",
  // Turlar
  "Bir sonraki rotanız.": "Your next route.",
  "Kısa bir kaçamak, kışın peşinde bir gün veya yeni bir şehrin hikâyesi.":
    "A short getaway, a day chasing winter, or the story of a new city.",
  "Bir rota veya şehir arayın": "Search for a route or city",
  "Tur ara": "Search tours",
  "1 rota sizi bekliyor.": "1 route awaits you.",
  "{n} rota sizi bekliyor.": "{n} routes await you.",
  "Bu aramayla eşleşen bir rota yok.": "No routes match this search.",
  "Başka bir şehir deneyin veya bütün rotalara göz atın.":
    "Try another city or browse all routes.",
  "Bütün rotaları göster": "Show all routes",
  "Kars çıkışlı": "Departs from Kars",
  "tarih için arayın": "call for dates",
  "kişi başı": "per person",
  // Tur detayı
  "Bu rota bulunamadı.": "We couldn’t find this route.",
  "Turlara dön": "Back to tours",
  Turlar: "Tours",
  "{n}. fotoğrafı göster": "Show photo {n}",
  Güzergâh: "Route",
  Süre: "Duration",
  Araç: "Vehicle",
  "Kişi başı": "Per person",
  "Bu tur için bilgi alın": "Ask about this tour",
  "Tarih ve koltuk seç": "Choose date and seat",
  "İlk hareket: {date} · {time}": "Next departure: {date} · {time}",
  "Uygun tarih için bize ulaşın.": "Contact us for available dates.",
  "Bu yolculukta sizi neler bekliyor?": "What awaits you on this trip?",
  "Günün akışı": "The day’s plan",
  "Fiyata dahil": "Included in the price",
  "Ekstra hizmetler": "Extras",
  "Buluşalım, yola çıkalım.": "Let’s meet and set off.",
  "Kars merkez · Kesin buluşma noktası acente tarafından paylaşılır":
    "Kars city center · The agency will share the exact meeting point",
  "Tarihinizi acenteyle planlayın.": "Plan your date with our agency.",
  "Rehber: {name}": "Guide: {name}",
  "Tur bölgesini haritada aç": "Open the tour area on the map",
  "Yola çıkmadan önce": "Before you go",
  "Çocuklar için koltuk ve fiyat nasıl belirlenir?":
    "How are seats and prices handled for children?",
  "Koltuklu her yolcu için ayrı koltuk seçilir. Çocuk indirimi veya çocuk koltuğu ihtiyacını rezervasyon öncesinde acenteye bildirin; yaşa göre koşullar teyit edilir. Ekrandaki kişi başı fiyat otomatik çocuk indirimi içermez.":
    "Every traveler who needs a seat gets their own. Let the agency know before booking if you need a child discount or a child seat; age-based terms will be confirmed. The per-person price shown does not include an automatic child discount.",
  "Buluşma saati veya rehber değişirse nasıl öğrenirim?":
    "How will I know if the meeting time or guide changes?",
  "Seçtiğiniz seferin hareket ve buluşma bilgileri rezervasyon belgenizde görünür. E-posta hizmeti etkin olduğunda güncellemeler ve hareket hatırlatması kayıtlı adresinize iletilir.":
    "Departure and meeting details for your chosen trip appear on your booking document. When email is enabled, updates and a departure reminder are sent to your registered address.",
  "Rezervasyon nasıl kesinleşir?": "How is a booking confirmed?",
  "Ön rezervasyonunuzu tarih ve koltuk seçerek oluşturabilirsiniz. Bu aşamada tahsilat yapılmaz. Acente programı ve ödeme koşullarını teyit ettikten sonra kesin rezervasyon sürecini tamamlar.":
    "You can make a pre-booking by choosing a date and seats. Nothing is charged at this stage. Once the agency confirms the itinerary and payment terms, it completes the final booking.",
  "Rehber koltuğunu seçebilir miyim?": "Can I choose the guide’s seat?",
  "{seats}+1 aracın şoför yanındaki ön koltuğu rehbere ayrılmıştır. Şoför ve rehber dışında {guests} misafir için koltuk seçilebilir.":
    "In the {seats}+1 vehicle, the front seat beside the driver is kept for the guide. Besides the driver and guide, seats can be chosen for {guests} guests.",
  "İptal ve program değişikliği nasıl olur?":
    "How do cancellations and itinerary changes work?",
  "Ön rezervasyon talebinizi referans numarası ve e-posta adresinizle sorgulayabilir, acente onayı bekleyen talebinizi iptal edebilirsiniz. Kesin rezervasyonun iptal ve iade koşulları acente tarafından tur bazında paylaşılır.":
    "You can look up your pre-booking with its reference number and your email address, and cancel it while it awaits agency approval. Cancellation and refund terms for confirmed bookings are shared by the agency for each tour.",
  "kişi başı başlangıç fiyatı": "starting price per person",
  "İlk hareket {date}, {time}": "Next departure {date}, {time}",
  "Size uyan günü seçin.": "Pick the day that suits you.",
  "Yolculuğunuzun yerini şimdiden belirleyin.":
    "Claim your seat for the journey now.",
  "İlk hareket: {date}": "Next departure: {date}",
  "{n} yolcu koltuğu": "{n} passenger seats",
  "Acente onaylı ön rezervasyon": "Agency-approved pre-booking",
  "Demo sürümünde fiyat ve sefer tarihleri örnektir. Online ödeme henüz aktif değildir.":
    "In the demo, prices and departure dates are samples. Online payment is not active yet.",
  "Online ödeme henüz aktif değildir.": "Online payment is not active yet.",
  "Birlikte planlayalım: {phone}": "Let’s plan together: {phone}",
  "kişi başı başlangıç": "starting per person",
  "Bilgi alın": "Ask us",
  // Rezervasyonum
  "Rezervasyonunuz burada.": "Your booking is right here.",
  "Ön rezervasyon referansınız ve e-posta adresinizle sorgulayın.":
    "Look it up with your pre-booking reference and email address.",
  "Referans numarası": "Reference number",
  "E-posta adresiniz": "Your email address",
  Sorgula: "Look up",
  "İptal talebiniz acente değerlendirmesini bekliyor.":
    "Your cancellation request is awaiting agency review.",
  "İptal talebiniz acenteye iletilecek. Ödenen tutarların iadesi acente tarafından ayrıca değerlendirilir; otomatik iade yapılmaz.":
    "Your cancellation request will be sent to the agency. Refunds of amounts paid are reviewed separately by the agency; there are no automatic refunds.",
  "Ön rezervasyon iptal edilecek ve koltuklarınız serbest bırakılacak.":
    "Your pre-booking will be canceled and your seats released.",
  "İptali onayla": "Confirm cancellation",
  Vazgeç: "Never mind",
  "İptal talebi oluşturmak istiyorum": "I’d like to request a cancellation",
  // Hakkımızda
  "Bu coğrafyanın": "We are part",
  "bir parçasıyız.": "of this land.",
  "Rota Kars Turizm olarak Kars merkezli turlar, özel grup programları ve turizm taşımacılığı hizmetleri sunuyoruz.":
    "At Rota Kars Turizm, we offer Kars-based tours, private group programs and tourist transport.",
  "Bir şehri tanımanın en güzel yolu, hikâyesini bilen insanlarla yürümek. Ani’den Çıldır’a, Sarıkamış’tan komşu rotalara uzanan programlarımızda bu yaklaşımı benimsiyoruz.":
    "The best way to know a city is to walk it with people who know its story. That’s the spirit of our programs, from Ani to Çıldır and from Sarıkamış to neighboring routes.",
  "Küçük gruplar için VIP midibüslerle ulaşımı, rehberli geziyi ve konaklama planlamasını bir arada ele alıyoruz.":
    "For small groups, we bring together VIP minibus transport, guided sightseeing and accommodation planning.",
  "Özel tur planlayın": "Plan a private tour",
  "Araç kiralama talebi": "Vehicle rental request",
  "Ani’de kış manzarası": "Winter scene in Ani",
  "İyi bildiğimiz yollar,": "Roads we know well,",
  "birlikte biriktireceğimiz anılar.": "memories we’ll make together.",
  "Rotalarımızla tanışın": "Meet our routes",
  // İletişim
  Yolculuğu: "Let’s talk",
  "birlikte konuşalım.": "about your trip.",
  "Tur, ulaşım ve konaklama planlarınız için":
    "For tours, transport and places to stay,",
  "Kars’taki ekibimizle iletişime geçin.":
    "get in touch with our team in Kars.",
  Ofisimiz: "Our office",
  "Google Haritalar’da yol tarifi": "Directions on Google Maps",
  "Sabit hat": "Landline",
  "E-posta": "Email",
  // Bilet doğrulama
  "Tur tarihi {date}, {time}": "Tour date {date}, {time}",
  "Rezervasyon doğrulandı.": "Booking verified.",
  "Kesinleşmiş bilet değil.": "Not a confirmed ticket.",
  "Belge doğrulanamadı.": "This document could not be verified.",
  "Belgeniz kontrol ediliyor…": "Checking your document…",
  Hareket: "Departure",
  Koltuklar: "Seats",
  Buluşma: "Meeting point",
  "Katılım kaydedildi.": "Attendance recorded.",
  "Bu belge acente tarafından onaylanmış rezervasyona aittir.":
    "This document belongs to a booking approved by the agency.",
  "Ödeme ve acente onayı tamamlanmadan kesin bilet olarak kullanılamaz.":
    "It cannot be used as a confirmed ticket until payment and agency approval are complete.",
  "Katılım kaydedildi": "Attendance recorded",
  "Yönetici: katılımı kaydet": "Admin: record attendance",
  // Yorumlar
  "Müşterilerimizin gözünden Rota Kars": "Rota Kars through our guests’ eyes",
  "Rota Kars ile yola çıkanların gözünden":
    "Through the eyes of those who traveled with Rota Kars",
  "Bu rotayı gezenlerin gözünden":
    "Through the eyes of those who took this route",
  "Google’da yorumları okuyun": "Read reviews on Google",
  "{n} Google değerlendirmesi": "{n} Google reviews",
  "Acente genel puanı": "Overall agency rating",
  "Yorum yazın": "Write a review",
  "Haritada açın": "Open in Maps",
  "Rota Kars Turizm Google Haritalar konumu":
    "Rota Kars Turizm location on Google Maps",
  "Yorumlar yükleniyor…": "Loading reviews…",
  "Yorumunda {terms} geçen {n} misafirimiz.":
    "{n} guests who mentioned {terms} in their reviews.",
  "Bu rotaya özel yorum henüz yok; acentemizin diğer turlarına gelen yorumlar gösteriliyor.":
    "No reviews for this route yet; showing reviews of our other tours.",
  "Google Maps’te görüntüle": "View on Google Maps",
  "Daha fazla yorum göster ({n})": "Show more reviews ({n})",
  "Bu rotanın deneyimlerini keşfedin.":
    "Discover what others experienced on this route.",
  "Bir yolculuğun en güzel hatırası, anlatılan hikâyesi.":
    "The best souvenir of a trip is the story it leaves.",
  "Bu rotayla eşleşen bir yorum henüz bulunmuyor. Diğer deneyimleri Google’da okuyabilirsiniz.":
    "No reviews match this route yet. You can read other experiences on Google.",
  "Misafirlerimizin paylaştığı deneyimlere Google işletme sayfamızdan ulaşabilirsiniz.":
    "You can read our guests’ experiences on our Google business page.",
  veya: "or",
  "bu rota": "this route",
  "Bu misafir yalnızca puan bırakmış.": "This guest left a rating only.",
  "Daha az göster": "Show less",
  "Devamını oku": "Read more",
  "{n} / 5 yıldız": "{n} out of 5 stars",
  // Instagram
  "Instagram yükleniyor…": "Loading Instagram…",
  "Oynatıcı yüklenemedi.": "The player couldn’t load.",
  "Instagram’da görüntüle": "View on Instagram",
  "Instagram gönderisi": "Instagram post",
  "Sesi aç": "Unmute",
  "Sesi kapat": "Mute",
  "Video şu an yüklenemedi": "Video can’t load right now",
  "Üzerine gelin, izleyin": "Hover to watch",
  "Instagram’da aç": "Open on Instagram",
  "{title} videosunu izle": "Watch the video: {title}",
  "İzlemek için tıklayın": "Click to watch",
  "Instagram’da biz.": "Find us on Instagram.",
  "Yollardan, buluşmalardan, birlikte biriktirdiğimiz anlardan.":
    "From the road, from meetups, from the moments we share.",
  "Bizi Instagram’da takip edin": "Follow us on Instagram",
  "Videolar üzerine gelince sessiz oynar; sesi kartın köşesinden açabilirsiniz.":
    "Videos play muted on hover; turn on sound from the corner of the card.",
  "Videoyu izlemek için karta tıklayın.": "Click a card to watch the video.",
  "Önceki Instagram videoları": "Previous Instagram videos",
  "Sonraki Instagram videoları": "Next Instagram videos",
  "Yolculuğumuz Instagram’da da devam ediyor.":
    "Our journey continues on Instagram.",
  "Rotalarımızdan videolar için @rotakarstur hesabımızı ziyaret edin.":
    "Visit @rotakarstur for videos from our routes.",
  "Reels’leri keşfedin": "Explore our Reels",
  // Üyelik daveti
  "Rota Kars’a hoş geldiniz": "Welcome to Rota Kars",
  "Bir sonraki rotanız": "Let your next route",
  "bir sürprizle başlasın.": "start with a surprise.",
  "Ücretsiz üye olun, şans çarkında %5, %10 veya %15 tur indirimi kazanın.":
    "Sign up for free and spin the wheel to win 5%, 10% or 15% off a tour.",
  "Arkadaşını davet et, ikinize de %10 indirim gelsin.":
    "Invite a friend and you both get 10% off.",
  "Üye ol, çarkını çevir": "Sign up and spin",
  "Şimdilik rotaları keşfedeyim": "I’ll explore the routes for now",
  "Çark üyelik başına bir kez. Güncel oran, süre ve davet koşullarını hesabınızdan inceleyebilirsiniz.":
    "One spin per membership. See current rates, validity and invite terms in your account.",
  "Yükleniyor…": "Loading…",
  "Rotanız hazırlanıyor…": "Preparing your route…",
  "Bir bağlantı molası.": "A brief connection break.",
  "Yeniden dene": "Try again",
};
