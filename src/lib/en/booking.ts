// Rezervasyon adımları, koltuk planı ve ödeme metinleri.
export const booking: Record<string, string> = {
  // Rezervasyon sayfası
  "Kuponlarınız şu an yüklenemedi. Rezervasyona kuponsuz devam edebilir veya sayfayı yenileyebilirsiniz.":
    "We couldn't load your coupons right now. You can continue without a coupon or refresh the page.",
  "Koltuk ayırma süreniz doldu. Yeniden koltuk seçebilirsiniz.":
    "Your seat hold has expired. Please choose your seats again.",
  "1 yolcu için 1 koltuk seçin.": "Choose 1 seat for 1 passenger.",
  "{count} yolcu için {count} koltuk seçin.":
    "Choose {count} seats for {count} passengers.",
  "Bu rota için birlikte plan yapalım.": "Let's plan this route together.",
  "Tur seçeneklerine dön": "Back to tours",
  "Yolculuğunuzun ilk adımı tamam.": "The first step of your trip is done.",
  "Özeti yazdır": "Print summary",
  "Rezervasyonumu sorgula": "Look up my booking",
  "Koltuk {seats}": "Seats {seats}",
  "Koltuk {n}": "Seat {n}",
  "Tur detayına dön": "Back to tour details",
  "Yolculuğunuzu planlayın.": "Plan your trip.",
  "Koltuklarınız için kalan süre: {time}": "Time left on your seats: {time}",
  "Koltuklarınızın ayrılma süresi 2 dakikadan az. Bilgilerinizi tamamlamak için süreyi uzatabilirsiniz.":
    "Less than 2 minutes left on your seat hold. Extend it if you need more time to finish.",
  "Süreyi 10 dakika uzat": "Add 10 more minutes",
  "Tarih ve koltuk": "Date and seats",
  "Yolcu bilgileri": "Passenger details",
  "Ön rezervasyon": "Pre-booking",
  "Tarih seçin": "Choose a date",
  "Ne zaman, hangi koltukta?": "When, and which seats?",
  "Önce tarihinizi seçin, sonra yol arkadaşlarınızın yerini belirleyin.":
    "Pick your date first, then choose where everyone will sit.",
  "Hareket tarihi": "Departure date",
  "Uygun tarih seçin": "Choose an available date",
  "Tarihler yükleniyor…": "Loading dates…",
  "Yolcu sayısı": "Number of passengers",
  "1 kişi": "1 person",
  "{n} kişi": "{n} people",
  "Seçtiğiniz tarihte sefer yok, en yakın sefer gösteriliyor.":
    "There's no departure on the date you chose, so we're showing the nearest one.",
  "Bu rota için açık bir tarih bulunmuyor.":
    "There are no open dates for this route.",
  "Acente ile görüşün.": "Contact our agency.",
  "Tek rezervasyonda en fazla {max} koltuk seçebilirsiniz. Daha büyük gruplar için bize WhatsApp'tan yazın.":
    "You can book up to {max} seats at a time. For larger groups, message us on WhatsApp.",
  "İyi bir yolculuk,": "A great trip",
  "iyi bir yerle başlar.": "starts with a great seat.",
  "Şoförün yanındaki ön koltuk rehberinize ayrıldı. Diğer {n} koltuktan dilediğinizi seçin.":
    "The front seat next to the driver is reserved for your guide. Pick any of the other {n} seats.",
  Boş: "Available",
  Seçili: "Selected",
  Dolu: "Taken",
  Rehber: "Guide",
  Seçiminiz: "Your selection",
  "Henüz koltuk seçmediniz.": "No seats selected yet.",
  "{selected} / {count} koltuk": "{selected} / {count} seats",
  "Devam ettiğinizde seçtiğiniz koltukları 10 dakika sizin için tutarız.":
    "Once you continue, we'll hold your seats for 10 minutes.",
  "Yolcu bilgilerine geç": "Continue to passenger details",
  "{n}. yolcunun T.C. kimlik numarası geçerli görünmüyor. Lütfen kontrol edin.":
    "The Turkish ID number (T.C.) for passenger {n} doesn't look right. Please check it.",
  "Yol arkadaşlarımızı tanıyalım.": "Tell us who's coming along.",
  "Yolcu adlarını ve sizinle iletişime geçebileceğimiz bilgileri paylaşın.":
    "Share the passengers' names and how we can reach you.",
  "{n}. yolcu": "Passenger {n}",
  "Kayıtlı yol arkadaşım": "Saved travel companion",
  "Yeni yolcu bilgisi gireceğim": "I'll enter a new passenger",
  "kayıtlı bilgileri kullanılacak": "saved details will be used",
  "Ad soyad": "Full name",
  "Kimlikteki gibi": "As shown on ID",
  Uyruk: "Nationality",
  "Sık seçilenler": "Most common",
  "Tüm ülkeler": "All countries",
  "T.C. kimlik numarası": "Turkish ID number (T.C.)",
  "Pasaport numarası": "Passport number",
  Cinsiyet: "Gender",
  Kadın: "Female",
  Erkek: "Male",
  "Kimlik bilgileri, turizm taşımacılığında zorunlu olan yolcu listesi bildirimi (U-ETDS) için istenir. Bu bilgileri yalnız acentemiz görür; size gönderilen belgede numaranın yalnız son 3 hanesi yer alır.":
    "ID details are required for the passenger list that Turkish law requires for tour transport (U-ETDS). Only our agency sees them; your booking document shows just the last 3 digits.",
  "İletişim kişisi": "Contact person",
  "Adınız soyadınız": "Your full name",
  "E-posta adresiniz": "Your email",
  "Telefon numaranız": "Your phone number",
  "Koltuk seçimine dön": "Back to seat selection",
  "Özeti incele": "Review summary",
  "Son bir kez göz atalım.": "One last look.",
  "%30 kapora": "30% deposit",
  "Tam ödeme": "Full payment",
  "Acente onayından sonra": "After agency confirmation",
  "Kartla ödeyince anında onay": "Confirmed instantly when paid by card",
  "Ödemeyi bir sonraki adımda kartla yapın.": "Pay by card in the next step.",
  "Ön rezervasyonunuz oluşunca seçtiğiniz tutarı kartla, 3D Secure (SMS onayı) ile ödeyebilirsiniz; ödeme alınınca rezervasyonunuz anında onaylanır. Dilerseniz acentemizle havale veya nakit de ödeyebilirsiniz.":
    "Once your pre-booking is created, you can pay the chosen amount by card with 3D Secure (SMS verification); your booking is confirmed as soon as the payment goes through. You can also pay our agency by bank transfer or cash.",
  "Bu adımda ödeme alınmaz; kartla ödeme sonraki adımdadır.":
    "No payment at this step; card payment comes next.",
  "Bilgileri düzenle": "Edit details",
  "Ön rezervasyon oluştur": "Request pre-booking",
  "{time} hareket": "Departs {time}",
  "1 yolcu": "1 passenger",
  "{n} yolcu": "{n} passengers",
  "Üyelik kuponunuz": "Your member coupon",
  "İndirim kuponu": "Discount coupon",
  "Kupon kullanma": "No coupon",
  "%{p}": "{p}%",
  "Şans çarkı": "Prize wheel",
  "Arkadaş daveti": "Friend referral",
  "Üye olun": "Become a member",
  ", çarkı çevirin ve tur indirimi kazanın.":
    ", spin the wheel and win a tour discount.",
  "Fiyat hesaplanıyor…": "Calculating price…",
  "Tur bedeli {amount}": "Tour price {amount}",
  "Üyelik indirimi −{amount}": "Member discount −{amount}",
  "İndirim sonrası örnek tur bedeli": "Sample tour price after discount",
  "İndirim sonrası tur bedeli": "Tour price after discount",
  "Örnek tur bedeli": "Sample tour price",
  "Tur bedeli": "Tour price",
  "Fiyatlar ve tarihler örnek demo verisidir.":
    "Prices and dates are sample demo data.",
  "Şimdi ödeme alınmaz.": "No payment is taken now.",

  // Koltuk planı
  "Ön taraf": "Front",
  Şoför: "Driver",
  "Rehber koltuğu, seçilemez": "Guide seat, not available",
  Ayrılmış: "Reserved",
  "Yolcu bölümü": "Passenger area",
  Kapı: "Door",
  "{n} numaralı koltuk, {state}": "Seat {n}, {state}",
  seçili: "selected",
  dolu: "taken",
  boş: "available",
  "{guests} misafir + {guides} rehber + {drivers} şoför":
    "{guests} guests + {guides} guide + {drivers} driver",

  // Ödeme
  "Kaporanızı şimdi ödeyin.": "Pay your deposit now.",
  "Ödeme alınınca rezervasyonunuz anında onaylanır ve QR kodlu biletiniz geçerli olur.":
    "Once paid, your booking is confirmed instantly and your QR ticket becomes valid.",
  "Kartla öde": "Pay by card",
  "Kart bilgileriniz ödeme kuruluşunun güvenli sayfasında girilir; bizim sunucularımıza ulaşmaz.":
    "You enter your card details on the payment provider's secure page; they never reach our servers.",
  "Deneme ödeme sayfası · gerçek para çekilmez":
    "Test payment page · no real money is charged",
  "{reference} numaralı rezervasyonun kaporası":
    "Deposit for booking {reference}",
  "Ödeme yükleniyor…": "Loading payment…",
  "Ödemeyi tamamla": "Complete payment",
  "Başarısız ödeme dene": "Try a failed payment",
  "Sonucu gör": "See result",
  "Ödemeniz kontrol ediliyor…": "Checking your payment…",
  "Ödemeniz alındı.": "Payment received.",
  "Ödeme tamamlanamadı.": "Payment couldn't be completed.",
  "Ödemeniz bekleniyor…": "Waiting for your payment…",
  "{amount} tahsil edildi. {reference} numaralı rezervasyonunuz onaylandı; QR kodlu biletiniz artık geçerli.":
    "{amount} received. Booking {reference} is confirmed, and your QR ticket is now valid.",
  "Kartınızdan para çekilmedi. Rezervasyonum sayfasından yeniden deneyebilir ya da bizi arayabilirsiniz.":
    "Your card wasn't charged. You can try again from the My Booking page or give us a call.",
  "Ödeme kuruluşundan onay bekleniyor; bu sayfa kendiliğinden yenilenir.":
    "Waiting for confirmation from the payment provider; this page refreshes on its own.",
  "Biletimi göster": "Show my ticket",
  "Rezervasyonuma dön": "Back to my booking",

  // Rezervasyon belgesi
  "Acente onayı bekliyor": "Awaiting agency confirmation",
  "Onaylı rezervasyon": "Confirmed booking",
  "Tur tamamlandı": "Tour completed",
  "İptal edildi": "Cancelled",
  "Süresi doldu": "Expired",
  "Referans numarası": "Reference number",
  "Üyelik indirimi: −{discount} · İndirim sonrası {total}":
    "Member discount: −{discount} · After discount {total}",
  "Toplam tur bedeli": "Total tour price",
  "Tercih edilen ilk ödeme": "Preferred first payment",
  "Net tahsilat": "Amount paid",
  "Kalan ödeme": "Balance due",
  "Rezervasyon doğrulama QR kodu": "Booking verification QR code",
  "Rezervasyon belgeniz": "Your booking document",
  "Kodu okutan güncel onay durumunu görür. Binişte rehberimiz de bu kodu okutur.":
    "Scanning the code shows the current confirmation status. Your guide will also scan it at boarding.",
  "Belgeyi doğrula": "Verify document",
  "Yazdır / PDF kaydet": "Print / save as PDF",
  "Tur tarihi {date}, {time}": "Tour date {date}, {time}",
  "Tur tarihi": "Tour date",
  Yolcular: "Passengers",
  Koltuklar: "Seats",
  Buluşma: "Meeting point",
  // Vakıfbank kart ödemesi
  "Ödeme Vakıfbank sanal POS ile alınır; kartınız 3D Secure (SMS onayı) ile doğrulanır ve kart bilgileriniz saklanmaz.":
    "Payment is taken through VakıfBank's virtual POS; your card is verified with 3D Secure (SMS) and your card details are not stored.",
  "Banka simülasyonu · gerçek para çekilmez": "Bank simulation · no real money is charged",
  "{reference} numaralı rezervasyonun ödemesi": "Payment for booking {reference}",
  "Kart üzerindeki isim": "Name on card",
  "Kart numarası": "Card number",
  "Son kullanma (AA/YY)": "Expiry (MM/YY)",
  "AA/YY": "MM/YY",
  "Güvenlik kodu (CVV)": "Security code (CVV)",
  "{amount} öde": "Pay {amount}",
  "Bir sonraki adımda bankanızın 3D Secure sayfasında SMS koduyla onaylayacaksınız. Visa, Mastercard ve Troy kabul edilir. Kart bilgileriniz saklanmaz.":
    "Next, you will confirm with an SMS code on your bank's 3D Secure page. Visa, Mastercard and Troy are accepted. Your card details are not stored.",
  "Simülasyon kartı: 4111 1111 1111 1111, ileri bir tarih, herhangi bir CVV. 0002 ile biten kart reddedilir.":
    "Simulation card: 4111 1111 1111 1111, any future date, any CVV. A card ending in 0002 is declined.",
  "Bu ödeme bağlantısının süresi doldu. Rezervasyonum sayfasından yeniden ödeme başlatabilirsiniz.":
    "This payment link has expired. You can start a new payment from the My booking page.",
  "Ödemeniz kontrol ediliyor.": "We are checking your payment.",
  "Bankadan ödemenizin sonucu alınamadı. Kartınızdan çekim yapıldıysa rezervasyonunuz korunuyor; ekibimiz kontrol edip sizi arayacak.":
    "We could not get the payment result from the bank. If your card was charged, your booking is safe; our team will check and call you.",
  // Sunucudan gelen kart ödemesi mesajları
  "Kart numarası geçerli değil.": "The card number is not valid.",
  "Visa, Mastercard veya Troy kartı kullanın.": "Please use a Visa, Mastercard or Troy card.",
  "Son kullanma tarihini AA/YY biçiminde girin.": "Enter the expiry date as MM/YY.",
  "Son kullanma ayı geçerli değil.": "The expiry month is not valid.",
  "Kartın son kullanma tarihi geçmiş.": "This card has expired.",
  "Güvenlik kodu (CVV) geçerli değil.": "The security code (CVV) is not valid.",
  "Kart üzerindeki ismi girin.": "Enter the name on the card.",
  "Ödeme süresi doldu. Rezervasyonum sayfasından yeniden başlatın.":
    "The payment time has run out. Start again from the My booking page.",
  "Bu rezervasyonun ödeme durumu değişti. Rezervasyonum sayfasından yeniden başlatın.":
    "This booking's payment status has changed. Start again from the My booking page.",
  "Çok fazla ödeme denemesi yapıldı. Bir süre sonra yeniden deneyin.":
    "Too many payment attempts. Please try again later.",
  "Bu rezervasyon için bir ödeme şu anda bankada sonuçlanıyor. Birkaç dakika sonra sayfayı yenileyin.":
    "A payment for this booking is being completed at the bank. Refresh the page in a few minutes.",
  "Bankaya şu anda ulaşılamıyor. Birkaç dakika sonra yeniden deneyin.":
    "The bank cannot be reached right now. Please try again in a few minutes.",
  "Kartınız 3D Secure (SMS onayı) ile kullanıma açık değil. Bankanızdan açtırın veya başka bir kart deneyin.":
    "Your card is not enabled for 3D Secure (SMS verification). Ask your bank to enable it or try another card.",
  "Kartınız 3D Secure ile doğrulanamadı. Başka bir kart deneyin.":
    "Your card could not be verified with 3D Secure. Please try another card.",
  "Banka yanıtı geçersiz.": "The bank's response was invalid.",
  "Banka yanıtı ödemeyle eşleşmedi. Kartınızdan çekim yapılmadı.":
    "The bank's response did not match the payment. Your card was not charged.",
  "3D Secure doğrulaması tamamlanmadı. Kartınızdan çekim yapılmadı; yeniden deneyebilirsiniz.":
    "3D Secure verification was not completed. Your card was not charged; you can try again.",
  "Ödeme oturumunun süresi doldu. Kart bilgilerinizi yeniden girin.":
    "The payment session has expired. Please enter your card details again.",
  "Bu rezervasyon artık bu ödemeyi beklemiyor (iptal edilmiş, süresi dolmuş veya başka bir ödemeyle tamamlanmış). Kartınızdan çekim yapılmadı.":
    "This booking is no longer waiting for this payment (cancelled, expired or already paid). Your card was not charged.",
  "Ödeme bankanız tarafından onaylanmadı.": "Your bank did not approve the payment.",
  "Bu ödeme zaten alındı.": "This payment has already been received.",
  // Ödeme önizlemesi (PAYMENT_PREVIEW=1)
  "Önizleme · kartla ödeme banka onayından sonra açılacak": "Preview · card payment opens after bank approval",
  "Kartla ödeme, banka onayının ardından açılacak. Kartınızdan çekim yapılmadı; ön rezervasyonunuz kayıtlı, acentemiz sizinle iletişime geçecek.":
    "Card payment will open after bank approval. Your card was not charged; your pre-booking is saved and our agency will contact you.",
  // Herkese açık ödeme sayfası (/odeme)
  Öde: "Pay",
  "Online ödeme": "Online payment",
  "Rota Kars Turizm tur ve transfer ödemeleri. Rezervasyon numaranızı ve acentemizin bildirdiği tutarı yazıp kartınızla ödeyin.":
    "Rota Kars Turizm tour and transfer payments. Enter your booking number and the amount our agency gave you, then pay by card.",
  "Ödenecek tutar (TL)": "Amount to pay (TRY)",
  "Ödenecek tutarı TL olarak yazın (ör. 1.250).": "Enter the amount in TRY (e.g. 1,250).",
  "Rezervasyon no (varsa)": "Booking no. (if any)",
  "Kartla ödeme, banka onayının ardından açılacak. Kartınızdan çekim yapılmadı ve kart bilgileriniz hiçbir yere gönderilmedi.":
    "Card payment will open after bank approval. Your card was not charged and your card details were not sent anywhere.",
  "Ön bilgilendirme ve hizmet sözleşmesi": "Pre-contract information and service agreement",
  "KVKK aydınlatma metni": "Privacy notice (KVKK)",
  // Canlı kart görseli
  "Kart sahibi": "Cardholder",
  "Son kullanma": "Expires",
  "AD SOYAD": "FULL NAME",
  "Güvenlik kodu kartın arkasındaki son 3 hanedir.": "The security code is the last 3 digits on the back of the card.",
  "Bankanıza bağlanılıyor…": "Connecting to your bank…",
  "Kartın üzerindeki ismi yazın.": "Enter the name as it appears on the card.",
  "Kart numarasını kontrol edin (16 hane).": "Check the card number (16 digits).",
  "Kartın arkasındaki 3 haneli kodu girin.": "Enter the 3-digit code on the back of the card.",
  // Yasal metinler (ön bilgilendirme, onaylar, künye)
  "Ön Bilgilendirme Formu":
    "Pre-information form",
  "Göndermeden önce okuyun. Onayladığınız metin rezervasyonunuza kaydedilir ve e-postanıza gönderilir.":
    "Please read it before you send. The text you approve is saved with your booking and e-mailed to you.",
  "Bu formun bağlayıcı metni Türkçedir. Temel koşullar: {policy}":
    "The binding text of this form is in Turkish. Key terms: {policy}",
  "Son dakika rezervasyonu: tur hareketine {days} günden az kaldı. Ödeme yaptıktan sonra iptal ederseniz kapora iade edilmez.":
    "Last-minute booking: departure is less than {days} days away. If you cancel after paying, the deposit is not refunded.",
  "Ön Bilgilendirme Formu metni":
    "Pre-information form text",
  "Form hazırlanıyor…":
    "Preparing the form…",
  "Ön Bilgilendirme Formu'nu, {contract} ve {cancel} okudum, onaylıyorum. Online ödeme yaparsam rezervasyonun ödemeyle birlikte kesinleşeceğini, havale veya nakit ödemede sözleşmenin acente onayıyla kurulacağını biliyorum.":
    "I have read and accept the pre-information form, the {contract} and the {cancel}. I understand that if I pay online the booking is confirmed with the payment, and that with bank transfer or cash the contract is formed when the agency confirms.",
  "Tur Hizmet Sözleşmesi'ni":
    "tour service contract",
  "İptal ve İade Koşulları'nı":
    "cancellation and refund terms",
  "Diğer yolcuların bilgilerini onların bilgisi dahilinde girdiğimi, kimlik bilgilerinin kimlik belgeleriyle aynı olduğunu ve bu kişileri aydınlatma metni hakkında bilgilendireceğimi beyan ederim.":
    "I confirm that I entered the other passengers' details with their knowledge, that their ID details match their documents, and that I will inform them of the privacy notice.",
  "İsteğe bağlı: Kampanya, indirim ve yeni rotalar hakkında bana e-posta ve SMS ile ticari elektronik ileti gönderilmesine ve bu amaçla ad, e-posta ve telefon bilgilerimin işlenmesine onay veriyorum. Onayımı dilediğim zaman ücretsiz geri alabilirim.":
    "Optional: I agree to receive marketing messages about offers, discounts and new routes by e-mail and SMS, and to the processing of my name, e-mail and phone for this purpose. I can withdraw this consent at any time, free of charge.",
  "Kişisel verileriniz {notice} kapsamında işlenir.":
    "Your personal data is processed as described in the {notice}.",
  "Aydınlatma Metni":
    "privacy notice",
  "Bu yolcuyu yol arkadaşlarıma kaydet. Bilgilerini onun bilgisi dahilinde, sonraki rezervasyonlarımda kullanmak üzere kaydettiğimi ve kendisini aydınlatma metni hakkında bilgilendireceğimi beyan ederim.":
    "Save this passenger to my travel companions. I confirm that I am saving their details with their knowledge for my future bookings and that I will inform them of the privacy notice.",
  "Tur Hizmet Sözleşmesi":
    "Tour service contract",
  "Belgeleriniz":
    "Your documents",
  // Ödeme durumuna göre metinler
  "Ödeme havale veya nakitle; rezervasyonunuzu acentemiz onaylar.":
    "Pay by bank transfer or cash; our agency confirms your booking.",
  "Tarih ve koltuğunuzu seçip ön rezervasyonunuzu oluşturun. Ardından kaporayı (%30) ya da tamamını kartla ödediğinizde rezervasyonunuz anında onaylanır ve QR kodlu biletiniz geçerli olur. Havale veya nakitle de ödeyebilirsiniz; o durumda ödemeniz kaydedilince acentemiz onaylar.":
    "Choose your date and seats to create a pre-booking. When you then pay the deposit (30%) or the full amount by card, your booking is confirmed instantly and your QR ticket becomes valid. You can also pay by bank transfer or cash; in that case our agency confirms once your payment is recorded.",
  "Tarih ve koltuğunuzu seçip ön rezervasyonunuzu oluşturun; bu adımda ödeme alınmaz. Acentemiz sizinle iletişime geçer, kaporayı (%30) havale veya nakitle ödediğinizde rezervasyonunuzu onaylar. Koltuklarınız bu sırada 24 saate kadar sizin için tutulur.":
    "Choose your date and seats to create a pre-booking; no payment is taken at this step. Our agency contacts you and confirms your booking once you pay the deposit (30%) by bank transfer or cash. Your seats are held for up to 24 hours meanwhile.",
  "Kaporayı ödeyince anında onay":
    "Instant confirmation once the deposit is paid",
  "Acente onaylı rezervasyon":
    "Bookings confirmed by the agency",
  "Koltuklarınız ayrıldı.":
    "Your seats are held.",
  "Ön rezervasyonunuz kaydedildi; koltuklarınız 24 saate kadar sizin için tutuluyor. Kaporayı kartla ödediğiniz anda rezervasyonunuz onaylanır. Dilerseniz havale veya nakitle de ödeyebilirsiniz.":
    "Your pre-booking is saved and your seats are held for up to 24 hours. Your booking is confirmed the moment you pay the deposit by card. You can also pay by bank transfer or cash.",
  "Ön rezervasyonunuz kaydedildi; koltuklarınız 24 saate kadar sizin için tutuluyor. Acentemiz sizinle iletişime geçecek; kaporayı havale veya nakitle ödediğinizde rezervasyonunuz onaylanır. Bu işlemde ödeme alınmadı.":
    "Your pre-booking is saved and your seats are held for up to 24 hours. Our agency will contact you; your booking is confirmed once you pay the deposit by bank transfer or cash. No payment was taken.",
  "Ödeme planınızı seçin. Ödemeyi ön rezervasyonunuz oluşunca, bir sonraki adımda kartla yaparsınız.":
    "Choose your payment plan. You pay by card in the next step, once your pre-booking is created.",
  "Ödeme planınızı seçin. Bu adımda ödeme alınmaz.":
    "Choose your payment plan. No payment is taken at this step.",
  "Ödeme havale veya nakitle yapılır.":
    "Payment is by bank transfer or cash.",
  "Ön rezervasyonunuzu gönderin; acentemiz sizinle iletişime geçip ödeme bilgilerini iletir. Kaporanız kaydedilince rezervasyonunuz onaylanır. Online kartla ödeme henüz aktif değil.":
    "Send your pre-booking; our agency will contact you with payment details. Your booking is confirmed once your deposit is recorded. Online card payment isn't available yet.",
  "Kartla ödeme yakında":
    "Card payment coming soon",
  "Banka onayının ardından bu tutarı buradan kartla ödeyebileceksiniz. Şimdilik kartınızdan çekim yapılmaz; acentemiz ödeme için sizinle iletişime geçecek.":
    "Once the bank approves, you'll be able to pay this amount here by card. For now no charge is made to your card; our agency will contact you about payment.",
  "Kart ekranını görüntüle":
    "View the card screen",
  "Rezervasyonunuz onaylandı. Güncel ödeme ve hareket bilgileri yukarıda.":
    "Your booking is confirmed. Current payment and departure details are above.",
  "Bu bir ön rezervasyondur; kapora ödenip onaylanınca biletiniz geçerli olur. Ödemesi kaydedilmeyen ön rezervasyonlar 24 saat sonra düşer. Referansınızı ve e-posta adresinizi saklayın.":
    "This is a pre-booking; your ticket becomes valid once the deposit is paid and confirmed. Pre-bookings without a recorded payment lapse after 24 hours. Keep your reference and e-mail address.",
  // Rezervasyon durumu
  "Koltuk {n} az önce doldu; başka bir koltuk seçin.":
    "Seat {n} was just taken; please choose another seat.",
  "Yolcu sayısı {n} oldu · {total}":
    "Passengers now {n} · {total}",
  "{selected} / {count} koltuk seçildi":
    "{selected} of {count} seats chosen",
  "Devam":
    "Continue",
  // Sözleşme onay kutuları ve ödeme ekranı
  "Sözleşmeler ve onaylar": "Contracts and consents",
  "Devam etmek için her birini okuyup ayrı ayrı onaylayın. Onaylarınız tarih ve saatiyle kaydedilir; metinler e-postanıza da gönderilir.":
    "Read and tick each one separately to continue. Your consents are recorded with date and time, and the texts are also emailed to you.",
  "{link} okudum, onaylıyorum.": "I have read and accept the {link}.",
  "{link} okudum, kabul ediyorum.": "I have read and agree to the {link}.",
  "Kişisel verilerimin işlenmesine ilişkin {link} okudum, bilgilendirildim.":
    "I have read the {link} on how my personal data is processed.",
  "Ön Bilgilendirme Formu'nu": "Pre-Information Form",
  "Tur Hizmet Sözleşmesi'ni (Mesafeli Satış Sözleşmesi)":
    "Tour Service Agreement (distance sales contract)",
  "KVKK Aydınlatma Metni'ni": "Privacy Notice (KVKK)",
  "İptal ve İade Koşulları": "Cancellation and Refund Terms",
  "KVKK Aydınlatma Metni": "Privacy Notice (KVKK)",
  "Okudum, onaylıyorum": "I have read it, I accept",
  "Kapat": "Close",
  "Ödemeye geçmeden önce dört onay kutusunun hepsini işaretleyin.":
    "Tick all four boxes before you pay.",
  "Ön rezervasyon için dört onay kutusunun hepsini işaretleyin.":
    "Tick all four boxes to make your booking.",
  "Online ödeme yaparsanız rezervasyonunuz ödemeyle birlikte kesinleşir; havale veya nakit ödemede sözleşme acente onayıyla kurulur.":
    "If you pay online, your booking is confirmed with the payment; with bank transfer or cash, the contract is formed when the agency confirms.",
  "Ödemeden önce ön bilgilendirme formu, tur hizmet sözleşmesi, iptal-iade koşulları ve aydınlatma metni onay kutularını işaretleyin.":
    "Before paying, tick the boxes for the pre-information form, the tour service agreement, the cancellation terms and the privacy notice.",
  "Onaylarınız kaydedildi. Kartla ödeme, banka onayının ardından açılacak. Kartınızdan çekim yapılmadı; ön rezervasyonunuz kayıtlı, acentemiz sizinle iletişime geçecek.":
    "Your consents have been recorded. Card payment will open once the bank approves. Your card was not charged; your provisional booking is saved and our agency will contact you.",
  "Rezervasyon adımları": "Booking steps",
  "Tur seçimi": "Choose a tour",
  "Rezervasyon": "Booking",
  "Ödeme": "Payment",
  "Tur": "Tour",
  "Tarih": "Date",
  "Yolcu": "Passengers",
  "{count} kişi": "{count} people",
  "Şimdi ödenecek kapora (%{pct})": "Deposit due now ({pct}%)",
  "Şimdi ödenecek tutar (tamamı)": "Amount due now (in full)",
  "Kalan {rest} tur günü hareketten önce ödenir.":
    "The remaining {rest} is paid on the tour day before departure.",
  "TÜRSAB belge no {no}": "TÜRSAB licence no {no}",
  "Yasal metinler": "Legal texts",
  "Künye": "Company details",
  "Sonraki adımda kart ödeme ekranını göreceksiniz.":
    "You will see the card payment screen next.",
  "Ön rezervasyonunuz oluşunca kartla ödeme ekranına geçebilirsiniz. Kartla ödeme banka onayının ardından açılacak; o zamana kadar kartınızdan çekim yapılmaz ve acentemiz havale veya nakit ödeme için sizinle iletişime geçer.":
    "Once your provisional booking is created you can go to the card payment screen. Card payment opens once the bank approves; until then your card is not charged and our agency will contact you for bank transfer or cash payment.",
};
