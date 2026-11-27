// Panelden düzenlenen site içerikleri: tur metinleri/fotoğrafları, hizmet sayfalarındaki
// araçlar, iletişim bilgileri ve sitenin en üstündeki duyuru şeridi.
// Varsayılanlar catalog.mjs'de kalır; düzenlemeler "site_content" koleksiyonunda tutulur
// ve açılışta/kayıtta katalogdaki nesnelerin üstüne yazılır. Böylece site, SEO etiketleri,
// sohbet botu ve bildirimler aynı güncel metni kullanır. (Tek sunucu örneği varsayılır.)
import { isDeepStrictEqual } from "node:util";
import { tours, business, services } from "./catalog.mjs";
import { en } from "./catalog-en.mjs";
import { AppError } from "./store.mjs";

export const TOUR_FIELDS = [
  "name",
  "subtitle",
  "category",
  "duration",
  "location",
  "season",
  "departure",
  "end",
  "price",
  "summary",
  "image",
  "gallery",
  "included",
  "excluded",
  "itinerary",
  "note",
  // Gerekli belgeler ve önemli notlar (kimlik, pasaport, muvafakatname, harç...):
  // tur sayfasında ve rezervasyonda dikkat çeken kutuda, her satır bir madde.
  "documents",
  // Asgari katılımcı sayısı ve bu sayıya ulaşılamazsa turun en geç kaç saat önce
  // iptal edileceği. 0 = belirlenmedi. Ön bilgilendirme formu ve sözleşmede yazılır.
  "minParticipants",
  "minNoticeHours",
  // Kart fotoğrafındaki şerit yazısı; boşsa güzergâhtaki yer adı (ör. "Bakü") yazar.
  "cardLabel",
];
export const BUSINESS_FIELDS = [
  "phone",
  "mobile",
  "email",
  "address",
  "hours",
  "whatsapp",
  "whatsappLabel",
  "instagram",
  "facebook",
  "mapsUrl",
];
// Sitenin en üstündeki duyuru şeridi (kampanya, yeni rota, bayram programı...).
// Kapalıyken ya da metin boşken sitede görünmez.
export const ANNOUNCEMENT_FIELDS = ["enabled", "text", "textEn", "link"];
// Hizmet sayfasındaki araç kartları: [{ name, photos: [yol, ...] }], ilk fotoğraf kapak.
export const SERVICE_FIELDS = ["vehicles"];
const DEFAULT_ANNOUNCEMENT = { enabled: false, text: "", textEn: "", link: "" };
export const announcement = structuredClone(DEFAULT_ANNOUNCEMENT);
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, structuredClone(obj[k])]));
const DEFAULT_TOURS = new Map(
  tours.map((t) => [t.id, { minParticipants: 0, minNoticeHours: 0, documents: [], cardLabel: "", ...pick(t, TOUR_FIELDS) }]),
);
const DEFAULT_BUSINESS = pick(business, BUSINESS_FIELDS);
const DEFAULT_SERVICES = new Map(services.map((s) => [s.id, { vehicles: [], ...pick(s, SERVICE_FIELDS) }]));
// Kod içindeki turlar; panelden kopyalanan turlar (custom_tours) bunlara eklenir.
const BUILT_IN = new Set(tours.map((t) => t.id));
// Kopyaya kaynaktan geçen, panelde düzenlenmeyen alanlar.
const BASE_FIELDS = ["inquiryOnly", "demandByDefault"];
// Kopya turun adresi: /turlar/<id>.
export const TOUR_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// "Varsayılana dön"ün dokunmadığı satış ve sözleşme koşulları.
const KEPT_ON_RESET = ["price", "minParticipants", "minNoticeHours"];

// /en sürümünün çevirileri (catalog-en.mjs) varsayılan Türkçe metne göre yazılmıştır.
// Panelden değiştirilen alanın çevirisi eskimiş olur (ör. "fiyata dahil"den çıkarılan bir
// hizmeti hâlâ vaat eder); o alan için eski çeviri yerine paneldeki güncel metin verilir.
const fresh = (translated, current, defaults) =>
  Object.fromEntries(
    Object.entries(translated).map(([k, v]) => [
      k,
      k in defaults && !isDeepStrictEqual(current[k], defaults[k]) ? structuredClone(current[k]) : v,
    ]),
  );
export function currentEn() {
  return {
    ...en,
    business: fresh(en.business, business, DEFAULT_BUSINESS),
    tours: Object.fromEntries(
      Object.entries(en.tours).map(([id, x]) => {
        const tour = tours.find((t) => t.id === id),
          defaults = DEFAULT_TOURS.get(id);
        return [id, tour && defaults ? fresh(x, tour, defaults) : x];
      }),
    ),
  };
}

export async function createContent(db, { clock = Date.now } = {}) {
  // Panelde kayıtlı eski varsayılan Ani setini yenile; özel fotoğraflara dokunma.
  const ani = DEFAULT_TOURS.get("ani-cildir");
  await db.update(
    "site_content",
    {
      _id: "tour:ani-cildir",
      "fields.image": "/images/tours/ani.webp",
      "fields.gallery": ["/images/tours/ani.webp", "/images/cildir.webp", "/images/kars.webp"],
    },
    { "fields.image": ani.image, "fields.gallery": ani.gallery },
  );
  // Panelden kopyalanan turlar ortak tur dizisine (kaynağın ve önceki kopyalarının
  // arkasına) eklenir; böylece rezervasyon, sefer, SEO ve bildirimler onları da bulur.
  // Kayıttan silinen kopya diziden de çıkar.
  async function syncCustomTours() {
    const rows = await db.find("custom_tours", {}, { sort: { created_at: 1 } }),
      wanted = new Set(rows.map((r) => r.id));
    for (let i = tours.length - 1; i >= 0; i--)
      if (!BUILT_IN.has(tours[i].id) && !wanted.has(tours[i].id)) {
        DEFAULT_TOURS.delete(tours[i].id);
        tours.splice(i, 1);
      }
    for (const row of rows) {
      DEFAULT_TOURS.set(row.id, structuredClone(row.defaults));
      let tour = tours.find((t) => t.id === row.id);
      if (!tour) {
        tour = { id: row.id };
        const after = tours.reduce((at, t, i) => (t.id === row.source_id || t.sourceId === row.source_id ? i : at), tours.length - 1);
        tours.splice(after + 1, 0, tour);
      }
      Object.assign(tour, structuredClone(row.base || {}), {
        source: "",
        custom: true,
        hidden: Boolean(row.hidden),
        sourceId: row.source_id,
      });
    }
  }
  async function apply() {
    await syncCustomTours();
    const docs = new Map((await db.find("site_content", {})).map((d) => [d.id, d]));
    for (const tour of tours) {
      Object.assign(tour, structuredClone(DEFAULT_TOURS.get(tour.id)), docs.get("tour:" + tour.id)?.fields || {});
      // Kopyada yurt dışı/yurt içi kategoriden gelir (ücretsiz iptal süresi, sözleşme dili).
      if (tour.custom) tour.abroad = tour.category === "Yurt dışı";
    }
    for (const service of services)
      Object.assign(service, structuredClone(DEFAULT_SERVICES.get(service.id)), docs.get("service:" + service.id)?.fields || {});
    Object.assign(business, structuredClone(DEFAULT_BUSINESS), docs.get("business")?.fields || {});
    Object.assign(announcement, structuredClone(DEFAULT_ANNOUNCEMENT), docs.get("announcement")?.fields || {});
  }
  await apply();
  const info = async (key, current, defaults) => {
    const doc = await db.one("site_content", { _id: key });
    return {
      current,
      defaults,
      // Yalnız fiyat / asgari katılımcı kalan kayıt (metin sıfırlanmış) düzenlenmiş içerik sayılmaz.
      edited: Boolean(doc) && Object.keys(doc.fields || {}).some((k) => !KEPT_ON_RESET.includes(k)),
      updatedAt: doc?.updated_at || null,
      updatedBy: doc?.updated_by || null,
    };
  };
  const meta = (t) => ({ id: t.id, name: t.name, custom: Boolean(t.custom), hidden: Boolean(t.hidden), sourceId: t.sourceId || null });
  const copyOnly = (id) => {
    if (BUILT_IN.has(id)) throw new AppError(409, "Bu işlem yalnız panelden kopyalanan turlarda yapılabilir.");
    const tour = tours.find((t) => t.id === id);
    if (!tour) throw new AppError(404, "Tur bulunamadı.");
    return tour;
  };
  return {
    apply,
    // Açılıştaki gibi kopyaları kayıttan yeniden yükler (testlerde yeniden başlatma).
    reload: apply,
    // Paneldeki tur listesi: taslak kopyalar dahil.
    listTours: () => tours.map(meta),
    async tour(id) {
      const tour = tours.find((t) => t.id === id);
      if (!tour) throw new AppError(404, "Tur bulunamadı.");
      return { ...(await info("tour:" + id, pick(tour, TOUR_FIELDS), DEFAULT_TOURS.get(id))), tour: meta(tour) };
    },
    // Turu yeni bir tur olarak kopyalar: içerik (paneldeki güncel hâliyle) ve araç/satış
    // ayarı kaynaktan gelir, seferler gelmez. Kopya taslak başlar; "Yayınla" ile sitede görünür.
    async copyTour(sourceId, { id, name }, actor) {
      const source = tours.find((t) => t.id === sourceId);
      if (!source) throw new AppError(404, "Tur bulunamadı.");
      if (tours.some((t) => t.id === id) || (await db.one("custom_tours", { _id: id })))
        throw new AppError(409, "Bu adres başka bir turda kullanılıyor. Farklı bir adres yazın.");
      const ops = await db.one("tour_operations", { _id: sourceId });
      await db.transaction(async () => {
        await db.insert("custom_tours", id, {
          id,
          source_id: sourceId,
          hidden: true,
          base: pick(source, BASE_FIELDS),
          defaults: { ...pick(source, TOUR_FIELDS), name },
          created_at: clock(),
          created_by: actor?.name || null,
        });
        if (ops) {
          const { _id, ...rest } = ops;
          await db.insert("tour_operations", id, { ...rest, tour_id: id });
        }
      });
      await apply();
      return this.tour(id);
    },
    async setTourHidden(id, hidden) {
      copyOnly(id);
      await db.update("custom_tours", { _id: id }, { hidden: Boolean(hidden) });
      await apply();
      return this.tour(id);
    },
    // Seferi olan kopya silinmez (rezervasyon ve raporlar tur adını kullanır); taslağa alınır.
    async deleteTour(id, { force = false } = {}) {
      copyOnly(id);
      if (!force && (await db.count("departures", { tour_id: id })))
        throw new AppError(409, "Bu turun seferleri var; silmek yerine taslağa alın.");
      await db.remove("custom_tours", { _id: id });
      await db.remove("site_content", { _id: "tour:" + id });
      await db.remove("tour_operations", { _id: id });
      await apply();
      return { ok: true };
    },
    async saveTour(id, fields, actor) {
      if (!DEFAULT_TOURS.has(id)) throw new AppError(404, "Tur bulunamadı.");
      await db.upsert("site_content", "tour:" + id, {
        id: "tour:" + id,
        fields: pick(fields, TOUR_FIELDS),
        updated_at: clock(),
        updated_by: actor?.name || null,
      });
      await apply();
      return this.tour(id);
    },
    // keepPrice: paneldeki "Varsayılana dön" yalnız metin ve fotoğrafları geri alır.
    // Fiyat satışı belirler (varsayılanı 0 olan tur satıştan düşer), o yüzden korunur.
    async resetTour(id, { keepPrice = false } = {}) {
      if (!DEFAULT_TOURS.has(id)) throw new AppError(404, "Tur bulunamadı.");
      const doc = keepPrice ? await db.one("site_content", { _id: "tour:" + id }) : null,
        defaults = DEFAULT_TOURS.get(id),
        kept = Object.fromEntries(
          KEPT_ON_RESET.filter((k) => typeof doc?.fields?.[k] === "number" && doc.fields[k] !== defaults[k]).map((k) => [
            k,
            doc.fields[k],
          ]),
        );
      if (Object.keys(kept).length) await db.update("site_content", { _id: "tour:" + id }, { fields: kept });
      else await db.remove("site_content", { _id: "tour:" + id });
      await apply();
      return this.tour(id);
    },
    listServices() {
      return services.map((s) => ({ id: s.id, title: s.title }));
    },
    async service(id) {
      const service = services.find((s) => s.id === id);
      if (!service) throw new AppError(404, "Hizmet bulunamadı.");
      return { ...(await info("service:" + id, pick(service, SERVICE_FIELDS), DEFAULT_SERVICES.get(id))), title: service.title };
    },
    async saveService(id, fields, actor) {
      if (!DEFAULT_SERVICES.has(id)) throw new AppError(404, "Hizmet bulunamadı.");
      await db.upsert("site_content", "service:" + id, {
        id: "service:" + id,
        fields: pick(fields, SERVICE_FIELDS),
        updated_at: clock(),
        updated_by: actor?.name || null,
      });
      await apply();
      return this.service(id);
    },
    async resetService(id) {
      if (!DEFAULT_SERVICES.has(id)) throw new AppError(404, "Hizmet bulunamadı.");
      await db.remove("site_content", { _id: "service:" + id });
      await apply();
      return this.service(id);
    },
    async business() {
      return info("business", pick(business, BUSINESS_FIELDS), DEFAULT_BUSINESS);
    },
    async saveBusiness(fields, actor) {
      await db.upsert("site_content", "business", {
        id: "business",
        fields: pick(fields, BUSINESS_FIELDS),
        updated_at: clock(),
        updated_by: actor?.name || null,
      });
      await apply();
      return this.business();
    },
    async announcement() {
      return info("announcement", pick(announcement, ANNOUNCEMENT_FIELDS), DEFAULT_ANNOUNCEMENT);
    },
    async saveAnnouncement(fields, actor) {
      await db.upsert("site_content", "announcement", {
        id: "announcement",
        fields: pick(fields, ANNOUNCEMENT_FIELDS),
        updated_at: clock(),
        updated_by: actor?.name || null,
      });
      await apply();
      return this.announcement();
    },
  };
}
