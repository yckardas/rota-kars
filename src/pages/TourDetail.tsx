import { InstagramSection } from "../components/InstagramSection";
import { isIllustrativePhoto, responsive } from "../lib/images";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { develop, useReveal } from "../lib/reveal";
import { useParams } from "react-router-dom";
import { Link, useLang } from "../lib/i18n";
import {
  Clock3,
  MapPin,
  Armchair,
  Check,
  Minus,
  ChevronRight,
  ArrowRight,
  Info,
  CalendarDays,
  Expand,
  FileCheck2,
  BellRing,
} from "lucide-react";
import { Reviews } from "../components/Reviews";
import { RequestForm } from "../components/RequestForm";
import { api } from "../lib/api";
import { telHref } from "../lib/phone";
import { useClearOfLaunchers } from "../lib/launchers";
import { tourTone, toneStyle } from "../lib/tone";
import { Lightbox } from "../components/Lightbox";
import { enteredViaTransition } from "../lib/tour-transition";
import { TransferOffer } from "../components/TourExtras";
import { discoverFor } from "../lib/discover";
import { ArticleCard } from "../components/ArticleCard";
import { InterestForm } from "../components/InterestForm";
import { DemandDates } from "../components/DemandDates";
import {
  currency,
  hasPrice,
  dateLabel,
  type Catalog,
  type Departure,
  type Hotel,
  type Article,
  DEFAULT_PICKUP,
} from "../lib/types";
export function TourDetail({ catalog }: { catalog: Catalog }) {
  const { id } = useParams(),
    t = catalog.tours.find((t) => t.id === id);
  // t bu sayfada turun kendisi; çeviri işlevi tx.
  const { t: tx } = useLang();
  const [request, setRequest] = useState(false),
    // Tur öncesi/sonrası konaklama talebi (anlaşmalı oteller listesiyle açılır).
    [stay, setStay] = useState<Hotel[] | null>(null),
    // Talep toplama modundaki tur için ücretsiz ön kayıt formu.
    // Açıkken { dateId }: bir talep tarihinden açıldıysa o tarih seçili gelir.
    [prereg, setPrereg] = useState<{ dateId?: string } | null>(null),
    // Satışa kapalı tur: "tarih açılınca haber ver" formu.
    [notify, setNotify] = useState(false),
    [departures, setDepartures] = useState<Departure[]>([]),
    // Bu rotayla ilişkilendirilmiş rehber yazıları (panelden).
    [articles, setArticles] = useState<Article[]>([]),
    [activeImage, setActiveImage] = useState(0),
    // Tam ekran fotoğraf görüntüleyicide açık olan fotoğraf (kapalıyken null).
    [zoom, setZoom] = useState<number | null>(null),
    // Galeride görüntü değişince yeni fotoğraf yerine "oturur" (ilk açılışta değil).
    [swapped, setSwapped] = useState(false),
    // Karttan geçişle gelindiyse fotoğraf zaten akarak yerine oturdu; kartın giriş
    // hareketi ayrıca oynamaz (geçiş bitince yeniden başlamaz).
    [viaTransition] = useState(enteredViaTransition);
  // Rota çizgisi ve fiyat kartı ekrana girince canlanır.
  const routeLine = useReveal<HTMLDivElement>(),
    stampRow = useReveal<HTMLDivElement>();
  const strip = useRef<HTMLDivElement>(null),
    card = useRef<HTMLDivElement>(null),
    stripVisible = useClearOfLaunchers(strip);
  // Telefonda da: tur kartı (güzergâh, süre, fiyat ve "Tarih ve koltuk seç")
  // görünürken WhatsApp ve asistan düğmeleri kartın üstüne binmesin.
  useClearOfLaunchers(card, "actionVisible");
  useEffect(() => {
    setActiveImage(0);
    if (t && !t.inquiryOnly)
      api<Departure[]>(`/tours/${t.id}/departures`)
        .then(setDepartures)
        .catch(() => setDepartures([]));
    else setDepartures([]);
  }, [t]);
  useEffect(() => {
    if (!id) return;
    api<Article[]>("/articles?tur=" + encodeURIComponent(id))
      .then(setArticles)
      .catch(() => setArticles([]));
  }, [id]);
  if (!t)
    return (
      <div className="container empty-state">
        <h1>{tx("Bu rota bulunamadı.")}</h1>
        <Link className="btn" to="/turlar">
          {tx("Turlara dön")}
        </Link>
      </div>
    );
  // Seferler sonradan yüklenir; o ana kadar sayfaya gömülü katalogdaki ilk hareket
  // gösterilir, böylece damga ve tarih satırı yüklenince yer değiştirmez.
  const next = departures[0],
    first: { date: string; start_time: string } | undefined =
      next || (t.next && { date: t.next.date, start_time: t.next.startTime }),
    startingPrice = departures.length
      ? Math.min(...departures.map((d) => d.price))
      : (t.fromPrice ?? t.price),
    currentVehicle = next?.vehicle || t.vehicle;
  // Talep toplama: satılabilir sefer yoksa koltuk satılmaz; yeterli ön kayıt olunca acente
  // satışı açar. Talep turunda satışa açılmış bir tarih varsa sayfa satış görünümüne geçer.
  // Yalnız talep tarihi olan online tur da (ör. Konaklamalı Batum) satılabilir tarihi
  // olmadığı sürece baştan sona "ön kayıt"ı anlatır: düğme, vaatler ve tarih satırı.
  const demandDates = t.inquiryOnly ? [] : t.demandDates || [],
    demand =
      !t.inquiryOnly &&
      !first &&
      (t.mode === "demand" || demandDates.length > 0),
    threshold = t.demand?.threshold || 14;
  // Ana çağrı düğmesi her yerde aynı: haber listesi (satışa kapalı), ön kayıt ya da tarih/koltuk seç.
  const cta = (className: string, short = false) =>
    t.inquiryOnly ? (
      <button className={className} onClick={() => setNotify(true)}>
        <BellRing size={short ? 16 : 17} aria-hidden="true" />{" "}
        {short ? tx("Haber ver") : tx("Tarih açılınca haber ver")}
      </button>
    ) : demand ? (
      <button className={className} onClick={() => setPrereg({})}>
        {short ? tx("Ön kayıt") : tx("Ücretsiz ön kayıt bırakın")}
      </button>
    ) : (
      <Link className={className} to={"/rezervasyon/" + t.id}>
        {tx("Tarih ve koltuk seç")} <ArrowRight size={short ? 16 : 17} />
      </Link>
    );
  const mapUrl =
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(t.location + " " + t.name);
  // Kapak her zaman ilk fotoğraf (SEO ve ön yükleme ile aynı sıra).
  const photos = [...new Set([t.image, ...t.gallery])];
  const coverImage = photos[activeImage] || t.image;
  // Sayfa turun türünün rengini alır (rota renkleri, src/lib/tone.ts).
  const tone = toneStyle(tourTone(t));
  return (
    <>
      <div className="container breadcrumb">
        <Link to="/">{tx("Ana sayfa")}</Link>
        <ChevronRight size={12} />
        <Link to="/turlar">{tx("Turlar")}</Link>
        <ChevronRight size={12} />
        <span>{t.name}</span>
      </div>
      <section
        className={
          "container kp-detail-card" + (viaTransition ? " is-vt-entry" : "")
        }
        aria-labelledby="tour-title"
        style={tone}
      >
        <div className="kp-card" ref={card}>
          <div
            className={
              "kp-views" + (photos.length > 1 ? "" : " kp-views-single")
            }
          >
            <div className="kp-main-view">
              <img
                key={activeImage}
                className={swapped ? "kp-swap" : undefined}
                style={viaTransition ? { viewTransitionName: "tour-photo" } : undefined}
                {...responsive(
                  coverImage,
                  "(max-width: 760px) 100vw, 62vw",
                )}
                alt={t.name}
                width="1280"
                height="720"
                onClick={() => setZoom(activeImage)}
              />
              <button
                type="button"
                className="rk-zoom"
                onClick={() => setZoom(activeImage)}
                aria-label={tx("Fotoğrafları büyüt")}
              >
                <Expand size={17} aria-hidden="true" />
                <span>{tx("Büyüt")}</span>
              </button>
              <div className="kp-title">
                <h1 id="tour-title" style={viaTransition ? { viewTransitionName: "tour-title" } : undefined}>
                  {t.name}
                </h1>
                <p>{t.subtitle}</p>
              </div>
              {isIllustrativePhoto(coverImage) && (
                <small className="kp-photo-disclosure">{tx("Temsili · Yapay zekâ")}</small>
              )}
              {!t.salesOpen && (
                <span className="tour-sales-closed">
                  {tx("Şu an satışa kapalı")}
                </span>
              )}
            </div>
            {photos.length > 1 && (
              <div className={"kp-insets kp-insets-stack" + (photos.length > 3 ? " kp-insets-mosaic" : "")}>
                {photos.map((img, i) => (
                  <button
                    key={img}
                    type="button"
                    className="kp-inset"
                    onClick={() => {
                      setSwapped(true);
                      setActiveImage(i);
                    }}
                    aria-label={tx("{n}. fotoğrafı göster", { n: i + 1 })}
                    aria-pressed={activeImage === i}
                  >
                    <img
                      {...responsive(img, "(max-width: 760px) 33vw, 20vw")}
                      {...develop}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                    {isIllustrativePhoto(img) && (
                      <small className="kp-photo-disclosure">{tx("Temsili · Yapay zekâ")}</small>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="kp-strip kp-detail-strip" ref={strip}>
            <dl className="kp-facts">
              <div>
                <dt>{tx("Güzergâh")}</dt>
                <dd>
                  <MapPin size={15} />
                  {t.location}
                </dd>
              </div>
              <div>
                <dt>{tx("Süre")}</dt>
                <dd>
                  <Clock3 size={15} />
                  {t.duration}
                </dd>
              </div>
              <div>
                <dt>{tx("Araç")}</dt>
                <dd>
                  <Armchair size={15} />
                  {currentVehicle.passengerSeats}+1 {currentVehicle.name}
                </dd>
              </div>
              <div className="kp-fact-price">
                <dt>{demand && hasPrice(startingPrice) ? tx("Tahmini kişi başı") : tx("Kişi başı")}</dt>
                <dd>
                  {hasPrice(startingPrice)
                    ? tx("{price}’den", { price: currency(startingPrice) })
                    : tx("Fiyat için arayın")}
                </dd>
              </div>
            </dl>
            {cta("btn")}
          </div>
          <p className="kp-printed">
            <span>
              {t.season} · {tx("Kars çıkışlı")}
            </span>
            <span>
              {demand
                ? demandDates[0]
                  ? tx(
                      "Planlanan tarih: {date} · yeterli talep olursa kesinleşir.",
                      {
                        date: dateLabel(demandDates[0].date),
                      },
                    )
                  : tx("Yeterli talep olursa kesinleşir.")
                : !t.inquiryOnly && first
                ? tx("İlk hareket: {date} · {time}", {
                    date: dateLabel(first.date),
                    time: first.start_time,
                  })
                : t.inquiryOnly
                  ? tx("Şu an satışa kapalı · tarih açılınca haber verelim.")
                  : tx("Uygun tarih için bize ulaşın.")}
            </span>
          </p>
        </div>
      </section>
      <div className="container detail-layout" style={tone}>
        <div className="detail-content">
          {/* Gerekli belgeler (yurt dışı turlarında kimlik, pasaport, muvafakatname, harç):
              içeriğin en üstünde, gözden kaçmayacak renkli kutuda. Panelden düzenlenir. */}
          {Boolean(t.documents?.length) && (
            <section className="tour-documents" aria-labelledby="tour-documents-title">
              <div className="tour-documents-icon" aria-hidden="true">
                <FileCheck2 size={26} />
              </div>
              <div>
                <h2 id="tour-documents-title">{tx("Yola çıkmadan önce: gerekli belgeler")}</h2>
                <ul>
                  {t.documents!.map((d) => (
                    <li key={d}>
                      <Check size={16} />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
          <section>
            <h2>{tx("Bu yolculukta sizi neler bekliyor?")}</h2>
            <p className="lead-copy">{t.summary}</p>
          </section>
          {t.itinerary.length > 0 && (
            <section id="program">
              <h2>{tx("Günün akışı")}</h2>
              <div className="itinerary kp-await" ref={routeLine}>
                {t.itinerary.map((s, i) => (
                  <div key={s.title} style={{ "--i": i } as CSSProperties}>
                    <span className="itinerary-time">{s.time}</span>
                    <div>
                      <h3>{s.title}</h3>
                      <p>{s.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          {discoverFor(t.id).length > 0 && (
            <section className="discover-links" aria-label={tx("Rotadaki yerleri keşfedin")}>
              {discoverFor(t.id).map((d) => (
                <Link key={d.slug} className="discover-link" to={"/kesfet/" + d.slug}>
                  <img {...responsive(d.image, "160px")} alt="" loading="lazy" decoding="async" />
                  <span>
                    <strong>
                      {tx(d.linkLabel)} <ArrowRight size={16} />
                    </strong>
                    <small>{tx(d.teaser)}</small>
                  </span>
                </Link>
              ))}
            </section>
          )}
          <section className="inclusions">
            <div>
              <h3>{tx("Fiyata dahil")}</h3>
              {t.included.map((s) => (
                <p key={s}>
                  <Check size={16} />
                  {s}
                </p>
              ))}
            </div>
            <div>
              {/* Bu kalemler satılmaz: müşteri dahil ya da sitede eklenebilir sanmasın. */}
              <h3>{tx("Fiyata dahil değil")}</h3>
              <small className="inclusions-note">
                {tx(
                  "Tur bedeline eklenmez, sitede satın alınmaz. Ücretini tur sırasında yerinde kendiniz ödersiniz.",
                )}
              </small>
              {t.excluded.map((s) => (
                <p key={s}>
                  <Minus size={16} />
                  {s}
                </p>
              ))}
            </div>
          </section>
          {t.note && (
            <div className="info-note">
              <Info size={20} />
              <p>{t.note}</p>
            </div>
          )}
          <section>
            <h2>{tx("Buluşalım, yola çıkalım.")}</h2>
            <div className="tour-meeting">
              <MapPin size={24} />
              <div>
                <strong>{tx(next?.pickup || DEFAULT_PICKUP)}</strong>
                <p>
                  {first
                    ? `${dateLabel(first.date)} · ${first.start_time}`
                    : demand && demandDates[0]
                      ? tx("{date} · {time} · ön kayıt", {
                          date: dateLabel(demandDates[0].date),
                          time: demandDates[0].start_time,
                        })
                      : tx("Tarihinizi acenteyle planlayın.")}
                </p>
                {next?.guide_name && (
                  <p>{tx("Rehber: {name}", { name: next.guide_name })}</p>
                )}
                <a
                  className="text-link"
                  href={mapUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {tx("Tur bölgesini haritada aç")} <ArrowRight size={15} />
                </a>
              </div>
            </div>
            {!t.inquiryOnly && !demand && <TransferOffer tourId={t.id} config={t.transfer} />}
            <section className="tour-extra stay-offer" aria-labelledby="stay-offer-title">
              <div>
                <h2 id="stay-offer-title">{tx("Konaklamayı da ayarlayalım.")}</h2>
                <p className="muted">
                  {tx(
                    "Tur öncesi ya da sonrası Kars’ta kalacak yer mi arıyorsunuz? Tarihinizi, kişi sayınızı ve oda tercihinizi bırakın; anlaşmalı otellerimizle görüşüp size dönelim.",
                  )}
                </p>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() =>
                    api<Hotel[]>("/hotels")
                      .then(setStay)
                      .catch(() => setStay([]))
                  }
                >
                  {tx("Konaklama talebi bırakın")}
                </button>
              </div>
            </section>
            <h2>{tx("Yola çıkmadan önce")}</h2>
            <details>
              <summary>
                {tx("Çocuklar için koltuk ve fiyat nasıl belirlenir?")}
              </summary>
              <p>
                {tx(
                  "Koltuklu her yolcu için ayrı koltuk seçilir. Çocuk indirimi veya çocuk koltuğu ihtiyacını rezervasyon öncesinde acenteye bildirin; yaşa göre koşullar teyit edilir. Ekrandaki kişi başı fiyat otomatik çocuk indirimi içermez.",
                )}
              </p>
            </details>
            <details>
              <summary>
                {tx("Buluşma saati veya rehber değişirse nasıl öğrenirim?")}
              </summary>
              <p>
                {tx(
                  "Hareket ve buluşma bilgileri rezervasyon belgenizde yazar; güncel hâline Rezervasyonum sayfasından her zaman bakabilirsiniz. Yolculuktan önceki 24 saat içinde e-postanıza bir hatırlatma göndeririz. Saat, buluşma noktası veya rehber değişirse sizi kayıtlı telefonunuzdan ya da e-posta adresinizden bilgilendiririz.",
                )}
              </p>
            </details>
            <details>
              <summary>{tx("Rezervasyon nasıl kesinleşir?")}</summary>
              <p>
                {catalog.payment.enabled
                  ? tx(
                      "Tarih ve koltuğunuzu seçip ön rezervasyonunuzu oluşturun. Ardından kaporayı (%30) ya da tamamını kartla ödediğinizde rezervasyonunuz anında onaylanır ve QR kodlu biletiniz geçerli olur. Havale veya nakitle de ödeyebilirsiniz; o durumda ödemeniz kaydedilince acentemiz onaylar.",
                    )
                  : tx(
                      "Tarih ve koltuğunuzu seçip ön rezervasyonunuzu oluşturun; bu adımda ödeme alınmaz. Acentemiz sizinle iletişime geçer, kaporayı (%30) havale veya nakitle ödediğinizde rezervasyonunuzu onaylar. Koltuklarınız bu sırada 24 saate kadar sizin için tutulur.",
                    )}
              </p>
            </details>
            <details>
              <summary>{tx("Rehber koltuğunu seçebilir miyim?")}</summary>
              <p>
                {tx(
                  "{seats}+1 aracın şoför yanındaki ön koltuğu rehbere ayrılmıştır. Şoför ve rehber dışında {guests} misafir için koltuk seçilebilir.",
                  {
                    seats: currentVehicle.passengerSeats,
                    guests: currentVehicle.sellableSeats,
                  },
                )}
              </p>
            </details>
            <details>
              <summary>
                {tx("İptal ve program değişikliği nasıl olur?")}
              </summary>
              <p>
                {/* Tek kaynak: katalogdaki iptal metni (server/catalog.mjs). */}
                {catalog.cancellationPolicy}{" "}
                <Link to="/bilgilendirme#iptal">
                  {tx("İptal ve iade koşulları")}
                </Link>
              </p>
            </details>
          </section>
        </div>
        <aside className="booking-aside">
          <div className="rk-price-card" ref={stampRow}>
            <div className="booking-price">
              <span className="rk-price-place">{t.name}</span>
              {hasPrice(startingPrice) ? (
                <>
                  <strong>{currency(startingPrice)}</strong>
                  <span>{demand ? tx("tahmini kişi başı fiyat") : tx("kişi başı başlangıç fiyatı")}</span>
                </>
              ) : (
                <>
                  <strong className="booking-price-ask">{tx("Fiyat için arayın")}</strong>
                  <span>{tx("Fiyat, tur tarihi kesinleşince duyurulur.")}</span>
                </>
              )}
            </div>
          </div>
          {demand ? (
            <div className="demand-note">
              <p>
                {tx("Bu tur yeterli talep olursa yapılacak. Ücretsiz ön kayıt bırakın; tur kesinleşince size haber verip rezervasyonu açalım.")}
              </p>
              {!demandDates.length && (
                <p className="demand-goal">
                  {tx("Tur {threshold} kişiye ulaşınca kesinleşir.", {
                    threshold,
                  })}
                </p>
              )}
              {t.demand?.count !== undefined && !demandDates.length && (
                <div className="demand-progress">
                  <span>
                    {tx("{count} / {threshold} kişi hazır", {
                      count: Math.min(t.demand.count, t.demand.threshold),
                      threshold: t.demand.threshold,
                    })}
                  </span>
                  <progress max={t.demand.threshold} value={Math.min(t.demand.count, t.demand.threshold)} />
                </div>
              )}
              {demandDates.length > 0 && (
                <DemandDates
                  title={tx("Planlanan tarihler")}
                  dates={demandDates}
                  threshold={threshold}
                  onPick={(dateId) => setPrereg({ dateId })}
                />
              )}
            </div>
          ) : t.inquiryOnly ? (
            <p>
              {tx(
                "Bu tur şu an satışa kapalı. Yeni tarih açılınca size e-postayla haber verelim.",
              )}
            </p>
          ) : (
            <p>
              {tx("Size uyan günü seçin.")}
              <br />
              {tx("Yolculuğunuzun yerini şimdiden belirleyin.")}
            </p>
          )}
          {!t.inquiryOnly && !demand && (
            <div className="next-departures">
              <CalendarDays size={18} />
              <span>
                {first
                  ? tx("İlk hareket: {date}", {
                      date: dateLabel(first.date),
                    })
                  : tx("Uygun tarih için bize ulaşın.")}
              </span>
            </div>
          )}
          {!demand && demandDates.length > 0 && (
            <DemandDates
              title={tx("Talep toplanan tarihler")}
              dates={demandDates}
              threshold={threshold}
              onPick={(dateId) => setPrereg({ dateId })}
            />
          )}
          {cta("btn block")}
          {t.inquiryOnly && (
            <button
              type="button"
              className="text-link demand-dates-more"
              onClick={() => setRequest(true)}
            >
              {tx("Bu tur için bilgi alın")}
            </button>
          )}
          {/* Talep turunda satışa açılmış tarih olsa da tarih belirtmeden ön kayıt yolu kalır. */}
          {t.mode === "demand" && !demand && !t.inquiryOnly && (
            <button type="button" className="text-link demand-dates-more" onClick={() => setPrereg({})}>
              {tx("Başka bir tarih için ücretsiz ön kayıt")}
            </button>
          )}
          <div className="aside-benefits">
            <span>
              <Armchair size={15} />
              {tx("{n} yolcu koltuğu", { n: currentVehicle.sellableSeats })}
            </span>
            <span>
              <Check size={15} />
              {demand
                ? tx("Ön kayıt ücretsizdir, ödeme alınmaz")
                : t.inquiryOnly
                  ? tx("Haber listesi ücretsizdir, koltuk tutulmaz")
                  : catalog.payment.enabled
                  ? tx("Kaporayı ödeyince anında onay")
                  : tx("Acente onaylı rezervasyon")}
            </span>
          </div>
          {catalog.demo ? (
            <small>
              {tx(
                "Demo sürümünde fiyat ve sefer tarihleri örnektir. Online ödeme henüz aktif değildir.",
              )}
            </small>
          ) : (
            !catalog.payment.enabled && (
              <small>{tx("Online ödeme henüz aktif değildir.")}</small>
            )
          )}
          <a className="text-link" href={telHref(catalog.business.mobile)}>
            {tx("Birlikte planlayalım: {phone}", {
              phone: catalog.business.mobile,
            })}
          </a>
        </aside>
      </div>
      {articles.length > 0 && (
        <section className="container section tour-articles" aria-labelledby="tour-articles-title">
          <h2 id="tour-articles-title">{tx("Yola çıkmadan okuyun.")}</h2>
          <div className="article-grid">
            {articles.slice(0, 3).map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        </section>
      )}
      <InstagramSection profileUrl={catalog.business.instagram} />
      <Reviews tourId={t.id} />
      <div
        className={"tour-mobile-booking" + (stripVisible ? " is-tucked" : "")}
        style={tone}
        aria-hidden={stripVisible || undefined}
      >
        <div>
          <strong>{currency(startingPrice)}</strong>
          <small>{demand ? tx("tahmini kişi başı") : tx("kişi başı başlangıç")}</small>
        </div>
        {cta("btn", true)}
      </div>
      {zoom !== null && (
        <Lightbox
          images={photos}
          start={zoom}
          alt={t.name}
          onClose={() => setZoom(null)}
        />
      )}
      {request && (
        <RequestForm
          kind="tour-info"
          tourId={t.id}
          tourName={t.name}
          initialCheckIn={first?.date}
          onClose={() => setRequest(false)}
        />
      )}
      {prereg && (
        <InterestForm
          kind="prereg"
          tourId={t.id}
          tourName={t.name}
          dates={demandDates}
          initialDateId={prereg.dateId}
          threshold={threshold}
          count={t.demand?.count}
          onClose={() => setPrereg(null)}
        />
      )}
      {notify && (
        <InterestForm
          kind="notify"
          tourId={t.id}
          tourName={t.name}
          onClose={() => setNotify(false)}
        />
      )}
      {stay && (
        <RequestForm
          kind="hotel"
          hotels={stay}
          tourId={t.id}
          tourName={t.name}
          initialCheckIn={first?.date}
          hours={catalog.business.hours}
          onClose={() => setStay(null)}
        />
      )}
    </>
  );
}
