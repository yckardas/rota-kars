# Çerez Politikası

> **Taslak — avukat onayı gerekiyor.** KVKK Çerez Uygulamaları Hakkında Rehber (2022) esas alındı.
> Aşağıdaki çerez ve depolama listesi kaynak koddan çıkarıldı (`server/app.mjs`, `server/social-auth.mjs`, `src/components/*.tsx`), varsayım değil.

## Bugünkü durum ve bulgu

Mevcut /bilgilendirme metni: *"Yalnızca oturumunuzu sürdürmek için zorunlu oturum çerezleri kullanılır; reklam veya izleme çerezi kullanılmaz."*

Sitenin **kendi** çerezleri için bu doğru. Ancak:

| Üçüncü taraf | Nerede | Etki |
|---|---|---|
| **Google Haritalar** gömülü harita | Ana sayfa yorumlar bölümü (`src/components/Reviews.tsx`) | Sayfa açıldığında (lazy) Google alan adından içerik yüklenir; Google çerez yerleştirebilir ve IP adresini alır. |
| **Instagram** gömülü oynatıcı | Ana sayfa Instagram bölümü (`src/components/InstagramSection.tsx`) | Meta alan adından içerik yüklenir; Meta çerez yerleştirebilir. |
| **Cloudflare Turnstile** | Rezervasyon, talep ve üyelik formları | Bot doğrulaması için cihaz ve tarayıcı sinyalleri Cloudflare'e gider. Güvenlik amaçlı, zorunlu sayılabilir. |

**Önerim (geliştirme işi, onayınızdan sonra):** Google Haritalar ve Instagram çerçevelerini **"tıklayınca yükle"** yapmak: yerine bir görsel + "Haritayı göster (Google içeriği yüklenir)" düğmesi. Böylece ayrı bir çerez onay penceresine gerek kalmaz ve mevcut cümle doğru olur. Diğer seçenek, onay penceresi eklemek; küçük bir site için gereksiz yük.

---

## Önerilen metin

### Çerez nedir?

Çerezler, ziyaret ettiğiniz sitenin tarayıcınıza kaydettiği küçük metin dosyalarıdır. Benzer şekilde çalışan tarayıcı depolama alanlarını (localStorage, sessionStorage) da bu politikada çerez gibi ele alıyoruz.

### Kullandığımız çerezler

Sitemiz **yalnız zorunlu çerez ve depolama** kullanır. Reklam, profilleme veya ziyaretçi istatistiği (analitik) çerezi kullanmayız. Zorunlu çerezler sitenin çalışması için gerekli olduğundan KVKK md. 5/2-(c) ve (f) kapsamında onayınız aranmadan kullanılır; tarayıcınızdan engellerseniz giriş ve rezervasyon gibi işlevler çalışmayabilir.

| Ad | Tür | Amaç | Süre |
|---|---|---|---|
| `rota_member` | Çerez, birinci taraf, HttpOnly | Üye oturumunu sürdürmek | 7 gün |
| `rota_oauth` | Çerez, birinci taraf | Google / Facebook / Apple ile girişte güvenlik doğrulaması | 10 dakika |
| `rota_admin` | Çerez, birinci taraf, HttpOnly | Yalnız acente personelinin yönetim paneli oturumu | Varsayılan 8 saat |
| `rota-membership-invite-v1` | localStorage | Üyelik davet penceresini bir kez gösterdikten sonra tekrar göstermemek | Siz silene kadar |
| `rota-chat-abroad-consent` | localStorage | Sohbet asistanı için verdiğiniz yurt dışı aktarım onayını hatırlamak | Onayı geri alana kadar |
| Sohbet geçmişi | sessionStorage | Sohbet penceresindeki son mesajları sayfa değişince korumak | Sekme kapanınca silinir |

### Üçüncü taraf içerikler

| Sağlayıcı | Amaç | Ne zaman |
|---|---|---|
| Cloudflare (Turnstile) | Formların botlara karşı korunması | Form sayfalarında |
| Ödeme kuruluşu `[doldurulacak]` | Online kapora ödemesi | Yalnız kartla ödemeyi seçtiğinizde; ödeme sayfası kuruluşun kendi alan adında açılır `[geliştirici teyit: yönlendirme mi, sayfaya gömülü form mu]` |
| Google (Haritalar) | Ofis konumunun gösterilmesi | `[tıklayınca yükle yapılırsa: yalnız "Haritayı göster"e bastığınızda]` |
| Meta (Instagram) | Instagram gönderilerinin gösterilmesi | `[tıklayınca yükle yapılırsa: yalnız oynatıcıyı açtığınızda]` |

Bu sağlayıcıların çerezleri kendi politikalarına tabidir.

### Çerezleri nasıl yönetirsiniz?

Tarayıcınızın ayarlarından çerezleri silebilir veya engelleyebilirsiniz. localStorage ve sessionStorage kayıtları da tarayıcının "site verilerini temizle" seçeneğiyle silinir.

Kişisel verilerinizle ilgili ayrıntılar ve haklarınız için Aydınlatma Metni'ne bakın.

*Son güncelleme: [doldurulacak]*
