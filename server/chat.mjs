import Anthropic from "@anthropic-ai/sdk";
import {
  business,
  tours,
  vehicle,
  features,
  services,
  fleet,
  cancellationPolicy,
} from "./catalog.mjs";
import { reviewSnapshot } from "./reviews.mjs";

const HANDOFF = "[[WHATSAPP]]";
const tl = (kurus) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(kurus / 100);
const normalize = (s) =>
  s
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i");

// Sistem talimatı katalogdan üretilir ve sabittir; böylece önbelleğe alınabilir.
export const knowledge = [
  `Firma: ${business.name}. ${business.founded} yılından beri hizmet veren, TÜRSAB ${business.tursabNo} belge numaralı A grubu seyahat acentesi. Adres: ${business.address}. Ofis: ${business.phone}, ${business.mobile}. E-posta: ${business.email}. WhatsApp: ${business.whatsappLabel}. Çalışma: ${business.hours}.`,
  `Google puanı: ${reviewSnapshot.rating} (${reviewSnapshot.total} değerlendirme).`,
  `Öne çıkanlar: ${features.map((f) => `${f.title} – ${f.text}`).join(" | ")}`,
  `İptal koşulları: ${cancellationPolicy}`,
  `Tur aracı: ${vehicle.passengerSeats}+${vehicle.driverSeats} VIP midibüs. Şoför yanındaki ön koltuk her zaman rehbere ayrılır. ${vehicle.sellableSeats} yolcu koltuğu online seçilebilir; koltuk 10 dakika tutulur, ön rezervasyon acente onayıyla kesinleşir. Ödeme tercihi %30 kapora veya tam ödeme; site üzerinden kartla tahsilat şu an yok, acente iletişime geçer.`,
  `Hizmetler: ${services.map((s) => `${s.title}: ${s.text}`).join(" | ")}`,
  `Şoförlü araç kiralama: turizm ${fleet.tourism.join(", ")}; VIP ${fleet.vip.join(", ")}. ${fleet.perks.join(", ")}.`,
  "Turlar:",
  ...tours.map(
    (t) =>
      `- ${t.name} (/turlar/${t.id}) · ${t.duration} · ${t.location} · kişi başı ${tl(t.price)}${t.inquiryOnly ? " · tarih için acente teyidi gerekir" : ` · online koltuk seçimi /rezervasyon/${t.id}`} · Kalkış ${t.departure}. ${t.summary} Dahil: ${t.included.join(", ")}. Hariç: ${t.excluded.join(", ")}. ${t.itinerary.map((i) => `${i.time} ${i.title}`).join("; ")}. Not: ${t.note}`,
  ),
].join("\n");

const SYSTEM = `Sen Rota Kars Turizm'in web sitesindeki misafir asistanısın. Ziyaretçilerin turlar, fiyatlar, programlar, koltuk seçimi, iptal, araç kiralama ve iletişim sorularını yanıtlarsın.

Bilgi kaynağın yalnızca aşağıdaki firma bilgisidir. Burada olmayan tarih, kontenjan, otel adı, indirim veya fiyatı uydurma; bunlar için acentenin WhatsApp hattına yönlendir. Fiyatlar kişi başıdır ve sefer tarihine göre değişebilir, bunu gerektiğinde belirt.

Ziyaretçinin dilinde yanıt ver (çoğunlukla Türkçe). Kısa ve sıcak ol: genelde 2–5 cümle, gerekirse kısa madde listesi. Markdown başlığı kullanma. Bir tura atıf yaparken sayfa yolunu (/turlar/...) yaz; site bunu bağlantıya çevirir.

Ziyaretçi rezervasyonu kesinleştirmek, özel/grup teklifi almak, bir insanla konuşmak istediğinde ya da soruyu bu bilgilerle yanıtlayamadığında yanıtının en sonuna tek başına ${HANDOFF} yaz. Bu, ekranda WhatsApp'a geçiş düğmesini gösterir.

<firma_bilgisi>
${knowledge}
</firma_bilgisi>`;

function localReply(text) {
  const q = normalize(text);
  const has = (...w) => w.some((x) => q.includes(x));
  const tour = tours.find((t) =>
    ({
      "ani-cildir": has("ani", "cildir", "sehir turu"),
      sarikamis: has("sarikamis", "kayak", "ski"),
      batum: has("batum", "gurcistan", "yurt disi"),
      "van-gunubirlik": has("van") && has("gunubirlik", "tek gun"),
      van: has("van") && has("konaklama", "ishak", "tuz", "2 gun", "iki gun"),
      "van-havzasi": has("havza", "nemrut", "ahlat", "tatvan", "bitlis"),
    })[t.id],
  ) || (has("van") ? tours.find((t) => t.id === "van-gunubirlik") : null);
  if (tour)
    return {
      text: `${tour.name}: ${tour.duration}, kişi başı ${tl(tour.price)}. ${tour.summary}\n\nDahil: ${tour.included.join(", ")}.\nHariç: ${tour.excluded.join(", ")}.\n\nDetaylar: /turlar/${tour.id}${tour.inquiryOnly ? "" : `\nKoltuk seçimi: /rezervasyon/${tour.id}`}`,
      handoff: tour.inquiryOnly,
    };
  if (has("koltuk", "arac", "midibus", "minibus", "rehber", "kac kisi"))
    if (has("kirala", "transfer", "otobus"))
      return {
        text: `Şoförlü araç kiralıyoruz. Turizm araçları: ${fleet.tourism.join(", ")}. VIP: ${fleet.vip.join(", ")}. Tüm araçlar ${fleet.perks.join(", ").toLocaleLowerCase("tr-TR")}. Teklif için WhatsApp'tan yazabilirsiniz.`,
        handoff: true,
      };
    else
      return {
        text: `Turlarımız ${vehicle.passengerSeats}+${vehicle.driverSeats} VIP midibüsle yapılır. Şoför yanındaki ön koltuk rehberinize ayrılır; ${vehicle.sellableSeats} yolcu koltuğundan dilediğinizi rezervasyon sırasında seçebilirsiniz.`,
        handoff: false,
      };
  if (has("kirala", "transfer", "otobus", "kongre", "seminer"))
    return {
      text: `Şoförlü araç kiralama ve transfer hizmetimiz var. Turizm araçları: ${fleet.tourism.join(", ")}. VIP: ${fleet.vip.join(", ")}. Size özel teklif için WhatsApp'tan yazın.`,
      handoff: true,
    };
  if (has("iptal", "iade", "vazgec"))
    return {
      text: `${cancellationPolicy}\n\nÖn rezervasyonunuzu /rezervasyonum sayfasından sorgulayıp iptal edebilirsiniz.`,
      handoff: false,
    };
  if (has("odeme", "kapora", "kredi", "kart", "taksit", "doviz", "euro", "dolar"))
    return {
      text: "Tüm ödemeler Türk Lirası ile yapılır, yurt dışı turlarda bile kur riski yoktur. Ön rezervasyonda %30 kapora veya tam ödeme tercih edebilirsiniz; ödeme adımı için acentemiz sizinle iletişime geçer.",
      handoff: true,
    };
  if (has("adres", "nerede", "ofis", "telefon", "iletisim", "ulas", "saat"))
    return {
      text: `Ofisimiz: ${business.address}.\nTelefon: ${business.phone} · ${business.mobile}\nWhatsApp: ${business.whatsappLabel}\nE-posta: ${business.email}\n${business.hours}.`,
      handoff: true,
    };
  if (has("otel", "konaklama", "pansiyon", "kalmak", "kalacak"))
    return {
      text: "Turunuzun öncesinde veya sonrasında Kars'ta konaklamanızı planlayabiliriz. /konaklama sayfasından talep bırakın ya da WhatsApp'tan yazın.",
      handoff: true,
    };
  if (has("ozel tur", "kisiye ozel", "grup", "okul", "dernek", "kurum"))
    return {
      text: "Kişiye özel ve kurum/grup turları düzenliyoruz. Kişi sayınızı, tarihinizi ve gitmek istediğiniz rotayı WhatsApp'tan iletirseniz size özel program ve teklif hazırlayalım.",
      handoff: true,
    };
  if (has("yorum", "puan", "guven", "tursab"))
    return {
      text: `Google'da ${reviewSnapshot.total} değerlendirmede ${String(reviewSnapshot.rating).replace(".", ",")} puanımız var. ${business.founded}'dan beri TÜRSAB ${business.tursabNo} belge numaralı A grubu acenteyiz. Yorumları ana sayfanın sonunda görebilirsiniz.`,
      handoff: false,
    };
  if (has("tur", "fiyat", "ucret", "rota", "program", "nereye"))
    return {
      text:
        "Güncel rotalarımız:\n" +
        tours
          .map((t) => `• ${t.name} – ${tl(t.price)} (/turlar/${t.id})`)
          .join("\n") +
        "\n\nHangisini merak ediyorsunuz?",
      handoff: false,
    };
  if (has("merhaba", "selam", "iyi gunler", "hey"))
    return {
      text: "Merhaba, Rota Kars'a hoş geldiniz! Turlar, fiyatlar, koltuk seçimi veya araç kiralama hakkında ne sormak istersiniz?",
      handoff: false,
    };
  if (has("tesekkur", "sagol"))
    return { text: "Rica ederiz, iyi yolculuklar dileriz!", handoff: false };
  return {
    text: "Bu konuda en doğru bilgiyi ekibimiz verebilir. WhatsApp'tan yazarsanız hemen yardımcı olalım.",
    handoff: true,
  };
}

export function createChatService(env = process.env, client = null) {
  const enabled = Boolean(client || env.ANTHROPIC_API_KEY);
  const anthropic = enabled ? client || new Anthropic() : null;
  return {
    provider: enabled ? "claude" : "local",
    async reply(messages) {
      const last = messages[messages.length - 1].content;
      if (!anthropic) return { ...localReply(last), provider: "local" };
      try {
        const response = await anthropic.beta.messages.create({
          model: env.CHAT_MODEL || "claude-opus-5-5",
          max_tokens: 1500,
          output_config: { effort: "low" },
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: [
            {
              type: "text",
              text: SYSTEM,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages,
        });
        if (response.stop_reason === "refusal")
          return { ...localReply(last), provider: "local" };
        let text = response.content
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("")
          .trim();
        const handoff = text.includes(HANDOFF);
        text = text.replaceAll(HANDOFF, "").trim();
        if (!text) return { ...localReply(last), provider: "local" };
        return { text, handoff, provider: "claude" };
      } catch (error) {
        if (error instanceof Anthropic.APIError)
          console.error(`Chat API error ${error.status}`);
        else console.error("Chat unavailable");
        return { ...localReply(last), provider: "local" };
      }
    },
  };
}
