import { useEffect, useState, type FormEvent } from "react";
import { responsive } from "../lib/images";
import { useSearchParams } from "react-router-dom";
import { Link, useLang } from "../lib/i18n";
import { useMember } from "../lib/member";
import {
  ArrowRight,
  MapPin,
  Phone,
  Mail,
  Instagram,
  ExternalLink,
  Check,
  Search,
  LoaderCircle,
} from "lucide-react";
import { RequestForm } from "../components/RequestForm";
import { ReservationTicket } from "../components/ReservationTicket";
import { PayDeposit } from "./Payment";
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
        <img
          {...responsive("/images/tours/sarikamis.webp", "100vw")}
          alt="Sarıkamış’ta karlı çam ormanı ve Allahuekber Dağları"
          decoding="async"
        />
        <div className="container">
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
        <small>Sarıkamış · Allahuekber Dağları</small>
      </section>
      <section className="container section">
        <div className="section-heading">
          <div>
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
          error && (
            <p className="muted">
              Otel listesine şu anda erişilemiyor. Talep bırakarak
              seçeneklerinizi sorabilirsiniz.
            </p>
          )
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
    { member } = useMember(),
    { t } = useLang();
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
      <h1>{t("Rezervasyonunuz burada.")}</h1>
      <p className="muted">
        {t("Ön rezervasyon referansınız ve e-posta adresinizle sorgulayın.")}
      </p>
      <form className="lookup-form" onSubmit={lookup}>
        <label className="field">
          {t("Referans numarası")}
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
          {t("E-posta adresiniz")}
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
          {t("Sorgula")}
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <>
          <PayDeposit
            catalog={catalog}
            reservation={result}
            email={credentials.email}
          />
          <ReservationTicket reservation={result} catalog={catalog} />
          <ReservationDocuments reservation={result} />
          {Boolean(result.cancellation_requested_at) &&
            result.status !== "cancelled" && (
              <p className="notice-success">
                {t("İptal talebiniz acente değerlendirmesini bekliyor.")}
              </p>
            )}
          {["pending_agency", "confirmed"].includes(result.status) &&
            !result.cancellation_requested_at &&
            (confirm ? (
              <div className="cancel-confirm">
                <p>
                  {result.net_paid
                    ? t(
                        "İptal talebiniz acenteye iletilecek. Ödenen tutarların iadesi acente tarafından ayrıca değerlendirilir; otomatik iade yapılmaz.",
                      )
                    : t(
                        "Ön rezervasyon iptal edilecek ve koltuklarınız serbest bırakılacak.",
                      )}
                </p>
                <div className="button-row">
                  <button
                    className="btn btn-danger"
                    onClick={cancel}
                    disabled={busy}
                  >
                    {t("İptali onayla")}
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() => setConfirm(false)}
                  >
                    {t("Vazgeç")}
                  </button>
                </div>
              </div>
            ) : (
              <button className="text-link" onClick={() => setConfirm(true)}>
                {t("İptal talebi oluşturmak istiyorum")}
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
  const { t } = useLang();
  return (
    <>
      <section className="container about-layout section">
        <div>
          <h1>
            {t("Bu coğrafyanın")}
            <br />
            {t("bir parçasıyız.")}
          </h1>
          <p className="lead-copy">
            {t(
              "Rota Kars Turizm olarak Kars merkezli turlar, özel grup programları ve turizm taşımacılığı hizmetleri sunuyoruz.",
            )}
          </p>
          <p>
            {t(
              "Bir şehri tanımanın en güzel yolu, hikâyesini bilen insanlarla yürümek. Ani’den Çıldır’a, Sarıkamış’tan komşu rotalara uzanan programlarımızda bu yaklaşımı benimsiyoruz.",
            )}
          </p>
          <p>
            {t(
              "Küçük gruplar için VIP midibüslerle ulaşımı, rehberli geziyi ve konaklama planlamasını bir arada ele alıyoruz.",
            )}
          </p>
          <div className="button-row">
            <button className="btn" onClick={() => setRequest("private-tour")}>
              {t("Özel tur planlayın")}
            </button>
            <button
              className="btn btn-outline"
              onClick={() => setRequest("vehicle")}
            >
              {t("Araç kiralama talebi")}
            </button>
          </div>
        </div>
        <img
          src="/images/kars.webp"
          alt={t("Ani’de kış manzarası")}
          loading="lazy"
          decoding="async"
        />
      </section>
      <section className="about-note">
        <div className="container">
          <h2>
            {t("İyi bildiğimiz yollar,")}
            <br />
            {t("birlikte biriktireceğimiz anılar.")}
          </h2>
          <Link to="/turlar" className="text-link">
            {t("Rotalarımızla tanışın")} <ArrowRight size={17} />
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
  const { t } = useLang();
  return (
    <div className="container contact-page section">
      <div>
        <h1>
          {t("Yolculuğu")}
          <br />
          {t("birlikte konuşalım.")}
        </h1>
        <p>
          {t("Tur, ulaşım ve konaklama planlarınız için")}
          <br />
          {t("Kars’taki ekibimizle iletişime geçin.")}
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
            <span>{t("Ofisimiz")}</span>
            <strong>{b.address}</strong>
            <small>
              {t("Google Haritalar’da yol tarifi")} <ExternalLink size={12} />
            </small>
          </div>
        </a>
        <a href={telHref(b.phone)}>
          <Phone />
          <div>
            <span>{t("Sabit hat")}</span>
            <strong>{b.phone}</strong>
          </div>
        </a>
        <a href={"mailto:" + b.email}>
          <Mail />
          <div>
            <span>{t("E-posta")}</span>
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
      <section className="legal-imprint" id="kunye" aria-labelledby="kunye-title">
        <h2 id="kunye-title">{t("Yasal bilgiler")}</h2>
        <dl>
          {legalRows(b, t).map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
// Rezervasyona kaydedilen, müşterinin onayladığı belgeler (bağlayıcı metin Türkçe).
function ReservationDocuments({ reservation }: { reservation: Reservation }) {
  const { t } = useLang();
  const docs = [
    [t("Tur Hizmet Sözleşmesi"), reservation.contract_text],
    [t("Ön Bilgilendirme Formu"), reservation.pre_info_text],
  ].filter((d): d is [string, string] => Boolean(d[1]));
  if (!docs.length) return null;
  return (
    <section className="reservation-documents" aria-label={t("Belgeleriniz")}>
      <h2>{t("Belgeleriniz")}</h2>
      {docs.map(([title, text]) => (
        <details key={title}>
          <summary>{title}</summary>
          <div className="pre-info-text" tabIndex={0} lang="tr">
            {text}
          </div>
        </details>
      ))}
    </section>
  );
}
// Künye: 6563 sayılı Kanun md. 3 kapsamında hizmet sağlayıcı bilgileri.
function legalRows(b: Catalog["business"], t: (s: string, v?: Record<string, string | number>) => string) {
  return [
    [t("Ticaret unvanı"), b.legalName],
    [t("Acenta unvanı"), b.name],
    [
      t("Seyahat acentası belgesi"),
      t("T.C. Kültür ve Turizm Bakanlığı, {group} Grubu, Belge No {no}", {
        group: b.licenseGroup,
        no: b.tursabNo,
      }),
    ],
    [t("Meslek birliği"), t("TÜRSAB (Türkiye Seyahat Acentaları Birliği) üyesi")],
    [t("Merkez adresi"), b.address],
    [t("MERSİS no"), b.mersis],
    [t("Ticaret sicili"), `${b.tradeRegistry} · ${t("Sicil No")} ${b.tradeRegistryNo}`],
    [t("Meslek odası"), `${b.chamber} · ${t("Oda Sicil No")} ${b.chamberNo}`],
    [t("Vergi dairesi / no"), `${t("{office} Vergi Dairesi", { office: b.taxOffice })} · ${b.taxNo}`],
    [t("Telefon"), `${b.phone} · ${b.mobile}`],
    [t("E-posta"), b.email],
    ["KEP", b.kep],
  ] as const;
}
// Yasal bilgilendirme. Kaynak taslaklar docs/yasal/; ön bilgilendirme formu ve
// sözleşmenin kişiye özel hâli server/legal.mjs'te üretilir. Bağlayıcı metin Türkçedir.
// Eski bağlantılar (#kvkk, #iptal, #haklar, #uyelik, #asistan) korunur.
const LEGAL_UPDATED = "11 Kasım 2026";
export function Information({ catalog }: { catalog: Catalog }) {
  const demo = Boolean(catalog.demo),
    b = catalog.business,
    { lang } = useLang();
  return (
    <article className="container legal-page section">
      <h1>Yasal bilgilendirme</h1>
      <p className="legal-updated">
        Son güncelleme: {LEGAL_UPDATED} · {b.legalName}
      </p>
      {lang === "en" && <LegalSummaryEn />}
      {demo && (
        <div className="info-note legal-review-note" role="note">
          <p>
            <strong>Demo sürümü.</strong> İletilen bilgiler yerel veritabanında
            saklanır; testlerde gerçek kimlik veya kart bilgisi kullanmayın.
          </p>
        </div>
      )}
      <nav className="legal-toc" aria-label="Sayfa içeriği">
        <a href="#kvkk">Aydınlatma metni</a>
        <a href="#cerez">Çerez politikası</a>
        <a href="#iptal">İptal ve iade koşulları</a>
        <a href="#sozlesme">Ön bilgilendirme ve sözleşme</a>
        <a href="#acik-riza">Açık rıza ve izinler</a>
        <a href="#asistan">Yapay zekâ asistanı</a>
        <a href="#uyelik">Üyelik ve kampanyalar</a>
      </nav>

      <section className="legal-part" aria-labelledby="kvkk">
        <h2 id="kvkk">Kişisel Verilerin Korunması Aydınlatma Metni</h2>
        <h3>1. Veri sorumlusu</h3>
        <p>
          6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) uyarınca
          kişisel verileriniz, veri sorumlusu sıfatıyla{" "}
          <strong>{b.legalName}</strong> (“Rota Kars Turizm”) tarafından
          aşağıda açıklanan şekilde işlenir.
        </p>
        <ul className="legal-list">
          <li>Adres: {b.address}</li>
          <li>MERSİS: {b.mersis}</li>
          <li>
            E-posta: <a href={"mailto:" + b.email}>{b.email}</a> · KEP: {b.kep}
          </li>
          <li>
            Telefon: <a href={telHref(b.phone)}>{b.phone}</a>
          </li>
        </ul>

        <h3 id="veriler">2. Hangi kişisel verileri işliyoruz</h3>
        <ul className="legal-list">
          <li>
            <strong>Kimlik:</strong> ad soyad; yolcuların adı soyadı, uyruğu,
            cinsiyeti, T.C. kimlik numarası (T.C. vatandaşları) veya pasaport
            numarası (yabancılar).
          </li>
          <li>
            <strong>İletişim:</strong> e-posta, telefon.
          </li>
          <li>
            <strong>Müşteri işlem:</strong> tur, tarih, koltuk, tutar, kapora,
            tahsilat ve iade kayıtları; online ödemede bankanın ilettiği işlem
            sonucu ve maskeli kart numarası (ilk 6 ve son 4 hane); rezervasyon
            notları, iptal talepleri, bilet ve biniş kayıtları; onayladığınız ön
            bilgilendirme formu ve sözleşmenin metni.
          </li>
          <li>
            <strong>Talep:</strong> konaklama, araç kiralama ve özel tur
            formlarına yazdıklarınız.
          </li>
          <li>
            <strong>Üyelik:</strong> hesap bilgileri, güvenli özetlenmiş parola,
            kupon ve davet kayıtları; Google, Facebook veya Apple ile girişte
            sağlayıcının ilettiği ad, e-posta ve hesap kimliği; “Yol
            arkadaşlarım” bölümüne kaydettiğiniz en çok 10 kişinin adı, uyruğu,
            cinsiyeti ve kimlik / pasaport numarası.
          </li>
          <li>
            <strong>İşlem güvenliği:</strong> IP adresi, tarayıcı bilgisi, oturum
            kayıtları, bot doğrulama sonucu, onay kayıtlarının zamanı ve sürümü.
          </li>
          <li>
            <strong>Pazarlama:</strong> ticari elektronik ileti izniniz ve izin
            tarihi (isteğe bağlı).
          </li>
        </ul>
        <p>
          <strong>Kart bilgileri:</strong> Kartla ödemede kart bilgileriniz
          sitemizdeki güvenli ödeme formunda girilir, şifreli bağlantıyla
          Vakıfbank sanal POS’una iletilir ve 3D Secure doğrulaması süresince (en
          fazla 15 dakika) yalnız sunucu belleğinde şifreli tutulur. Kart
          numarası, son kullanma tarihi ve güvenlik kodu veritabanımıza yazılmaz
          ve saklanmaz.
        </p>
        <p>
          T.C. kimlik ve pasaport numaraları veritabanımızda şifrelenmiş olarak
          tutulur; size gönderilen bilet ve belgelerde yalnız son 3 hanesi
          görünür.
        </p>
        <p>
          <strong>Başkası adına bilgi verirseniz:</strong> Rezervasyonda diğer
          yolcuların veya “Yol arkadaşlarım” bölümünde aile ve arkadaşlarınızın
          bilgilerini girdiğinizde bu kişileri bilgilendirdiğinizi ve
          bilgilerini paylaşmaya yetkili olduğunuzu beyan edersiniz. Bu metni
          onlarla paylaşmanızı rica ederiz. 18 yaşından küçük yolcuların
          bilgileri veli veya vasileri tarafından girilmelidir. Özel nitelikli
          kişisel veri (sağlık, din vb.) talep etmiyoruz.
        </p>

        <h3 id="yontem">3. Toplama yöntemi</h3>
        <p>
          Verileriniz; sitemizdeki rezervasyon, üyelik, talep ve iletişim
          formları, telefon, WhatsApp ve e-posta görüşmeleri, ofisimizde ve tur
          sırasında yapılan işlemler aracılığıyla, kısmen otomatik (site
          formları ve güvenlik kayıtları) ve otomatik olmayan (telefon, ofis)
          yollarla toplanır.
        </p>

        <h3 id="amaclar">4. Amaçlar ve hukuki sebepler</h3>
        <ul className="legal-list">
          <li>
            <strong>Sözleşmenin kurulması ve ifası (md. 5/2-c):</strong> ön
            rezervasyonun alınması ve onaylanması; turun, konaklamanın ve
            transferin sunulması; bilet, yolcu ve koltuk listelerinin
            hazırlanması; online kapora ödemesinin alınması, ödemenin
            rezervasyonla eşleştirilmesi ve iadeler; üyelik hesabının ve yol
            arkadaşı kayıtlarının yönetimi.
          </li>
          <li>
            <strong>Hukuki yükümlülük (md. 5/2-ç) ve kanunlarda açıkça
            öngörülme (md. 5/2-a):</strong> fatura ve muhasebe kayıtları;
            turizm taşımacılığında yolcu listesinin (ad soyad, uyruk, T.C.
            kimlik / pasaport no, cinsiyet) Ulaştırma Elektronik Takip ve
            Denetim Sistemi’ne (U-ETDS) bildirilmesi; yetkili kurumların
            talepleri.
          </li>
          <li>
            <strong>Bir hakkın tesisi, kullanılması veya korunması (md.
            5/2-e):</strong> uyuşmazlıklarda onay ve sözleşme kayıtlarının
            delil olarak saklanması.
          </li>
          <li>
            <strong>Meşru menfaat (md. 5/2-f):</strong> site güvenliği, kötüye
            kullanımın ve sahte kayıtların önlenmesi, yönetici işlemlerinin
            denetim kaydı, müşteri şikâyetlerinin takibi.
          </li>
          <li>
            <strong>Açık rıza (md. 5/1):</strong> kampanya ve yeni rotalar
            hakkında e-posta ve SMS gönderimi (6563 sayılı Kanun kapsamında
            ticari elektronik ileti onayı) ve yapay zekâ asistanı için yurt
            dışına aktarım. Açık rıza isteğe bağlıdır; vermemeniz hizmetten
            yararlanmanızı engellemez ve dilediğiniz zaman geri alabilirsiniz.
          </li>
        </ul>

        <h3 id="aktarim">5. Kimlere aktarıyoruz</h3>
        <p>
          <strong>Yurt içinde:</strong>
        </p>
        <ul className="legal-list">
          <li>
            Ulaştırma ve Altyapı Bakanlığı (U-ETDS): her sefer öncesinde yolcu
            listesi; aynı bildirimde şoför ve rehberin bilgileri de yer alır.
          </li>
          <li>
            Türkiye Vakıflar Bankası T.A.O. (sanal POS): online ödemenin
            alınması ve iadesi için kart bilgileri, tutar ve rezervasyon
            numarası. Kartınızı veren banka 3D Secure doğrulamasını kendisi
            yapar.
          </li>
          <li>
            Diğer yetkili kamu kurum ve kuruluşları (vergi idaresi, Kültür ve
            Turizm Bakanlığı, emniyet, yargı mercileri): mevzuatın gerektirdiği
            hâllerde ve ölçüde.
          </li>
          <li>
            Konaklamalı turlarda otel ve tesisler: yalnız konaklama için gereken
            ad ve tarih bilgisi.
          </li>
          <li>
            Sigorta şirketi: zorunlu koltuk ferdi kaza sigortası kapsamında,
            gerektiğinde.
          </li>
          <li>Muhasebe ve hukuk danışmanlarımız: sır saklama yükümlülüğü altında.</li>
        </ul>
        <p>
          <strong>Yurt dışındaki hizmet sağlayıcılar:</strong> Aşağıdaki
          sağlayıcıların sunucuları yurt dışında bulunabilir; aktarımlar KVKK
          md. 9 kapsamında yapılır.
        </p>
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead>
              <tr>
                <th scope="col">Sağlayıcı</th>
                <th scope="col">Ne için</th>
                <th scope="col">Ülke</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Railway</td>
                <td>Sitenin, veritabanının ve dosyaların barındırılması</td>
                <td>ABD merkezli</td>
              </tr>
              <tr>
                <td>Cloudflare</td>
                <td>Formlarda bot doğrulaması (Turnstile)</td>
                <td>ABD / küresel</td>
              </tr>
              <tr>
                <td>Google</td>
                <td>
                  Harita (yalnız “Haritayı göster”e bastığınızda), Google ile
                  giriş, ekip telefonlarına anlık bildirim (Firebase)
                </td>
                <td>ABD</td>
              </tr>
              <tr>
                <td>Meta</td>
                <td>
                  Instagram gönderisi (yalnız bir gönderiyi açtığınızda),
                  Facebook ile giriş
                </td>
                <td>ABD</td>
              </tr>
              <tr>
                <td>Apple</td>
                <td>Apple ile giriş</td>
                <td>ABD</td>
              </tr>
              <tr>
                <td>E-posta sağlayıcısı</td>
                <td>Rezervasyon, doğrulama ve bildirim e-postaları</td>
                <td>Sağlayıcıya göre</td>
              </tr>
              <tr>
                <td>Anthropic</td>
                <td>
                  Yalnız sohbet penceresinde açık rıza verirseniz, yerel
                  asistanın yanıtlayamadığı soru metni
                </td>
                <td>ABD</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 id="saklama">6. Saklama süreleri</h3>
        <ul className="legal-list">
          <li>
            T.C. kimlik / pasaport numaraları: tur tarihinden 1 yıl sonra
            otomatik silinir.
          </li>
          <li>Ödemesiz ön rezervasyonlar: 1 yıl.</li>
          <li>
            Ödemeli rezervasyon, tahsilat, fatura kayıtları ve onaylanan
            sözleşmeler: 10 yıl (Vergi Usul Kanunu, Türk Ticaret Kanunu).
          </li>
          <li>Konaklama ve özel tur talepleri: 2 yıl.</li>
          <li>Gönderilmiş bildirimler: 90 gün.</li>
          <li>Güvenlik ve denetim kayıtları: 2 yıl.</li>
          <li>
            Üyelik hesabı ve yol arkadaşı kayıtları: siz silene veya hesabınız
            silinene kadar (yasal saklama gerektiren kayıtlar hariç).
          </li>
          <li>
            Ticari elektronik ileti onayı ve ret kayıtları: onayın sona
            ermesinden itibaren 3 yıl.
          </li>
        </ul>
        <p>
          Süresi dolan kayıtlar silinir, yok edilir veya kimliğinizle ilişkisi
          kaldırılarak anonim hâle getirilir.
        </p>

        <h3 id="haklar">7. Haklarınız (KVKK md. 11)</h3>
        <p>
          Kişisel verilerinizin işlenip işlenmediğini öğrenme; işlenmişse bilgi
          talep etme; işlenme amacını ve amacına uygun kullanılıp
          kullanılmadığını öğrenme; yurt içinde veya yurt dışında aktarıldığı
          üçüncü kişileri bilme; eksik veya yanlış işlenmişse düzeltilmesini
          isteme; md. 7 çerçevesinde silinmesini veya yok edilmesini isteme;
          düzeltme ve silme işlemlerinin aktarıldığı üçüncü kişilere
          bildirilmesini isteme; münhasıran otomatik sistemlerle analiz
          edilmesi sonucu aleyhinize bir sonucun ortaya çıkmasına itiraz etme;
          kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın
          giderilmesini talep etme haklarına sahipsiniz.
        </p>

        <h3 id="basvuru">8. Başvuru</h3>
        <p>Başvurunuzu kimliğinizi gösteren bilgilerle birlikte</p>
        <ul className="legal-list">
          <li>yazılı olarak yukarıdaki adresimize,</li>
          <li>KEP adresimize ({b.kep}),</li>
          <li>
            güvenli elektronik veya mobil imzalı olarak ya da daha önce bize
            bildirdiğiniz ve sistemimizde kayıtlı e-posta adresinizden{" "}
            <a href={"mailto:" + b.email}>{b.email}</a> adresine
          </li>
        </ul>
        <p>
          iletebilirsiniz. Başvurular en geç 30 gün içinde ücretsiz
          sonuçlandırılır; işlemin ayrıca bir maliyet gerektirmesi hâlinde
          Kurul’un belirlediği tarife uygulanabilir. Üyelerimiz{" "}
          <Link to="/hesabim">Hesabım</Link> sayfasından verilerinin bir
          kopyasını indirebilir veya hesaplarını silebilir.
        </p>
      </section>

      <section className="legal-part" aria-labelledby="cerez">
        <h2 id="cerez">Çerez Politikası</h2>
        <p>
          Çerezler, ziyaret ettiğiniz sitenin tarayıcınıza kaydettiği küçük
          metin dosyalarıdır. Benzer şekilde çalışan tarayıcı depolama
          alanlarını (localStorage, sessionStorage) da bu politikada çerez gibi
          ele alıyoruz.
        </p>
        <p>
          Sitemiz <strong>yalnız zorunlu çerez ve depolama</strong> kullanır.
          Reklam, profilleme veya ziyaretçi istatistiği (analitik) çerezi
          kullanmayız. Zorunlu çerezler sitenin çalışması için gerekli olduğundan
          onayınız aranmadan kullanılır; tarayıcınızdan engellerseniz giriş ve
          rezervasyon gibi işlevler çalışmayabilir.
        </p>
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead>
              <tr>
                <th scope="col">Ad</th>
                <th scope="col">Tür</th>
                <th scope="col">Amaç</th>
                <th scope="col">Süre</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>rota_member</td>
                <td>Çerez, birinci taraf</td>
                <td>Üye oturumunu sürdürmek</td>
                <td>7 gün</td>
              </tr>
              <tr>
                <td>rota_oauth</td>
                <td>Çerez, birinci taraf</td>
                <td>Google, Facebook veya Apple ile girişte güvenlik doğrulaması</td>
                <td>10 dakika</td>
              </tr>
              <tr>
                <td>rota_admin</td>
                <td>Çerez, birinci taraf</td>
                <td>Yalnız acente personelinin yönetim paneli oturumu</td>
                <td>8 saat (cihazı hatırla seçilirse daha uzun)</td>
              </tr>
              <tr>
                <td>rota-membership-invite-v1</td>
                <td>localStorage</td>
                <td>Üyelik davetini bir kez gösterdikten sonra tekrar göstermemek</td>
                <td>Siz silene kadar</td>
              </tr>
              <tr>
                <td>rota-chat-abroad-consent</td>
                <td>localStorage</td>
                <td>Sohbet asistanı için verdiğiniz yurt dışı aktarım onayını hatırlamak</td>
                <td>Onayı geri alana kadar</td>
              </tr>
              <tr>
                <td>Sohbet geçmişi</td>
                <td>sessionStorage</td>
                <td>Sohbet penceresindeki son mesajları sayfa değişince korumak</td>
                <td>Sekme kapanınca silinir</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          <strong>Üçüncü taraf içerikler:</strong> Formlarda bot doğrulaması
          için Cloudflare Turnstile çalışır ve cihaz ile tarayıcı sinyallerini
          Cloudflare’e gönderir. Google Haritalar yalnız “Haritayı göster”e
          bastığınızda, Instagram oynatıcısı yalnız bir gönderiyi açtığınızda
          yüklenir; bu sağlayıcılar kendi çerezlerini kullanabilir ve kendi
          politikalarına tabidir.
        </p>
        <p>
          Çerezleri ve site verilerini tarayıcınızın ayarlarından silebilir veya
          engelleyebilirsiniz.
        </p>
      </section>

      <section className="legal-part" aria-labelledby="iptal">
        <h2 id="iptal">İptal ve İade Koşulları</h2>
        <p>{catalog.cancellationPolicy}</p>
        <h3>Ödeme yapılmamış ön rezervasyonlar</h3>
        <p>
          Henüz ödeme kaydedilmemiş ön rezervasyonunuzu istediğiniz zaman
          ücretsiz iptal edebilirsiniz (<Link to="/rezervasyonum">Rezervasyonum</Link>{" "}
          sayfasından ya da bizi arayarak). 24 saat içinde ödeme yapılmayan ön
          rezervasyonlar kendiliğinden düşer.
        </p>
        <h3>Onaylanmış rezervasyonlarda sizin iptaliniz</h3>
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead>
              <tr>
                <th scope="col">Tur</th>
                <th scope="col">Kesintisiz iptal</th>
                <th scope="col">Bu süreden sonra</th>
                <th scope="col">Gelmeme</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Yurt içi turlar (Ani–Çıldır, Sarıkamış, Van ve diğerleri)</td>
                <td>
                  Hareketten 3 gün (72 saat) öncesine kadar: kapora dahil
                  ödediğiniz tutarın tamamı iade edilir.
                </td>
                <td>
                  Kapora (toplam bedelin %30’u) iade edilmez; kaporayı aşan
                  ödemeniz iade edilir.
                </td>
                <td>Ödediğiniz tutar iade edilmez.</td>
              </tr>
              <tr>
                <td>Yurt dışı turlar (Batum)</td>
                <td>
                  Hareketten 5 gün (120 saat) öncesine kadar: tamamı iade
                  edilir.
                </td>
                <td>
                  Kapora (toplam bedelin %30’u) iade edilmez; kaporayı aşan
                  ödemeniz iade edilir.
                </td>
                <td>Ödediğiniz tutar iade edilmez.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul className="legal-list">
          <li>
            Süre, iptal talebinizin bize ulaştığı an ile turun hareket saati
            arasında hesaplanır.
          </li>
          <li>
            <strong>Son dakika rezervasyonu:</strong> kesintisiz iptal süresi
            içinde kalan bir tur için online ödeme yaparsanız rezervasyonunuz
            ödemeyle onaylanır ve iptalde kapora iade edilmez. Bu durum ödeme
            öncesinde rezervasyon ekranında ayrıca gösterilir.
          </li>
          <li>
            Haber vermeden tura katılmamak, buluşma saatinde hazır bulunmamak
            veya yurt dışı turda geçerli giriş belgesi olmaması nedeniyle tura
            katılamamak gelmeme sayılır.
          </li>
          <li>
            Yolcu adı değişikliği kalkıştan önce bildirilirse ücretsizdir.
          </li>
        </ul>
        <h3>Online ödemede</h3>
        <ul className="legal-list">
          <li>
            Kaporayı veya tamamını kartla öderseniz rezervasyonunuz ödemeyle
            birlikte otomatik onaylanır ve yukarıdaki kurallar uygulanır.
          </li>
          <li>
            Otomatik onaydan sonra turu yapamazsak (ör. araç arızası, sistem
            hatası) ödediğiniz tutarın tamamı kesintisiz iade edilir veya
            dilerseniz başka bir tarihe geçersiniz.
          </li>
          <li>
            Ödeme tamamlanmaz veya başarısız olursa rezervasyon onaylanmaz;
            koltuklar tutma süresi sonunda serbest kalır. Kartınızdan çekim
            yapılmış ama rezervasyon onaylanmamışsa tutar aynı karta iade
            edilir.
          </li>
        </ul>
        <h3>Bizim iptalimiz</h3>
        <p>
          Asgari katılımcı sayısına ulaşılamaz, hava, yol veya sınır koşulları
          turu güvenle yapmamıza izin vermez ya da resmî bir karar turu
          engellerse sizi hemen ararız. Başka bir tarihe geçebilir ya da
          ödediğiniz tutarın tamamını kesintisiz geri alabilirsiniz.
        </p>
        <h3>İade nasıl yapılır</h3>
        <p>
          İadeler, iptal kesinleştikten sonra en geç 14 gün içinde yapılır:
          kartla online ödediyseniz aynı karta, havale ile ödediyseniz
          bildirdiğiniz IBAN’a, nakit ödediyseniz ofisimizde ya da IBAN’ınıza.
          Karta iadenin hesabınıza yansıma süresi bankanıza bağlıdır. Kesintisiz
          iade hâllerinde hiçbir kesinti yapılmaz.
        </p>
      </section>

      <section className="legal-part" aria-labelledby="sozlesme">
        <h2 id="sozlesme">Ön Bilgilendirme Formu ve Tur Hizmet Sözleşmesi</h2>
        <p>
          Rezervasyonun son adımında, seçtiğiniz tura, tarihe, yolculara ve
          ödeme planına göre doldurulmuş <strong>Ön Bilgilendirme Formu</strong>{" "}
          gösterilir. Formu onaylamadan ön rezervasyon gönderilemez. Onayladığınız
          metin, onay zamanı ve sürümüyle rezervasyonunuza kaydedilir ve
          e-postanıza gönderilir. Rezervasyon onaylandığında{" "}
          <strong>Tur Hizmet Sözleşmesi</strong> kurulur ve onay e-postasıyla
          birlikte size iletilir. Temel hükümler:
        </p>
        <ul className="legal-list">
          <li>
            <strong>Taraflar:</strong> {b.legalName} (A Grubu Seyahat Acentası,
            belge no {b.tursabNo}, MERSİS {b.mersis}) ile rezervasyonu yapan
            müşteri.
          </li>
          <li>
            <strong>Sözleşmenin kurulması:</strong> siteden gönderilen kayıt,
            ödeme yapılana kadar bir ön rezervasyon talebidir; koltuklar 24
            saat tutulur. Online ödemede ödeme başarıyla tamamlandığı anda,
            havale/EFT veya nakit ödemede acentenin onayı e-postayla
            bildirildiği anda sözleşme kurulur.
          </li>
          <li>
            <strong>Fiyat ve ödeme:</strong> fiyatlar Türk lirası ve KDV
            dahildir. Onay için toplam bedelin %30’u kapora olarak ödenir; kalan
            bedel en geç tur günü hareketten önce ödenir. Dilerseniz tamamını
            baştan ödeyebilirsiniz. Sözleşme kurulduktan sonra toplam bedel
            artırılmaz.
          </li>
          <li>
            <strong>Cayma hakkı:</strong> belirli bir tarihte yapılması gereken
            ve boş zamanın değerlendirilmesine ilişkin hizmetlerde Mesafeli
            Sözleşmeler Yönetmeliği md. 15/1-(g) uyarınca 14 günlük cayma hakkı
            bulunmaz. Konaklamalı paket turlarda 6502 sayılı Kanun md. 51 ve
            Paket Tur Sözleşmeleri Yönetmeliği uygulanır. Bunların yerine
            yukarıdaki iptal ve iade koşulları geçerlidir.
          </li>
          <li>
            <strong>Program değişikliği:</strong> program hava, yol, sınır ve
            mevsim koşullarına göre değişebilir; mevsime bağlı deneyimler (buz,
            kar, atlı kızak vb.) garanti edilmez. Turun esaslı bir unsuru
            (tarih, ana duraklar, konaklama yeri, araç sınıfı) değişirse
            sözleşmeden ücretsiz dönebilirsiniz.
          </li>
          <li>
            <strong>Devir:</strong> konaklamalı paket turda, tur başlangıcından
            en az 7 gün önce bildirerek turu koşulları taşıyan başka birine
            devredebilirsiniz.
          </li>
          <li>
            <strong>Yükümlülükleriniz:</strong> buluşma saatinde hazır olmak,
            yurt dışı turlarda geçerli giriş belgesini yanınızda bulundurmak,
            rehberin güvenlik talimatlarına uymak. Kimlik bilgileri U-ETDS’ye
            bildirildiği için kimlik belgesiyle aynı olmalıdır.
          </li>
          <li>
            <strong>Şikâyet ve uyuşmazlık:</strong> şikâyetlerinizi önce{" "}
            <a href={"mailto:" + b.email}>{b.email}</a> veya {b.phone}{" "}
            numarasına iletebilirsiniz. Ticaret Bakanlığı’nca her yıl
            belirlenen parasal sınırlar içinde tüketici hakem heyetlerine, bu
            sınırları aşan uyuşmazlıklarda tüketici mahkemelerine
            başvurabilirsiniz; başvuru e-Devlet’teki TÜBİS üzerinden de
            yapılabilir. Kanunda öngörülen hâllerde dava açmadan önce
            arabulucuya başvurulması zorunludur.
          </li>
        </ul>
        <p>
          Acentemiz telefonla, e-postayla veya mesajla kart bilgisi, parola ya
          da doğrulama kodu istemez. Rezervasyonunuza ait form ve sözleşmeye{" "}
          <Link to="/rezervasyonum">Rezervasyonum</Link> sayfasından da
          ulaşabilirsiniz.
        </p>
      </section>

      <section className="legal-part" aria-labelledby="acik-riza">
        <h2 id="acik-riza">Açık Rıza ve İzin Metinleri</h2>
        <h3>Ticari elektronik ileti onayı</h3>
        <p>
          Rezervasyon ve üyelik formlarındaki isteğe bağlı kutuyu
          işaretlerseniz, {b.legalNameShort}’nin kampanya, indirim ve yeni
          rotalar hakkında size e-posta ve SMS ile ticari elektronik ileti
          göndermesine ve bu amaçla ad, e-posta ve telefon bilgilerinizin
          işlenmesine onay vermiş olursunuz. Kutu varsayılan olarak boştur ve
          hizmet şartı değildir. Onayınızı her iletideki ret bağlantısından
          veya <a href={"mailto:" + b.email}>{b.email}</a> adresine yazarak
          ücretsiz geri alabilirsiniz. İletiler, onayınız İleti Yönetim
          Sistemi’ne (İYS) kaydedildikten sonra gönderilir.
        </p>
        <h3>Başkası adına bilgi girme beyanı</h3>
        <p>
          Birden fazla yolcu için rezervasyon yaparken ve “Yol arkadaşlarım”
          bölümüne kişi eklerken, bu kişilerin bilgilerini onların bilgisi
          dahilinde girdiğinizi, kimlik bilgilerinin kimlik belgeleriyle aynı
          olduğunu ve onları bu aydınlatma metni hakkında bilgilendireceğinizi
          beyan edersiniz. Bu beyan açık rıza değildir; diğer kişinin rızası
          yerine geçmez.
        </p>
        <p>
          Onaylarınız; verildiği zaman, metnin sürümü ve kanalıyla birlikte
          kayıt altına alınır. E-posta adresiniz onay kayıtlarında açık
          tutulmaz, karma (hash) olarak saklanır.
        </p>
      </section>

      <section className="legal-part" aria-labelledby="asistan">
        <h2 id="asistan">Yapay Zekâ Asistanı</h2>
        <p>
          Sağ alttaki asistana yazdığınız mesajlar önce sitemizdeki yerel
          asistanla yanıtlanır, yalnız yanıt üretmek için kullanılır ve
          sunucuda saklanmaz. Yerel asistanın yanıtlayamadığı bir soru, yalnız
          sohbet penceresinde açıkça onay vermeniz hâlinde Anthropic PBC (ABD)
          tarafından sunulan Claude yapay zekâ hizmetine iletilir.
        </p>
        <p>
          Bu aktarım açık rızanıza dayanır. ABD için Kişisel Verileri Koruma
          Kurulu’nun yeterlilik kararı yoktur; verileriniz Türkiye’deki koruma
          düzeyine eşdeğer bir güvenceye sahip olmayabilir. Mesajlarınıza ad,
          kimlik, telefon veya ödeme bilgisi yazmayın. Onayınız o tarayıcıda,
          sohbet penceresindeki “Onayı geri al” bağlantısıyla geri alana kadar
          geçerlidir. Onay vermeseniz de sorunuzu WhatsApp’tan ekibimize
          iletebilirsiniz.
        </p>
      </section>

      <section className="legal-part" aria-labelledby="uyelik">
        <h2 id="uyelik">Üyelik ve Kampanya Koşulları</h2>
        <p>
          Üyelik ücretsizdir. Ad, e-posta ve parola ile oluşturulan hesaplarda
          parola tek yönlü güvenli özet olarak saklanır. Oturum için zorunlu
          bir çerez kullanılır. E-posta doğrulama ve parola yenileme
          bağlantıları e-postayla iletilir. Sosyal girişler yalnız firma
          tarafından yapılandırılan sağlayıcılarla açılır. Kampanya e-postası ve
          SMS’i yalnız isteğe bağlı onay kutusunu işaretlediyseniz gönderilir.
        </p>
        <p>
          Şans çarkı hesap başına bir kez çevrilebilir. %5, %10 veya %15
          sonuçları yönetici tarafından belirlenen altı eşit olasılıklı dilimden
          sunucuda seçilir. Kuponlar üzerlerinde belirtilen son tarihe kadar
          geçerlidir, tek kullanımlıdır ve devredilemez. Aynı rezervasyonda
          yalnız bir kupon uygulanır. Konaklama ve ekstra hizmetler kapsam
          dışındadır.
        </p>
        <p>
          Davet koduyla üye olan arkadaş turunu tamamladığında veya kampanya
          ayarına göre tam ödemesi kaydedildiğinde, davet eden ve davet edilen
          hesabın her birine sonraki rezervasyonda kullanılmak üzere birer %10
          kupon tanımlanır. Aynı arkadaş için ödül yalnız bir kez verilir. Kişi
          kendi hesabını davet edemez. Ön rezervasyon iptal edilirse kullanılan
          ve süresi geçmemiş kupon yeniden kullanılabilir; davet ödülü
          tekrarlanmaz.
        </p>
        <h3>Google yorumları</h3>
        <p>
          Yorumlar Google’dan kaynak ve yazar bilgileriyle gösterilir. Rota
          sayfaları ilgili turdan bahseden veya yönetici tarafından o turla
          eşleştirilen yorumları içerir. İşletme puanı, tur puanı olarak
          sunulmaz.
        </p>
        <h3>Konaklama</h3>
        <p>
          Konaklama talepleri güncel müsaitlik ve fiyat teyidine tabidir. Talep
          oluşturmak otelde kesin rezervasyon yapıldığı anlamına gelmez.
        </p>
      </section>
    </article>
  );
}
// İngilizce sürümde bağlayıcı Türkçe metnin önünde kısa özet.
function LegalSummaryEn() {
  return (
    <section className="legal-summary-en" lang="en" aria-label="English summary">
      <p>
        <strong>English summary.</strong> The binding legal texts below are in
        Turkish. In short:
      </p>
      <ul className="legal-list">
        <li>
          <strong>Data controller:</strong> Rota Kars Turizm Taşımacılık Seyahat
          Acentası Ltd. Şti., Kars, Türkiye. We process your data to handle
          bookings, report passenger lists to the Ministry (U-ETDS), keep legal
          records and, only with your consent, send marketing messages or pass
          chat questions to an AI provider in the USA. You can exercise your
          rights under Turkish data protection law (KVKK art. 11) by writing to
          info@rotakarsturizm.com.
        </li>
        <li>
          <strong>Cookies:</strong> only strictly necessary cookies; no
          advertising or analytics. Google Maps and Instagram load only when you
          ask for them.
        </li>
        <li>
          <strong>Cancellation:</strong> unpaid pre-bookings can be cancelled
          free at any time. Confirmed bookings: full refund up to 3 days
          (domestic) or 5 days (abroad) before departure; after that the 30%
          deposit is kept; no-shows are not refunded. If we cancel, you get a
          full refund or another date. Refunds within 14 days.
        </li>
        <li>
          <strong>Contract:</strong> you approve a pre-information form before
          booking; the contract is formed when online payment succeeds or when
          the agency confirms by e-mail. Both are e-mailed to you.
        </li>
      </ul>
    </section>
  );
}
