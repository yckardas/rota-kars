---
version: 1
slug: "src-pages-admin-tsx"
primary_target: "src/pages/Admin.tsx"
related_targets: ["mobile/www/offline.html"]
---

# Surface brief: agency panel (/yonetim)

Scope: the whole agency panel (Admin shell, all tabs, dialogs, toasts, login) and the Android wrapper's native parts (icon, splash, status bar, offline page). Public site out of scope.
Mode: Operate. Used equally at a desk and on a phone in the field, daylight. Build path: code-led.
Task: see pending work first, confirm/cancel bookings, record payments, run the day's departures (passengers, boarding), keep content current.
Must stay: every function, Turkish copy, role gating, URL tabs, Ctrl+K, toasts, confirmations.

## Direction contract

FORM: Ani Taşı (assigned by roll; seed:205c3d420f03db78)

THESIS: The panel is built like Ani's walls: courses of dressed black and red tufa set in pale mortar. It refuses the category default of white cards, grey ground and one blue accent.

OWN-WORLD: Black tufa shell (#24201D rail, near-black ink), cool pale stone ground (not cream), mortar-line hairlines instead of shadows on most surfaces, 4px corners like cut blocks. Red tufa is reserved for today and pending work. Lichen green for confirmed, ochre for waiting, stone grey for closed. Onest throughout, tabular numerals, tight 4px grid.

STORY: On opening, staff read what is waiting (pending, cancellation requests, new leads) and how full today's vehicles are, then act in one tap.

FIRST VIEWPORT: Black rail with grouped navigation, then a work band with live counts and today's departures. Each departure shows its seats as a course of stone blocks: red = sold, pale = free, black = guide.

SIGNATURE: The masonry course. Seat occupancy drawn as a row of blocks wherever a departure appears (overview, departures list, calendar, daily report). A thin two-tone tufa band edges the rail.

RISK: Texture turning into ornament. Stone appears only as occupancy, the rail edge and active markers; tables and forms stay plain and fast.
