# UX decisions — Akinaza

Each notable choice: decision · problem · principle (with source) · refused · cost · the signal that would say we are wrong.
Feedback: the pinned Discussion of the repository.

## 1. The day first: appointments beside an invoice

- **Decision**: the signed-in home is today — the appointments, and next to them an invoice with its GST and QST lines.
- **Problem**: a shop owner opens the tool between two clients; a dashboard of charts answers no question they have.
- **Principle**: match between the system and the real world (Nielsen, 1994); recognition over recall.
- **Refused**: a KPI dashboard as home.
- **Cost**: no overview of the month on the first screen.
- **Wrong if**: owners go elsewhere first thing every morning (navigation analytics, interviews of A0).

## 2. The invoice speaks its own language

- **Decision**: an invoice is drawn in its own language (French by default), whatever the page's language.
- **Problem**: a bilingual shop must hand clients a document the Charter of the French language accepts.
- **Principle**: consistency between preview and artefact — what you see is what the client gets (Shneiderman, *Designing the User Interface*).
- **Refused**: translating the invoice with the interface.
- **Cost**: an English-speaking owner sees French lines on a French invoice.
- **Wrong if**: owners ask for the preview in their own language more than for the real document — then add a toggle, never change the document.

## 3. Prepared, never filed

- **Decision**: "Prepare my tax return" shows the figures and their sources; the merchant files. Any difference between the
  assistant and the ledger is shown.
- **Problem**: trust — a tool that files for you is a tool you cannot check.
- **Principle**: keep the user in control of irreversible actions (Norman, *The Design of Everyday Things*).
- **Refused**: one-click filing; silently adopting the AI's figures.
- **Cost**: a last step outside Akinaza.
- **Wrong if**: merchants copy the figures with mistakes — then make the copy safer, still without filing.
