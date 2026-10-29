# Akinaza for iOS and Android

The shop's phone app (Expo, Expo Router, `@krizaka/ui/native` in Akinaza's forest green and copper, light and dark,
French first). Same account as the web: a bearer session in the Keychain / Keystore (`@krizaka/app-client`, its
`createAuth` for the screens), the owner's API read through `@akinaza/client`, every answer parsed by `@akinaza/core`.
Decision: [ADR-004](https://github.com/krizaka/.github/blob/main/docs/adr/ADR-004-expo-app-shell.md).

| Tab (the web rail's order and words, D8) | Path (the web's) | What it shows |
| :-- | :-- | :-- |
| Aujourd'hui | `/fr/app/<shop>/today?day=&visit=` | The day strip (two weeks, the days with appointments marked: the calendar folded in) and the day's appointments as a list that opens into its detail (`ListDetail`: two panes on a tablet, one at a time on a phone; the open one is `?visit=`), with check-in and check-out in the shop's time zone; a staff member sees their own appointments only |
| Clients | `/fr/app/<shop>/clients?q=` | Search the shop's clients; « Facturer » opens a new invoice for one |
| Factures | `/fr/app/<shop>/invoices`, `/new` | The invoices; a quick invoice with GST (5 %) and QST (9.975 %) computed by `@akinaza/core` (the server's totals on known lines) |
| Livres | `/fr/app/<shop>/books?period=` | The period's GST and QST nets, to remit or to claim. Akinaza prepares the figures, it never files a return |
| Vos chiffres (opened from Livres) | `/fr/app/<shop>/figures` | « What to do now » and each figure with its meaning, its formula with the numbers read and where it comes from (`GET /api/walker/figures`, akinaza#260), in a grid that follows the size class. Akinaza prepares the figures; the merchant checks them and files the returns themselves |
| Boutique | `/fr/app/<shop>/settings` | The shop, its tax status and terms, its services; the page, the team and the hours are edited on the web |

The settings are the account's (`/fr/app/profile`), under the avatar of every header. `/fr/app` opens the member's shop at its
own address; the app's old addresses (`/fr/app/calendar`, `/fr/app/settings`…) land on the same place. Each tab tells its three
states: loading, empty (what will fill it) and an error in place with « Réessayer ».

Every tab's header carries the signed-in account (its avatar opens the profile). The paths are the web's, so a link opens
the same place on the phone and on the web.

```bash
pnpm install
cd apps/mobile
pnpm lint && pnpm typecheck && pnpm test
pnpm ios               # or: pnpm android — EXPO_PUBLIC_APP_URL=http://<your machine>:3000 for a local backend
```

Tests: Jest with `jest-expo` and Testing Library (a test per tab, the domain rules). Maestro (`.maestro/`, run in CI on every pull request by the org's `mobile-e2e.yml`, check `mobile-e2e / gate`): `smoke` (the first
screen), `tabs` (the five tabs), `aujourdhui`, `factures` and `quick-invoice`, signed in as the demo shop's owner (`PERSONA_EMAIL`, `PERSONA_PASSWORD`) against `scripts/ci-mobile-backend.sh`'s throwaway backend; the screenshots, video and JUnit report are the `maestro-e2e` artifact. `jest.resolver.js` lets Jest load the
ESM-only `@krizaka/*` packages. CI: `.github/workflows/mobile-ci.yml` (the org's `expo-ci`: lint, types, tests, the iOS
and Android bundle export).

Store builds are local (`eas build --local`, Xcode, Gradle), never in the cloud. TestFlight and the Play internal track
wait for the App Store Connect and Play Console records; the Download page says « bientôt » until then.
