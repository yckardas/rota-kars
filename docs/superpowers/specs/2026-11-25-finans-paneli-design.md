# Finans paneli — tasarım

Tarih: 2026-11-25 · Dal: `feature/finans-dekont`

## Amaç ve neden

Acente sahibi ve operasyon ekibi paranın durumunu tek ekrandan görmek istiyor: ne sattık (ciro), ne tahsil ettik, müşterilerden ne kadar alacağımız var, önümüzdeki günlerde kimden ne kadar para bekliyoruz ve gelen taleplerin tahmini değeri ne. Bugün bunun bir kısmı yalnız "Aylık rapor"da, ay ay ve tablo olarak var; "Özet" yalnız adet gösteriyor. Ay sınırı olmadan toplam alacak, gün/hafta kırılımı, beklenen ödeme takvimi ve talep değeri hiçbir yerde yok.

Başarı: Acente sekmeyi açtığında (1) dönemin cirosunu ve tahsilatını, (2) toplam açık alacağı, (3) önümüzdeki günlerde kimi araması gerektiğini, (4) talep hattının tahmini değerini grafikler ve kısa listelerle bir bakışta görür; gün / hafta / ay arasında geçebilir.

## Hedefler

- Panelde yeni **"Finans"** sekmesi (menüde "Satış" grubunda, "Aylık rapor"un üstünde). Sahip ve operasyon rolü görür (Aylık rapor ile aynı erişim); rehber görmez.
- Üstte dönem seçici: **Gün / Hafta / Ay / Tarih aralığı**, önceki/sonraki ok düğmeleri ve "Bugün". Varsayılan: bu ay.
- Bölümler (yukarıdan aşağıya):
  1. **Özet kartları**: dönem cirosu, dönem net tahsilatı, toplam açık alacak (dönemden bağımsız, bugün itibarıyla), önümüzdeki 7 günde beklenen ödeme.
  2. **Ciro ve tahsilat grafiği**: dönem içinde yan yana çubuklar. Hafta görünümünde 7 gün; ay görünümünde günler; tarih aralığı 62 günü aşarsa haftalar. Gün görünümünde grafik yerine **"Günün hareketleri"** listesi gelir; iki parçası var:
     - o gün kalkan seferler: tur, saat, kişi, ciro, kalan bakiye;
     - o gün kaydedilen tahsilat ve iadeler: saat, referans, müşteri, yöntem, tutar, not.
     Diğer bölümler gün görünümünde de aynen durur.
  3. **Beklenen ödemeler takvimi**: bugünden itibaren 30 gün (dönem seçiciden bağımsız). Gün gün çubuk + altında liste: referans, müşteri, tur, tur tarihi, kalan tutar, Ara ve WhatsApp bağlantısı; satıra tıklayınca rezervasyon kartı açılır (Rezervasyonlar sekmesindeki `openRef` yolu).
  4. **Tur bazında satış**: tur tarihi dönemde olan turlar için yatay çubuk. Her satırda ciro, "bu satıştan tahsil edilen" ve doluluk % var. Tahsil edilen, bu rezervasyonların bugünkü `net_paid` toplamıdır, para ne zaman girmiş olursa olsun. Bu, Aylık rapordaki `byTour.collected` ile aynı tanımdır, yani iki ekranın tur satırları tutar. Bu yüzden satırların toplamı "dönem net tahsilatı" kartına eşit olmak zorunda değildir: kart, dönemde kasaya giren parayı gösterir. Bu farkı bölüm başlığının altındaki kısa bir açıklama satırı söyler.
  5. **Ödeme yöntemleri**: dönemin net tahsilatının nakit / havale / POS / online kart payları (tek yatay yığılmış çubuk + rakamlar).
  6. **Talep hattı**: aşamalar Yeni → Arandı → Görüşülüyor → Teklif verildi → Rezervasyona döndü / Kapandı; her aşamada adet ve tahmini TL. Dönem: talebin geliş tarihi (`created_at`).
  7. **Geçmiş turdan kalan alacak**: tur tarihi geçmiş, durumu onaylı veya tamamlanmış, kalan bakiyesi olan kayıtlar (uyarı listesi, Ara/WhatsApp).
- Telefonda (mobil panel / uygulama) bölümler alt alta, grafikler tam genişlikte; karanlık modda okunur.

## Hesap tanımları

Para birimi her yerde kuruş (tamsayı), gösterim `currency()` ile.

- **Canlı rezervasyon**: durumu `cancelled` veya `expired` olmayan kayıt. (Aylık rapordaki tanımla aynı; iki ekranın rakamları tutsun diye.)
- **Ciro**: tur tarihi dönem içinde olan canlı rezervasyonların `total` toplamı. Onay bekleyenler dahildir; kartın altında "bunun X TL'si onay bekliyor" satırı gösterilir. Grafikte ciro tur tarihine göre gruplanır.
- **Tahsilat**: `payment_ledger` kayıtlarından, `created_at` (Europe/Istanbul) dönem içinde olanlar: ödemeler − iadeler = net. Grafikte ödeme gününe göre gruplanır. Yöntem payı aylık rapordaki gibi `cash`, `bank_transfer`, `pos`, `online:vakifbank`.
- **Açık alacak (toplam)**: tüm canlı rezervasyonlarda `max(0, total − net_paid)` toplamı, `no_show` hariç (gelmeyen müşteriden kalan bakiye tahsil edilecek alacak sayılmaz; kartta ayrıca "gelmeyenlerde X TL" diye küçük not olarak gösterilir).
- **Beklenen ödeme**: tur tarihi bugün veya sonrası, canlı, `no_show` olmayan ve kalan bakiyesi > 0 olan kayıtlar; vade = tur tarihi (kalan bakiye en geç hareketten önce ödenir). 7 günlük kart ve 30 günlük takvim bundan beslenir.
- **Geçmiş turdan kalan alacak**: tur tarihi bugünden önce, durumu `confirmed` veya `completed`, kalan bakiyesi > 0.
- **Talebin tahmini değeri**: yalnız tur fiyatıyla eşleşebilen talepler için `kişi sayısı (guests) × birim fiyat`.
  - Talepte `tourId` varsa o tur kullanılır.
  - `tourId` yoksa, talebin notunda (`body.notes`) bir tur adı geçiyorsa o tur kullanılır ("benzer isimdeki tur"). Bu özel tur talepleri için asıl yoldur: `RequestForm` özel tur talebinde `tourId` göndermez. Eşleştirme sabit bir **anahtar kelime tablosuyla** yapılır. Tablo, sunucuda tur kimliğine bağlıdır. Not Türkçe küçük harfe çevrilip kelime sınırıyla aranır:

    | Anahtar kelime(ler) | Tur |
    |---|---|
    | ani, çıldır | ani-cildir |
    | sarıkamış, kayak | sarikamis |
    | batum | batum |
    | tiflis, gürcistan | tiflis |
    | nahçıvan | nahcivan |
    | azerbaycan, bakü | buyuk-azerbaycan |
    | mardin | butik-mardin |
    | güneydoğu | guneydogu |
    | divriği, kemaliye, sivas | sivas-kemaliye |
    | karadeniz | karadeniz |
    | narman, tortum | narman-tortum |
    | şavşat, karagöl | savsat-karagol |
    | van havzası | van-havzasi |
    | van | van-gunubirlik, van, van-havzasi (üçü birden) |

    "Günübirlik", "Konaklamalı", "Büyük", "Butik", "tur" gibi genel kelimeler anahtar değildir. Uzun ifade kısa olanı ezer: "van havzası" geçiyorsa yalnız van-havzasi eşleşir, düz "van" eşleşmesi düşer. Katalogda tabloda olmayan yeni bir tur varsa onun için nottan eşleştirme yapılmaz, ama `tourId` ile gelen taleplerde kullanılır.
  - **Birden çok tur eşleşirse** (ör. düz "Van turu" ya da notta hem "Batum" hem "Tiflis" geçmesi) birim fiyat, eşleşen turların birim fiyatlarının **ortalamasıdır**. Bu, kullanıcının "benzer isimdeki önceki turun fiyatıyla ortalama olarak göstersin" isteğine dayanır. Satırda "tahmini · N turun ortalaması" etiketi görünür.
  - **Birim fiyat** = o turun tarihi bugünden önceki en son seferinin fiyatı ("önceki tur"); hiç geçmiş sefer yoksa en yakın gelecek seferin fiyatı; o da yoksa katalogdaki tur fiyatı.
  - Konaklama ve araç kiralama talepleri ile eşleşmeyen talepler tahmine girmez; aşamada "N talep · M'si tahminli" diye adetle gösterilir.
  - "Rezervasyona döndü" ve "Kapandı" aşamaları açık hattın toplam tahminine eklenmez (dönen talebin parası zaten rezervasyonda sayılıyor); kendi satırlarında gösterilir.

## Kısıtlar

- Veri tabanı: mevcut koleksiyonlar (`reservations`, `payment_ledger`, `departures`, `requests`) okunur; yeni koleksiyon ya da alan eklenmez.
- Saat dilimi: gün sınırları Europe/Istanbul (aylık rapordaki gibi).
- Yeni bağımlılık yok: grafikler React içinde elle çizilen SVG/CSS ile, panelin renk değişkenleriyle (açık/karanlık mod).
- Ölçek küçük (yüzlerce rezervasyon): sunucu, aylık rapordaki gibi listeyi belleğe alıp hesaplayabilir.
- Türkçe arayüz; kişisel veri yalnız yetkili panel kullanıcısına gider (zaten öyle).

## Hedef dışı

- Muhasebe/fatura, KDV kırılımı, gider ve kâr hesabı.
- Aylık rapor ekranı ve CSV'si değişmez.
- Talep formuna tutar alanı eklemek; taleplere elle teklif tutarı girmek.
- Yeni dışa aktarma (CSV/PDF) — sonraki iş olabilir.

## Anti-hedefler (çalışsa da başarısızlık sayılacaklar)

- Finans ekranındaki ciro/tahsilat ile aynı ayın Aylık rapor rakamlarının tutmaması.
- Tahmini talep değerinin gerçek ciro gibi görünmesi: her yerde "tahmini" etiketi ve farklı (soluk/çizgili) görünüm.
- Telefonda yatay kaydırma gerektiren grafik ya da tablo.

## Yaklaşımlar

1. **Yeni "Finans" sekmesi (seçilen).** Dönem seçicili ayrı ekran; Aylık rapor dokunulmadan kalır. Bedeli: bazı rakamların iki ekranda tekrarı.
2. **Aylık raporu genişletmek.** Tek ekran olurdu ama muhasebede kullanılan rapor ve CSV değişir, sayfa kalabalıklaşır.
3. **Özet sekmesine kartlar eklemek.** Hızlı ama grafik ve dönem seçimi için yer yok; operasyon ekranını para bilgisiyle doldurur.

Kullanıcı 1'i seçti. Grafikler için kütüphane eklemek yerine elle SVG çizmek benim kararım: panelin kendi tasarım diliyle uyumlu, paket boyutu artmaz, ihtiyaç duyulan grafik türleri (çubuk, yatay çubuk, yığılmış çubuk) basit.

## Yapı (öneri)

- Sunucu: `GET /api/admin/finance?from=YYYY-MM-DD&to=YYYY-MM-DD&bucket=day|week` (requireAdmin, rehber 403). Tek yanıt tüm bölümleri taşır: `summary`, `series` (bucket başına ciro/tahsilat), `expected` (30 gün, gün başına toplam + satırlar), `byTour`, `methods`, `pipeline` (aşama başına adet, tahminli adet, tahmini tutar), `overdue`, ve `from === to` iken `day` (`departures`, `ledger` satırları). Hesap `workflow` içinde yeni `financeReport({ from, to, bucket })` fonksiyonunda; `monthReport` ile ortak parçalar yardımcı fonksiyona çıkarılabilir ama monthReport'un çıktısı değişmez.
- İstemci: `src/components/admin/FinancePanel.tsx` + küçük grafik bileşenleri (aynı dosyada veya `financeCharts.tsx`). Stil `src/admin.css` içinde, mevcut `--tufa`, `--red-deep` vb. değişkenlerle.
- Menü: `ALL_TABS`'a `["finance", "Finans", <lucide simgesi>, "Satış"]`; mobil "Diğer" menüsünde görünür.

## Kararlaştırılanlar (kullanıcı)

- Ayrı Finans sekmesi.
- Ciro, tahsilat, alacak, beklenen ödemeler, tur bazında satış, ödeme yöntemleri, talep hattı, geçmiş alacak — hepsi olsun.
- Talep değeri o tura (benzer isimdeki) ait önceki turun fiyatıyla tahmin edilsin.
- Gün / hafta görünümü olsun; grafikler olsun.

## Benim kararlarım (düzeltilebilir)

- Erişim: sahip + operasyon (Aylık rapor gibi).
- Ciro tur tarihine, tahsilat ödeme gününe göre; onay bekleyenler ciroya dahil, ayrıca gösterilir.
- `no_show` bakiyesi alacağa sayılmaz.
- Beklenen ödeme vadesi = tur tarihi; takvim 30 gün, dönem seçiciden bağımsız.
- Nottan tur eşleştirme anahtar kelime tablosu; birden çok eşleşmede fiyat ortalaması ("ortalama" sözünü böyle okudum); birim fiyat sırası (geçmiş sefer → gelecek sefer → katalog).
- Tur bazında satışta "tahsil edilen" = Aylık rapordaki tanım (rezervasyonların net tahsilatı); dönem tahsilat kartı ise kasaya giren para.
- Gün görünümünde grafik yerine "Günün hareketleri" listesi.
- Elle SVG grafik, yeni bağımlılık yok.

## Kurucuya bırakılanlar

- Grafik bileşenlerinin iç yapısı, eksen etiketlerinin yoğunluğu, ipucu (tooltip) davranışı.
- Hafta başlangıcı: Pazartesi.
- Boş durum metinleri ("Bu dönemde satış yok" vb.).
- Simge seçimi (lucide).
- Test kapsamı: sunucu hesapları için `tests/` altında birim testleri (ciro/tahsilat tanımları, no_show hariçliği, talep tahmini ve eşleştirme, gün sınırları); arayüz yerel panelde doğrulanır.
