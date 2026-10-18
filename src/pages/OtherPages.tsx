import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMember } from "../lib/member";
import {
  ArrowRight,
  MapPin,
  Phone,
  Mail,
  Instagram,
  ExternalLink,
  Check,
  BedDouble,
  Search,
  LoaderCircle,
  Compass,
} from "lucide-react";
import { RequestForm } from "../components/RequestForm";
import { ReservationTicket } from "./Booking";
import { api, post } from "../lib/api";
import { telHref } from "../lib/phone";
import type { Catalog, Hotel, Reservation } from "../lib/types";
export function Hotels() {
  const [hotels, setHotels] = useState<Hotel[]>([]),
    [request, setRequest] = useState(false),
    [hotelId, setHotelId] = useState<string>(),
    [error, setError] = useState(false);
  useEffect(() => {
    api<Hotel[]>("/hotels")
      .then(setHotels)
      .catch(() => setError(true));
  }, []);
  return (
    <>
      <section className="hotel-hero">
        <img src="/images/stay.jpg" alt="Temsili konaklama görseli" />
        <div className="container">
          <span className="section-note">
            Yolculuğunuza bir gece daha ekleyin
          </span>
          <h1>
            Kars’ta güzel
            <br />
            bir mola.
          </h1>
          <p>
            Anlaşmalı otellerimizde konaklamanızı planlayın.
            <br />
            Tarihlerinizi paylaşın, size uygun seçenekleri birlikte bulalım.
          </p>
          <button className="btn btn-white" onClick={() => setRequest(true)}>
            Konaklama talebi oluştur <ArrowRight size={17} />
          </button>
        </div>
        <small>Temsili oda görseli</small>
      </section>
      <section className="container section">
        <div className="section-heading">
          <div>
            <span className="section-note">
              Sizin için birlikte planlıyoruz
            </span>
            <h2>İyi bir yolculuğa, iyi bir konaklama.</h2>
          </div>
        </div>
        {hotels.length > 0 ? (
          <div className="tour-grid">
            {hotels.map((h) => (
              <article className="hotel-card" key={h.id}>
                {h.image && <img src={h.image} alt={h.name} loading="lazy" />}
                <div>
                  <span className="muted">
                    <MapPin size={14} />
                    {h.location}
                  </span>
                  <h3>{h.name}</h3>
                  <p>{h.description}</p>
                  <div className="hotel-amenities">
                    {h.amenities.map((a) => (
                      <span key={a}>
                        <Check size={13} />
                        {a}
                      </span>
                    ))}
                  </div>
                  <button
                    className="btn"
                    onClick={() => {
                      setHotelId(h.id);
                      setRequest(true);
                    }}
                  >
                    Müsaitlik talep et
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="hotel-empty">
            <BedDouble size={42} strokeWidth={1} />
            <div>
              <h3>Konaklamanızı size göre planlayalım.</h3>
              <p>
                {error
                  ? "Otel listesine şu anda erişilemiyor. Talep bırakarak seçeneklerinizi sorabilirsiniz."
                  : "Otel seçeneklerini tarihlerinize ve oda tercihinize göre acentemizle netleştirebilirsiniz."}
              </p>
            </div>
            <button className="btn" onClick={() => setRequest(true)}>
              Tarihlerimi paylaşayım
            </button>
          </div>
        )}
        <div className="stay-process">
          <div>
            <span>1</span>
            <h3>Tarihlerinizi paylaşın</h3>
            <p>Giriş, çıkış ve kişi sayısını bize iletin.</p>
          </div>
          <div>
            <span>2</span>
            <h3>Seçenekleri değerlendirin</h3>
            <p>Acente güncel müsaitlik ve fiyatı teyit eder.</p>
          </div>
          <div>
            <span>3</span>
            <h3>Konaklamanız netleşsin</h3>
            <p>Seçiminiz ve acente onayı sonrasında rezervasyon kesinleşir.</p>
          </div>
        </div>
      </section>
      {request && (
        <RequestForm
          hotels={hotels}
          hotelId={hotelId}
          onClose={() => setRequest(false)}
        />
      )}
    </>
  );
}
export function Lookup({ catalog }: { catalog: Catalog }) {
  const [params] = useSearchParams(),
    { member } = useMember();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<Reservation | null>(null),
    [credentials, setCredentials] = useState({
      reference: (params.get("ref") || "").slice(0, 30),
      email: member?.email || "",
    }),
    [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (member)
      setCredentials((current) => ({
        ...current,
        email: current.email || member.email,
      }));
  }, [member]);
  async function lookup(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    setConfirm(false);
    try {
      setResult(await post<Reservation>("/reservations/lookup", credentials));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    setBusy(true);
    try {
      setResult(await post<Reservation>("/reservations/cancel", credentials));
      setConfirm(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container lookup-page">
      <span className="section-note">Yolculuğunuzun detayları</span>
      <h1>Rezervasyonunuz burada.</h1>
      <p className="muted">
        Ön rezervasyon referansınız ve e-posta adresinizle sorgulayın.
      </p>
      <form className="lookup-form" onSubmit={lookup}>
        <label className="field">
          Referans numarası
          <input
            value={credentials.reference}
            onChange={(e) =>
              setCredentials({ ...credentials, reference: e.target.value })
            }
            placeholder="RK-…"
            maxLength={30}
            required
          />
        </label>
        <label className="field">
          E-posta adresiniz
          <input
            type="email"
            value={credentials.email}
            onChange={(e) =>
              setCredentials({ ...credentials, email: e.target.value })
            }
            autoComplete="email"
            required
          />
        </label>
        <button className="btn" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <Search size={17} />
          )}
          Sorgula
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <>
          <ReservationTicket reservation={result} catalog={catalog} />
          {Boolean(result.cancellation_requested_at) &&
            result.status !== "cancelled" && (
              <p className="notice-success">
                İptal talebiniz acente değerlendirmesini bekliyor.
              </p>
            )}
          {["pending_agency", "confirmed"].includes(result.status) &&
            !result.cancellation_requested_at &&
            (confirm ? (
              <div className="cancel-confirm">
                <p>
                  {result.net_paid
                    ? "İptal talebiniz acenteye iletilecek. Ödenen tutarların iadesi acente tarafından ayrıca değerlendirilir; otomatik iade yapılmaz."
                    : "Ön rezervasyon iptal edilecek ve koltuklarınız serbest bırakılacak."}
                </p>
                <div className="button-row">
                  <button
                    className="btn btn-danger"
                    onClick={cancel}
                    disabled={busy}
                  >
                    İptali onayla
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() => setConfirm(false)}
                  >
                    Vazgeç
                  </button>
                </div>
              </div>
            ) : (
              <button className="text-link" onClick={() => setConfirm(true)}>
                İptal talebi oluşturmak istiyorum
              </button>
            ))}
        </>
      )}
    </div>
  );
}
export function About() {
  const [request, setRequest] = useState<"private-tour" | "vehicle" | null>(
    null,
  );
  return (
    <>
      <section className="container about-layout section">
        <div>
          <span className="section-note">Kars’ı tanıyanlarla yola çıkın.</span>
          <h1>
            Bu coğrafyanın
            <br />
            bir parçasıyız.
          </h1>
          <p className="lead-copy">
            Rota Kars Turizm olarak Kars merkezli turlar, özel grup programları
            ve turizm taşımacılığı hizmetleri sunuyoruz.
          </p>
          <p>
            Bir şehri tanımanın en güzel yolu, hikâyesini bilen insanlarla
            yürümek. Ani’den Çıldır’a, Sarıkamış’tan komşu rotalara uzanan
            programlarımızda bu yaklaşımı benimsiyoruz.
          </p>
          <p>
            Küçük gruplar için VIP midibüslerle ulaşımı, rehberli geziyi ve
            konaklama planlamasını bir arada ele alıyoruz.
          </p>
          <div className="button-row">
            <button className="btn" onClick={() => setRequest("private-tour")}>
              Özel tur planlayın
            </button>
            <button
              className="btn btn-outline"
              onClick={() => setRequest("vehicle")}
            >
              Araç kiralama talebi
            </button>
          </div>
        </div>
        <img src="/images/kars.webp" alt="Ani’de kış manzarası" />
      </section>
      <section className="about-note">
        <div className="container">
          <Compass size={35} strokeWidth={1} />
          <h2>
            İyi bildiğimiz yollar,
            <br />
            birlikte biriktireceğimiz anılar.
          </h2>
          <Link to="/turlar" className="text-link">
            Rotalarımızla tanışın <ArrowRight size={17} />
          </Link>
        </div>
      </section>
      {request && (
        <RequestForm kind={request} onClose={() => setRequest(null)} />
      )}
    </>
  );
}
export function Contact({ catalog }: { catalog: Catalog }) {
  const b = catalog.business;
  return (
    <div className="container contact-page section">
      <div>
        <span className="section-note">Bir telefon kadar yakınız.</span>
        <h1>
          Yolculuğu
          <br />
          birlikte konuşalım.
        </h1>
        <p>
          Tur, ulaşım ve konaklama planlarınız için
          <br />
          Kars’taki ekibimizle iletişime geçin.
        </p>
        <a href={telHref(b.mobile)} className="btn">
          <Phone size={17} />
          {b.mobile}
        </a>
      </div>
      <div className="contact-details">
        <a href={b.mapsUrl} target="_blank" rel="noreferrer">
          <MapPin />
          <div>
            <span>Ofisimiz</span>
            <strong>{b.address}</strong>
            <small>
              Google Haritalar’da yol tarifi <ExternalLink size={12} />
            </small>
          </div>
        </a>
        <a href={telHref(b.phone)}>
          <Phone />
          <div>
            <span>Sabit hat</span>
            <strong>{b.phone}</strong>
          </div>
        </a>
        <a href={"mailto:" + b.email}>
          <Mail />
          <div>
            <span>E-posta</span>
            <strong>{b.email}</strong>
          </div>
        </a>
        <a href={b.instagram} target="_blank" rel="noreferrer">
          <Instagram />
          <div>
            <span>Instagram</span>
            <strong>@rotakarstur</strong>
          </div>
        </a>
      </div>
    </div>
  );
}
export function Information({ catalog }: { catalog: Catalog }) {
  const demo = Boolean(catalog.demo),
    b = catalog.business;
  return (
    <article className="container legal-page section">
      <span className="section-note">
        {demo ? "Demo sürümü" : "Bilgilendirme"}
      </span>
      <h1>Kişisel Verilerin Korunması Aydınlatma Metni</h1>
      {demo && (
        <div className="info-note legal-review-note" role="note">
          <p>
            <strong>Bu metin hukuki danışman onayından geçirilmelidir.</strong>{" "}
            Demo sürümünde iletilen bilgiler yerel veritabanında saklanır;
            testlerde gerçek kimlik veya kart bilgisi kullanmayın.
          </p>
        </div>
      )}
      <nav className="legal-toc" aria-label="Sayfa içeriği">
        <a href="#kvkk">Veri sorumlusu</a>
        <a href="#veriler">İşlenen veriler</a>
        <a href="#amaclar">Amaçlar ve hukuki sebepler</a>
        <a href="#aktarim">Aktarım</a>
        <a href="#saklama">Saklama süreleri</a>
        <a href="#haklar">Haklarınız</a>
        <a href="#basvuru">Başvuru</a>
        <a href="#iptal">Tur iptali</a>
      </nav>
      <h2 id="kvkk">Veri sorumlusu</h2>
      <p>
        6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) uyarınca veri
        sorumlusu <strong>Rota Kars Turizm</strong>’dir.
      </p>
      <ul className="legal-list">
        <li>Adres: {b.address}</li>
        <li>
          Telefon: <a href={telHref(b.phone)}>{b.phone}</a>
        </li>
        <li>
          E-posta: <a href={"mailto:" + b.email}>{b.email}</a>
        </li>
        {b.tursabNo && <li>TÜRSAB belge no: {b.tursabNo}</li>}
      </ul>
      <h2 id="veriler">Hangi verileri işliyoruz</h2>
      <ul className="legal-list">
        <li>
          <strong>Kimlik ve iletişim:</strong> ad soyad, e-posta, telefon.
        </li>
        <li>
          <strong>Yolcu bilgileri:</strong> rezervasyondaki yolcu adları ve
          koltuk tercihleri.
        </li>
        <li>
          <strong>Rezervasyon ve ödeme kayıtları:</strong> tur, tarih, tutar,
          tahsilat ve iade kayıtları. Kart bilgisi alınmaz ve saklanmaz.
        </li>
        <li>
          <strong>Üyelik:</strong> hesap bilgileri, tek yönlü özetlenmiş
          parola, kuponlar ve davet kayıtları.
        </li>
        <li>
          <strong>Talepler:</strong> konaklama, araç kiralama ve özel tur
          formlarında ilettiğiniz bilgiler.
        </li>
        <li>
          <strong>Çerezler:</strong> yalnızca oturumunuzu sürdürmek için
          zorunlu oturum çerezleri kullanılır; reklam veya izleme çerezi
          kullanılmaz.
        </li>
        <li>
          <strong>Sohbet asistanı:</strong> asistana yazdığınız mesajlar
          yalnızca yanıt üretmek için kullanılır, sunucuda kaydedilmez.
        </li>
      </ul>
      <h2 id="amaclar">İşleme amaçları ve hukuki sebepler</h2>
      <ul className="legal-list">
        <li>
          <strong>Sözleşmenin kurulması ve ifası (md. 5/2-c):</strong> ön
          rezervasyonun alınması, tur ve konaklama hizmetinin sunulması, bilet
          ve yolcu listelerinin hazırlanması, üyelik hesabının yönetilmesi.
        </li>
        <li>
          <strong>Hukuki yükümlülük (md. 5/2-ç):</strong> fatura, muhasebe ve
          yolcu listesi gibi vergi ve turizm mevzuatından doğan kayıtlar.
        </li>
        <li>
          <strong>Meşru menfaat (md. 5/2-f):</strong> hizmet güvenliği,
          kötüye kullanımın önlenmesi ve yönetici işlemlerinin denetim kaydı.
        </li>
        <li>
          <strong>Açık rıza (md. 5/1):</strong> kampanya ve yeni rotalarla ilgili
          ticari elektronik ileti gönderimi ile yapay zekâ asistanı için yurt
          dışına aktarım. Açık rıza isteğe bağlıdır; vermemeniz hizmetten
          yararlanmanızı engellemez ve dilediğiniz zaman geri alabilirsiniz.
        </li>
      </ul>
      <h2 id="aktarim">Aktarım</h2>
      <ul className="legal-list">
        <li>
          <strong>Barındırma:</strong> site ve veritabanı Railway altyapısında
          barındırılır.
        </li>
        <li>
          <strong>Dosya depolama:</strong> görseller ve belgeler Railway dosya
          deposunda (bucket) saklanır.
        </li>
        <li>
          <strong>E-posta sağlayıcı:</strong> doğrulama, rezervasyon ve bildirim
          e-postalarının iletilmesi için.
        </li>
        <li>
          <strong>Yapay zekâ asistanı:</strong> yerel asistanın yanıtlayamadığı
          sorular yalnız onayınızla Anthropic’e (ABD) iletilir.
        </li>
        <li>
          <strong>Yetkili kamu kurum ve kuruluşları:</strong> mevzuatın
          gerektirdiği hâllerde ve ölçüde.
        </li>
      </ul>
      <h2 id="saklama">Saklama süreleri</h2>
      <ul className="legal-list">
        <li>Ödemesiz ön rezervasyonlar: 1 yıl</li>
        <li>Ödemeli rezervasyon ve tahsilat kayıtları: 10 yıl (VUK/TTK)</li>
        <li>Konaklama ve özel tur talepleri: 2 yıl</li>
        <li>Gönderilmiş bildirimler: 90 gün</li>
      </ul>
      <p>
        Süresi dolan kayıtlar silinir veya kimliğinizle ilişkisi kaldırılarak
        anonimleştirilir.
      </p>
      <h2 id="haklar">Haklarınız (md. 11)</h2>
      <ul className="legal-list">
        <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme,</li>
        <li>İşlenmişse buna ilişkin bilgi talep etme,</li>
        <li>
          İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,
        </li>
        <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme,</li>
        <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme,</li>
        <li>
          KVKK md. 7 çerçevesinde silinmesini veya yok edilmesini isteme,
        </li>
        <li>
          Düzeltme ve silme işlemlerinin aktarıldığı üçüncü kişilere
          bildirilmesini isteme,
        </li>
        <li>
          Münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir
          sonuç çıkmasına itiraz etme,
        </li>
        <li>
          Kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın
          giderilmesini talep etme.
        </li>
      </ul>
      <h2 id="basvuru">Başvuru</h2>
      <p>
        Haklarınızla ilgili başvurularınızı{" "}
        <a href={"mailto:" + b.email}>{b.email}</a> adresine iletebilirsiniz.
        Başvurular en geç 30 gün içinde ücretsiz yanıtlanır. Üyelerimiz{" "}
        <Link to="/hesabim">Hesabım</Link> sayfasından verilerinin bir kopyasını
        indirebilir veya hesaplarını silebilir.
      </p>
      <h2 id="iptal">Tur iptali</h2>
      <p>
        Yurt dışı paket turlarımızda son 5 güne, yurt içi paketlerimizde son 3
        güne kadar hiçbir koşul aranmadan turunuzu iptal edebilirsiniz. Yurt içi
        paketlerde iptal güvence paketi ile 72 saate kadar koşulsuz iptal hakkı
        bulunur (uçaklı paketlerde geçerli değildir). Ödediğiniz ücreti
        kesintisiz geri alırsınız.
      </p>
      <h2 id="asistan">Yapay zekâ asistanı</h2>
      <p>
        Sağ alttaki asistana yazdığınız mesajlar yalnızca yanıt üretmek için
        kullanılır ve sunucuda saklanmaz. Sorularınız önce sitemizdeki yerel
        asistanla yanıtlanır. Yerel asistanın yanıtlayamadığı bir soru, yalnız
        sohbet penceresinde açıkça onay vermeniz hâlinde Anthropic (ABD)
        tarafından sunulan Claude yapay zekâ hizmetine iletilir. Onayınızı
        sohbet penceresindeki “Onayı geri al” bağlantısıyla dilediğiniz zaman
        geri alabilirsiniz. Kişisel veya ödeme bilgisi paylaşmayın; rezervasyon
        için WhatsApp hattımıza yönlendirilirsiniz.
      </p>
      <h2>Ön rezervasyon</h2>
      <p>
        Tur tarihi, koltuklar ve yolcu bilgileriyle oluşturulan kayıt acente
        onayı bekleyen bir taleptir. Kesin bilet veya ödeme belgesi değildir.
        Online ödeme aktif değildir ve kart bilgisi alınmaz. Onay bekleyen
        koltuklar 24 saat sonra serbest kalır.
      </p>
      <h2 id="uyelik">Üyelik ve kampanyalar</h2>
      <p>
        Üyelik ücretsizdir. Ad, e-posta ve parola ile oluşturulan hesaplarda
        parola tek yönlü güvenli özet olarak saklanır. Oturum için zorunlu bir
        çerez kullanılır. E-posta doğrulama ve parola yenileme bağlantıları
        gönderim hizmeti tanımlandığında e-postayla iletilir. Sosyal girişler
        yalnız firma tarafından yapılandırılan sağlayıcılarla açılır. Kampanya
        e-postası ve SMS’i yalnız isteğe bağlı onay kutusunu işaretlediyseniz
        gönderilir.
      </p>
      <p>
        Şans çarkı hesap başına bir kez çevrilebilir. %5, %10 veya %15 sonuçları
        yönetici tarafından belirlenen altı eşit olasılıklı dilimden sunucuda
        seçilir. Kuponlar üzerlerinde belirtilen son tarihe kadar geçerlidir,
        tek kullanımlıdır ve devredilemez. Aynı rezervasyonda yalnız bir kupon
        uygulanır. Konaklama ve ekstra hizmetler kapsam dışındadır.
      </p>
      <p>
        Davet koduyla üye olan arkadaş turunu tamamladığında veya kampanya
        ayarına göre tam ödemesi kaydedildiğinde, davet eden ve davet edilen
        hesabın her birine sonraki rezervasyonda kullanılmak üzere birer %10
        kupon tanımlanır. Aynı arkadaş için ödül yalnız bir kez verilir. Kişi
        kendi hesabını davet edemez. Ön rezervasyon iptal edilirse kullanılan ve
        süresi geçmemiş kupon yeniden kullanılabilir; davet ödülü tekrarlanmaz.
        Kampanya indirimleri tahsilat veya kesin bilet oluşturmaz; güncel tur
        kapsamı acente tarafından teyit edilir.
      </p>
      <h2>Google yorumları</h2>
      <p>
        Google bağlantısı etkinleştirildiğinde yorumlar kaynak ve yazar
        bilgileriyle gösterilir. Rota sayfaları ilgili turdan bahseden veya
        yönetici tarafından o turla eşleştirilen yorumları içerir. İşletme
        puanı, tur puanı olarak sunulmaz.
      </p>
      <h2>Konaklama</h2>
      <p>
        Konaklama talepleri güncel müsaitlik ve fiyat teyidine tabidir. Talep
        oluşturmak otelde kesin rezervasyon yapıldığı anlamına gelmez. Otel
        listesi yalnızca acentenin doğruladığı anlaşmalı tesislerle doldurulur.
      </p>
    </article>
  );
}
