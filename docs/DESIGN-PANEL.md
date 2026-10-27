---
name: Rota Kars Yönetim (Ani Taşı)
description: Agency panel and Android wrapper. Ani wall masonry, black tufa shell, pale stone ground, red tufa for the day's work.
colors:
  tufa: "#24201d"
  tufa-2: "#2e2925"
  tufa-3: "#3b3430"
  tufa-black: "#110e0c"
  rail-mortar: "#4a413a"
  rail-text: "#ece6dc"  # panel ray yazısı; Android taş rengi #e4e8ea
  rail-muted: "#aaa093"
  red: "#9c3b2e"
  red-deep: "#7e2f25"
  red-wash: "#f4e5e1"
  lichen: "#4b6740"
  lichen-wash: "#e2eadc"
  ochre: "#8f611b"
  ochre-wash: "#f3e9d6"
  closed: "#6f6962"
  closed-wash: "#e4e6e7"
  ground: "#dfe2e3"
  surface: "#f6f7f7"
  surface-2: "#eceeef"
  field: "#fbfcfc"
  row-hover: "#eef0f1"
  mortar: "#c9ced0"
  mortar-soft: "#dde1e2"
  mortar-hover: "#aeb5b8"
  free: "#d6d9da"
  free-edge: "#b9bfc2"
  ink-strong: "#1f1b18"
  ink-soft: "#5e5750"
typography:
  display:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  figure:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.1
    fontFeature: "tnum"
  body:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  body-small:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.06em"
rounded:
  stone: "1px"
  tag: "3px"
  block: "4px"
  window: "6px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "28px"
  3xl: "36px"
components:
  button-primary:
    backgroundColor: "{colors.tufa}"
    textColor: "#ffffff"
    rounded: "{rounded.block}"
    padding: "0 16px"
    height: "38px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "{colors.tufa-3}"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-strong}"
    rounded: "{rounded.block}"
    padding: "0 16px"
    height: "38px"
  button-outline-hover:
    backgroundColor: "{colors.surface-2}"
  button-danger:
    backgroundColor: "{colors.red}"
    textColor: "#ffffff"
    rounded: "{rounded.block}"
    padding: "0 16px"
    height: "38px"
  button-danger-hover:
    backgroundColor: "{colors.red-deep}"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink-strong}"
    rounded: "{rounded.block}"
    padding: "8px 12px"
    height: "40px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-strong}"
    rounded: "{rounded.block}"
    padding: "0 12px"
    height: "32px"
  chip-active:
    backgroundColor: "{colors.tufa}"
    textColor: "#ffffff"
  status-tag-waiting:
    backgroundColor: "{colors.ochre-wash}"
    textColor: "{colors.ochre}"
    rounded: "{rounded.tag}"
    padding: "2px 8px"
    typography: "{typography.label}"
  status-tag-confirmed:
    backgroundColor: "{colors.lichen-wash}"
    textColor: "{colors.lichen}"
    rounded: "{rounded.tag}"
    padding: "2px 8px"
  status-tag-closed:
    backgroundColor: "{colors.closed-wash}"
    textColor: "{colors.closed}"
    rounded: "{rounded.tag}"
    padding: "2px 8px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.block}"
    padding: "16px 18px"
  rail:
    backgroundColor: "{colors.tufa}"
    textColor: "{colors.rail-text}"
    width: "256px"
  nav-item-active:
    backgroundColor: "{colors.tufa-3}"
    textColor: "#ffffff"
    rounded: "{rounded.block}"
    height: "34px"
  nav-badge:
    backgroundColor: "{colors.red}"
    textColor: "#ffffff"
    rounded: "{rounded.tag}"
    height: "18px"
  stone-free:
    backgroundColor: "{colors.free}"
    rounded: "{rounded.stone}"
    width: "15px"
    height: "11px"
  stone-sold:
    backgroundColor: "{colors.red}"
    rounded: "{rounded.stone}"
    width: "15px"
    height: "11px"
  stone-guide:
    backgroundColor: "{colors.tufa}"
    rounded: "{rounded.stone}"
    width: "15px"
    height: "11px"
  modal-header:
    backgroundColor: "{colors.tufa}"
    textColor: "{colors.rail-text}"
    padding: "12px 18px"
  toast:
    backgroundColor: "{colors.tufa}"
    textColor: "#ffffff"
    rounded: "{rounded.block}"
  toast-error:
    backgroundColor: "{colors.red-deep}"
---

<!-- Scope: the agency panel (/yonetim, everything under .rk-admin in src/admin.css) and the Android wrapper's native parts (mobile/android res, mobile/www/offline.html). The public site's system lives in docs/DESIGN.md and does not apply here; neither file overrides the other. -->

# Design System: Rota Kars Yönetim (Ani Taşı)

## Overview

**Creative North Star: "Ani Taşı" (the Ani wall)**

The panel is built like the walls of Ani: courses of dressed black and red tufa set in pale mortar. The shell is black tufa, the working ground is cool pale stone, and surfaces are flat dressed blocks divided by thin mortar lines instead of floating on shadows. It deliberately avoids the usual admin look of white cards on grey with one blue accent.

The stone shows up in only three places: seat occupancy drawn as a course of blocks, the two-tone tufa band along the rail edge (and at the top of the login form and the bottom of the offline page), and the single red stone marking the active tab. Everything else (tables, forms, lists) stays plain, dense and fast, because the panel is used at a desk and one-handed on a phone in daylight. Red tufa means today, waiting or needing attention. Lichen means confirmed, ochre means waiting on someone, and stone grey means closed.

Onest is the only typeface, numbers are always tabular, and corners are small and square-cut (4px), like cut blocks.

**Key Characteristics:**
- Black tufa rail and dark bars; cool pale stone ground (not cream, not white).
- Flat surfaces with 1px mortar hairlines; shadows only on things that float above the page.
- The masonry course (seat blocks) wherever a departure appears.
- Red tufa is scarce and has a meaning: today, pending, attention, the active marker, destructive actions.
- One family (Onest), tabular numerals, a dense 14px body.

## Colors

A warm black-and-red stone pair on a cool grey-white ground, plus three muted state colours taken from the same landscape (lichen, ochre, weathered stone).

### Primary
- **Black Tufa** (tufa): the shell. Rail background, primary buttons, the active chip and active desk tab, modal header bar, toasts, Android status/navigation bar, splash and launcher background. Its two lifted steps, **Tufa Lit** (tufa-2) and **Tufa Face** (tufa-3), are hover and active fills inside the rail and on dark controls.
- **Fired Black** (tufa-black) and **Rail Mortar** (rail-mortar): used only inside masonry bands and the launcher/splash courses. Fired Black is the dark block and Rail Mortar is the joint between blocks on dark ground. Rail Mortar also serves as the rail's scrollbar and the kbd border.

### Secondary
- **Red Tufa** (red): sold seats, the active-tab stone, nav badges, today's date cell, attention counts in the work band, "DOLU" on full departures, focus outline, caret, danger buttons, text-link hover.
- **Deep Red Tufa** (red-deep): alternating sold blocks so a course reads as masonry rather than a progress bar; danger hover; error toast; error text.
- **Red Wash** (red-wash): error alert background and text selection.

### Tertiary (state)
- **Lichen** (lichen) on **Lichen Wash** (lichen-wash): confirmed and completed, open sales, boarded passengers, success notices.
- **Ochre** (ochre) on **Ochre Wash** (ochre-wash): waiting and pending, info-note icons, row notes, warning banners.
- **Weathered Stone** (closed) on **Closed Wash** (closed-wash): cancelled, expired, no-show, inactive, closed operations.

### Neutral
- **Pale Stone Ground** (ground): page background behind everything in the main column.
- **Dressed Face** (surface): every card, table, list, editor, modal body and chip.
- **Shaded Face** (surface-2): table header row, money summary cells, empty calendar cells, hover fill for ghost controls.
- **Field Face** (field): input background, a touch lighter than the surface so fields read as cut-in.
- **Row Hover** (row-hover): hover fill for clickable rows and work-band cells.
- **Mortar** (mortar): every outer border on surfaces, inputs and chips, plus the 1px gap colour of joined grids (work band, money summary).
- **Soft Mortar** (mortar-soft): inner row dividers in tables and lists, and calendar grid joints.
- **Hover Mortar** (mortar-hover): hover border on inputs, chips and outline buttons; also the scrollbar thumb.
- **Limestone** (free) with **Limestone Edge** (free-edge): empty seat blocks and the empty part of the weekly fill bar.
- **Ink** (ink-strong): headings and body text. **Ink Soft** (ink-soft): secondary text, table header labels, dates.
- **Rail Text** (rail-text) / **Rail Muted** (rail-muted): text on Black Tufa. Rail Text also serves as the Android launcher and splash glyph colour (`rota_stone`).

### Named Rules
**The Red Tufa Rule.** Red appears only for today's work, pending or full counts, sold seats, the single active marker, focus, and destructive actions. Never use it for decoration, headings or generic emphasis.

**The Cool Ground Rule.** The ground is cool pale stone (ground, surface). Never warm it toward cream; the warmth belongs to the tufa.

## Typography

**Display Font:** Onest (with Arial, sans-serif)
**Body Font:** Onest (with Arial, sans-serif)

**Character:** A single plain, slightly geometric sans with tabular numerals on the whole panel (`font-variant-numeric: tabular-nums`), so times, seat counts and money line up in columns. Hierarchy comes from size and weight 600, not from a second typeface.

### Hierarchy
- **Display** (600, 28px, 1.15; 24px under 760px): page title in the main header and on login.
- **Headline** (600, 18px, 1.3): section and editor headings. The booking window title runs larger (22px) and confirm dialogs at 19px; overview section headings at 16px.
- **Title** (600, 15px, 1.35): card and calendar headings.
- **Figure** (600, 24px, 1.1; 20px on phone): work-band counts; departure times at 18px; money totals at 18px.
- **Body** (400, 14px, 1.5): tables, lists, inputs, buttons. Inputs go up to 16px on phones to avoid zoom.
- **Body Small** (500, 13px): field labels, chips, text links, rail search, small buttons; secondary lines at 12.5px.
- **Label** (600, 12px, 0.06em tracking, uppercase): table column headers, weekday headers and phone-card cell labels (11px) only. Rail group headings use 11px/600 with 0.1em tracking in sentence case.

### Named Rules
**The One Stone Rule.** One family, Onest. Any contrast comes from weight 600 and size, never from a display face.

**The Tabular Rule.** Every number in the panel uses tabular figures; columns of times, seats and amounts must align.

## Layout

A two-part shell: a sticky 256px black rail on the left and a fluid main column (`minmax(0, 1fr)`) with 28px top / 36px side / 56px bottom padding. The rail holds the wordmark, the Ctrl+K search button, grouped navigation (groups separated by 18px), and the user block at the bottom.

The Overview opens with the **work band**: four equal cells joined by 1px mortar gaps inside one bordered block (two columns on phones), each a large count plus a label, linking to its list. Below it, today's departures form a list whose rows use a grid of time | tour and meeting point | seat course | action. This sits in one row when its container is 820px or wider (container query), and otherwise stacks the course under the info.

Spacing is dense and mostly on a 4px rhythm (4, 8, 12, 16, 20, 28, 36). Half-steps of 14, 18 and 22px appear in padding for optical balance. Sections are separated by 28px.

Under 760px the rail is hidden and replaced by a black bottom tab bar. "More" opens the rail as a full overlay with 48px nav rows. Main padding drops to 18px/14px. Tables become stacked stone cards (each row bordered, with uppercase cell labels), form grids collapse to one column, and touch targets grow (buttons 42px, small buttons 38px, inputs 44px, chips 36px).

## Elevation & Depth

Flat by default. Surfaces sit on the ground as dressed blocks: depth comes from tone (ground → surface → surface-2) and 1px mortar borders, never from shadow. Only elements that genuinely float above the page cast a shadow, and those shadows are soft, warm-black and diffuse.

### Shadow Vocabulary
- **Window** (`box-shadow: 0 24px 64px #14100e47`): modals and the booking window, over a `#1a1613a6` backdrop without blur.
- **Toast** (`box-shadow: 0 12px 32px #14100e40`): toasts.
- **Tab bar lift** (`box-shadow: 0 -8px 24px #14100e33`): phone bottom tab bar.
- **Field focus halo** (`box-shadow: 0 0 0 3px #9c3b2e22`): focused inputs, together with a Black Tufa border.

### Named Rules
**The Mortar Not Shadow Rule.** Cards, tables, lists, editors and chips have `box-shadow: none` and a 1px mortar border. A shadow means the element floats (window, toast, tab bar); nothing else gets one.

## Shapes

Square-cut blocks. The standard corner is 4px (block) for buttons, inputs, chips, cards, tables and toasts. Status tags, nav badges, initials and hotel thumbnails use 3px (tag). Seat stones, the active-tab stone and the weekly fill bar use 1px (stone), so they read as masonry, not pills. Floating windows and the command palette use 6px (window). Nothing is fully rounded.

Joined grids (work band, money summary, calendar) are made by setting the container background to mortar with a 1px gap, so the joints are real mortar lines between blocks. Empty states use a dashed mortar border.

### Named Rules
**The Cut Block Rule.** No pills and no radius above 6px. If an element reads as a soft lozenge, it is outside this world.

## Components

### Buttons
Solid and quick, with a small physical press.
- **Shape:** cut block corner (4px), 38px tall (42px on phone), 0 16px padding, 14px/500.
- **Primary:** Black Tufa fill, white text; hover lifts to Tufa Face.
- **Outline:** Dressed Face fill, Mortar border, Ink text; hover to Shaded Face with Hover Mortar border.
- **Danger:** Red Tufa fill; hover Deep Red Tufa. Used only for irreversible actions behind a confirm dialog.
- **Small:** 32px tall (38px on phone), 0 12px, 13px.
- **States:** press moves the button down 1px (`translateY(1px)`, 0.1s); transitions 0.15s on background/border; disabled at 45% opacity; focus is a 2px Red Tufa outline offset 2px (shared by every interactive element).
- **Icon button:** 34px square, 4px corner, Shaded Face on hover.
- **Text link:** Ink 13px/500; hover turns Red Tufa and underlines (3px offset).

### Chips (status filters)
- **Style:** Dressed Face, Mortar border, 4px corner, 32px tall, 13px/500.
- **State:** hover gets the Hover Mortar border; active fills Black Tufa with white text, like the active desk tab.

### Status tags
Small flat stones of state colour: 3px corner, 2px 8px padding, 12px/600, wash background with full-strength text. Ochre is the default (waiting), Lichen is confirmed or completed, Weathered Stone is cancelled, expired, no-show or inactive. Red is not a status tag colour; red marks attention in counts, not states.

### Cards / Containers
- **Corner Style:** 4px.
- **Background:** Dressed Face on the Pale Stone ground.
- **Shadow Strategy:** none (see Elevation).
- **Border:** 1px Mortar; inner row dividers 1px Soft Mortar. A new request card's border warms to `#d7b3aa`.
- **Internal Padding:** 16px 18px for cards, 20px 22px for editors, 12px 16px for list rows.

### Tables
Bordered block with a Shaded Face header row (uppercase Label, Ink Soft), 10px 14px header cells, 12px 14px body cells, Soft Mortar row joints, and a Row Hover fill on clickable rows. Secondary lines under a cell are 12.5px Ink Soft. On phones each row becomes its own bordered stone card.

### Inputs / Fields
- **Style:** Field Face, 1px Mortar border, 4px corner, 40px tall (44px and 16px text on phone), 8px 12px padding; labels 13px/500 with a 6px gap. Placeholder `#776f67`. Checkboxes and radios use Black Tufa as accent colour.
- **Hover:** Hover Mortar border.
- **Focus:** Black Tufa border plus the faint red halo (Field focus halo); no browser outline.
- **Error:** Deep Red Tufa text at 13px; alert blocks on Red Wash with a `#e2c2ba` border.

### Navigation
- **Rail (desk):** Black Tufa, 256px, sticky full height. Wordmark "ROTA KARS" at 15px/600 tracked 0.26em, with "Acente yönetimi" beneath in Rail Muted. Group headings are 11px/600 Rail Muted. Items are 34px rows, 13.5px, `#d8d0c4` text with Rail Muted icons; hover fills Tufa Lit with white text. **Active** fills Tufa Face, white 600 text, with a single 6×12px Red Tufa stone on the left edge. Nav badges are Red Tufa tags (3px corner, 18px tall, 12px/600).
- **Rail edge:** a 6px vertical masonry band on the rail's right edge: alternating Red Tufa, Fired Black and Deep Red Tufa blocks (16–24px) separated by 2px Rail Mortar joints.
- **Tab bar (phone):** Black Tufa bar, 11.5px Rail Muted labels; active turns white with a 22×4px Red Tufa stone at the top edge. Badges get a 2px tufa ring.

### The Masonry Course (signature)
Seat occupancy drawn as a row of blocks wherever a departure appears: overview, departures list, calendar and daily report. The guide seat is one Black Tufa block, set apart by a 4px gap (3px in the small size). Sold seats are Red Tufa, with every third block in Deep Red Tufa so the row reads as laid stone. Free seats are Limestone with an inset Limestone Edge hairline. Blocks are 15×11px with 2px gaps (sm 9×7, xs 5×5 with 1px gaps, 11×10 on phones), all at a 1px corner. The course is one image with an aria-label giving "sold/total". A count sits next to it; when full, the count turns Red Tufa uppercase ("DOLU").

The same course appears in the weekly fill bar (6px Limestone track, Red Tufa fill), the login form's 6px top band, and the offline page's footer band. The offline page's "broken wall" course has one missing block drawn as an empty mortar outline.

### Windows, toasts, command palette
Modals have a 6px corner and a Tufa Face border, with a Black Tufa header strip (13px/600, Rail Text) above a Dressed Face body. The money summary is a joined mortar grid of Shaded Face cells with 18px/600 figures. Desk tabs inside the window are 13.5px/500 Ink Soft and turn Black Tufa with white text when active. Toasts are Black Tufa with a pale lichen icon (`#b9d1a9`), or Deep Red Tufa for errors. The command palette marks its active row with Shaded Face and a red icon.

### Android shell
Status bar, navigation bar, window background and splash background are all Black Tufa with light icons. The launcher icon is a Rail Text rose/compass glyph on Black Tufa above a band of red, deep red and black blocks with Rail Mortar joints (the adaptive background). The monochrome icon is the glyph alone. The splash shows the same glyph over a single short course. The offline page is a Black Tufa screen with the tracked wordmark, a 26px/600 heading, a full-width 52px Rail Text button with Black Tufa text, and the masonry footer band.

## Do's and Don'ts

### Do:
- **Do** draw seat occupancy as the masonry course (guide block, red sold, limestone free) everywhere a departure is shown.
- **Do** separate surfaces with 1px Mortar borders and joined 1px-gap grids, keeping cards and tables at `box-shadow: none`.
- **Do** keep Red Tufa for today, pending or full counts, sold seats, the one active marker, focus and destructive actions.
- **Do** use Lichen, Ochre and Weathered Stone tags for confirmed, waiting and closed, always on their own wash.
- **Do** use Onest with tabular numerals for all panel text and figures.
- **Do** grow touch targets under 760px (buttons 42px, inputs 44px with 16px text, nav rows 48px).

### Don't:
- **Don't** use white cards on a grey ground with a single blue accent; that is the category default this world refuses.
- **Don't** add drop shadows to cards, tables, lists or chips; shadow is reserved for windows, toasts and the phone tab bar.
- **Don't** spread stone texture onto tables, forms or backgrounds. Masonry appears only as occupancy, the rail edge (and its login/offline echoes) and active markers.
- **Don't** use pills or radii above 6px.
- **Don't** warm the ground toward cream or bring in the public site's navy, gold or Marcellus. The public site's system stays in docs/DESIGN.md.
