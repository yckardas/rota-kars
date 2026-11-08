---
version: 1
slug: "src-pages-home-tsx"
primary_target: "src/pages/Home.tsx"
related_targets: ["src/pages/Tours.tsx","src/pages/TourDetail.tsx","src/pages/Booking.tsx","src/components/TourCard.tsx","src/components/Layout.tsx","src/postcard.css"]
---

# Halka açık site · Hatıra Kartı

Scope: public site (home, tour list, tour detail, booking flow). Mode: Persuade (home, tour pages); booking steps lean Operate.
Audience: domestic travellers coming to Kars from outside, planning on a phone. Job: pick a route and date, see seats, leave a pre-reservation. Proof: real tour photography, real catalog prices and programs, live Google rating only when the API returns it, TÜRSAB A 13948, own VIP vehicles with seat maps.
Constraints: logo gold and Marcellus + Onest are pinned by the user; previous public look kept on branch `yedek/mevcut-site-tasarimi`; panel (`.rk-admin`) untouched.

## Direction contract
THESIS: The site is a Kars souvenir postcard, the old multi-view kind: one big view, smaller views beside it, a red title band, a white caption strip. It refuses the full-bleed hero photo with a floating search box that every tour agency ships.
OWN-WORLD: Snow ground #E9EEF1, white card stock with a 14px border and soft offset shadow, blue-black ink #1A2846, airmail red #C2342B only for the title band and actions, logo gold #8A6128 for prices and stamps. Thin airmail chevron edge at the top of the page. Marcellus for titles, form values and prices; Onest for labels and body. Square-ish corners (4-6px), no pills.
STORY: The visitor sees Kars at postcard scale, recognises the routes as views on one card, picks a view or fills the caption strip, and reaches dates and seats in one step. Tour pages read as the back of the card: program on one continuous route line, price as a stamp.
FIRST VIEWPORT: One white card fills the width under a slim header. Left two thirds: the Ani photo with the red band reading "Kars’tan selamlar." and one line beneath. Right third: a 2x2 of route views with name and starting price; clicking one selects that route. Below the photos, inside the card, the white strip holds Rota / Tarih / Yolcu and the red "Rotamı bul" button. Printed small line under it: TÜRSAB, years in Kars, payment note, live Google rating when present.
FORM: Multi-view souvenir postcard (variant A1 of the Kartpostal direction), position 7 on the grounded list, chosen by the user after a variant round. SEED REFERENCE seed:663eccf7c4654d8d
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
