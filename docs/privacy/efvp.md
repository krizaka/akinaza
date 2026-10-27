# Privacy impact assessment (EFVP)

> Akinaza, under art. 3.3 of the *Act respecting the protection of personal information in the private sector*, CQLR c. P-39.1 ([LégisQuébec](https://www.legisquebec.gouv.qc.ca/en/document/cs/P-39.1)). Status: **good-faith version, to be validated by the lawyer**; open points are on the checklist ([krizaka/.github#250](https://github.com/krizaka/.github/issues/250)) and block nothing. Written from the code and the deployment spec, never from a promise. Companion: [transfers outside Québec](transfers.md). Issue: akinaza#369.
> Reviewed by the person in charge of the protection of personal information: **pending** (date to be filled at the review).

## The project

Akinaza is a new electronic service: it lets an independent shop in Québec (salon, workshop, coach, cleaning, pets, consulting; never a restaurant or a bar) take bookings, send bilingual invoices with GST and QST, keep a tax ledger and prepare, never file, its GST/QST figures. It collects personal information about two groups: the **shop owners and their staff** (accounts) and the **shops' clients**. The proportionality of this assessment follows art. 3.3: sensitivity, purpose, quantity, distribution, medium.

**Roles.** For its shop-owner accounts and its billing, Akinaza (Technologies Krizaka Inc.) is the enterprise that collects. For the information about a shop's clients, the shop decides why it is held; Akinaza holds it **for the shop as a service provider under art. 18.3**, and the terms say so (terms, section 7). Question for the lawyer below.

## Data map

| Information | From whom | Why | Where it lives | Who can see it | How long | How it is destroyed |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Account: e-mail, name, password (scrypt hash), sessions (hashed tokens) | Owner, staff, signed-in client | Sign in | Database (`accounts`, `sessions`) | The person; the administrator console (IP-gated) | While the account lives | Account deletion |
| Client file: name, e-mail, phone, language, notes | The client or the shop | Run bookings and reminders | Database (`clients`) | The shop's members | Until erased at the shop's or the client's request | `privacy` erasure blanks the fields, keeps the row (invoices point to it) |
| Access notes (a key, a door code) | The client | Let the walker in | Database, sealed (AES-256-GCM) | Only the person who walks the pet | Until erased | Blanked on erasure |
| Dependants (a pet's name, kind, profile) | The client | Do the service | Database (`dependants`) | The shop | Until erased | Blanked |
| Appointments, bookings | The client or the shop | Schedule | Database | The shop | Business record | Kept as an anonymous fact after erasure |
| Visit reports: note, photo | The staff member | Tell the client how the visit went | Database (`visit_reports`) | The shop; the client by a link | Until erased | Note and photo removed; the link is revoked |
| Invoices, payments, tax ledger | The shop | Bill, prepare GST/QST | Database (append-only ledger) | The shop | **Six years** (see retention) | At the end of the period |
| Consents (service, reminders, marketing) | The client | Prove what was agreed, per purpose and text version | Database (`privacy.consent`, written once) | The shop; the client | With the proof of erasure | A withdrawal is a new row |
| Client requests and their files | The client | Ask a shop for a service | Database + media store | The shop | Until the client deletes or is erased | Rows deleted, files deleted from the store |
| Reviews: first name and an initial | A verified client | Show a score | Database | The public page | Until erased | Name and words blanked, the score kept |
| Mail queue, audit log (actions, IP address) | System | Send mails; keep a trail | Database | Administrators | Not yet bounded: **open**, see risks | Pending |
| Shop media (public photos) | The owner | The shop page | Media store (New York) | The public | While published | Removed by the owner |

Quantity: small (dev preview; a few shops). Distribution: the shop's members only; no data is sold or shared for advertising; providers per the [transfer register](transfers.md). Medium: one web application and one PostgreSQL database; no mobile app in the preview.

## Risks and measures

| Risk | Measure in the code | Residual |
| :--- | :--- | :--- |
| One shop reads another's data | Every table classified (`tenancy.ts`); shop guards; another shop's id answers 404; a test walks every route | Low |
| A stolen database copy | Volumes encrypted at rest (provider-stated); door codes sealed in the application; passwords scrypt; TLS to the database | Low to medium |
| A client cannot get or erase their data | Export and erasure from `@krizaka/privacy` contributors; the owner answers from the console; 30-day delay | Low |
| Over-collection | A client file holds what the shop needs; consent per purpose, never pre-ticked | Low |
| Data kept too long | Retention rules as data (`packages/core/src/retention.ts`); erasure keeps only what tax law keeps | Medium: the audit log and mail queue have no purge yet (open) |
| An incident goes unnoticed or unreported | Company [incident procedure and register](https://github.com/krizaka/.github/blob/main/docs/privacy/incident-procedure.md); an entry point in the admin console is planned (akinaza#392) | Medium until the console entry exists |
| Provider outside Québec | [Transfer register](transfers.md); written contracts to collect; Canadian hosting planned | Medium until contracts and regions are confirmed |
| The model that translates a shop page | Only the page's texts and a glossary leave; nothing about a client | Low |

## Retention

Rules as data in `packages/core/src/retention.ts`, with their basis: invoices and tax ledger **six years** after the end of the year they relate to (*Tax Administration Act*, CQLR c. A-6.002, art. 35; *Income Tax Act*, s. 230(4); *Excise Tax Act*, s. 286); the rest is destroyed at request (art. 23). A closed account is destroyed after the tax period.

## Decision

Proceed to the dev preview; before sign-up opens: confirm regions and collect contracts (.github#285), have the person in charge sign this assessment, have the lawyer read the open points, and bound the audit log and mail queue.

## Questions for the lawyer (also on the checklist)

- Is Akinaza a service provider of the shop under art. 18.3 for the clients' information, and does that need a separate data processing agreement?
- Is a provider's standard addendum enough for arts. 17 and 18.3? Does a CDN edge outside Canada count as a communication outside Québec?
- Is "proportionate" met by this document for a service of this size and sensitivity?
