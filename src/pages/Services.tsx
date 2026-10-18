import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  Check,
  MapPin,
  Bus,
  Clock3,
  ChevronRight,
} from "lucide-react";
import type { Catalog } from "../lib/types";
import { RequestForm } from "../components/RequestForm";
const details: Record<
  string,
  {
    lead: string;
    benefits: string[];
    steps: { title: string; text: string }[];
    kind: "vehicle" | "private-tour";
    cta: string;
  }
> = {
  "turizm-tasimaciligi": {
    lead: "Yolculuğun her aşamasını birlikte planlıyoruz. Tur grupları, okul gezileri ve şehirler arası organizasyonlar için grubunuza uygun araç ve güzergâhı belirliyoruz.",
    benefits: [
      "Grubun büyüklüğüne göre araç planı",
      "Şoförlü ulaşım ve güzergâh planlaması",
      "Kars merkezli bölge deneyimi",
      "Hareket ve mola noktalarının önceden belirlenmesi",
    ],
    steps: [
      {
        title: "Grubunuzu tanıyalım",
        text: "Tarih, güzergâh, kişi sayısı ve ihtiyaçlarınızı paylaşın.",
      },
      {
        title: "Yolculuğu tasarlayalım",
        text: "Araç, buluşma noktası ve program için size özel teklif hazırlayalım.",
      },
      {
        title: "Birlikte yola çıkalım",
        text: "Teyit edilen plan üzerinden operasyonu koordine edelim.",
      },
    ],
    kind: "vehicle",
    cta: "Grubunuz için teklif alın",
  },
  "vip-transfer": {
    lead: "Havalimanından otelinize, toplantınızdan bir sonraki durağa; size ayrılan bir araçla, size uyan saatte yola çıkın.",
    benefits: [
      "Kişiye ve gruba özel şoförlü araç",
      "Havalimanı, otel ve şehir içi transfer",
      "Bagaj ve yolcu sayısına uygun planlama",
      "Tek yön veya gidiş dönüş seçenekleri",
    ],
    steps: [
      {
        title: "Nereden, nereye?",
        text: "Alış ve varış noktalarını, tarih ve saati paylaşın.",
      },
      {
        title: "İhtiyaçları netleştirelim",
        text: "Kişi, bagaj ve varsa çocuk koltuğu ihtiyacınızı belirtin; uygunluğu teyit edelim.",
      },
      {
        title: "Transferi teyit edelim",
        text: "Araç ve fiyat onayından sonra buluşma bilgilerinizi netleştirelim.",
      },
    ],
    kind: "vehicle",
    cta: "Transfer planınızı paylaşın",
  },
  "kongre-toplanti": {
    lead: "Katılımcılarınızın ulaşımını tek bir plan altında toplayın. Karşılama, konaklama noktası ve etkinlik alanı arasındaki akışı beraber kuralım.",
    benefits: [
      "Etkinlik saatlerine göre transfer planı",
      "Farklı grup ve araç kapasiteleri",
      "Havalimanı–otel–etkinlik alanı koordinasyonu",
      "Çok duraklı organizasyonlar için özel çalışma",
    ],
    steps: [
      {
        title: "Programınızı paylaşın",
        text: "Etkinlik takvimi, katılımcı sayısı ve transfer noktalarını iletin.",
      },
      {
        title: "Operasyon planı hazırlayalım",
        text: "Araç sayısını, saatleri ve buluşma noktalarını netleştirelim.",
      },
      {
        title: "Süreci koordine edelim",
        text: "Onaylanan planı ekiplerinizle iletişim halinde yürütelim.",
      },
    ],
    kind: "vehicle",
    cta: "Organizasyon teklifi isteyin",
  },
  "express-tur": {
    lead: "Vaktiniz az, keşfedecek çok yer var. İlginize ve ayırdığınız süreye göre size özel kısa bir gezi rotası oluşturalım.",
    benefits: [
      "Size uygun tarih ve hareket saati",
      "Kültür, doğa ve fotoğraf odaklı rotalar",
      "Özel grup ve kurumsal gezi planları",
      "Rehberlik ve ek hizmetlerin teklif içinde netleştirilmesi",
    ],
    steps: [
      {
        title: "Ne keşfetmek istersiniz?",
        text: "İlginizi çeken yerleri ve ayırdığınız süreyi anlatın.",
      },
      {
        title: "Rotanızı hazırlayalım",
        text: "Mesafeleri, ziyaret noktalarını ve molaları birlikte planlayalım.",
      },
      {
        title: "Detayları teyit edelim",
        text: "Kapsam ve fiyat onayından sonra yolculuğunuzu kesinleştirelim.",
      },
    ],
    kind: "private-tour",
    cta: "Size özel bir rota isteyin",
  },
};
export function Services({ catalog }: { catalog: Catalog }) {
  const { id } = useParams(),
    [request, setRequest] = useState(false),
    service = catalog.services.find((s) => s.id === id),
    info = id ? details[id] : null;
  if (!service || !info)
    return (
      <section className="container section">
        <span className="section-note">Yolun her aşamasında</span>
        <h1>Birlikte planlıyoruz.</h1>
        <p className="lead-copy">
          Grubunuza, zamanınıza ve ihtiyaçlarınıza uygun bir yolculuk.
        </p>
        <div className="services-directory">
          {catalog.services.map((s) => (
            <Link
              className="service-directory-card"
              key={s.id}
              to={"/hizmetler/" + s.id}
            >
              <img
                src={s.image}
                alt={s.title}
                loading="lazy"
                decoding="async"
              />
              <div>
                <h2>{s.title}</h2>
                <p>{s.text}</p>
                <span>
                  Hizmeti keşfet <ArrowRight size={17} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    );
  return (
    <>
      <div className="container breadcrumb">
        <Link to="/">Ana sayfa</Link>
        <ChevronRight size={12} />
        <Link to="/hizmetler">Hizmetler</Link>
        <ChevronRight size={12} />
        <span>{service.title}</span>
      </div>
      <section className="service-detail-hero container">
        <div>
          <span className="section-note">Kars’tan, size özel</span>
          <h1>{service.title}</h1>
          <p>{info.lead}</p>
          <button className="btn" onClick={() => setRequest(true)}>
            {info.cta}
            <ArrowRight size={17} />
          </button>
          <div className="service-detail-points">
            <span>
              <MapPin size={15} />
              Kars merkezli
            </span>
            <span>
              <Bus size={15} />
              Grubunuza uygun araç
            </span>
            <span>
              <Clock3 size={15} />
              Size özel plan
            </span>
          </div>
        </div>
        <img src={service.image} alt={service.title} decoding="async" />
      </section>
      <section className="container service-detail-body">
        <div>
          <span className="section-note">İhtiyacınıza göre</span>
          <h2>Yolculuğunuzun detayları.</h2>
          <div className="service-benefits">
            {info.benefits.map((text) => (
              <p key={text}>
                <Check size={19} />
                {text}
              </p>
            ))}
          </div>
          <p className="muted">
            Araç, müsaitlik, hizmet kapsamı ve fiyat talebinize göre acente
            tarafından teyit edilir.
          </p>
        </div>
        <div className="service-process">
          <h2>Nasıl ilerliyoruz?</h2>
          {info.steps.map((step, i) => (
            <article key={step.title}>
              <span>{i + 1}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="container service-detail-cta">
        <div>
          <h2>Detayları birlikte konuşalım.</h2>
          <p>
            Tarih ve kişi sayısını paylaşın; ihtiyacınıza uygun bir plan
            hazırlayalım.
          </p>
        </div>
        <button className="btn" onClick={() => setRequest(true)}>
          {info.cta}
          <ArrowRight size={17} />
        </button>
      </section>
      {request && (
        <RequestForm
          kind={info.kind}
          initialNotes={service.title + " hizmeti için teklif almak istiyorum."}
          onClose={() => setRequest(false)}
        />
      )}
    </>
  );
}
