// Yasal metinler: ön bilgilendirme formu ve tur hizmet sözleşmesi tek yerde üretilir.
// Aynı metin rezervasyonun 3. adımında gösterilir, onaylandığı anda rezervasyon
// kaydına yazılır ve müşteriye e-postayla gider. Kaynak taslaklar: docs/yasal/.
// Metin değişirse LEGAL_VERSION yükseltilir; kayıtta hangi sürümün onaylandığı kalır.
import { transferLine } from "./transfer.mjs";
import { business } from "./catalog.mjs";

export const LEGAL_VERSION = "2026-11";
export const DEFAULT_DEPOSIT_PERCENT = 30;

const tl = (kurus) =>
  (Number(kurus || 0) / 100).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " TL";
const trDate = (ymd) => {
  const [y, m, d] = String(ymd || "").split("-");
  return y && m && d ? `${d}.${m}.${y}` : String(ymd || "");
};
const stamp = (ms) =>
  new Date(ms).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });

// Yurt dışı turlarda kesintisiz iptal süresi 5, yurt içinde 3 gündür.
export const isAbroad = (tour) => Boolean(tour?.abroad);
export const isOvernight = (tour) => /gece/i.test(String(tour?.duration || ""));
export const freeCancelDays = (tour) => (isAbroad(tour) ? 5 : 3);
// Hareketten bu kadar saat öncesine kadar yapılan iptal kesintisizdir.
export const freeCancelHours = (tour) => freeCancelDays(tour) * 24;
// Rezervasyon anı kesintisiz iptal süresinin içine düşüyorsa (son dakika) true.
export function isLateBooking(tour, date, startTime, now = Date.now()) {
  const start = Date.parse(`${date}T${startTime || "00:00"}:00+03:00`);
  return (
    Number.isFinite(start) && start - now < freeCancelHours(tour) * 3600000
  );
}

export function legalEntity(b = business) {
  return [
    `Ticaret unvanı: ${b.legalName}`,
    `Acenta unvanı: ${b.name} · T.C. Kültür ve Turizm Bakanlığı ${b.licenseGroup} Grubu Seyahat Acentası, belge no ${b.tursabNo} · TÜRSAB üyesi`,
    `Adres: ${b.address}`,
    `MERSİS: ${b.mersis} · ${b.taxOffice} V.D. ${b.taxNo} · ${b.tradeRegistry} ${b.tradeRegistryNo}`,
    `Telefon: ${b.phone} · ${b.mobile} · E-posta: ${b.email} · KEP: ${b.kep}`,
  ];
}

// İptal ve iade koşulları (sitedeki /bilgilendirme#iptal metniyle aynı kurallar).
export function cancellationRules(
  tour,
  { depositPercent = DEFAULT_DEPOSIT_PERCENT } = {},
) {
  const days = freeCancelDays(tour),
    scope = isAbroad(tour) ? "yurt dışı" : "yurt içi";
  return [
    "Ödeme yapılmamış ön rezervasyonu istediğiniz zaman ücretsiz iptal edebilirsiniz. 24 saat içinde ödeme kaydedilmeyen ön rezervasyon kendiliğinden düşer.",
    `Bu tur ${scope} turdur. Onaylanmış rezervasyonu tur hareketinden ${days} gün (${days * 24} saat) öncesine kadar iptal ederseniz kapora dahil ödediğiniz tutarın tamamı iade edilir.`,
    `Bu süreden sonra yapılan iptallerde kapora (toplam bedelin %${depositPercent}'u) iade edilmez; kaporayı aşan ödemeniz iade edilir.`,
    "Haber vermeden tura katılmazsanız veya buluşma saatinde hazır bulunmazsanız (gelmeme) ödediğiniz tutar iade edilmez.",
    "Süre, iptal talebinizin bize ulaştığı an ile turun hareket saati arasında hesaplanır. İptal talebi Rezervasyonum sayfasından, e-postayla veya telefonla iletilebilir.",
    "Turu biz iptal edersek (asgari katılımcıya ulaşılamaması, hava, yol, sınır koşulları veya resmî karar) ödediğiniz tutarın tamamını kesintisiz geri alırsınız ya da dilerseniz başka bir tarihe geçersiniz.",
    "İadeler, iptal kesinleştikten sonra en geç 14 gün içinde ödemenin yapıldığı yönteme uygun olarak yapılır: kartla ödendiyse aynı karta, havale ile ödendiyse bildirdiğiniz IBAN'a. Karta iadenin hesaba yansıma süresi bankanıza bağlıdır. Kesintisiz iade hâllerinde hiçbir kesinti yapılmaz.",
  ];
}

const section = (title, lines) =>
  [
    title.toLocaleUpperCase("tr-TR"),
    ...lines.filter(Boolean).map((l) => (l.startsWith("  ") ? l : "- " + l)),
  ].join("\n");

// data: { tour, date, startTime, pickup, vehicleName, customer:{name,email,phone},
//   passengers:[{name, seat, nationality}], unitPrice, count, discount, total, deposit,
//   paymentMode, onlinePayment, reference, createdAt, depositPercent }
export function preInfoText(data, b = business) {
  const { tour } = data,
    pct = data.depositPercent || DEFAULT_DEPOSIT_PERCENT,
    full = data.paymentMode === "full",
    late = isLateBooking(
      tour,
      data.date,
      data.startTime,
      data.createdAt || Date.now(),
    );
  const parts = [
    `ÖN BİLGİLENDİRME FORMU · sürüm ${LEGAL_VERSION}`,
    data.reference
      ? `Ön rezervasyon no: ${data.reference} · Oluşturulma: ${stamp(data.createdAt || Date.now())}`
      : "",
    section("1. Hizmeti sunan (acente)", legalEntity(b)),
    section("2. Müşteri", [
      `Ad soyad: ${data.customer.name}`,
      `E-posta: ${data.customer.email}`,
      `Telefon: ${data.customer.phone}`,
    ]),
    section("3. Tur", [
      `Tur: ${tour.name} (${isOvernight(tour) ? "konaklamalı paket tur" : "günübirlik tur"}, ${tour.duration})`,
      `Güzergâh: ${tour.location}`,
      `Tarih: ${trDate(data.date)} · hareket ${data.startTime}${tour.end ? ` · dönüş yaklaşık ${tour.end}` : ""}`,
      data.pickup ? `Buluşma noktası: ${data.pickup}` : "",
      data.vehicleName
        ? `Araç: ${data.vehicleName}, şoförlü, D2/B2 belgeli`
        : "",
      "Rehberlik: profesyonel kokartlı rehber",
      tour.included?.length ? `Fiyata dahil: ${tour.included.join(", ")}` : "",
      tour.excluded?.length
        ? `Fiyata dahil değil: ${tour.excluded.join(", ")}`
        : "",
      isAbroad(tour)
        ? "Yurt dışı tur: her yolcunun yanında sınır geçişine uygun geçerli kimlik belgesi (pasaport veya kabul edilen kimlik kartı) bulunmalıdır. Belge eksikliği nedeniyle tura katılamama gelmeme hükmündedir."
        : "",
      "Program hava, yol, sınır ve mevsim koşullarına göre sıra veya içerik bakımından değişebilir; mevsime bağlı deneyimler (buz, kar, atlı kızak vb.) garanti edilmez. Turun esaslı bir unsuru (tarih, ana duraklar, konaklama yeri, araç sınıfı) değişirse sözleşmeden ücretsiz dönebilirsiniz.",
    ]),
    section("4. Yolcular ve koltuklar", [
      ...data.passengers.map(
        (p, i) =>
          `${i + 1}. ${p.name}${p.nationality ? ` (${p.nationality})` : ""}${p.seat != null ? ` · koltuk ${p.seat}` : ""}`,
      ),
      "Bir rezervasyonda en çok 4 koltuk ayrılabilir.",
      "Yolcuların ad soyad, uyruk, T.C. kimlik / pasaport numarası ve cinsiyet bilgileri turizm taşımacılığı mevzuatı gereği sefer öncesinde Ulaştırma ve Altyapı Bakanlığı'nın U-ETDS sistemine bildirilir. Bilgiler kimlik belgesiyle aynı olmalıdır.",
      data.passengers.length > 1
        ? "Diğer yolcular adına bilgi girdiniz; bu kişileri bilgilendirdiğinizi ve bilgilerini paylaşmaya yetkili olduğunuzu beyan ettiniz."
        : "",
    ]),
    section("5. Fiyat ve ödeme", [
      `Kişi başı fiyat: ${tl(data.unitPrice)} × ${data.count} kişi`,
      data.discount ? `Kupon indirimi: -${tl(data.discount)}` : "",
      data.transfer ? `${transferLine(data.transfer)}: ${tl(data.transfer.amount)} (grup başına)` : "",
      `Toplam (KDV dahil): ${tl(data.total)}`,
      full
        ? `Ödeme tercihi: tam ödeme (${tl(data.total)})`
        : `Ödeme tercihi: %${pct} kapora (${tl(data.deposit)}) · kalan ${tl(data.total - data.deposit)} tur günü hareketten önce ödenir`,
      data.onlinePayment
        ? "Online ödeme: kart bilgileriniz sitemizdeki güvenli ödeme formunda girilir, şifreli bağlantıyla Vakıfbank sanal POS'una iletilir ve 3D Secure ile kartınızı veren bankada doğrulanır. Kart bilgileri veritabanımıza yazılmaz ve saklanmaz. Ödeme başarıyla tamamlandığında rezervasyonunuz otomatik onaylanır."
        : "",
      "Havale/EFT veya nakit: ödeme acente ofisinde nakit ya da acentenin bildireceği banka hesabına havale/EFT ile de yapılabilir. Bu durumda ödeme acente tarafından kaydedilip rezervasyon onaylanana kadar kaydınız bir ön rezervasyondur, kesin bilet değildir.",
      "Fiyatlar Türk lirasıdır. Sözleşme kurulduktan sonra toplam bedel artırılmaz. Fatura, ödeme kaydedildikten sonra rezervasyon sahibi adına düzenlenir.",
      "Acente telefonla, e-postayla veya mesajla kart bilgisi, parola ya da doğrulama kodu istemez.",
    ]),
    section("6. Sözleşmenin kurulması", [
      "Siteden gönderdiğiniz kayıt, ödeme yapılana kadar bir ön rezervasyon talebidir. Seçtiğiniz koltuklar 24 saat süreyle sizin için tutulur.",
      data.onlinePayment
        ? "Online ödemede kapora veya tam ödeme başarıyla tamamlandığı anda rezervasyonunuz otomatik onaylanır ve sözleşme bu anda kurulur."
        : "",
      "Havale/EFT veya nakit ödemede acente müsaitliği teyit edip ödemeyi kaydeder; sözleşme, acentenin onayı size e-postayla bildirildiği anda kurulur.",
      "Onay e-postası Tur Hizmet Sözleşmesi'nin ve bu formun bir kopyasını içerir.",
      "24 saat içinde ödeme kaydedilmezse ön rezervasyon kendiliğinden düşer, koltuklar serbest kalır; size bir yükümlülük doğmaz.",
    ]),
    section("7. Cayma hakkı", [
      isOvernight(tour)
        ? "Konaklamalı paket turlarda 6502 sayılı Kanun md. 51 ve Paket Tur Sözleşmeleri Yönetmeliği uygulanır; 14 günlük cayma hakkı yoktur."
        : "Belirli bir tarihte yapılması gereken ve boş zamanın değerlendirilmesine ilişkin hizmetlerde Mesafeli Sözleşmeler Yönetmeliği md. 15/1-(g) uyarınca 14 günlük cayma hakkı bulunmaz.",
      "Bunun yerine aşağıdaki iptal ve iade koşulları geçerlidir.",
    ]),
    section("8. İptal ve iade koşulları", [
      ...cancellationRules(tour, { depositPercent: pct }),
      late && data.onlinePayment
        ? `Son dakika rezervasyonu: tur hareketine ${freeCancelDays(tour)} günden az kaldı. Ödeme yaptıktan sonra iptal ederseniz kapora iade edilmez.`
        : "",
    ]),
    section("9. Turun devri ve yolcu değişikliği", [
      "Günübirlik turlarda yolcu adı değişikliği kalkıştan önce acenteye bildirilerek ücretsiz yapılır.",
      isOvernight(tour)
        ? "Konaklamalı paket turda, tura katılmanıza engel bir durum çıkarsa tur başlangıcından en az 7 gün önce bildirerek turu koşulları taşıyan başka birine devredebilirsiniz; devreden ve devralan kalan bedelden ve devrin yol açtığı makul ek masraflardan birlikte sorumludur."
        : "",
    ]),
    section("10. Şikâyet ve uyuşmazlık", [
      `Şikâyetlerinizi önce acenteye iletebilirsiniz: ${b.email} · ${b.phone}.`,
      "Ticaret Bakanlığı'nca her yıl belirlenen parasal sınırlar içinde tüketici hakem heyetlerine, bu sınırları aşan uyuşmazlıklarda tüketici mahkemelerine başvurabilirsiniz. Başvuru e-Devlet'teki TÜBİS üzerinden de yapılabilir. Kanunda öngörülen hâllerde dava açmadan önce arabulucuya başvurulması zorunludur.",
    ]),
    section("11. Kişisel veriler", [
      "Kişisel verileriniz rotakarsturizm.com/bilgilendirme#kvkk adresindeki Aydınlatma Metni'ne uygun olarak işlenir.",
    ]),
  ];
  return parts.filter(Boolean).join("\n\n");
}

// Onay anında kurulan sözleşme. data: preInfoText ile aynı alanlar + confirmedAt, via.
export function contractText(data, b = business) {
  const { tour } = data,
    pct = data.depositPercent || DEFAULT_DEPOSIT_PERCENT;
  const parts = [
    `TUR HİZMET SÖZLEŞMESİ · sürüm ${LEGAL_VERSION}`,
    data.draft
      ? `Sözleşme no: ${data.reference} · Kuruluş: ${data.via === "online" ? "ödemeniz bankaca onaylandığı anda" : "rezervasyonunuz onaylandığı anda"}`
      : `Sözleşme no: ${data.reference} · Kuruluş: ${stamp(data.confirmedAt || Date.now())} (${data.via === "online" ? "online ödeme ile otomatik onay" : "acente onayı"})`,
    section("Madde 1. Taraflar", [
      ...legalEntity(b).map((l, i) => (i === 0 ? l + ' ("Acente")' : l)),
      `Müşteri: ${data.customer.name} · ${data.customer.email} · ${data.customer.phone} ("Müşteri")`,
      "Müşteri, kendisi dışındaki yolcular adına da işlem yapıyorsa bu kişilerin bilgisi ve onayıyla hareket ettiğini, onları bu sözleşme ve aydınlatma metni hakkında bilgilendireceğini ve verdiği kimlik bilgilerinin yolcuların kimlik belgeleriyle aynı olduğunu kabul eder.",
    ]),
    section("Madde 2. Konu", [
      "Bu sözleşmenin konusu, Müşteri'nin rotakarsturizm.com üzerinden ön rezervasyonunu yaptığı aşağıdaki tur hizmetinin aşağıdaki fiyat ve koşullarla sunulmasıdır. Müşteri'nin sözleşmeden önce onayladığı Ön Bilgilendirme Formu bu sözleşmenin ekidir.",
    ]),
    section("Madde 3. Tur bilgileri", [
      `Tur: ${tour.name} (${tour.duration}) · ${tour.location}`,
      `Tarih: ${trDate(data.date)} · hareket ${data.startTime}${tour.end ? ` · dönüş yaklaşık ${tour.end}` : ""}`,
      data.pickup ? `Buluşma noktası: ${data.pickup}` : "",
      data.vehicleName
        ? `Araç: ${data.vehicleName}, şoförlü, D2/B2 belgeli`
        : "",
      "Rehberlik: profesyonel kokartlı rehber",
      tour.included?.length ? `Dahil: ${tour.included.join(", ")}` : "",
      tour.excluded?.length ? `Dahil değil: ${tour.excluded.join(", ")}` : "",
      `Yolcular ve koltuklar: ${data.passengers.map((p) => `${p.name}${p.seat != null ? " (" + p.seat + ")" : ""}`).join(", ")}`,
    ]),
    section("Madde 4. Fiyat ve ödeme", [
      `Toplam bedel ${tl(data.total)} (KDV dahil); kişi başı ${tl(data.unitPrice)} × ${data.count} kişi${data.discount ? `, kupon indirimi ${tl(data.discount)}` : ""}${data.transfer ? `, ek hizmet olarak ${transferLine(data.transfer).replace(/^Transfer: /, "transfer (")}) ${tl(data.transfer.amount)}` : ""}.`,
      `Onay için toplam bedelin %${pct}'u kapora olarak ödenir; kalan bedel en geç tur günü hareketten önce ödenir. Müşteri dilerse bedelin tamamını baştan ödeyebilir.`,
      "Ödemeler sitedeki güvenli ödeme formunda kartla (Vakıfbank sanal POS, 3D Secure), Acente'nin banka hesabına havale/EFT ile veya Acente ofisinde nakit yapılır. Kart bilgileri Acente'nin veritabanına yazılmaz ve saklanmaz.",
      "Sözleşme kurulduktan sonra toplam bedel artırılmaz.",
      "Kalan bedel hareketten önce ödenmezse Müşteri tura alınmayabilir; bu durum gelmeme hükmündedir (Madde 6).",
    ]),
    section("Madde 5. Tarafların yükümlülükleri", [
      "Acente, turu programa, sözleşmeye ve mevzuata uygun; belgeli araçlarla ve yetkili rehberle yürütür. Programın esaslı unsurlarında değişiklik zorunlu olursa Müşteri'yi gecikmeksizin bilgilendirir.",
      "Müşteri, buluşma noktasında belirtilen saatte hazır bulunur; yurt dışı turlarda geçerli giriş belgesini yanında bulundurur; rehberin güvenlik talimatlarına ve araç kurallarına uyar.",
      "Acente, programda dahil değil olarak belirtilen ve Müşteri'nin doğrudan üçüncü kişilerden satın aldığı hizmetlerden (yemek, giriş ücreti, atlı kızak, kayak ekipmanı vb.) sorumlu değildir. Bu, Acente'nin kanundan doğan sorumluluğunu sınırlamaz.",
      "Mevsime bağlı deneyimler (buz, kar, atlı kızak vb.) doğa koşullarına bağlıdır ve garanti edilmez; bunların gerçekleşmemesi tek başına esaslı değişiklik sayılmaz.",
    ]),
    section(
      "Madde 6. İptal ve iade",
      cancellationRules(tour, { depositPercent: pct }),
    ),
    section("Madde 7. Acente'nin turu iptal etmesi veya değiştirmesi", [
      "Asgari katılımcı sayısına ulaşılamaması veya hava, yol, sınır kapısı, resmî makam kararı gibi Acente'nin kontrolü dışındaki sebeplerle tur yapılamazsa Acente Müşteri'yi derhâl bilgilendirir.",
      "Bu hâllerde Müşteri dilerse başka bir tarihe aktarılır, dilerse ödediği tutarın tamamı Madde 6'daki sürede kesintisiz iade edilir.",
      "Tur başladıktan sonra programın bir bölümü yapılamazsa Acente mümkün olan eşdeğer alternatifi sunar; yapılamayan ve yerine konamayan hizmetin bedeli iade edilir.",
      "Turun esaslı unsurlarından biri değişirse Müşteri değişikliği kabul etmeyerek sözleşmeden ücretsiz dönebilir.",
    ]),
    isOvernight(tour)
      ? section("Madde 8. Paket tur ek hükümleri", [
          "Bu tur 6502 sayılı Kanun md. 51 ve Paket Tur Sözleşmeleri Yönetmeliği kapsamındadır; yönetmeliğin emredici hükümleri bu sözleşmeye aykırı olsa da geçerlidir.",
          "Devir: Müşteri, tur başlangıcından en az 7 gün önce bildirerek turu gerekli koşulları taşıyan bir başkasına devredebilir; devreden ve devralan kalan bedelden ve makul ek masraflardan müteselsilen sorumludur.",
          "Acente, tur başlangıcından makul süre önce otel adı ve iletişim bilgisi, buluşma noktası ve acil durum telefonunu yazılı olarak iletir.",
          "Belirtilen otel veya eşdeğer kategoride bir tesis kullanılır; daha düşük nitelikte tesise geçilmesi esaslı değişikliktir.",
          "Sözleşmeye uygun sunulmayan hizmetler için Müşteri; eksikliğin giderilmesi, bedelden indirim, sözleşmeden dönme ve şartları varsa tazminat haklarına sahiptir. Eksikliğin yerinde giderilebilmesi için rehbere veya Acente'ye gecikmeden bildirilmesi önerilir.",
        ])
      : "",
    section(`Madde ${isOvernight(tour) ? 9 : 8}. Kişisel veriler`, [
      "Kişisel veriler Acente'nin Aydınlatma Metni'ne (rotakarsturizm.com/bilgilendirme#kvkk) uygun işlenir. Yolcuların ad soyad, uyruk, T.C. kimlik / pasaport no ve cinsiyet bilgileri her sefer öncesinde U-ETDS sistemine bildirilir. Kimlik numaraları şifreli saklanır ve tur tarihinden 1 yıl sonra silinir.",
    ]),
    section(`Madde ${isOvernight(tour) ? 10 : 9}. Bildirimler ve uyuşmazlık`, [
      "Madde 1'deki e-posta ve telefonlar geçerli bildirim adresidir; Acente'ye resmî bildirimler KEP adresine de yapılabilir.",
      "Uyuşmazlıklarda Ticaret Bakanlığı'nca ilan edilen parasal sınırlar içinde tüketici hakem heyetleri, bu sınırları aşan hâllerde tüketici mahkemeleri yetkilidir. Kanunda öngörülen hâllerde dava açılmadan önce arabulucuya başvurulması zorunludur.",
    ]),
    data.preInfoAcceptedAt
      ? `Müşteri Ön Bilgilendirme Formu'nu ${stamp(data.preInfoAcceptedAt)} tarihinde elektronik ortamda onaylamıştır. Sözleşmenin bir örneği Müşteri'ye e-postayla gönderilmiş, bir örneği Acente kayıtlarında saklanmaktadır.`
      : "Sözleşmenin bir örneği Müşteri'ye e-postayla gönderilmiş, bir örneği Acente kayıtlarında saklanmaktadır.",
  ];
  return parts.filter(Boolean).join("\n\n");
}

// Rezervasyon kaydından (workflow.get çıktısı) metin verisi.
export function legalDataFromReservation(
  r,
  tour,
  { depositPercent, onlinePayment = false } = {},
) {
  return {
    tour,
    date: r.date,
    startTime: r.start_time,
    pickup: r.pickup,
    vehicleName: r.vehicle?.name || "",
    customer: { name: r.name, email: r.email, phone: r.phone },
    passengers: r.passengers.map((name, i) => ({
      name,
      seat: r.seats[i],
      nationality: r.passenger_details?.[i]?.nationality || "",
    })),
    unitPrice: r.seats.length
      ? Math.round((r.subtotal || r.total) / r.seats.length)
      : r.total,
    count: r.seats.length,
    discount: r.discount_amount || 0,
    transfer: r.transfer || null,
    total: r.total,
    deposit: r.deposit,
    paymentMode: r.payment_mode,
    onlinePayment,
    reference: r.reference,
    createdAt: r.created_at,
    depositPercent,
    preInfoAcceptedAt: r.pre_info_accepted_at || null,
  };
}
