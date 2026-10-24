# The Cahier storefront — design (phase 1)

Refs krizaka/akinaza#236 (the shop as a place). Status: **proposal, waiting for the CTO's « validé »**. No code changes in this PR.

It designs the public shop page (`/[locale]/s/[slug]`) and its booking journey in the Cahier, the artistic notebook that Akinaza's public
shop pages wear as the one product exception to « products stay pro plain Krizaka UI » (decision 2026-10-23, akinaza#236). The owner app
stays plain Krizaka UI, and so does the owner studio around its preview.

It builds on, and never contradicts:

- `docs/design/storefront-templates.md` (#261, **validé**, option C): a template is versioned data (order, variants, slots, hue, paper, text
  styles); content is never part of it; the Cahier pieces arrive as **version 2** of each template; a shop on `@1` is untouched until its owner
  applies the update. The code is in `packages/core/src/storefront-templates/` (merged through #284 and #291).
- The default media per trade (#267, PR #281): no section is ever empty, and nothing pretends to be the owner's shop.
- The owner app review, `docs/ux/2026-10-full-review.md`: the Boutique hub on `SettingsLayout` (K4), the media manager (K5), the storefront
  items of K9 (the language switch offers the shop's languages only, « Camille » once, the cover chip after K0).
- `AGENTS.md`: service businesses only (never a restaurant, café, bar or bakery), Krizaka named **only in the footer**, no « IA » word, Loi 25,
  tokens only, dark and light first-class.
- krizaka-ui ADR-004 (the Cahier): matt paper, blue ink on paper and chalk on slate, a solid paper shadow (never a blur), 2 px on controls and
  0 on cards, lower-case typed labels (no tracked caps), the pen stroke, the ink motion.

---

## 1. The concept

A shop's page is **a place you visit, kept in a notebook by its owner**. You open it the way you push a door on Rue Saint-Denis: the painted
sign over the window, a photo of the inside taped on the first page, the owner's post-it of the day stuck beside it (« Fermé à 15 h jeudi, le
café est sur moi »), a small stamp that says what it feels like in there right now. Further down, the services are index cards on the
counter, each stamped with its price; the wall carries the Polaroids, the cards with a word and the latest reel in an old television; the
hours are written on a ruled card, the areas on a folded map, the team as small prints, the clients' word as a stamp of verified reviews.
**The art lives in the frames, never in the way**: every sentence stays on paper, readable, and « Réserver » is one plain button that is always
within reach — the notebook is the shop's charm, the booking is the shop's business.

---

## 2. The page, top to bottom, for one trade at a time

### 2.0 The order, and what is fixed

Every Cahier page (`@2` templates) has a **fixed head** (not orderable, always in this order, painted at once — no reveal, LCP) and an
**orderable body** (the template's order, overridden by the owner's `shop_page.sections` as today).

| # | Piece | Where | Block (`@krizaka/ui`) | Data | Shown when |
| :-- | :-- | :-- | :-- | :-- | :-- |
| 1 | **The sign** | head | `ShopSign` (`painted` · `enamel` · `neon` · `none`), the name as the page's `h1` text | `shops.name`, `shop_page.logo_url`, `shop_page.sign` | always (name only when no logo) |
| 2 | **The hero photo, taped in** | head | `TapedPhoto` around `CoverHero`'s media (image or silent loop) | cover media or the trade's default (#267) | always (defaults never blank) |
| 3 | **The post-it of the day** | head, beside the photo (phone: under it) | `PinnedNote` held by `Stuck` (`tape` or `pin`) | `shop_note` (#240) | set, not expired, `features.shopNote`, owner toggle |
| 4 | **The vibe tag** | head, under the sign's facts | `Stamp` (ink) + a `@krizaka/icons` glyph | `shop_page.vibe`, `vibe_until` (#241) | set, not expired, `features.shopVibe` |
| — | Facts: open now, area, the next free time | head, under the sign | `Stamp` (`ok` for « Ouvert », `neutral` otherwise) | hours, zones, slots | as today (after K0) |
| — | **« Réserver »** | head | `Button` primary `shape="cut"` `lg` (+ `shimmer` + `magnetic` on desktop) | `bookHref` | always |
| 5 | **The services, as stamped index cards** | body | `ServiceCard variant="index"` in `CardGrid` | services (as today) | ≥ 1 service |
| 6 | **The wall** | body | `Wall` (`brick` · `zellige` · `ridge` · `plaster`) of `Polaroid`, `PinnedNote`, `ShopSign`, `RetroTv` | `shop_wall` (#234) | `features.shopWall`, ≥ 1 item |
| 7 | **The bulletin board** (announcements) | body | `PinnedNote` flyers (≤ 3), the same as the neighbourhood feed (#243) | announcements (#232) | ≥ 1 current |
| 8 | **Hours and places** | body | `OpeningHours` on a ruled card · `Map` in a straight taped frame · zone `Stamp`s | hours, zones | as today |
| 9 | **The team** | body | small `Polaroid`s of default avatars, the state as a `Stamp` | staff, today's states | ≥ 2 people |
| 10 | **Reviews and score** | body | `ReviewSummary` (new, § 8) + review cards | reviews (#233) | `features.shopReviews`, ≥ `reviews.minCount` |
| 11 | **The story, contact and rules** (`trust`) | body | `Section` on paper, the owner's text, `DescriptionList` on a ruled card | about, contact, policies | as today |
| — | Follow (#232) | body, last | `CtaPanel` secondary | follows | `features.shopFollow` |
| — | The closing call | foot | `CtaPanel` + « Réserver » | — | always |
| — | Footer | foot | `SiteFooter` (Krizaka named here only) | — | always |

**« Réserver » is always reachable** (§ 3): in the head; in the site bar's primary slot once the head has scrolled away (desktop); in the
`StickyAction` bar at the bottom of a phone, hidden while the head's button is on screen; in the closing call. One look everywhere: the
**Akinaza primary**, never the template's hue, so a client learns one button across every shop.

The three trades below are drawn on the three layouts of the catalogue, one each, so the wireframes cover every structure:
**the salon** on `salon-vitrine@2` (L1 Vitrine), **the dog walker** on `pets-histoire@2` (L3 Histoire), **the workshop** on `workshop-carte@2`
(L2 Carte). Widths: desktop at the page frame (`--kz-page-max` 72rem, gutters 32 px); phone at **390 px** (gutters 16 px, 358 px of content).

Legend: `[ ]` a straight frame · `/ /` a tilted piece (≤ 2°) · `==` tape · `(o)` a pin · `~~~` a hand-drawn divider · `[[ Réserver ]]` the
primary · `( Choisir )` a secondary · `« »` the owner's text · `#` a stamp.

### 2.1 The salon — « Cèdre & Ciseaux », `salon-vitrine@2` (L1 Vitrine, paper `plain`, hue `brand-akinaza`)

The atmosphere first: a light page, the loop of the salon (or the trade's default loop) taped large, the menu of cuts as index cards, then the
wall of finished cuts.

**Desktop**

```
+----------------------------------------------------------------------------------------------------+
| (A) Akinaza · Cèdre & Ciseaux                               FR | EN     ( Mon compte )  [[ Réserver ]] |  <- bar: Réserver joins once the head is out
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|   .--------------------------------------------.                                                   |
|   |  CÈDRE & CISEAUX        (painted sign, h1) |    # ouvert · ferme à 19 h #   # Plateau #          |
|   '--------------------------------------------'    # en ce moment : jazz du dimanche, thé à la menthe #
|                                                                                                    |
|   ==                                       ==        (o)                                           |
|   /  +------------------------------------+ /       /  « Fermé à 15 h jeudi,      /                  |
|   /  |                                    | /       /    le café est sur moi. »    /                  |
|   /  |   COVER 16:9 (image or 8 s loop)   | /       /             — Camille        /                  |
|   /  |   AVIF 1280, priority (LCP)        | /       /____________________________/                   |
|   /  +------------------------------------+ /                                                      |
|   ==   « Coupe, couleur, soin. »         ==         [[ Réserver ]]   prochaine place : 14 h 30       |
|                                                                                                    |
|   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ |
|   Choisissez, puis réservez                                                                        |
|   +--------------------------+  +--------------------------+  +--------------------------+         |
|   |o Coupe femme             |  |o Couleur                 |  |o Soin profond            |         |
|   |--------------------------|  |--------------------------|  |--------------------------|         |
|   | [ 3:2 service image ]    |  | [ 3:2 service image ]    |  | [ 3:2 service image ]    |         |
|   | shampoing, coupe, séchage|  | racines ou complète      |  | 30 min, sans rendez-vous |         |
|   | # 45 min #     # 55 $ #  |  | # 90 min #  # dès 95 $ # |  | # 30 min #     # 35 $ #  |         |
|   |              ( Choisir ) |  |              ( Choisir ) |  |              ( Choisir ) |         |
|   +--------------------------+  +--------------------------+  +--------------------------+         |
|   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ |
|   Le mur                                                                                           |
|   +---------------------------------------- brick ------------------------------------------+      |
|   |   /Polaroid/    (o)/card « merci »/      .-[ RetroTv ]-.     /Polaroid/    [sign enamel]   |      |
|   |   « balayage »                           |  latest reel |    « avant/après »                |      |
|   |         /Polaroid/        /Polaroid/     '-------------'           /card « nouveau »/     |      |
|   +------------------------------------------------------------------------------------------+      |
|   Au babillard        (o)/flyer « Portes ouvertes samedi »/   (o)/flyer « Nouvelle coloriste »/   |
|   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ |
|   L'équipe   /(o) Camille # libre à 14 h 30 #/  /(o) Inès # en rendez-vous #/                       |
|   Horaires et lieu                                                                                  |
|   +-- ruled card ----------------+   ==[ Map (straight, tape at two corners) ]==                    |
|   | lun   fermé                  |     # Plateau #  # Mile End #                                    |
|   | mar   10 h – 19 h  # aujourd'hui #                                                               |
|   +------------------------------+                                                                  |
|   Ce qu'en disent les clients   # 4,8 / 5 · 27 avis vérifiés #   5 ▇▇▇▇▇▇▇ 4 ▇▇ 3 ▏ 2 1              |
|   [ review card ] [ review card ] [ review card ]                       ( Lire tous les avis )      |
|   Qui vous accueille   « story »  ( Appeler ) ( Écrire )   [ ruled card: annulation, retard, … ]   |
|   +------------------------------------------------------------------------------------------+     |
|   | Une place vous attend.                                                [[ Réserver ]]       |     |
|   +------------------------------------------------------------------------------------------+     |
|   footer · Akinaza · publié par Krizaka                                                            |
+----------------------------------------------------------------------------------------------------+
```

**Phone, 390 px**

```
+------------------------------------+
| (A) Cèdre & Ciseaux      FR  (=)   |
+------------------------------------+
| .--------------------------------. |
| | CÈDRE & CISEAUX   (sign, h1)   | |
| '--------------------------------' |
| # ouvert · ferme à 19 h # #Plateau#|
| # en ce moment : jazz, thé #       |
| == +----------------------------+  |
|  / | COVER 16:9 (358 x 201)     | / |  <- tilt eased to 60 % (≤ 0.6°)
|  / +----------------------------+ / |
| (o)                                |
| / « Fermé à 15 h jeudi,        /   |  <- the post-it under the photo,
| /   le café est sur moi. »     /   |     4 lines max, fixed box
| [[        Réserver          ]]     |  <- visible: the sticky bar is hidden
| ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~   |
| Choisissez, puis réservez          |
| +--------------------------------+ |
| |o Coupe femme                   | |
| | [ 3:2 image ]                  | |
| | # 45 min #           # 55 $ #  | |
| |                  ( Choisir )   | |
| +--------------------------------+ |
| +--------------------------------+ |
| |o Couleur  …                    | |
| +--------------------------------+ |
| ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~   |
| Le mur  (one column, in z order)   |
| /Polaroid « balayage »/            |
| [ RetroTv: tap to play ]           |
| /card « merci »/                   |
| Au babillard  /flyer/              |
| L'équipe  /Camille/ /Inès/         |
| Horaires  [ ruled card ]           |
| [ map, straight ]                  |
| # 4,8 / 5 · 27 avis vérifiés #     |
| [ review ]  ( Lire tous les avis ) |
| Qui vous accueille · règles        |
+------------------------------------+
| [[          Réserver           ]]  |  <- StickyAction, once the head's button is gone
+------------------------------------+
```

### 2.2 The dog walker — « Les Promenades Lafontaine », `pets-histoire@2` (L3 Histoire, paper `kraft`, hue `brand-akinaza`)

The owner's story first, a neighbourhood notebook: who walks your dog, where, and the note after each outing. The **areas on the map** matter
more than for a salon, so « Horaires et lieu » climbs to the third body section; services are few (a walk, a group walk, a visit).

**Desktop**

```
+----------------------------------------------------------------------------------------------------+
| (A) Akinaza · Les Promenades Lafontaine                    FR | EN               [[ Réserver ]]    |
+----------------------------------------------------------------------------------------------------+
|  (kraft paper, grain)                                                                              |
|   .------------------------------------------------.   # ouvert · dernière sortie 17 h #            |
|   | LES PROMENADES LAFONTAINE  (enamel sign, h1)   |   # Plateau # # Rosemont #                     |
|   '------------------------------------------------'   # en ce moment : 4 chiens au parc, il neige #|
|   ==                                        ==                                                     |
|   /  [ COVER loop: a leash, a park path ]   /      ==/ « Sortie de 15 h au parc Lafontaine :   /    |
|   /                                         /        /   2 places. Bottes conseillées ! »     /     |
|   ==                                        ==       /________________________________ Marc /       |
|                                                    [[ Réserver ]]  prochaine sortie : 15 h        |
|   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ |
|   Mon histoire                                     |  ==/Polaroid « Biscuit »/   /Polaroid/==         |
|   (o) Marc  « Je promène les chiens du Plateau     |     /Polaroid « la neige »/                     |
|   depuis 2019. Petits groupes, toujours les        |  (gallery `taped`, 2 columns)                  |
|   mêmes visages, une note après chaque sortie. »   |                                                |
|   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ |
|   Les sorties                                                                                      |
|   +--------------------------+  +--------------------------+  +--------------------------+         |
|   |o Promenade solo          |  |o Promenade en groupe     |  |o Visite à domicile       |         |
|   | # 45 min #     # 28 $ #  |  | # 60 min #  # 22 $ #     |  | # 30 min #     # 20 $ #  |         |
|   |                          |  | jusqu'à 5 chiens         |  |                          |         |
|   |              ( Choisir ) |  |              ( Choisir ) |  |              ( Choisir ) |         |
|   +--------------------------+  +--------------------------+  +--------------------------+         |
|   Où et quand                                                                                      |
|   ==[ Map: the zones drawn, taped at two corners (straight, interactive) ]==   +-- ruled card --+  |
|      # Plateau #  # Rosemont #  # La Petite-Patrie #                           | lun–ven 8–18 h |  |
|                                                                                +----------------+  |
|   Le mur (plaster)   /Polaroid/  [RetroTv « la meute du mardi »]  (o)/card « merci Biscuit »/       |
|   L'équipe  /Marc # en sortie #/  /Léa # libre à 15 h #/                                           |
|   # 4,9 / 5 · 41 avis vérifiés #   [ review ] [ review ]                                           |
|   Règles: vaccins, laisse, annulation 24 h  [ ruled card ]                                         |
|   [ Une place dans la prochaine sortie.                                 [[ Réserver ]] ]           |
+----------------------------------------------------------------------------------------------------+
```

**Phone, 390 px**

```
+------------------------------------+
| (A) Les Promenades…      FR  (=)   |
+------------------------------------+
| .--------------------------------. |
| | LES PROMENADES LAFONTAINE (h1) | |  <- the sign wraps on two lines, never shrinks under 1.5rem
| '--------------------------------' |
| # ouvert · dernière sortie 17 h #  |
| # en ce moment : 4 chiens au parc #|
| == [ COVER loop 16:9 ] ==          |
| ==/ « Sortie de 15 h : 2 places. /  |
|   /  Bottes conseillées ! » Marc / |
| [[        Réserver          ]]     |
| ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~   |
| Mon histoire  (o) Marc « … »       |
| /Polaroid/ /Polaroid/  (2 per row) |
| Les sorties  [index card] x3       |
| Où et quand  [ map, 358 x 240 ]    |
| # Plateau # # Rosemont #           |
| [ ruled card: hours ]              |
| Le mur (one column)                |
| L'équipe · avis · règles           |
+------------------------------------+
| [[          Réserver           ]]  |
+------------------------------------+
```

### 2.3 The workshop — « Atelier Ferland », `workshop-carte@2` (L2 Carte, paper `ruled`, hue `steel`)

Booking first: a page people open to book a repair or ask for a made-to-measure piece. The head is **compact** (the photo smaller, beside the
sign), and the services are a **price list of index cards in one column**, the hours and the team beside them.

**Desktop**

```
+----------------------------------------------------------------------------------------------------+
| (A) Akinaza · Atelier Ferland                              FR | EN               [[ Réserver ]]    |
+----------------------------------------------------------------------------------------------------+
|  (Seyès ruling, red margin)                                                                        |
| § | .-----------------------------------.   ==/ [ cover 16:9, 480 wide ] /==   (o)/ « Retour des   / |
|   | | ATELIER FERLAND (painted sign, h1)|                                      /  vélos réparés:   /  |
|   | '-----------------------------------'                                    /  jeudi 16 h. » /     |
|   | # ouvert · ferme à 18 h #  # Saint-Henri #  # en ce moment : le tour à bois tourne #           |
|   | [[ Réserver ]]   prochaine place : demain 9 h                                                  |
|   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ |
| § | Réparations et sur mesure                     |  Horaires                                       |
| 1 | +-----------------------------------------+   |  +-- ruled card --------------+                 |
|   | |o Mise au point vélo   # 60 min # # 65 $ #| |  | mar–sam  9 h – 18 h        |                 |
|   | |  freins, vitesses, pneus     ( Choisir ) | |  +----------------------------+                 |
|   | +-----------------------------------------+   |  L'équipe  /Luc/  /Sam/                          |
|   | +-----------------------------------------+   |                                                 |
|   | |o Affûtage           # 20 min # # 15 $ #  | |                                                 |
|   | +-----------------------------------------+   |                                                 |
|   | +-----------------------------------------+   |                                                 |
|   | |o Meuble sur mesure  # sur devis #        | |                                                 |
|   | +-----------------------------------------+   |                                                 |
| § | Qui vous accueille « story »  [ ruled card: devis, garantie, annulation ]                     |
| 2 | Ce qu'en disent les clients  # 4,7 / 5 · 18 avis vérifiés #                                    |
| § | Le mur (ridge)   /Polaroid « table en frêne »/  [RetroTv]  [sign neon « OUVERT »]             |
| 3 | Photos (strip)                                                                                 |
|   | [ Un devis, une réparation : on s'en occupe.                         [[ Réserver ]] ]          |
+----------------------------------------------------------------------------------------------------+
```

**Phone, 390 px**

```
+------------------------------------+
| (A) Atelier Ferland      FR  (=)   |
+------------------------------------+
| .--------------------------------. |
| | ATELIER FERLAND  (sign, h1)    | |
| '--------------------------------' |
| # ouvert · ferme à 18 h #          |
| # en ce moment : le tour tourne #  |
| [ cover 16:9, 358 wide ]           |  <- compact layout: tilt 0 on a phone
| (o)/ « Vélos réparés : jeudi » /   |
| [[        Réserver          ]]     |
| Réparations et sur mesure          |
| [o Mise au point · 60 min · 65 $ ] |
| [o Affûtage · 20 min · 15 $      ] |
| [o Meuble sur mesure · sur devis ] |
| Horaires [ ruled card ]            |
| L'équipe · histoire · avis         |
| Le mur · photos                    |
+------------------------------------+
| [[          Réserver           ]]  |
+------------------------------------+
```

The red margin and its `§` numbers show from 64rem only (the `Page margin` rule); a phone never loses width to a decoration.

### 2.4 Piece by piece

**The sign.** `ShopSign` frames the shop's name **as live text, the page's `h1`** (never an image of the name), in the display face; with a
logo, the logo sits on the plate's left. Three styles: `painted` (an old painted sign on brick, faded — the default of `vitrine` and `carte`),
`enamel` (a painted metal plate with screws — the default of `histoire`), `neon` (a glow drawn with `text-shadow`, lit at once; one flicker on
first view only when motion is allowed, never a loop), and `none` (the name alone on paper). The plate is straight (0°): it is the heading.
The name wraps on two lines and never shrinks under `2xl`; a name longer than 48 characters drops to `none`.

**The hero photo, taped in.** `TapedPhoto` (`tape="corners"`, tilt −1.2° on desktop, eased to 60 % on a phone; 0° for `carte`) around the
`CoverHero` media, which keeps its own 16:9 box: the tilt is a transform, nothing moves. The cover is the LCP element: `priority`, AVIF/WebP at
640/1280, the loop starts after the page settles (`html[data-motion]`) and never under reduced motion or Save-Data (poster only). The owner's
tagline is written under the print as its caption (text face, not the pen: it is content). The status, area and next-free-time facts move off
the photo onto the paper as stamps, so no text is ever read over a picture.

**The post-it of the day.** `PinnedNote` held by `Stuck` (`tape` or `pin`, the owner's choice), tilted by its data (−4° to 4°, clamped,
default −2°), in the pen face (`cahier`, 20 px minimum) for the word and the owner's first name. At most 140 characters, **4 lines in a fixed
box** (so a late font never shifts anything), the ink from three: blue ink, the margin's red, the hue. Expires by itself (`expires_at`; default
the end of the shop's day, in its time zone). It is an `aside` named « Le mot du jour » with its text read in full. Desktop: beside the photo;
phone: under the photo, before « Réserver ».

**The vibe tag.** One line, at most 80 characters, after a fixed prefix the page writes (« en ce moment : »), as an ink `Stamp` with a small
glyph from three (`equalizer`, `steam`, `leaf` — `@krizaka/icons`); the equaliser's bars move only when motion is allowed and only while on
screen. Read as plain text (« En ce moment : jazz du dimanche »). Expires (`vibe_until`, default 4 hours). Never a time or a promise — the facts
stamps say those.

**The services, as stamped index cards.** `ServiceCard variant="index"`: a ruled card (one Seyès line under the title), a punched hole at the
top-left, **straight** (0°: a card you pick is never askew), the duration and the price as ink stamps (the price in tabular digits of the text
face, the stamp's tilt only on its own border, the figures straight), what is included in the text face, « Choisir » as a secondary button.
Lift on hover and focus (a 2 px raise and the solid paper shadow growing from `4px 5px` to `6px 7px`, 120 ms), nothing under reduced motion.
The whole card is not the link (the button is), so the name stays selectable and the screen reader hears one link per card. `vitrine` and
`histoire`: a grid (min 250 px); `carte`: one column (the `list` variant).

**The wall.** `Wall` on its texture (`brick` Montréal, `zellige` Morocco, `ridge` Grenoble, `plaster` plain), the owner's items from data
(x, y in %, rotation, z): `Polaroid` (photo + a caption ≤ 40 characters in the pen), `PinnedNote` (a card with a word), `ShopSign` (the logo as a
second sign), **the latest reel** in a `RetroTv` (an uploaded vertical video, or a TikTok / YouTube Shorts / Instagram link behind a
click-to-load facade — nothing loads from the platform before the visitor asks, Loi 25). **Text is never laid on a texture**: every word on the
wall is on a paper item. Desktop: the composed wall at a fixed 16:9 box (≤ 12 items drawn; the rest behind « Voir tout le mur »); phone: one
column in z order, every item straight. Under it, a real list (`ul`) of the items carries the semantics; the composition is decoration over it.
The **reel lives on the wall**: v2 templates do not place the separate `reels` section (§ 8.2).

**The bulletin board.** The shop's current announcements (#232), at most three, as `PinnedNote` flyers (pin, the date stamped, an optional
photo in a `Polaroid`), the newest first; the same flyer component as the neighbourhood feed on the Akinaza home (#243), so a flyer reads the
same in both places. Hidden when none is current.

**Hours and places.** `OpeningHours` on a ruled card, today's row stamped « aujourd'hui »; the map in a **straight** frame taped at two
corners (an interactive map is never tilted), the zones as stamps. For `pets` the section is called « Où et quand » and sits higher (§ 2.2).

**The team.** Small `Polaroid`s (88 px) of the default avatars (or the member's own picture, when the avatar picker lands, K6), each tilted by a
seed of its name (±1°), the first name in the display face under it (a name is content, never the pen), the state as a stamp (« libre à
14 h 30 », « en rendez-vous ») — each name once (K9). Hidden when only one person works there (the story already introduces them).

**Reviews and score.** A stamp « 4,8 / 5 · 27 avis vérifiés » (the Bayesian score of #233, one decimal, the count, « vérifiés » because only a
completed appointment may review), the distribution as five plain meters, three review cards (first name and initial, the month, the
service, the text, the owner's reply indented in the pen's ink colour but in the text face). Nothing at all under `reviews.minCount`. **Not
the `GradeStamp`**: a « 18/20 » in a teacher's red is the tool sites' register; a client's rating of a shop is not a school grade.

**The story, contact and rules.** The owner's text on paper (text face, `lg` for `histoire`), the owner's avatar, « Appeler » and « Écrire »;
the rules (cancellation, lateness, what to bring) on a ruled card as a `DescriptionList`.

**Hand-drawn dividers** separate the body sections (one shape per template, drawn in the hue at 60 %); none in the head, none between a
heading and its content.

**No Krizaka `Signature` and no Krizaka bird on a shop page**: the shop is the owner's, and Krizaka is named only in the footer (AGENTS § 3).
The beaver stays in the 404 and the empty states, never on a live shop page. **Margin doodles** (`Doodle`: an arrow to « Réserver », a circled
« nouveau ») are template data, at most two per page, shown only from 1360 px, `aria-hidden`.

---

## 3. The booking journey

The journey already exists (#145, most of it shipped): one route per step, a skeleton per route, add to calendar. This design only **frames** it
in the notebook, and keeps every step as fast and as clear as today.

```
/s/<slug>                       the shop page            « Réserver » or a card's « Choisir »
  └ /s/<slug>/service/<id>      1 · the service          what is included, « Avec qui ? », the price with its taxes, [[ Voir les heures ]]
      └ …/creneau               2 · the time             the day strip and the free times (SlotPicker), real availability, live
          └ /s/<slug>/book      3 · who and confirm      sign in (magic link) if needed, join the shop, the person or the dog, [[ Confirmer ]]
              └ …/confirmation  4 · booked               when, with whom, where, the price · [[ Ajouter au calendrier ]] (.ics) · cancel while the window is open
```

- **One route per step**, the address is the state (back and forward work, a link can be shared up to step 2); « Réserver » with one service
  goes straight to step 1 of that service, with several to the services section (`bookHref`, as today).
- **Skeletons**: each route has its `loading.tsx` (`JourneySkeleton`) drawn on the same paper with the same boxes (the step header, three rows),
  so the swap shifts nothing.
- **The frame**: the journey pages wear the shop's paper and hue as a **thin head** — the sign in its `none` style (the name in the display
  face, one line), the step (« 2 sur 4 · L'heure »), « Modifier » links — and nothing else of the notebook: no post-it, no tilt, no wall, no
  doodle, no texture under a form. The `SlotPicker`, the fields and the buttons are the plain Krizaka controls.
- **The one stamp of the journey** is on the confirmation: « réservé » pressed once (the stamp's short spring, nothing under reduced motion),
  beside the summary. « Ajouter au calendrier » is the primary there (the `.ics` of `lib/ics.ts`); the phone call and « Mes réservations » are
  secondary.
- **Budgets**: each step's server response ≤ 300 ms p75 on the dev database; no client JS added to steps 1, 2 and 4 by the Cahier (CSS only);
  INP ≤ 200 ms on the slot picker.

---

## 4. The visual system

### 4.1 Paper

Four papers, CSS and inline SVG only (no image file), each a token set of `@krizaka/tokens` (§ 8.1, UI-1), applied by `Page paper` / a section's
`paper`:

| Paper | Drawing | Default of | Notes |
| :-- | :-- | :-- | :-- |
| `plain` | the page surface, a grain at 3 % | `vitrine` | the calmest; photos lead |
| `dot-grid` | a 5 mm dot grid (`radial-gradient`, 1 px dots at `--kz-paper-rule-minor`) | — | the bullet-journal look |
| `ruled` | the existing Seyès ruling (`Page paper="ruled"`, 32 px squares, 8 px lines) + the red margin from 64rem | `carte` | a price list |
| `kraft` | a warm brown-grey paper, grain (`feTurbulence`, fixed seed) at 6 % | `histoire` | the craft notebook; contrast checked hardest (§ 6) |

The grain is one inline SVG filter per page (one `<svg>` in the layout, referenced by id), never per element.

### 4.2 Ink, stamps, tape, dividers

- **Ink**: light — blue ink on paper (`text-primary`, hue 212, ADR-004); dark — chalk on slate. The text roles stay the tokens' (`--kz-fg`,
  `--kz-fg-secondary`); the hue colours only stamps, dividers, the index card's top rule and the ink choice of the post-it, through
  `--kz-hue` (decorative, ≥ 3:1) and `--kz-hue-text` (small text, ≥ 4.5:1).
- **Stamps**: the existing `Stamp` of `specimen-tag` (double-ruled, slightly askew), in lower case, typed in the mono face; new tones `ink` and
  `hue` (§ 8.1, UI-2). A stamp's border tilts (≤ 2°), its text stays straight for reading.
- **Tape**: `TapedPhoto`'s strip (one implementation, reused by `Stuck`): a translucent paper strip with torn ends, neutral (never the hue,
  so tape never competes with the content).
- **Pins**: `Stuck hold="pin"`'s drawing pin, its little hard shadow.
- **Hand-drawn dividers**: a `Separator variant="hand"` (§ 8.1, UI-3), three shapes (`stroke`, `wave`, `dash`), an inline SVG path stretched
  to the width with `vector-effect: non-scaling-stroke`, 6 px tall, `aria-hidden`.
- **Shadows**: the Cahier's solid paper offset (`4px 5px 0 -2px`), never a blur (krizaka-ui `cahier.test.ts`); corners 0 on cards and notes,
  2 px on controls.

### 4.3 The trade's hue

The template's hue (`brand-akinaza`, `cobalt`, `sky`, `cyan`, `indigo`, `steel`, `ink`) is set by `data-hue` on the page and mapped to
`--kz-hue`, `--kz-hue-2`, `--kz-hue-text` in both themes. It never colours body text, never the primary button (always the Akinaza primary),
never a surface larger than a stamp; the page stays mostly paper and ink.

### 4.4 Typography — `@krizaka/fonts` roles and `TextStyle` (krizaka-ui#561, merged as #564)

| Role on the page | Face (`@krizaka/fonts` role) | `TextStyle` default (v2) | Owner may change | Never |
| :-- | :-- | :-- | :-- | :-- |
| The sign, section titles (`title`) | `display` — Young Serif, **one weight (400)** | `{ font: "display", size: "3xl", weight: 400 }` (`carte`: `2xl`) | size among `2xl`·`3xl`·`4xl`, `italic`, `case: small-caps`, tone `primary`·`accent` | bold (the face has one weight), `cahier` |
| Body, the story, what is included (`body`) | `text` — Atkinson Hyperlegible Next | `{ font: "text", size: "md" }` (`histoire`: `lg`) | size `md`·`lg`, leading `normal`·`relaxed` | under `md` (`minBodySize`), `cahier`, `mono`, `case: upper` |
| Prices and durations (`price`) | `text`, tabular digits, in a stamp | `{ font: "text", size: "lg", weight: 600 }` | weight 500·600·700, size `md`·`lg` | `cahier`, `display` |
| Stamps, typed labels (fixed) | `mono` — Courier Prime | fixed by the template | — | — |
| The post-it, the vibe word, wall captions, the owner's first name on the post-it (fixed) | `cahier` — Krizaka Cahier, 20 px minimum | fixed by the template | — | anything else: headings, body, prices, buttons, tables |

- v1 templates store `{ font: "display" | "body", size, weight, italic }`; v2 stores the full krizaka-ui `TextStyle` and reads it through
  `parseTextStyle` (any invalid value becomes the default, never CSS). The owner's overrides (`shop_page.style`) keep that shape.
- The `TextStylePicker` in the studio is bounded by `fields` and `presets` per role (the « Owner may change » column), so it can never pick
  the pen for a title or bold Young Serif; the contrast guard of the picker stays on.
- **The pen covers French only today.** Krizaka Cahier is subset to the French alphabet; shop pages may be offered in English and Spanish
  (#258). Until the subset covers Spanish (§ 8.1, UI-8), a page in `es` falls back to the `text` face for the pen roles, at the same box.
- The pen font (≤ 52 kB) is loaded only on a page that shows a pen element (a post-it, a vibe, a wall caption), not preloaded; its boxes are
  fixed, so its late arrival shifts nothing.

### 4.5 Dark and light — « carnet de nuit »

The dark theme is **the notebook at night**, not an inverted page: slate paper, chalk ink, the prints stay paper (a shade dimmer), the tape
stays visible.

| Element | Light (paper) | Dark (carnet de nuit) |
| :-- | :-- | :-- |
| Page surface | cool white paper (never cream) | slate, green-grey (`--kz-surface-0` dark) |
| Text | blue-black ink | chalk (`--kz-fg` dark) |
| Ruling, dots | `--kz-paper-rule-*` blue at 10–24 % | chalk at 4.5–9 % |
| Red margin | `hsl(5 62% 40%)` | `hsl(8 64% 66%)` |
| Kraft | warm grey-brown, ink text | dark tobacco, chalk text, grain at 4 % |
| Stamps | the hue's ink on paper | the hue's `--kz-hue-text` dark on slate |
| Photos, Polaroids | white print border | the print border at 88 % (« a shade dimmer », `TapedPhoto`) |
| Tape | translucent white paper | translucent chalk paper at 22 % |
| Post-it | pale paper of the ink's family | the same note, dimmed to keep ≥ 7:1 with its ink |
| Wall textures | brick, zellige, ridge, plaster at day | the same at night: −35 % lightness, no glow (the neon sign is the only light, and it keeps ≥ 3:1) |
| Primary button | Akinaza primary | Akinaza primary (dark) |

Both themes are first-class: every template × paper × texture is captured in both before it ships (§ 9).

### 4.6 Motion — restrained, never in the way

One system: `MotionObserver` of `@krizaka/ui/motion`, krizaka-motion's wall primitives (#49), the Cahier's ink ease
`cubic-bezier(0.45, 0, 0.2, 1)`. **Transforms and opacity only** (no layout property animates), **never on the head** (painted at once), once
per element, only on screen.

| Moment | Motion | Duration | Reduced motion |
| :-- | :-- | :-- | :-- |
| A body section arrives | `data-reveal="ink"` (settles in place, no travel) | 280 ms | still |
| Tape on a Polaroid / card | tape stick (scaleX from the tear) | 180 ms | still |
| A Polaroid on first view | develop (milky to sharp: opacity + saturate, **no blur**) | 600 ms | sharp at once |
| The neon sign | one flicker on first view | 400 ms | lit, still |
| The RetroTv | power on (a bright line opens) when it enters | 350 ms | the poster, then the video on tap |
| The vibe's equaliser / steam | a loop, only while on screen, paused off screen | — | still glyph |
| An index card, hover/focus | 2 px lift, the shadow grows | 120 ms | none |
| « réservé » on the confirmation | the stamp's short spring | 220 ms | printed |

No permanent `requestAnimationFrame`, no canvas, no animation library; nothing sways in a loop; Save-Data turns the loops off.

---

## 5. What the owner controls (the studio, #245)

### 5.1 Where the studio lives

The « Atelier » of #245 is **Boutique › Page** of the Boutique hub on `SettingsLayout` (UX review K4), not a second place: the hub's Page group
gathers the look (template, paper, sign, text styles), the head of the day (post-it, vibe), the wall, the bulletin board and the sections.
Plain Krizaka UI (it is the owner app), with a **live preview** of `/s/<slug>?preview=1` beside it on a desktop and behind a « Voir » toggle on a
phone, refreshed on save (`shop.page.updated`, `@krizaka/realtime`). Only the owner and manager roles write (#180); staff read.

The **head of the day** (post-it, vibe) is also one tap away from Aujourd'hui (a small « Le mot du jour » card): ten seconds, from the phone,
without opening the hub.

```
Boutique › Page (phone, 390 px)                    Boutique › Page (desktop)
+------------------------------------+             +------------------------+-------------------------------------+
| ← Boutique        Page    ( Voir ) |             | Page                   |  preview (iframe, 390 or 1280)      |
| Le mot du jour                     |             |  Le mot du jour        |  +-------------------------------+  |
| [ « Fermé à 15 h jeudi… »  ] 98/140|             |  En ce moment          |  | the shop page, live           |  |
| ( scotch ) ( punaise ) encre: o o o|             |  Apparence (template,  |  |                               |  |
| expire: [ ce soir ▾ ]   [[Publier]]|             |   papier, enseigne,    |  |                               |  |
| En ce moment                       |             |   styles de texte)     |  |                               |  |
| [ jazz du dimanche ] (eq)(steam) 4h|             |  Le mur                |  +-------------------------------+  |
| Apparence  ›                       |             |  Le babillard          |  ( Téléphone ) ( Ordinateur )      |
| Le mur  ›                          |             |  Sections              |                                     |
| Le babillard  ›                    |             +------------------------+-------------------------------------+
| Sections  ›                        |
+------------------------------------+
```

### 5.2 Data and fixed

| Piece | The owner's data (stored, per shop) | Fixed by the template (`id@2`) | Bounded by the administrator |
| :-- | :-- | :-- | :-- |
| Template | which one (`template_id@version`), applying an update | — | `storefront.templates.offered`, the per-type default |
| Paper | `shop_page.paper`: one of the four (default: the template's) | the grain, the ruling, the margin | `features.cahierStorefront` |
| Sign | `shop_page.sign`: `painted` · `enamel` · `neon` · `none`; the logo | the plate's drawing, its place | — |
| Text styles | `shop_page.style`: per role, within the « Owner may change » column (§ 4.4) | the faces per role, the fixed roles | — |
| Post-it | `shop_note`: text ≤ 140, `tape`·`pin`, tilt −4..4, ink among 3, `expires_at` | the note's paper, box, place, pen face | `features.shopNote` |
| Vibe | `shop_page.vibe` ≤ 80, glyph among 3, `vibe_until` (≤ 24 h) | the prefix « en ce moment : », the stamp | `features.shopVibe` |
| Wall | `shop_wall`: texture among 4, items (photos, cards ≤ 140, the sign, the reel), positions, rotation −8..8, z | the textures' drawing, the phone stacking, the frame of each item | `features.shopWall`, `limits.wallItems` (default 24, drawn ≤ 12), `limits.reelSeconds`, `limits.reelMegabytes` |
| Bulletin board | announcements (#232): text ≤ 500, photo, end date | the flyer, ≤ 3 shown | `features.shopAnnouncements`, the daily limit |
| Sections | order and visibility of the body (`shop_page.sections`, as today) | the head's order (sign, photo, post-it, vibe, facts, « Réserver ») | the `features.shop*` switches |
| Hue, layout, variants, dividers, tape, stamps, motion, doodles | — | all of them | — |
| « Réserver » | — | always present, always the Akinaza primary | — |

### 5.3 The limits that keep every shop beautiful

1. **No free colour, no free font, no free size**: every choice is an enum of the tokens or a `TextStyle` preset (`parseTextStyle` drops anything
   else).
2. **The pen is never chosen**: it belongs to the post-it, the vibe and the captions, fixed by the template.
3. **One post-it, one vibe, at most three flyers, at most twelve wall items drawn**, two doodles at most (template data).
4. **Tilts are clamped** (post-it −4..4, wall −8..8, everything else from the template); anything you click to book is straight.
5. **Texts are bounded** (sign 48, vibe 80, captions 40, post-it and cards 140, flyers 500) and the boxes are fixed; the editor counts down.
6. **Text never lies on a texture or a photo**: the editor offers no way to place one there.
7. **Expiry by default**: the post-it ends with the day, the vibe after 4 hours, so an old word never stays up for months.
8. **The head cannot be hidden or reordered**, only its optional pieces turned off; « Réserver » cannot be removed.
9. **The contrast guard warns in the editor** (the picker's measure, on the chosen paper, in both themes) and the page never renders a pair
   under 4.5:1 for text: an override that fails falls back to the template's default.
10. **No content in a template, no template in the content**: switching template or paper never touches the post-it, the wall or the
    translations (#261's rule).

---

## 6. Accessibility (WCAG 2.2 AA, phone 360 px and up)

- **Contrast on paper**: body text ≥ 4.5:1 measured on the paper **at its darkest grain point** (kraft: the grain is capped so the darkest
  point keeps the ratio; the target on kraft is 7:1 for body text); stamps' text ≥ 4.5:1 (`--kz-hue-text`); decorative strokes (dividers,
  ruling, tape) ≥ 1.5:1 at most, never carrying information. A test renders each paper × theme and checks the token pairs (§ 9, step 2).
- **Readable text over textures**: never — every word sits on a paper item (note, Polaroid border, card) or on the page's paper; the wall's
  textures and the photos carry no text. The cover's facts are on paper, not on a scrim.
- **The pen**: 20 px minimum, short (≤ 4 lines), and every pen text is also plain DOM text read in full.
- **Keyboard**: the order follows the visual order of the phone (sign, facts, photo, post-it, « Réserver », the body); the wall's items are
  reached through its list in z order; the RetroTv is one button (« Lire la vidéo de … »), its player keeps its controls; the facade is a
  button that says it loads TikTok/YouTube/Instagram; focus rings visible on every paper in both themes; the sticky bar never covers a focused
  element (`scroll-padding-bottom`).
- **Screen readers**: tape, pins, grain, rulings, dividers, doodles, the TV's cabinet, the sign's screws and neon are `aria-hidden`; the sign is
  the `h1` text; the post-it is an `aside` named « Le mot du jour »; the vibe reads « En ce moment : … »; stamps are text (« Ouvert, ferme à 19 h »,
  « 45 minutes », « 55 dollars »); the score reads « 4,8 sur 5, 27 avis vérifiés »; Polaroids are `figure` + `figcaption` with the owner's alt
  text (FR/EN); the proposed images are said to be illustrations (#267).
- **Motion**: every movement has its reduced-motion state (§ 4.6); nothing flashes more than once (the neon, three times a second at most,
  once).
- **Targets**: 44 px on a phone (« Choisir », the facade, the sticky « Réserver »), the cards' whole surface not a link.
- **Languages**: `lang` on the page from the content locale; the pen falls back to the text face where it lacks glyphs (§ 4.4).

---

## 7. Performance

| Budget (p75, mobile, 4G, mid phone) | Target | How |
| :-- | :-- | :-- |
| **LCP** | ≤ 2.5 s field, ≤ 2.0 s lab (Lighthouse mobile) — and no regression over the plain page | the cover is the LCP: AVIF 640/1280, `priority`, `fetchpriority=high`; the sign's text painted at once with the preloaded display face; no reveal in the head; the loop after settle |
| **CLS** | 0 (≤ 0.01 tolerated) | every image, note, card, TV and the wall in a fixed box; tilts are transforms; the pen in fixed boxes; skeletons with the same boxes |
| **INP** | ≤ 200 ms | no client JS for the read-only Cahier; the slot picker as today |
| Textures | 0 image files; ≤ 3 kB of inline SVG and CSS for all papers, textures, dividers, tape | CSS gradients, one shared `feTurbulence` filter, `zellige` as one SVG `pattern` |
| Client JS added by the Cahier | 0 kB for the page (server components); the RetroTv and the facade lazy, ≤ 6 kB gzip, loaded near the viewport | `VideoPlayer` reused, no second player |
| Fonts | the pen ≤ 52 kB, only when a pen element shows, not preloaded | `next/font/local` from `@krizaka/fonts` |
| Below the fold | the wall, the board, the team, the reviews with `content-visibility: auto` and an intrinsic size; images `loading=lazy` | — |
| Third parties | none before a click (the reel facade), Loi 25 | — |

The PR of each step publishes Lighthouse mobile numbers (before/after) and the CLS of a full scroll on Bunny (`pr-assets/akinaza/<key>`).

---

## 8. What `@krizaka/ui` must add, and what changes in the templates

### 8.1 Ready-to-file krizaka-ui issues

Already in flight, reused as they are (with the addenda below): `TapedPhoto` (merged, #542), `Stamp` / `SpecimenTag` (merged), `TextStyle`
(merged, #564), `Page paper` + `margin` (merged, ADR-004), `Wall` · `Polaroid` · `PinnedNote` · `ShopSign` (#537, PR #540), `Stuck` · `Doodle` ·
`Signature` (#554, PR #565 — Akinaza uses `Stuck` and `Doodle`, never `Signature`), `RetroTv` (#536), `WallEditor` (#538), krizaka-motion's wall
primitives (#49). `GradeStamp` (#548) is **not** used on shop pages.

> **UI-1 · feat(page): two more papers — `dot-grid` and `kraft`, with a shared grain**
> For Akinaza's Cahier storefront (akinaza#238, `docs/design/cahier-storefront.md` § 4.1). `Page paper` and `Section paper` accept
> `"ruled" | "lines" | "dot-grid" | "kraft"` (absent = plain). Tokens `--kz-paper-dot`, `--kz-paper-kraft`, `--kz-paper-kraft-ink`,
> `--kz-paper-grain-opacity` in light and dark (« carnet de nuit »); the grain is one inline SVG `feTurbulence` filter with a fixed seed,
> mounted once (`PaperGrain`), referenced by id. No image file.
> Acceptance: body text on every paper ≥ 4.5:1 at the darkest grain point in both themes (kraft ≥ 7:1), a token test; ≤ 3 kB CSS+SVG;
> examples and stories for each paper × theme; `cahier.test.ts` green; changeset (minor).

> **UI-2 · feat(specimen-tag): `Stamp` tones `ink` and `hue`, an optional glyph, and a straight text**
> For the facts, the vibe tag, the prices and durations of Akinaza's storefront (akinaza#238, #241). `Stamp tone="ink"` (the page's ink) and
> `tone="hue"` (`--kz-hue-text`); `icon` slot (a `@krizaka/icons` glyph, `aria-hidden`); the border keeps its askew, the text is straight
> (`straightText`, default true for `size="sm"`); `size` `sm` · `md`. Supersedes akinaza#238's « `Badge tone="ink"` »: one stamp in the system.
> Acceptance: contrast ≥ 4.5:1 for every tone in both themes, axe clean, examples, changeset.

> **UI-3 · feat(separator): `variant="hand"` — three hand-drawn shapes**
> `Separator variant="hand" shape="stroke" | "wave" | "dash"`: an inline SVG path stretched to the width, `vector-effect: non-scaling-stroke`,
> 6 px tall, the hue at 60 % (or the ink), `aria-hidden` (a `role="separator"` stays only when not decorative). Deterministic.
> Acceptance: no layout shift (fixed height), both themes, examples, changeset.

> **UI-4 · feat(service-card): `variant="index"` — a stamped index card**
> For akinaza#239. A ruled card (one Seyès line under the name), a punched hole (SVG, `aria-hidden`), **straight**, the duration and the price
> as `Stamp`s (tabular digits), what is included, the action as a secondary `Button`; lift + paper shadow on hover and focus (120 ms), none
> under reduced motion; a `list` density for one column. Same props as today, the variant only changes the drawing.
> Acceptance: keyboard and screen reader output identical to the default variant (a test), both themes, phone 360 px, changeset.

> **UI-5 · Addendum to #537 / PR #540 (the wall), before it merges**
> `ShopSign` renders **text children as a heading** (`as="h1"`, `name` as live text; the logo optional) and offers `none`; the `neon` flicker
> runs once on first view, never loops; `PinnedNote` takes `ink: "blue" | "margin" | "hue"`, `hold` through `Stuck`, a fixed box of N lines
> (`lines`, default 4); `Polaroid` « develop » is opacity + saturate, **no blur** (ADR-004); `Wall` draws at most `max` items in a fixed 16:9
> box and stacks in z order on a phone, with the real list underneath; text is never laid on a texture.

> **UI-6 · feat(media): `EmbedFacade` — a click-to-load facade for TikTok, YouTube Shorts and Instagram**
> For akinaza#234 (Loi 25: nothing loads from a platform before the visitor asks). The lite-youtube-embed pattern (Apache-2.0, studied in
> akinaza#236): a poster (given by the host, from the public oEmbed where it exists), a play button that names the platform, the iframe only
> after the click, `sandbox` and `allow` minimal; fits inside `RetroTv`'s screen. Acceptance: a test that no request leaves before the click;
> keyboard; reduced motion; ≤ 2 kB gzip; changeset.

> **UI-7 · feat(blocks): `ReviewSummary` and `ReviewCard` — a score you can trust**
> For akinaza#233 (data from `@krizaka/reviews`, krizaka-ts#37). `ReviewSummary`: the score as a `Stamp` (« 4,8 / 5 »), the count with
> « vérifiés », five `Meter`s for the distribution, a text equivalent (« 4,8 sur 5, 27 avis vérifiés »); renders nothing under the host's
> minimum. `ReviewCard`: first name + initial, month, the service, the text, the owner's reply indented. Never a « /20 » (that is
> `GradeStamp`'s register). Acceptance: axe clean, both themes, phone, FR/EN labels, changeset.

> **UI-8 · feat(fonts): Krizaka Cahier covers Spanish (ñ, á, í, ó, ú, ü, ¿, ¡)**
> Akinaza's shop pages are offered in French, English and Spanish (akinaza#258); the pen is subset to the French alphabet. Extend the subset
> (`scripts/subset.py`), keep the 52 kB budget or raise it with the reason. Until then, products fall back to the `text` face for pen roles in
> `es`. Acceptance: the glyph-coverage test lists the Spanish set; size budget; changeset.

> **UI-9 · feat(sticky-action): `hideWhileVisible` — hide the phone's bar while the page's own action is on screen**
> So the storefront never shows two « Réserver » at once on a phone: `StickyAction hideWhileVisible="#hero-book"` (an
> IntersectionObserver, no layout shift: the bar is fixed and its space reserved by `scroll-padding-bottom`). Skip if `StickyAction` already
> does it. Acceptance: a test with the target in and out of view; reduced motion: no slide, a fade.

### 8.2 What changes in the templates — version 2 of each

Every template gets an `@2` (`TEMPLATES` holds `@1` and `@2` side by side; a shop on `@1` renders unchanged; « update available » offers `@2`
with a preview, step 5 of #261). The schema grows by **one optional block** and two shapes:

```ts
// packages/core/src/storefront-templates/schema.ts — v2 additions (sketch)
cahier: z.object({
  sign: z.enum(["painted", "enamel", "neon", "none"]),           // the default; the owner may change it
  heroTape: z.enum(["corners", "top", "none"]),
  heroTilt: z.number().min(-2).max(2),                           // 0 for the compact `carte` head
  divider: z.enum(["stroke", "wave", "dash"]),
  wallTexture: z.enum(["brick", "zellige", "ridge", "plaster"]), // the default; the owner may change it
  noteHold: z.enum(["tape", "pin"]),
  doodles: z.array(z.object({ kind: z.enum(["arrow", "circle", "star", "wave"]), near: z.enum(["book", "services", "wall"]) })).max(2),
}).optional(),                                                   // absent = a v1 template, drawn as today
textStyles: { title: TextStyle, body: TextStyle, price: TextStyle }, // krizaka-ui's full TextStyle (fonts display|text), parsed with parseTextStyle
```

- `SECTION_VARIANTS` gains `services: "index"` (the index cards; `list` stays the one-column density), `trust: "story"` already exists,
  `gallery: "taped"` already exists, `hours: "card"`, `team: "polaroid"`, `reviews: "stamp"`.
- The **head** (sign, photo, post-it, vibe, facts, « Réserver ») is not a section: it is drawn by the renderer when `cahier` is present.
- `reels` is **not placed** by any `@2` template: the latest reel is a wall item. The id stays in `TEMPLATE_SECTIONS` so a `@1` shop's stored
  order still parses. The owner's `features.shopReels` switch governs the RetroTv item.
- v1's title styles were `display` at 600–700: Young Serif has one weight, so `@2` sets `weight: 400` (the size carries the emphasis).
- `minUiVersion` (named in the templates doc, not yet in the code) is added: `@2` requires the `@krizaka/ui` release that ships UI-1 to UI-5.

| Template | `@2` layout · paper · hue | sign · tape · tilt | divider · wall | services · team · hours · reviews | title / body / price (`TextStyle`) | doodles |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `salon-vitrine` | vitrine · plain · brand-akinaza | painted · corners · −1.2 | wave · brick | index (grid) · polaroid · card · stamp | display 3xl / text md / text lg 600 | arrow → book |
| `salon-carte` | carte · ruled · brand-akinaza | painted · top · 0 | stroke · plaster | index (list) · polaroid · card · stamp | display 2xl / text md / text lg 700 | — |
| `coaching-vitrine` | vitrine · dot-grid · cyan | neon · corners · −1.2 | dash · ridge | index (grid) · polaroid · card · stamp | display 3xl / text md / text lg 600 | star → services |
| `coaching-histoire` | histoire · kraft · sky | enamel · corners · −1.5 | wave · ridge | index (grid) · polaroid · card · stamp | display 3xl italic / text lg / text md 600 | — |
| `workshop-histoire` | histoire · kraft · steel | enamel · corners · −1.5 | stroke · brick | index (grid) · polaroid · card · stamp | display 3xl / text md / text md 600 | circle → wall |
| `workshop-carte` | carte · ruled · steel | painted · top · 0 | dash · ridge | index (list) · polaroid · card · stamp | display 2xl / text md / text lg 700 | — |
| `cleaning-vitrine` | vitrine · plain · sky | painted · corners · −1 | dash · plaster | index (grid) · polaroid · card · stamp | display 3xl / text md / text lg 700 | — |
| `cleaning-carte` | carte · dot-grid · cyan | none · top · 0 | stroke · plaster | index (list) · polaroid · card · stamp | display 2xl / text md / text lg 700 | — |
| `pets-histoire` | histoire · kraft · brand-akinaza | enamel · corners · −1.5 | wave · plaster | index (grid) · polaroid · card · stamp; **hours and zones before the wall** | display 3xl / text lg / text md 600 | arrow → book |
| `pets-vitrine` | vitrine · dot-grid · brand-akinaza | painted · corners · −1.2 | wave · brick | index (grid) · polaroid · card · stamp | display 3xl / text md / text md 600 | — |
| `consulting-carte` | carte · plain · indigo | none · top · 0 | stroke · plaster | index (list) · polaroid · card · stamp | display 2xl / text md / text lg 600 | — |
| `consulting-histoire` | histoire · ruled · ink | enamel · top · −1 | stroke · zellige | index (grid) · polaroid · card · stamp | display 3xl / text lg / text md 500 | — |

Body order of `@2` by layout (after the fixed head; the owner's own order still wins when `sections_custom`):

| Layout | `@2` body order |
| :-- | :-- |
| L1 vitrine | services · wall · announcements · team · hours · zones · reviews · trust · gallery · follow |
| L2 carte | services (list) · hours · team · trust · reviews · wall · gallery · announcements · follow |
| L3 histoire | trust (story) · gallery (taped) · services · hours · zones · wall · announcements · team · reviews · follow |

(`pets-histoire@2` uses L3's order with `zones` beside `hours`, as drawn in § 2.2.)

---

## 9. The cut — one PR each, in order

**krizaka-ui first** (filed from § 8.1, then released; the in-flight #537/#540, #554/#565, #536 and #538 finish with their addenda). The Akinaza
steps below each name the release they need. Every Akinaza step ships its tests (vitest, a render test, a 360 px overflow test, the hydration
crawl clean), captures in both themes at 390 px and desktop on Bunny, `docs/UX_DECISIONS.md`, and keeps a shop on `@1` or without a template
rendering exactly as today (a snapshot test).

| # | Akinaza PR (title) | Maps onto | Needs | Acceptance |
| :-- | :-- | :-- | :-- | :-- |
| C1 | **feat(templates): the v2 schema — the `cahier` block, full `TextStyle`, the head as data** | #238 (prep), #261 step 7 | `@krizaka/ui` ≥ 3.51 (`text-style/server`) | `@1` and `@2` coexist; every `@2` parses; `parseTextStyle` server-side; the pen can never be a title/body/price font (schema test); a `@1` shop and a shop with no template render byte-identical before/after |
| C2 | **feat(storefront): paper and ink — the four papers, stamps for the facts, hand-drawn dividers, the hue** | **#238** | UI-1, UI-2, UI-3 | migration `shop_page.paper` (CHECK on the four), `features.cahierStorefront`; the facts off the photo onto paper; contrast token test per paper × theme; tenant-isolation sweep; Lighthouse CLS 0, no LCP regression |
| C3 | **feat(storefront): the sign and the taped hero** | #238, #234 (the sign) | UI-5 (`ShopSign`), `TapedPhoto` | migration `shop_page.sign`; the `h1` is the sign's text (one `h1`); `none` for names > 48; LCP element is still the cover |
| C4 | **feat(storefront): the stamped index cards** | **#239** | UI-4 | same links and accessible names as today (test); straight cards; `list` for `carte` |
| C5 | **feat(storefront): the owner's post-it** | **#240** | UI-5 (`PinnedNote`), `Stuck` | table `shop_note` (≤ 140, hold, tilt −4..4, ink, `expires_at` default end of the shop's day), `PUT /api/walker/shop/note` owner/manager only, tenant 404 test, expiry test, translation port (#258) flags it; the Aujourd'hui card; reduced motion still |
| C6 | **feat(storefront): the vibe tag** | **#241** | UI-2 (`icon`) | `shop_page.vibe` ≤ 80 + glyph + `vibe_until` ≤ 24 h, `features.shopVibe`, expiry and tenant tests, FR/EN |
| C7 | **feat(storefront): the wall — photos, cards, the sign, read on the page** | **#234** (part 1) | UI-5 (`Wall`, `Polaroid`), krizaka-motion#49 | `shop_wall` (texture + items, validated, ≤ `limits.wallItems`), uploads under `wall/`; phone stacking; the real list; ≤ 12 drawn; captions FR/EN |
| C8 | **feat(studio): the wall editor** | **#234** (part 2), #245 | krizaka-ui#538 `WallEditor` | keyboard move/rotate saved; bounds server-side; role tests |
| C9 | **feat(storefront): the latest reel in a RetroTv, external links behind a facade** | **#234** (part 3) | #536 `RetroTv`, UI-6 | upload ≤ `limits.reelSeconds` / `reelMegabytes` checked by bytes under `reels/`; no request before the click (test); `reels` section not placed by `@2` |
| C10 | **feat(storefront): reviews and score in the notebook** | **#233** (its page side) | UI-7, krizaka-ts#37 | nothing under `minCount`; the stamp's text equivalent; verified only |
| C11 | **feat(storefront): the bulletin board on the shop page** | **#232** (its page side) | UI-5 (`PinnedNote`) | ≤ 3 current flyers; expiry; the same flyer component exported for C14 |
| C12 | **feat(storefront): the booking journey on paper** | #145 (its frame) | UI-9 | the thin head on steps 1–4, nothing else of the notebook; the « réservé » stamp; skeletons on the same boxes (CLS test); budgets of § 3 |
| C13 | **feat(templates): publish `@2` for the twelve templates, with « update available »** | #261 step 8, #238 | C1–C12 | each `@2` captured in both themes at 390 px and desktop; the update flow keeps the content (integration test); demo shops (#291) moved to `@2` |
| C14 | **feat(studio): Boutique › Page gathers the look, the head of the day, the wall, the board — with the live preview** | **#245** | K4 (the hub), C2–C11 | one place (no `/atelier` route), owner/manager write and staff read (role tests), the preview refreshed on `shop.page.updated`, phone layout, the editor's limits of § 5.3 (tests per bound) |
| C15 | **feat(community): the neighbourhood feed — flyers on the home** | **#243** | C11 | as #243's acceptance; the flyer is C11's component |

**What it supersedes or merges**

- **#245** — its separate `/[locale]/app/[shop]/atelier` route is **superseded** by Boutique › Page of the K4 hub (UX review); its intent and
  acceptance move to C14 unchanged. Until K4 lands, C5–C8 add their editors to today's editor tab (« Apparence »).
- **#238** — its « `Badge` ink tone » is **superseded** by `Stamp tone="ink"` (UI-2): one stamp in the system. Its paper default
  (`dot-grid`) is **replaced** by the template's paper (`plain`/`ruled`/`kraft`/`dot-grid` per template, § 8.2). Split into C2 and C3.
- **#234** — **split** into C7 (the wall on the page), C8 (the editor) and C9 (the reel); the separate `reels` section of the storefront is
  **merged into the wall** (the RetroTv item).
- **#232** and **#233** keep their back-end acceptance; their page side is C11 and C10, which they should link.
- **#145** — mostly shipped (one route per step, skeletons, `.ics`); the remaining « page transitions » and the paper frame are C12. Close #145
  when C12 merges.
- **#261** — steps 7 (text styles) and 8 (Cahier pieces as `@2`) are carried by C1 and C13; `docs/design/storefront-templates.md` § 2's
  « ready-to-file » items 1–3 are UI-1 to UI-4 here.
- **K9** of the UX review rides along: « Camille » once (C2 touches the team), the language switch offering the shop's languages only (C2),
  the cover chip moved to a paper stamp (C2, after K0).

---

## 10. Decisions to validate

1. **The art lives in the frames, never in the way.** The head is drawn at once (sign, taped photo, post-it, vibe, facts, « Réserver »); every
   word sits on paper; anything you click to book is straight; the booking journey keeps only a thin paper head and plain controls.
2. **« Réserver » is one look across every shop**, the Akinaza primary (never the hue), always reachable: head, bar, phone sticky bar (hidden
   while the head's button shows), closing call.
3. **Cahier = template `@2` data, bounded owner choices.** The owner chooses among enums (paper, sign, wall texture, text-style presets, post-it
   hold and ink); the template fixes hue, layout, variants, dividers, tape, motion; the pen is never the owner's choice. `@1` shops never move
   by themselves.
4. **« Carnet de nuit » is a first-class night notebook**, not an inversion: slate and chalk, prints a shade dimmer, tape still visible, the neon
   the only light; contrast checked per paper × theme (kraft at 7:1 for body text).
5. **CSS-only Cahier, zero added client JS, CLS 0**: textures are CSS and one shared SVG grain, the pen loads only where it shows, the reel waits
   behind a facade, the wall and below-the-fold blocks are lazy.

Also proposed, smaller: the studio is Boutique › Page (no `/atelier`); the reel lives on the wall; no `GradeStamp` and no Krizaka `Signature` on
a shop page; Young Serif at its one weight (400) in `@2`.
