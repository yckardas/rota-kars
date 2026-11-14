// Rehber yazıları (/rehber): Kars tanıtımı, aktiviteler (atlı kızak, kar motoru…) ve
// gezi notları. Panelden yazılır, taslak/yayında durumu vardır. Gövde sade bir
// Markdown alt kümesidir (başlık, paragraf, liste, alıntı, kalın, bağlantı, görsel);
// istemci bunu güvenli biçimde (HTML'e dönüştürmeden) çizer.
// Yayındaki yazıların özeti bellekte de tutulur: SEO başlıkları ve site haritası
// (server/seo.mjs) eşzamanlı okur. (Tek sunucu örneği varsayılır.)
import { randomUUID } from "node:crypto";
import { AppError } from "./store.mjs";

export const ARTICLE_CATEGORIES = {
  aktivite: "Aktivite",
  rehber: "Gezi rehberi",
  kultur: "Tarih ve kültür",
};
const published = new Map();
export const publishedArticle = (slug) => published.get(slug) || null;
export const publishedArticles = () => [...published.values()];

// Türkçe başlıktan adres: "Çıldır'da atlı kızak" → "cildirda-atli-kizak".
export const slugify = (s) =>
  String(s || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşü]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[c])
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");

const summaryOf = (a) => ({
  id: a.id,
  slug: a.slug,
  title: a.title,
  summary: a.summary,
  category: a.category,
  cover: a.cover,
  tourIds: a.tour_ids || [],
  publishedAt: a.published_at,
  updatedAt: a.updated_at,
});
const fullOf = (a) => ({ ...summaryOf(a), body: a.body, status: a.status, author: a.author || null });

// İlk yayında panelde inceleme için taslak olarak eklenen yazılar (bkz. articles-seed.mjs).
export async function createArticles(db, { clock, seed = [] }) {
  await Promise.all([
    db.index("articles", { slug: 1 }, { unique: true }),
    db.index("articles", { status: 1, published_at: -1 }),
  ]);
  const marker = "articles_seed_2026_11";
  if (seed.length && !(await db.one("integration_settings", { _id: marker }))) {
    for (const a of seed)
      if (!(await db.one("articles", { slug: a.slug }))) {
        const id = randomUUID();
        await db.insert("articles", id, {
          id,
          slug: a.slug,
          title: a.title,
          summary: a.summary,
          category: a.category,
          cover: a.cover,
          body: a.body,
          tour_ids: a.tourIds || [],
          status: "draft",
          published_at: null,
          created_at: clock(),
          updated_at: clock(),
          author: "Rota Kars",
        });
      }
    await db.upsert("integration_settings", marker, { id: marker, body: { appliedAt: clock(), count: seed.length }, updated_at: clock() });
  }
  async function refresh() {
    const rows = await db.find("articles", { status: "published" }, { sort: { published_at: -1 } });
    published.clear();
    for (const a of rows) published.set(a.slug, summaryOf(a));
  }
  await refresh();
  return {
    refresh,
    async listPublic({ category, tourId } = {}) {
      return publishedArticles().filter(
        (a) => (!category || a.category === category) && (!tourId || a.tourIds.includes(tourId)),
      );
    },
    async getPublic(slug) {
      const a = await db.one("articles", { slug, status: "published" });
      if (!a) throw new AppError(404, "Yazı bulunamadı.");
      return fullOf(a);
    },
    async adminList() {
      return (await db.find("articles", {}, { sort: { updated_at: -1 } })).map(fullOf);
    },
    async save(input, actor) {
      const slug = input.slug || slugify(input.title);
      if (!slug) throw new AppError(400, "Başlıktan bir adres üretilemedi; adresi elle yazın.");
      const clash = await db.one("articles", { slug, ...(input.id ? { _id: { $ne: input.id } } : {}) });
      if (clash) throw new AppError(409, `"${slug}" adresi başka bir yazıda kullanılıyor.`);
      const old = input.id ? await db.one("articles", { _id: input.id }) : null;
      if (input.id && !old) throw new AppError(404, "Yazı bulunamadı.");
      const fields = {
        slug,
        title: input.title,
        summary: input.summary,
        category: input.category,
        cover: input.cover,
        body: input.body,
        tour_ids: input.tourIds,
        status: input.status,
        // İlk yayın tarihi korunur; taslağa çekilince sitede görünmez.
        published_at: input.status === "published" ? old?.published_at || clock() : old?.published_at || null,
        updated_at: clock(),
        author: actor?.name || old?.author || null,
      };
      const id = old?.id || randomUUID();
      if (old) await db.update("articles", { _id: id }, fields);
      else await db.insert("articles", id, { id, created_at: clock(), ...fields });
      await refresh();
      return fullOf(await db.one("articles", { _id: id }));
    },
    async remove(id) {
      if (!(await db.remove("articles", { _id: id }))) throw new AppError(404, "Yazı bulunamadı.");
      await refresh();
    },
  };
}
