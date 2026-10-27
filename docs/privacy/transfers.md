# Transfers of personal information outside Québec

> Akinaza, register and assessment under art. 17 of the *Act respecting the protection of personal information in the private sector*, CQLR c. P-39.1 ([LégisQuébec](https://www.legisquebec.gouv.qc.ca/en/document/cs/P-39.1)). Status: **good-faith version, to be validated by the lawyer** (checklist: [krizaka/.github#250](https://github.com/krizaka/.github/issues/250)). It blocks nothing; it is read before sign-up opens.
> The register is data: [`transfers.json`](transfers.json). `apps/web/lib/transfers.test.ts` fails when the deployment spec adds a store, a region or a configuration context that file does not list. Companion: [the privacy impact assessment](efvp.md).

## What the law asks, in our words

- **Art. 17**: before communicating personal information outside Québec, assess the sensitivity of the information, the purposes, the protection measures (contractual ones included) and the legal framework of the place it goes to; communicate it only if it would receive adequate protection; a **written agreement** with the recipient. Where the information is only stored or processed for us, the same assessment applies.
- **Art. 18.3**: a service provider (hosting, storage, e-mail, payments) receives personal information without consent only under a **written contract** that sets the protection measures, limits the use to the mandate and requires destruction at the end.
- **Art. 3.3**: the assessment is proportionate to sensitivity, purpose, quantity, distribution and medium.

## Where the information is, as far as it is proven

| Store | Holds | Supplier | Place | Proof |
| :--- | :--- | :--- | :--- | :--- |
| The application | Sessions, requests in transit | DigitalOcean | Toronto (`tor`): outside Québec, in Canada | `deploy/digitalocean/app.yaml` |
| The database | Accounts, shops, clients, appointments, invoices, tax ledger, consents, visit reports and their photos | DigitalOcean (managed PostgreSQL) | Toronto (`tor1`): outside Québec, in Canada | spec header, krizaka-infra `docs/PLAN.md` |
| The media store | A shop's photos; the files a client attaches to a request | Bunny (storage zone) | New York (`ny`): **outside Canada** | `MEDIA_STORAGE_ENDPOINT` in the spec |

**Nothing is stored in Québec.** Every row above is a communication outside Québec; the media store is also outside Canada. Canadian hosting for production is *planned*, not claimed, and no public text says the media is in Canada (`public-claims.test.ts`).

## The art. 17 assessment, per place

| Factor | Application and database (Toronto) | Media store (New York) |
| :--- | :--- | :--- |
| Sensitivity | Medium: names, contacts, appointments, invoices; a pet's profile; visit notes and photos. No health, financial-account or identity-document data. A door code is sealed in the application before storage (AES-256-GCM). | Low to medium: a shop's public photos; a client's attachment to a booking request (a photo of a pet, a document the client chooses). |
| Purpose | Run the shop's bookings, invoices and tax figures. | Show the shop's page; keep a client's request files. |
| Protection measures | TLS to the database verified against its CA; credentials in secrets; volumes encrypted at rest (provider-stated); each shop reaches only its own rows (tested: `tenancy.test.ts`, `tenant-isolation.integration.test.ts`); a written contract with the provider (to collect). | Files stored under a content hash; a client's file is deleted from the store when the client is erased; access key in a secret; a written contract with the provider (to collect). |
| Legal framework of the place | Canada: federal private-sector privacy law (PIPEDA) applies to a Canadian provider's processing; Ontario is outside Québec but inside Canada. To be confirmed by the lawyer. | United States: no general federal privacy statute of the same reach; access by authorities under US law is possible. **To be assessed by the lawyer**; the lowest-risk answer is to move client files to a Canadian store. |
| Conclusion (good faith) | Adequate protection, subject to the signed provider terms. | Acceptable for shop photos meant to be public; **for client files, moving them to Canada is the planned measure** (see below). |

## Service providers

| Supplier | Role | Receives | Deployed | Place | Contract |
| :--- | :--- | :--- | :--- | :--- | :--- |
| DigitalOcean | Hosting | Everything the application and database hold | Yes | Proven for the two stores above; backups and replicas: **to confirm** | Provider's data processing terms: **to collect** |
| Bunny | Media storage and CDN | Photos and files; the CDN edge serves them | Yes | Storage: New York; CDN edge locations: **to confirm** | **to collect** |
| Mailgun | E-mail delivery | Recipient address and body of a walk report or invoice mail | No (off) | **to confirm** | **to collect** |
| Stripe | Payment processor (the subscription only) | The subscriber's e-mail and payment details, on its hosted page; never a shop client's data | No | **to confirm** | **to collect** |
| Orazaka (Krizaka's engine) | Translation of a shop page (off) | The page's texts and a glossary; never anything about a client | No | **to confirm** | **to write** |

« **to confirm** » means the region has not been checked in the supplier's console; that check and the collection of the signed terms wait on the founder: [krizaka/.github#285](https://github.com/krizaka/.github/issues/285). The company-wide list is the [supplier register](https://github.com/krizaka/.github/blob/main/docs/security/isms/supplier-register.json).

## Measures planned

1. Confirm each region and collect each provider's terms (.github#285).
2. Canadian hosting for production, and for client files first (planned; not claimed anywhere).
3. Add the engine's hosting to this register before translation is turned on.

## Open points for the lawyer (all on the checklist, none blocks)

- Is a provider's standard data processing addendum enough for arts. 17 and 18.3, or do we need our own agreement?
- Does a CDN edge outside Canada count as a communication outside Québec?
- Is the PIPEDA-governed Canadian processor in Ontario "adequate" for art. 17 without further measures?
- The United States store: what must the notice say, and is moving client files to Canada required before opening?
