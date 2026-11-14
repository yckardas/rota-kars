import type { Catalog } from "./types";
// Katalogdaki Türkçe metinleri İngilizceleriyle değiştirir (server/catalog-en.mjs).
// Çevirisi olmayan alan Türkçe kalır; dizi alanları sıra numarasıyla eşlenir.
type En = NonNullable<Catalog["translations"]>["en"];
export function localizeCatalog(catalog: Catalog): Catalog {
  const en = catalog.translations?.en as En | undefined;
  if (!en) return catalog;
  return {
    ...catalog,
    business: { ...catalog.business, ...(en.business || {}) },
    features: catalog.features.map((f, i) => ({ ...f, ...(en.features?.[i] || {}) })),
    services: catalog.services.map((s) => ({ ...s, ...(en.services?.[s.id] || {}) })),
    fleet: { ...catalog.fleet, ...(en.fleet || {}) },
    cancellationPolicy: en.cancellationPolicy || catalog.cancellationPolicy,
    vehicle: { ...catalog.vehicle, ...(en.vehicle || {}) },
    tours: catalog.tours.map((t) => {
      const x = en.tours?.[t.id];
      if (!x) return t;
      return {
        ...t,
        ...x,
        // Araç adı da çevrilir; plan ve koltuklar aynı kalır.
        vehicle: { ...t.vehicle, ...(t.vehicle.id === catalog.vehicle.id ? en.vehicle || {} : {}) },
      } as typeof t;
    }),
    stories: catalog.stories.map((s) => {
      const x = en.stories?.[s.id];
      return x
        ? {
            ...s,
            title: x.title ?? s.title,
            location: x.location ?? s.location,
            scenes: s.scenes.map((scene, i) => ({
              ...scene,
              ...x.scenes?.[i],
            })),
          }
        : s;
    }),
  };
}
