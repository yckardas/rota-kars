---
version: 1
slug: "src-pages-home-tsx"
primary_target: "src/pages/Home.tsx"
related_targets: ["src/pages/Tours.tsx","src/pages/TourDetail.tsx","src/pages/Booking.tsx","src/components/TourCard.tsx","src/components/Layout.tsx","src/renkli.css"]
---

# Halka açık site · Rota Renkleri

Scope: public site (home, tour list, tour detail, booking flow). Mode: Persuade (home, tour pages); booking steps lean Operate.
Audience: domestic travellers coming to Kars from outside, planning on a phone. Job: pick a route and date, see seats, leave a pre-reservation. Proof: real tour photography, real catalog prices and programs, live Google rating only when the API returns it, TÜRSAB A 13948, own VIP vehicles with seat maps.
Constraints: logo (black + copper) and Onest body stay; panel (`.rk-admin`) untouched. The customer asked (2026-11-20) for the colorful, animated general feel of cmrtur.com (not its pre-made banners): the category standard played straight, cmrtur's craft level as the bar. The previous postcard look is kept on branch `yedek/hatira-karti`.

## Direction contract
THESIS: Every route has its own colour. The page is a bright, moving travel shop where Kars routes arrive as colour-coded photo tiles, a turning hero and round category badges; colour tells the visitor what kind of day it is before they read.
OWN-WORLD: White ground, ink #1B1F2A. Orange-red #D63A12 is the action colour. One colour per tour type, darkened until white text passes AA: culture terracotta #A3401F, nature ice blue #0B7DB8, winter indigo #3B5BDB, overnight pine #0F7A50, day-trip amber #F59E0B (ink text on it, #B45309 as text on white), abroad magenta #C2255C. A 6px route stripe of five route colours at the page top and footer. Baloo 2 ExtraBold display, Onest body. 22px tile radius, pill buttons, a tone label band along the bottom of each photo, round tone price stickers.
STORY: The visitor sees a moving Kars view with a price sticker, finds the search bar riding on the hero, taps a round category or a coloured tile, and reaches dates and seats.
FIRST VIEWPORT: Slim white header. A wide rounded hero slider (4 routes, crossfade + slow zoom) with the route name huge in Baloo, the tour name under it, a "Turu incele" pill with the category chip beside it, and a rotated price sticker; a white pill search bar (Rota / Tarih / Yolcu / orange button) overlaps its bottom edge. Below: the row of round category badges.
FORM: Category standard (canon) at cmrtur.com craft level, pinned by the customer through the user; no concept roll was run because the brief pinned the direction. seed: none (brief-pinned canon)
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
