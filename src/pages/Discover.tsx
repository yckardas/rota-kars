// Keşif sayfası: Ani Harabeleri (/kesfet/ani). Hatıra kartı dünyasının parçaları
// üstüne kurulur: açılışta çok görüntülü kart (kart masaya yerleşir, başlık şeridi
// oturur), tarih rota çizgisi olarak ekrana girince çizilir, örnek yürüyüş şematik
// haritada kırmızı rota olarak akar ve duraklar sırayla belirir. Hareket azaltma
// tercihinde her şey baştan yerinde ve durağandır.
import { useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { ArrowRight, ChevronRight, Clock3, Footprints, MapPin, Shirt, Sun, Ticket, TriangleAlert } from "lucide-react";
import { Link, useLang } from "../lib/i18n";
import { responsive } from "../lib/images";
import { develop, useReveal } from "../lib/reveal";
import { TourCard } from "../components/TourCard";
import type { Catalog } from "../lib/types";

const TIMELINE = [
  { year: "961", title: "Başkent Ani", text: "Bagratlı Krallığı başkentini Ani’ye taşır. İpek Yolu üzerindeki şehir hızla büyür." },
  { year: "989–1001", title: "Katedral yükselir", text: "Mimar Trdat’ın yaptığı Ani Katedrali tamamlanır; şehrin en büyük yapısıdır." },
  { year: "1064", title: "Selçuklu dönemi", text: "Sultan Alparslan şehri alır. Ani, Anadolu’nun kapılarından biri olur." },
  { year: "1072", title: "İlk cami", text: "Şeddadi emiri Ebu’l Menucehr camiyi yaptırır; Anadolu’daki ilk Türk camii olarak anılır." },
  { year: "1215", title: "Freskli kilise", text: "Tüccar Tigran Honents kilisesini yaptırır; duvar resimleri bugün hâlâ görülebilir." },
  { year: "1236–1319", title: "Sessizliğe doğru", text: "Moğol akınları ve 1319 depremiyle şehir giderek boşalır." },
  { year: "2016", title: "Dünya Mirası", text: "Ani Arkeolojik Alanı UNESCO Dünya Mirası Listesi’ne girer." },
];
// Şematik yürüyüş haritası (ölçekli değil): duraklar ve aradaki rota.
const STOPS = [
  { x: 300, y: 62, name: "Aslanlı Kapı", text: "Şehre girilen ana kapı. Surlardaki aslan kabartması kapıya adını verir." },
  { x: 468, y: 150, name: "Kurtarıcı Kilisesi", text: "1035’te yapılan yuvarlak kilisenin yarısı 1957’de yıkıldı; kesiti, yapının içini bir maket gibi gösterir." },
  { x: 510, y: 245, name: "Tigran Honents Kilisesi", text: "Arpaçay’a bakan yamaçta. İçindeki freskler Ani’nin en iyi korunmuş duvar resimleridir." },
  { x: 368, y: 262, name: "Ani Katedrali", text: "Şehrin en büyük yapısı. Sivri kemerleri ve demet sütunlarıyla çağının ötesinde bir mimari." },
  { x: 250, y: 318, name: "Ebu’l Menucehr Camii", text: "Kanyonun kenarındaki minaresiyle; Anadolu’daki ilk Türk camii olarak bilinir." },
  { x: 318, y: 388, name: "Kız Kalesi", text: "Kanyona uzanan kayalığın ucundaki küçük manastır; en güzel uzaktan seyredilir." },
  { x: 130, y: 168, name: "Selçuklu Sarayı", text: "Batıdaki vadinin kenarında, renkli taş süslemeli saray kalıntısı." },
];
const ROUTE =
  "M300 62 C 380 80, 440 110, 468 150 S 505 210, 510 245 C 470 268, 420 268, 368 262 S 290 290, 250 318 C 262 352, 290 372, 318 388 M250 318 C 190 290, 140 240, 130 168 S 220 70, 300 62";
const TIPS = [
  { icon: Sun, title: "Ne zaman?", text: "İlkbahardan sonbahara yürüyüş en rahattır. Kışın kar altındaki Ani bambaşka bir sessizlik sunar. Akşamüstü ışığı fotoğraf için en güzelidir." },
  { icon: Clock3, title: "Ne kadar sürer?", text: "Ana yapıları görmek için 2–3 saatlik bir yürüyüş planlayın. Yollar düz ama taşlık ve gölgesizdir." },
  { icon: Shirt, title: "Ne giymeli?", text: "Rahat, kaymaz ayakkabı; yazın şapka ve su. Kışın katmanlı giyin, açık alanda rüzgâr serttir." },
  { icon: Ticket, title: "Giriş", text: "Ören yeri girişi ücretlidir ve Müzekart geçerlidir. Giriş ücreti tur fiyatına dahil değildir." },
  { icon: TriangleAlert, title: "Sınır bölgesi", text: "Arpaçay’ın karşı kıyısı Ermenistan’dır. Görevlilerin uyarılarına uyun, kanyon kenarına fazla yaklaşmayın." },
];

export function Discover({ catalog }: { catalog: Catalog }) {
  const { slug } = useParams(),
    { t } = useLang();
  if (slug !== "ani")
    return (
      <div className="container empty-state">
        <h1>{t("Bu sayfa bulunamadı.")}</h1>
        <Link className="btn" to="/turlar">
          {t("Turlara dön")}
        </Link>
      </div>
    );
  return <AniPage catalog={catalog} />;
}

function AniPage({ catalog }: { catalog: Catalog }) {
  const { t } = useLang();
  const timeline = useReveal<HTMLDivElement>(),
    walk = useReveal<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const tour = catalog.tours.find((x) => x.id === "ani-cildir");
  return (
    <div className="discover-page">
      <div className="container breadcrumb">
        <Link to="/">{t("Ana sayfa")}</Link>
        <ChevronRight size={12} />
        <Link to="/turlar/ani-cildir">{tour?.name || "Ani"}</Link>
        <ChevronRight size={12} />
        <span>{t("Ani’yi keşfet")}</span>
      </div>
      <section className="container kp-detail-card discover-hero" aria-labelledby="discover-title">
        <div className="kp-card">
          <div className="kp-views kp-views-single">
            <div className="kp-main-view">
              <img
                {...responsive("/images/tours/ani.webp", "(max-width: 760px) 100vw, 62vw")}
                alt={t("Ani Katedrali ve çevresindeki ovada kalıntılar")}
                width="1280"
                height="720"
                fetchPriority="high"
              />
              <div className="kp-title">
                <h1 id="discover-title">{t("Ani’yi keşfet")}</h1>
                <p>{t("Bin bir kilisenin sessiz şehri.")}</p>
              </div>
            </div>
          </div>
          <div className="kp-strip kp-detail-strip">
          <dl className="kp-facts discover-facts">
            <div>
              <dt>{t("Konum")}</dt>
              <dd>
                <MapPin size={16} /> {t("Kars’a yaklaşık 45 km")}
              </dd>
            </div>
            <div>
              <dt>{t("Koruma")}</dt>
              <dd>{t("UNESCO Dünya Mirası · 2016")}</dd>
            </div>
            <div>
              <dt>{t("Yürüyüş")}</dt>
              <dd>
                <Footprints size={16} /> {t("2–3 saat")}
              </dd>
            </div>
          </dl>
          <Link className="btn" to="/turlar/ani-cildir">
            {t("Rehberle gezin")} <ArrowRight size={17} />
          </Link>
          </div>
          <p className="kp-printed">
            <span>{t("Arpaçay kanyonunun kıyısında, Türkiye–Ermenistan sınırında")}</span>
            <span>
              <Link to="/gorsel-kaynaklari">{t("Fotoğraf: Martin Lopatka, CC BY-SA 2.0")}</Link>
            </span>
          </p>
        </div>
      </section>

      <div className="container discover-layout">
        <section className="detail-content discover-intro">
          <figure className="discover-photo">
            <img
              {...responsive("/images/ani.webp", "(max-width: 860px) 100vw, 36vw")}
              {...develop}
              alt={t("Karla kaplı Ani’de bir kilise")}
              loading="lazy"
              decoding="async"
            />
            <figcaption>{t("Kışın Ani: karın altında bin yıllık taşlar.")}</figcaption>
          </figure>
          <h2>{t("Taşların anlattığı bir şehir.")}</h2>
          <p className="lead-copy">
            {t(
              "Ani, Kars’ın doğusunda, Arpaçay’ın derin kanyonuyla çevrili bir düzlükte yükselir. Orta Çağ’da İpek Yolu’nun en kalabalık şehirlerinden biriydi; kiliselerinin çokluğu yüzünden “bin bir kilise şehri” diye anıldı. Bugün surların içinde katedraller, bir cami, saray kalıntıları ve rüzgârın sesi var.",
            )}
          </p>
          <p className="lead-copy">
            {t(
              "Bagratlılar, Bizans, Selçuklular, Gürcüler ve Moğollar şehrin kaderini değiştirdi. Her biri taşlara bir iz bıraktı: aynı ovada hem Anadolu’nun ilk camilerinden biri hem de freskleri hâlâ seçilebilen kiliseler durur.",
            )}
          </p>
        </section>

        <section className="detail-content discover-timeline" aria-labelledby="timeline-title">
          <h2 id="timeline-title">{t("Bin yılın kısa hikâyesi")}</h2>
          <div className="itinerary kp-await" ref={timeline}>
            {TIMELINE.map((s, i) => (
              <div key={s.year} style={{ "--i": i } as CSSProperties}>
                <span className="itinerary-time">{s.year}</span>
                <div>
                  <h3>{t(s.title)}</h3>
                  <p>{t(s.text)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="detail-content discover-walk" aria-labelledby="walk-title">
          <h2 id="walk-title">{t("Örnek bir yürüyüş")}</h2>
          <p className="muted">{t("Aslanlı Kapı’dan girip kanyon boyunca dönen, ana yapıları gören bir tur. Harita şematiktir, ölçekli değildir.")}</p>
          <div className="walk-grid kp-await" ref={walk}>
            <figure className="walk-map">
              <svg viewBox="0 0 600 420" role="img" aria-labelledby="walk-map-title">
                <title id="walk-map-title">{t("Ani yürüyüş rotasının şematik haritası")}</title>
                <path className="walk-river" d="M560 0 C 600 120, 560 240, 540 300 S 430 410, 330 418 S 150 400, 90 360" />
                <text className="walk-river-label" x="548" y="118" transform="rotate(78 548 118)">
                  Arpaçay
                </text>
                <path className="walk-wall" d="M60 120 L 120 70 L 220 46 L 300 40 L 390 52 L 470 88 L 520 130" />
                <text className="walk-wall-label" x="168" y="50">
                  {t("Surlar")}
                </text>
                <path className="walk-route" d={ROUTE} pathLength={1} />
                {STOPS.map((s, i) => (
                  <g
                    key={s.name}
                    className={"walk-stop" + (active === i ? " is-active" : "")}
                    style={{ "--i": i } as CSSProperties}
                    transform={`translate(${s.x} ${s.y})`}
                    onMouseEnter={() => setActive(i)}
                    onMouseLeave={() => setActive(null)}
                  >
                    <circle r="13" />
                    <text dy="4.5">{i + 1}</text>
                  </g>
                ))}
              </svg>
            </figure>
            <ol className="walk-stops">
              {STOPS.map((s, i) => (
                <li key={s.name} className={active === i ? "is-active" : ""} style={{ "--i": i } as CSSProperties}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    aria-describedby={`walk-stop-${i}`}
                  >
                    <b>{i + 1}</b>
                    <span>{t(s.name)}</span>
                  </button>
                  <p id={`walk-stop-${i}`}>{t(s.text)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="discover-tips" aria-labelledby="tips-title">
          <h2 id="tips-title">{t("Gitmeden bilin.")}</h2>
          <div className="discover-tip-grid">
            {TIPS.map((tip) => (
              <article key={tip.title} className="discover-tip">
                <h3>
                  <tip.icon size={17} /> {t(tip.title)}
                </h3>
                <p>{t(tip.text)}</p>
              </article>
            ))}
          </div>
        </section>

        {tour && (
          <section className="discover-cta" aria-labelledby="cta-title">
            <div>
              <h2 id="cta-title">{t("Ani’yi rehberle gezin.")}</h2>
              <p className="lead-copy">
                {t("Ani, Çıldır Gölü ve Kars şehir turunu tek günde birleştiren rotamızda rehberimiz Ani’nin hikâyesini yerinde anlatır.")}
              </p>
              <Link className="btn" to="/turlar/ani-cildir">
                {t("Turu incele")} <ArrowRight size={17} />
              </Link>
            </div>
            <div className="discover-cta-card">
              <TourCard tour={tour} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
