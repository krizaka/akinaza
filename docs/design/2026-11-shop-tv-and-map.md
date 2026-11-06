# Design intervention — the shop's television and map (2026-11-03)

Issue: krizaka-internal#2330. Founder, 2026-11-03: « le style de la TV était horrible aussi, son design était moche alors
qu'on avait une excellente idée » and « la map grande … horrible ». The idea stays: a shop shows its own short videos as
its own little television. The look changes. The map gets a sensible size and place. The map's wheel bug is
krizaka-internal#2329 (not in this spec; `map.tsx` is not touched).

Subject: the public shop page `/[locale]/s/[slug]` (`components/shop/ShopPageView.tsx`): the `community` section in its
`tv` variant (`components/shop/ShopVideoTv.tsx` on `@krizaka/ui/retro-tv`) and the `visit` section (`@krizaka/ui`
`VisitSection` + `MapGate`). Register: the product's (Krizaka UI, Folioviv brand tokens), both themes, phone first.

## Brief (market strategist)

- Buyer: a dog owner on a phone in Saint-Henri choosing a walker this week; second, the owner deciding whether to show
  the television.
- Jobs: 1. see them at work, to trust them with my dog; 2. know at a glance if my street is covered; 3. (owner) my clips
  look like my shop, not a gadget.
- Beliefs: « they really do this well » (the owner's own clips); « they come to my neighbourhood » (the covered areas,
  readable without the map); « I can book now » (the live open status).
- One action: Réserver. Visible words avoid « TV », « channel », « retro », « playlist », « reels ».
- Benchmark (from memory, not verified 2026-11): an Instagram profile leads with the 9:16 clip, sound off; booking
  marketplaces show a small map with the address and hours beside it.

## Before (real renders, 2026-11-03)

The demo shops on www.folioviv.com show their videos as a filmstrip, so the television is captured from its catalogue page
(ui.krizaka.com/components/retro-tv), the map from `www.folioviv.com/fr/s/pattes-saint-henri`.

| Render | What a stranger sees in five seconds |
| :-- | :-- |
| [TV, desktop, dark](https://krizaka-assets.b-cdn.net/pr-assets/folioviv/2330-design/before-tv-desk-dark.png) | An olive cabinet with blue knobs, a truncated « CH 3 · PL… » label, scanlines; the player's controls are piled in the middle of the picture. |
| [TV, desktop, light](https://krizaka-assets.b-cdn.net/pr-assets/folioviv/2330-design/before-tv-desk-light.png) | The same cabinet, washed out; the knobs read as two blue buttons that do nothing. |
| [TV, phone, dark](https://krizaka-assets.b-cdn.net/pr-assets/folioviv/2330-design/before-tv-phone-dark.png) · [light](https://krizaka-assets.b-cdn.net/pr-assets/folioviv/2330-design/before-tv-phone-light.png) | The screen is 60 % of the set; the controls wrap over the video; the stand eats the bottom. |
| [Map, desktop, dark](https://krizaka-assets.b-cdn.net/pr-assets/folioviv/2330-design/before-map-desk-dark.png) · [light](https://krizaka-assets.b-cdn.net/pr-assets/folioviv/2330-design/before-map-desk-light.png) | A 1150 × 645 px map of all Montréal, no pin in view, no hours, no list of areas: the page's biggest block says nothing. |
| [Map, phone, dark](https://krizaka-assets.b-cdn.net/pr-assets/folioviv/2330-design/before-map-phone-dark.png) · [light](https://krizaka-assets.b-cdn.net/pr-assets/folioviv/2330-design/before-map-phone-light.png) | A full-width still; the areas served are not written anywhere. |
| [Page, phone, dark](https://krizaka-assets.b-cdn.net/pr-assets/folioviv/2330-design/before-page-phone-dark.png) · [light](https://krizaka-assets.b-cdn.net/pr-assets/folioviv/2330-design/before-page-phone-light.png) | The whole page, for the order of the sections. |

## After (HTML prototype on the real tokens, rendered with Playwright)

Prototype: [prototype.html](https://krizaka-assets.b-cdn.net/pr-assets/folioviv/2330-design/prototype.html) (tokens
`@krizaka/tokens` + the Folioviv brand file, no hex). Demo data, said as demo.

| | Dark | Light |
| :-- | :-- | :-- |
| Desktop 1440 | [after-desk-dark](https://krizaka-assets.b-cdn.net/pr-assets/folioviv/2330-design/after-desk-dark.png) | [after-desk-light](https://krizaka-assets.b-cdn.net/pr-assets/folioviv/2330-design/after-desk-light.png) |
| Phone 390 | [after-phone-dark](https://krizaka-assets.b-cdn.net/pr-assets/folioviv/2330-design/after-phone-dark.png) | [after-phone-light](https://krizaka-assets.b-cdn.net/pr-assets/folioviv/2330-design/after-phone-light.png) |

### The television — `RetroTv variant="modern"`

Still a television: a cabinet, a bezel, a screen, two dials, two feet. Nothing else.

- Cabinet: one rectangle on `--kz-surface-2`, 1 px `--kz-border-default`, `--kz-radius-2xl`, `--kz-shadow-raised`. Bezel
  `--kz-surface-0`, `--kz-radius-xl`. Screen 9:16 on `--kz-media`, `--kz-radius-lg`, at most `70svh` tall, width
  `min(100%, 70svh * 9 / 16)`. Two short feet on `--kz-surface-3` replace the trapezoid stand.
- Over the picture: only the play mark before the first play, and one caption line that names the clip:
  « Sortie au canal Lachine · 2 sur 6 » / « Walk by the Lachine Canal · 2 of 6 » (replaces the truncated `CH 3 · …`).
- One control strip under the screen (`--kz-surface-1`, `--kz-border-subtle`): previous · play/pause · sound · next ·
  « 2 / 6 » (tabular figures, `--kz-text-secondary`) · « Plus » / « More » (a disclosure, `aria-expanded`, holding seek,
  speed, picture-in-picture, fullscreen). Icon buttons at `--kz-control-md` (44 px).
- Dials (container ≥ 48rem only): real `<button>`s for previous and next, `--kz-surface-1`, `--kz-border-control`, a
  visible short label (« Préc. » / « Suiv. »). On a click the notch turns 30° (`--kz-duration-fast`); under reduced
  motion it does not turn. Hover changes the surface and hairline one step, nothing moves under the pointer.
- Removed: scanlines, vignette, glass SVG, glow, the accent-tinted screen edge, the warm gradient body and its texture,
  the speaker grille, the power-on flash, the animated static (`off` shows the poster, still).
- Motion left: the `channel` transition becomes a short dip to `--kz-media` (no static, no roll); `crossfade` and `slide`
  stay; all three are a cut under reduced motion.
- Layout (container queries): under 22rem the strip keeps previous, play, next and the count (sound goes into « Plus »);
  22–48rem the full strip, no dials, `aside` under the set; from 48rem the set (screen ~340 px) on the left with the
  dials, `aside` on the right.
- New, additive props: `layout?: "auto" | "stack" | "side"`; `aside?: ReactNode` (the host's heading, sentence and
  action); `programme?: boolean` (the clip titles as an ordered list of buttons, `aria-current` on the playing one);
  `channel` also accepts `(source, index, count) => string`; labels `more`, `position`, `programme`.

### The map — `VisitSection` `split` with `MapGate size="compact"` and `areas`

- `MapGate size?: "auto" | "compact"` (default `auto`, today's behaviour). `compact`: desktop 4:3 capped at 22.5rem
  (360 px); phone a 3:2 still capped at 13.75rem (220 px) behind « Afficher la carte » / « Show the map »;
  `--kz-radius-lg`, `--kz-border-default`.
- `VisitSection` gains `mapSize` (passed to the gate) and `areas?: { label: string; items: string[] }`, drawn as a
  labelled list beside the hours in `split` and above the map on a phone. The list is the map's text version and
  answers « is my street covered » without the map.
- Folioviv: the shop page's visit section draws `split` with `mapSize="compact"` and `areas` from the shop's map places
  (`view.map.places[].name`), the open status first. Desktop: the card (status, « Nous venons à », hours) in 22rem on
  the left, the map on the right; the address under the map. Phone: the card, then the still.

## Adopted / rejected (critique)

- Adopted: a new variant rather than a restyle of `cabinet` (no break, the catalogue keeps its history); the strip under
  the screen (the main defect was the controls on the picture); the caption that names the clip (serves job 1); the
  areas list (serves job 2 and is the map's text version); `split` + `compact` (the map stops being the page's biggest
  block).
- Rejected: the speaker grille (one accessory removed: the feet and dials already say « television »); rotating dials
  under the pointer (motion budget); a glow, a gradient or a texture (no wash); a stand (eats phone height); a new
  admin setting (the owner already chooses the section and its variant).
- Open (founder): may the demo clips and the demo rating stay on a demo shop when labelled as demo data?
- The UX step proposed measuring « Réserver » clicks among visitors who started a clip; that event is not verified to
  exist, so it is not a measure here.

## Accessibility (WCAG 2.1 AA)

- Every control a real button with a unique name in the page's language; the set is a named region.
- Dials: visible label, keyboard focus, 2 px `--kz-ring`, never clipped by the cabinet's overflow.
- Contrast ≥ 4.5:1 for text (caption, count, dial labels) and ≥ 3:1 for controls, both themes.
- Sound off by default; nothing plays by itself under `prefers-reduced-motion`.
- Each clip has a title (its text version); the areas list is the map's text version; the map does not trap Tab.
- Nothing overflows at 360 px; the open status is never colour alone (« Ouvert maintenant » is written).

## Library changes (krizaka-ui) — first

1. `RetroTv` `variant="modern"` + `layout`, `aside`, `programme`, function `channel`, new labels. Not breaking; `cabinet`
   and `portable` marked deprecated in `meta.ts`; the default moves to `modern` at the next major. Examples:
   `modern`, `modern-playlist`, `side-programme` (with `aside` and an action), `modern-narrow` (a 20rem container).
   Tests: the modern stylesheet has no hex, no `repeating-linear-gradient`/`radial-gradient`, no effects/noise/glass
   nodes; strip controls have unique names, « 2 / 6 » follows « next », « More » toggles `aria-expanded`; a dial or a
   programme title calls `onIndexChange` and moves `aria-current`; the function `channel` names the new clip; under
   reduced motion no transition and no dial turn; `off` shows the poster still.
2. `MapGate size="compact"` + `VisitSection` `mapSize` and `areas`. Not breaking. Examples: `map-gate-compact`,
   `visit-split-areas`. Tests: `compact` shows the still and the button on a phone and goes live from `sm`; `areas`
   render as a labelled `<ul>`; the frame's caps hold at 1440 px.

## Folioviv changes — after the krizaka-ui release

- `ShopVideoTv.tsx`: `variant="modern"`, `layout="auto"`, `programme`, `aside` = the section's heading, lead and the
  booking action; the caption function from the messages (`console.shopPage.tvNow`: « {title} · {n} sur {count} » /
  « {title} · {n} of {count} »); drop `max-w-4xl` (the set sizes itself). Heading « Nos sorties en images » is the
  owner's section title, not a new default.
- `ShopPageView.tsx` visit section: `split`, `mapSize="compact"`, `areas` from `view.map.places`.
- Tests: the shop page journey and the page audit at 360 px, both themes; the client JS budget of `/s/*` holds.

## Measures

- Five dog owners see the phone page for five seconds; at least four say correctly whether their neighbourhood is
  covered (by hand, no tracker).
- The visit section's height on desktop drops from ~745 px to ≤ 420 px; no serious or critical axe finding on both
  blocks (the page audit).
