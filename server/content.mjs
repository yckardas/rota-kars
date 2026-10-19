// Panelden düzenlenen site içerikleri: tur metinleri/fotoğrafları ve iletişim bilgileri.
// Varsayılanlar catalog.mjs'de kalır; düzenlemeler "site_content" koleksiyonunda tutulur
// ve açılışta/kayıtta katalogdaki nesnelerin üstüne yazılır. Böylece site, SEO etiketleri,
// sohbet botu ve bildirimler aynı güncel metni kullanır. (Tek sunucu örneği varsayılır.)
import { tours, business } from "./catalog.mjs";
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
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, structuredClone(obj[k])]));
const DEFAULT_TOURS = new Map(tours.map((t) => [t.id, pick(t, TOUR_FIELDS)]));
const DEFAULT_BUSINESS = pick(business, BUSINESS_FIELDS);

export async function createContent(db, { clock = Date.now } = {}) {
  async function apply() {
    const docs = new Map((await db.find("site_content", {})).map((d) => [d.id, d]));
    for (const tour of tours)
      Object.assign(tour, structuredClone(DEFAULT_TOURS.get(tour.id)), docs.get("tour:" + tour.id)?.fields || {});
    Object.assign(business, structuredClone(DEFAULT_BUSINESS), docs.get("business")?.fields || {});
  }
  await apply();
  const info = async (key, current, defaults) => {
    const doc = await db.one("site_content", { _id: key });
    return {
      current,
      defaults,
      edited: Boolean(doc),
      updatedAt: doc?.updated_at || null,
      updatedBy: doc?.updated_by || null,
    };
  };
  return {
    apply,
    async tour(id) {
      const tour = tours.find((t) => t.id === id);
      if (!tour) throw new AppError(404, "Tur bulunamadı.");
      return info("tour:" + id, pick(tour, TOUR_FIELDS), DEFAULT_TOURS.get(id));
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
    async resetTour(id) {
      if (!DEFAULT_TOURS.has(id)) throw new AppError(404, "Tur bulunamadı.");
      await db.remove("site_content", { _id: "tour:" + id });
      await apply();
      return this.tour(id);
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
  };
}
