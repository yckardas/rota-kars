// Fotoğraflar /images altında WebP olarak iki boyda tutulur: tam boy (≤1400 px)
// ve "-800" ekli kart boyu. Tarayıcı ekran genişliğine göre uygun olanı seçer.
const RESPONSIVE = /^\/images\/(tours\/[\w-]+|ani|rota-bus|stay)\.webp$/;

export function responsive(src: string, sizes = "(max-width: 760px) 100vw, 33vw") {
  if (!RESPONSIVE.test(src)) return { src };
  const small = src.replace(/\.webp$/, "-800.webp");
  return { src, srcSet: `${small} 800w, ${src} 1400w`, sizes };
}
