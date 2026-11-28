// Keşif sayfaları (/kesfet/:yer): turdaki yerleri görsellerle ve animasyonla anlatan
// tanıtım sayfaları. Tur sayfası, tura bağlı keşif sayfalarına "…'yi keşfet" bağlantısı verir.
export type DiscoverPage = {
  slug: string;
  name: string;
  linkLabel: string;
  teaser: string;
  image: string;
  tourIds: string[];
};
export const DISCOVER_PAGES: DiscoverPage[] = [
  {
    slug: "ani",
    name: "Ani Harabeleri",
    linkLabel: "Ani’yi keşfet",
    teaser: "Bin bir kilisenin sessiz şehri: tarihi, yürüyüş rotası ve gitmeden bilmeniz gerekenler.",
    image: "/images/tours/ani.webp",
    tourIds: ["ani-cildir"],
  },
  {
    slug: "cildir",
    name: "Çıldır Gölü",
    linkLabel: "Çıldır’ı keşfet",
    teaser: "Buzun üstünde atlı kızak, buz balıkçıları ve gölün mevsim takvimi.",
    image: "/images/rehber/cildir-kizak.webp",
    tourIds: ["ani-cildir"],
  },
  {
    slug: "sarikamis",
    name: "Sarıkamış",
    linkLabel: "Sarıkamış’ı keşfet",
    teaser: "Sarıçam ormanları, kristal kar, kısa tarihi ve kayak dışında yapılacaklar.",
    image: "/images/kesfet/sarikamis-orman.webp",
    tourIds: ["sarikamis"],
  },
];
export const discoverFor = (tourId: string) => DISCOVER_PAGES.filter((p) => p.tourIds.includes(tourId));
