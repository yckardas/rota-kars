# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

The agency panel also ships inside an Android wrapper (Capacitor, `mobile/`, package `com.rotakars.yonetim`) that loads the live `/yonetim` page; its own native parts are the launcher icon, splash, status bar and offline page.

## Users

- **Public site:** travellers planning small-group tours, transfers and stays around Kars (Ani, Çıldır, Sarıkamış, Doğu Ekspresi, Van, Batum).
- **Agency panel (`/yonetim`):** the Rota Kars team. Roles are owner (sahip), operations (operasyon) and guide (rehber). The panel is used equally at a desk (dense lists, monthly reports, content edits) and on a phone in the field: at the meeting point, in the vehicle, at the bus station (passenger list, boarding check, calls and WhatsApp, quick confirmations).

## Product Purpose

A Kars-based tour agency sells seat-based small-vehicle tours online and by phone. The panel is where bookings are confirmed, payments recorded by hand, departures planned with a vehicle per date, passengers boarded, leads followed up and site content kept current. Success means the team sees the day's work at a glance, never misses a pending booking or cancellation request, and runs a departure from a phone without paper.

## Positioning

Local operator with its own VIP minibuses/midibuses and real seat maps per departure; small groups, guide seat reserved. The deposit can be paid by card online (Vakıfbank virtual POS, 3D Secure; the booking is confirmed instantly) or by bank transfer/cash recorded by the agency.

## Operating Context

- Bookings come from the website (pre-reservation awaiting agency approval) and from phone/WhatsApp (entered by staff).
- Payments: card deposit online (auto-confirms the booking) or bank transfer/cash recorded by staff with a receipt reference; a deposit is needed before approval. While the bank reviews the integration the live site runs in preview mode (`PAYMENT_PREVIEW=1`): the card screen is shown but nothing is charged.
- Each departure has date, time, price, vehicle class and capacity, pickup point, guide.
- Field work: passenger list per departure, QR ticket scan, "boarded" and "no-show" marks.
- Push notifications reach owner/operations phones for new bookings, cancellations, leads and Google reviews.
- Turkish UI throughout.

## Capabilities and Constraints

- Stack: React 19 + Vite + Express + MongoDB, lucide icons, self-hosted fonts (Marcellus, Onest). Single global stylesheet `src/styles.css`.
- Roles gate tabs server-side; guides see only daily operations.
- Card payment: Vakıfbank virtual POS with 3D Secure (`server/vakifbank.mjs`); the card is entered on the site's own form and never stored. SMS not connected; SMTP optional.
- Legal texts (pre-information form, tour service contract, privacy, cookies, cancellation) are generated in `server/legal.mjs` and published at `/bilgilendirme`.
- Membership prize wheel: guests spin in the invite popup; weighted percent and fixed-TL prizes become a coupon after e-mail verification.
- Panel changes reach the Android app by deploy; a new APK is needed only for native changes.

## Brand Commitments

- Name: Rota Kars Turizm; gold "ROTA" logotype at `public/images/logo.png`.
- Public site: the user chose the "Hatıra Kartı" world on 2026-11-03 (multi-view Kars souvenir postcard: snow ground, white card stock, blue-black ink, airmail red only for the title band and actions, logo gold for prices; Marcellus + Onest stay pinned). Recorded in `docs/DESIGN.md`; the previous public look is kept on branch `yedek/mevcut-site-tasarimi`. The agency panel has its own world (`docs/DESIGN-PANEL.md`, chosen 2026-10-21).

## Evidence on Hand

- Real tour photography under `public/images/` and `public/images/tours/`.
- Google rating and reviews only from live Google data; never invent reviews, partner hotels or ratings.

## Product Principles

1. The day's pending work is visible before anything else.
2. Every field action works one-handed on a phone.
3. Money and status are never ambiguous: totals, paid, balance and state are always shown together.
4. Irreversible actions ask first; every action reports its result.
