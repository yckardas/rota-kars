// Vitrinde fotoğrafın yerine sessiz, döngüde oynayan kısa videolar (tur kimliğine göre).
// "portrait" telefonda (dar ekran), "landscape" geniş ekranda oynar; biri yoksa o ekranda
// fotoğraf kalır. Dosyalar public/videos/vitrin/ altında; bkz. oradaki README.
export type HeroVideo = { portrait?: string; landscape?: string };

const VIDEOS: Record<string, HeroVideo> = {
  "ani-cildir": { portrait: "/videos/vitrin/ani-cildir-dikey.mp4" },
};

export const heroVideo = (tourId: string): HeroVideo | undefined => VIDEOS[tourId];

// Veri tasarrufu açıksa ya da bağlantı çok yavaşsa video indirilmez.
export function lightConnection() {
  const c = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  return !!c && (c.saveData === true || /(^|-)2g$/.test(c.effectiveType ?? ""));
}
