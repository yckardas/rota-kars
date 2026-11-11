import { Bus, MessageCircle } from "lucide-react";
import { useLang } from "../lib/i18n";
import { responsive } from "../lib/images";
import { whatsappLink } from "../lib/whatsapp";
import type { Catalog } from "../lib/types";
// Araç filosu ve şoförlü kiralama. Ana sayfadan Hizmetler sayfasına taşındı;
// ana sayfadaki "Kars'ta başka neler var?" bandı buraya (#filo) bağlanır.
export function FleetSection({ catalog }: { catalog: Catalog }) {
  const { t } = useLang();
  return (
    <section className="fleet-section" id="filo">
      <div className="container fleet-inner">
        <div className="fleet-photo">
          <img
            {...responsive(
              "/images/rota-bus.webp",
              "(max-width: 950px) 100vw, 55vw",
            )}
            alt={t("Rota Kars Tur logolu turizm otobüsü")}
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="fleet-copy">
          <h2>{t("Grubunuz kaç kişi olursa olsun, aracı bizde.")}</h2>
          <p>{catalog.fleet.note}</p>
          <div className="fleet-groups">
            <div>
              <small>{t("Turizm taşımacılığı")}</small>
              <div className="chips">
                {catalog.fleet.tourism.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
            </div>
            <div>
              <small>{t("VIP taşımacılık")}</small>
              <div className="chips">
                {catalog.fleet.vip.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
            </div>
          </div>
          <ul className="fleet-perks">
            {catalog.fleet.perks.map((p) => (
              <li key={p}>
                <Bus size={15} /> {p}
              </li>
            ))}
          </ul>
          <a
            className="btn btn-outline"
            href={whatsappLink(
              catalog.business.whatsapp,
              t("Merhaba, şoförlü araç kiralama için teklif almak istiyorum."),
            )}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle size={17} /> {t("Araç için teklif alın")}
          </a>
        </div>
      </div>
    </section>
  );
}
