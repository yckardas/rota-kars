// Üyelik, hesabım, hesap güvenliği ve yol arkadaşları metinleri; sunucunun bu
// akışlarda döndürdüğü hata iletileri de burada çevrilir.
export const member: Record<string, string> = {
  // Üye ol / giriş
  "Bu e-posta zaten kayıtlı. E-posta ve parolanızla giriş yapın, ardından sosyal hesabınızı bağlayın.":
    "This email is already registered. Log in with your email and password, then link your social account.",
  "Sosyal giriş tamamlanamadı. Yeniden deneyebilir veya e-postayla giriş yapabilirsiniz.":
    "Social sign-in couldn't be completed. You can try again or log in with your email.",
  "Üyelik hazırlanıyor…": "Getting your membership ready…",
  "Kars rotasından bir görünüm": "A view along a Kars route",
  "Rota Kars yol arkadaşlığı": "Travel with Rota Kars",
  "Güzel yolculuklar,": "Good journeys,",
  "güzel ayrıcalıklar.": "good perks.",
  "Birlikte keşfedelim. Size özel fırsatlar, yeni rotalar ve yol arkadaşlarınızla paylaşacağınız anılar.":
    "Let’s explore together. Offers just for you, new routes and memories to share with your travel companions.",
  "Üyelere özel şans çarkı": "Members-only prize wheel",
  "Arkadaşınla ikinize de %10 indirim": "10% off for you and a friend",
  Üyelik: "Membership",
  "Üye ol": "Sign up",
  "Giriş yap": "Log in",
  "Yol arkadaşımız olun.": "Travel with us.",
  "Yeniden hoş geldiniz.": "Welcome back.",
  "Üyeliğiniz ücretsiz. Bir sonraki rotanız için avantajlarınızı keşfedin.":
    "Membership is free. Discover your perks for your next route.",
  "Kuponlarınız ve yolculuklarınız sizi bekliyor.":
    "Your coupons and trips are waiting for you.",
  "Firma hesabı bağlantısı hazırlanıyor":
    "Company account connection in progress",
  "{provider} ile devam et": "Continue with {provider}",
  Yakında: "Coming soon",
  "Sosyal girişler hesap bağlantısı tamamlandığında açılacak. Şimdi e-postanızla üye olabilirsiniz.":
    "Social sign-in will open once the accounts are connected. You can sign up with your email now.",
  "veya e-postayla": "or with email",
  "Parolamı unuttum": "Forgot my password",
  Parolanız: "Your password",
  "En az 10 karakter kullanın.": "Use at least 10 characters.",
  "Davet kodunuz var mı?": "Have an invite code?",
  "Arkadaşınızın davet kodu": "Your friend’s invite code",
  "İsteğe bağlı": "Optional",
  "Üyelik ve kampanya koşullarını": "membership and campaign terms",
  "Üye ol, ayrıcalıkları keşfet": "Sign up and discover your perks",

  // Hesabım
  "Bağlantıyı kopyalayamadık. Aşağıdaki davet bağlantısını seçip kopyalayabilirsiniz.":
    "We couldn’t copy the link. You can select and copy the invite link below.",
  "Hesabınız hazırlanıyor…": "Getting your account ready…",
  "Rota Kars üyeliği": "Rota Kars membership",
  "Merhaba, {name}.": "Hello, {name}.",
  "Yolculuklarınız ve size özel fırsatlar, tek bir yerde.":
    "Your trips and offers just for you, all in one place.",
  "Çıkış yap": "Log out",
  "İlk yolculuğa bir sürpriz": "A surprise for your first trip",
  "Şansını rotana kat.": "Spin for your route.",
  "Çark dönüyor…": "Spinning…",
  "Çark hakkınız kullanıldı": "You’ve used your spin",
  "Çarkı çevir": "Spin the wheel",
  "Hesap başına bir hak. Yeni kuponlar {days} gün geçerli.":
    "One spin per account. New coupons are valid for {days} days.",
  "Minimum tur bedeli: {amount}.": "Minimum tour price: {amount}.",
  "Yalnız kampanyaya dahil turlarda geçerli.":
    "Valid only on tours included in the campaign.",
  "Bütün turlarda geçerli.": "Valid on all tours.",
  "Kampanya şu anda kapalı.": "The campaign is currently closed.",
  "Güzel rotalar paylaşınca çoğalır": "Good routes are better shared",
  "Arkadaşını getir,": "Bring a friend,",
  "ikinize de %10.": "10% off for you both.",
  "Davet bağlantını paylaş. Arkadaşın bu bağlantıyla üye olup turunun tam ödemesi kaydedildiğinde, ikiniz de sonraki turunuz için %10 kupon kazanın. Aynı arkadaş için bir kez ödül verilir.":
    "Share your invite link. When your friend signs up with it and their tour is paid in full, you both get a 10% coupon for your next tour. Each friend earns a reward once.",
  "Davet bağlantını paylaş. Arkadaşın bu bağlantıyla üye olup turunu tamamladığında, ikiniz de sonraki turunuz için %10 kupon kazanın. Aynı arkadaş için bir kez ödül verilir.":
    "Share your invite link. When your friend signs up with it and completes their tour, you both get a 10% coupon for your next tour. Each friend earns a reward once.",
  "Davet kodunuz": "Your invite code",
  "Davet bağlantınız": "Your invite link",
  "Bağlantı kopyalandı": "Link copied",
  "Davet bağlantısını kopyala": "Copy invite link",
  "davetle katılan": "joined by invite",
  "kazanılan ödül": "rewards earned",
  "Bir sonraki yolculuğunuz için": "For your next trip",
  "İndirim kuponlarım": "My discount coupons",
  "Rotanı seç": "Choose your route",
  "Şans çarkı hediyeniz": "Your prize wheel gift",
  "Arkadaş daveti hediyeniz": "Your friend invite gift",
  Kullanıldı: "Used",
  "Rezervasyonda seçebilirsiniz": "You can choose it when booking",
  "Minimum {amount}.": "Minimum {amount}.",
  "Seçili turlarda geçerli.": "Valid on selected tours.",
  "Tüm turlarda geçerli.": "Valid on all tours.",
  "Son gün: {date}": "Last day: {date}",
  "İlk kuponunuz için şans çarkını çevirin.":
    "Spin the prize wheel for your first coupon.",
  "Kuponlar üzerlerinde belirtilen tarihe kadar geçerli, tek kullanımlı ve yalnız üye hesabınıza aittir. Aynı rezervasyonda bir kupon kullanılabilir; indirimler birleştirilmez. Tur bedeline uygulanır; ekstra hizmet ve konaklamayı kapsamaz.":
    "Coupons are valid until the date shown, can be used once and belong to your member account only. One coupon can be used per booking; discounts can’t be combined. They apply to the tour price, not to extra services or accommodation.",
  "Giriş seçeneklerim": "My sign-in options",
  "Aynı e-posta adresine sahip sosyal hesabınızı bağlayarak sonraki girişlerinizi kolaylaştırabilirsiniz.":
    "Link a social account with the same email address to make signing in easier next time.",
  "{provider} hesabını bağla": "Link {provider} account",
  "{provider} · Bağlantı hazırlanıyor": "{provider} · Connection in progress",
  "Ön rezervasyonlarım": "My pre-bookings",
  "İlk yolculuğunuz henüz burada değil.": "Your first trip isn’t here yet.",
  "Rotaları keşfedin.": "Explore the routes.",

  // Hesap güvenliği
  "E-posta adresiniz doğrulandı.": "Your email address has been verified.",
  " E-posta gelmezse spam klasörünü kontrol edin veya acenteyle iletişime geçin.":
    " If the email doesn’t arrive, check your spam folder or contact the agency.",
  "Parolalar eşleşmiyor.": "The passwords don’t match.",
  "Parolanız yenilendi. Yeni parolanızla giriş yapabilirsiniz.":
    "Your password has been reset. You can log in with your new password.",
  "Hesap güvenliği": "Account security",
  "E-postanızı doğrulayın.": "Verify your email.",
  "Parolanızı mı unuttunuz?": "Forgot your password?",
  "Yeni bir parola belirleyin.": "Set a new password.",
  "Bağlantınızı aşağıdaki düğmeyle onaylayın.":
    "Confirm your link with the button below.",
  "Üyelik e-posta adresinize tek kullanımlık yenileme bağlantısı isteyin.":
    "Request a one-time reset link to your membership email address.",
  "Bu bağlantı bir saat geçerlidir ve bir kez kullanılabilir.":
    "This link is valid for one hour and can be used once.",
  "Yeni parola": "New password",
  "Yeni parola tekrar": "Repeat new password",
  "E-postamı doğrula": "Verify my email",
  "Yenileme bağlantısı iste": "Request a reset link",
  "Parolamı yenile": "Reset my password",
  "Hesabıma dön": "Back to my account",
  "Profiliniz güncellendi.": "Your profile has been updated.",
  "Size nasıl ulaşalım?": "How can we reach you?",
  "Profil bilgilerim": "My profile",
  "Doğrulanmış e-posta": "Verified email",
  "E-posta doğrulaması bekliyor": "Email verification pending",
  "E-postanız zaten doğrulanmış.": "Your email is already verified.",
  "Doğrulama e-postası kuyruğa alındı.":
    "The verification email is on its way.",
  "Doğrulama talebiniz kaydedildi. E-posta gönderimi acente tarafından etkinleştirildiğinde iletilecek.":
    "Your verification request has been saved. It will be sent once the agency turns on email delivery.",
  "Doğrulama bağlantısı iste": "Request a verification link",
  Telefon: "Phone",
  "Bilgilerimi kaydet": "Save my details",
  "Onay için kutuya büyük harflerle SİL yazın.":
    "To confirm, type DELETE in capital letters.",
  "KVKK md. 11": "KVKK art. 11",
  "Kişisel verilerim (KVKK)": "My personal data (KVKK)",
  "Hakkınızda tuttuğumuz verilerin bir kopyasını indirebilir veya hesabınızın silinmesini isteyebilirsiniz.":
    "You can download a copy of the data we hold about you or ask for your account to be deleted.",
  Haklarınız: "Your rights",
  "Verilerimi indir (JSON)": "Download my data (JSON)",
  "Hesabımı sil": "Delete my account",
  "Üyeliğiniz, kuponlarınız ve iletişim tercihleriniz silinir; oturumunuz kapanır. Ödemesiz rezervasyonlarınızdaki kişisel bilgiler anonimleştirilir. Ödemesi yapılmış rezervasyonlarınız vergi ve ticari mevzuat gereği 10 yıl saklanır ve bu sürenin sonunda anonimleştirilir. Yaklaşan bir yolculuğunuz varsa önce rezervasyonunuzu sonuçlandırmanız gerekir.":
    "Your membership, coupons and contact preferences will be deleted and you’ll be logged out. Personal details in unpaid bookings are anonymised. Paid bookings are kept for 10 years under tax and commercial law and anonymised after that. If you have an upcoming trip, please settle that booking first.",
  "Onaylamak için {word} yazın": "Type {word} to confirm",
  "Hesabımı kalıcı olarak sil": "Delete my account permanently",

  // Yol arkadaşlarım
  "Yol arkadaşlarım": "My travel companions",
  "Ailenizi ve sık birlikte gezdiğiniz kişileri bir kez kaydedin; rezervasyonda kimlik bilgilerini yeniden yazmayın.":
    "Save your family and the people you often travel with once, and skip retyping their ID details when booking.",
  "Yol arkadaşı ekle": "Add a travel companion",
  "{name} kaydını sil": "Delete {name}",
  Sil: "Delete",
  "Henüz kayıtlı yol arkadaşınız yok.":
    "You haven’t saved any travel companions yet.",
  "Türkiye (T.C.)": "Türkiye (T.C.)",
  Kaydet: "Save",
  "T.C. kimlik numarası geçerli görünmüyor.":
    "The Turkish ID number doesn’t look valid.",

  // Sunucu iletileri (üyelik, giriş, kupon, yol arkadaşı, güvenlik doğrulaması)
  "Çok fazla istek. Biraz sonra tekrar deneyin.":
    "Too many requests. Please try again in a moment.",
  "Bağlantı kurulamadı. Lütfen yeniden deneyin.":
    "Couldn’t connect. Please try again.",
  "Bu e-posta ile bir hesap var. Giriş yapın.":
    "An account with this email already exists. Please log in.",
  "Davet kodu bulunamadı. Kodu kontrol edin.":
    "Invite code not found. Please check the code.",
  "E-posta veya parola hatalı.": "Incorrect email or password.",
  "Bu sosyal hesap başka bir üyeye bağlı.":
    "This social account is linked to another member.",
  "Sosyal hesabın e-posta adresi üyeliğinizle eşleşmiyor.":
    "The social account’s email doesn’t match your membership.",
  "Üye girişi gerekli.": "Please log in as a member.",
  "Şans çarkı kampanyası şu anda kapalı.":
    "The prize wheel campaign is currently closed.",
  "Önce e-posta adresinizi doğrulayın.":
    "Please verify your email address first.",
  "Bu üyelik için çark hakkı kullanıldı. Kuponunuz hesabınızda.":
    "This membership has already used its spin. Your coupon is in your account.",
  "Parola en az 10 karakter olmalı.":
    "Password must be at least 10 characters.",
  "Bağlantı geçersiz. Yeni bir bağlantı isteyin.":
    "Invalid link. Please request a new one.",
  "Bağlantının süresi doldu veya daha önce kullanıldı.":
    "The link has expired or has already been used.",
  "Bu adresle bir üyelik varsa parola yenileme talebi oluşturuldu.":
    "If there’s a membership with this address, a password reset has been requested.",
  "Üyelik bulunamadı.": "Membership not found.",
  "Seçilen yol arkadaşı hesabınızda bulunamadı.":
    "The selected travel companion wasn’t found in your account.",
  "Uyruk için bir ülke seçin.": "Choose a country for nationality.",
  "Geçerli bir T.C. kimlik numarası girin.": "Enter a valid Turkish ID number.",
  "Pasaport numarası yalnız harf ve rakamdan oluşmalı.":
    "Passport number may contain only letters and digits.",
  "Güvenlik doğrulamasını tamamlayın.": "Please complete the security check.",
  "Güvenlik doğrulaması şu anda yapılamıyor. Biraz sonra tekrar deneyin.":
    "The security check isn’t available right now. Please try again shortly.",
  "Güvenlik doğrulaması geçersiz veya süresi doldu. Tekrar deneyin.":
    "The security check is invalid or has expired. Please try again.",
  // Yasal metinler (ön bilgilendirme, onaylar, künye)
  "Bu kişinin bilgilerini onun bilgisi dahilinde, sonraki rezervasyonlarımda kullanmak üzere kaydettiğimi ve kendisini {notice} hakkında bilgilendireceğimi beyan ederim. Kaydı dilediğim zaman silebilirim.":
    "I confirm that I am saving this person's details with their knowledge for my future bookings and that I will inform them of the {notice}. I can delete this record at any time.",
  "{terms} okudum, kabul ediyorum. {notice} okudum.":
    "I have read and accept the {terms}. I have read the {notice}.",
  "Kişisel veri aydınlatma metnini":
    "privacy notice",
  // Şans çarkı
  "Çark hediyeniz bekliyor: {prize} indirim.":
    "Your wheel prize is waiting: {prize} off.",
  "Bu tarayıcıdan üye olun veya giriş yapın; e-postanızı doğrulayınca kuponunuz hesabınıza tanımlanır.":
    "Sign up or log in from this browser; your coupon is added once you verify your e-mail.",
  "Çarkı bir kez çevir; her dilim bir tur indirimi.":
    "Spin the wheel once; every slice is a tour discount.",
  "Tebrikler! {prize} indirim kuponunuz hesabınızda.":
    "Congratulations! Your {prize} discount coupon is in your account.",
  "Çark hediyeniz ({prize}) hesabınıza bağlandı. E-postanızı doğrulayınca kuponunuz aktifleşir.":
    "Your wheel prize ({prize}) is linked to your account. Verify your e-mail to activate the coupon.",
};
