# Booking pages, benchmarked (2026-10-22)

Sources: the public documentation, help centres and 2026 comparison articles of Fresha, Booksy, Square Appointments,
Vagaro and Calendly. A desk benchmark, not a hands-on audit: where a point comes from a vendor's own marketing it is said.
Quebec: none of the five documents a French-first booking page; the vendors that claim French do so as a setting, not as the default.

## What a client sees
| | Fresha | Booksy | Square | Vagaro | Calendly |
|---|---|---|---|---|---|
| Menu with duration and price | yes | yes | yes | yes | one event type |
| Choose the professional | yes | yes | yes | yes | team pages only |
| Availability calendar | day strip + slots | slots | slots | slots, widget | month grid + slots |
| Deposit / card on file / no-show fee | yes | yes | yes | yes (paid plans) | payments add-on |
| Add-ons | yes | yes | limited | yes | questions only |
| Portfolio / reviews | marketplace reviews | marketplace reviews + photos | none | profile | none |
| Account needed to book | marketplace nudges one | app nudged | no | no | no |

Done well: a menu that shows the **duration and the price together**; the **professional choice with « any »**; a
**slot list that only shows what is bookable** (Calendly even hides what buffers would block); a **reschedule/cancel link
in every confirmation**. Done badly: the **marketplace** pulls the visitor away from the shop (Fresha takes up to 20 % of
a new client; Booksy pushes its app), **upsell and sign-up walls** before the slot, **paid SMS reminders** as the default
no-show answer, buffers that stay attached to old bookings (Calendly's own forum), long single-page flows that jank on a phone.

## After the booking
| | Reminders | Rebook | Waitlist | Gift cards | Cancel/reschedule | Add to calendar | Receipt with taxes |
|---|---|---|---|---|---|---|---|
| Fresha | e-mail, SMS (quota) | yes | yes | yes | link | yes | generic |
| Booksy | e-mail, SMS (plan) | yes | yes | no | link | yes | generic |
| Square | e-mail, SMS (paid) | yes | no | yes | link | yes | tax lines (US) |
| Vagaro | e-mail, SMS credits | yes | yes | yes | link | yes | generic |
| Calendly | workflows | link | no | no | link | yes | none |

None issues a **bilingual GST/QST receipt**. That, and French first, is Quebec's open lane.

## Where Akinaza can do better, and what it really runs
Chosen (7): each fits what the product already does, none is faked.
1. **One route per step** — `/s/<shop>`, `/service/<id>`, `/creneau`, `/confirmation`: the URL is the state, the back button works, every step prefetches.
2. **A menu that shows duration, price and the tax** — « 95 $ + TPS/TVQ = 109,97 $ », exact to the cent from the tax code, in both languages.
3. **Choose the professional, or « anyone »** — each person's own hours; « anyone » shows the union (multi-staff, built in this work).
4. **Only bookable times, with instant feedback** — slots from the real engine, skeletons instead of spinners, no layout shift.
5. **The cancellation rule before the click** — the shop's own window, in words, on the service step and in the confirmation.
6. **A confirmation that is useful** — add to calendar (.ics), a cancel link while the window is open, address and hours, in the visitor's language.
7. **French first, accessible** — French by default, keyboard-operable steps, reduced-motion respected, 44 px targets, plain professional Krizaka UI.

Not shown, because not built: deposits and card on file, reviews, gift cards, waitlist, add-ons, packages and multi-session
booking, SMS reminders. They are listed as issues; the demos never pretend.
