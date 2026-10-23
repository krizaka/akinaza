# Akinaza for iOS and Android

The shop's phone app (Expo, Expo Router, `@krizaka/ui/native` in Akinaza's forest green and copper, light and dark,
French first). Same account as the web: a bearer session in the Keychain / Keystore (`@krizaka/app-client`, its
`createAuth` for the screens), the owner's API read through `@akinaza/client`, every answer parsed by `@akinaza/core`.
Decision: [ADR-004](https://github.com/krizaka/.github/blob/main/docs/adr/ADR-004-expo-app-shell.md).

| Tab | What it shows |
| :-- | :-- |
| Today (`/fr/app?date=`) | The day's visits in the shop's time zone, check-in and check-out; a staff member sees their own appointments only |
| Calendar (`/fr/app/calendar?month=`) | The month, visits and bookings per day |
| Invoices (`/fr/app/invoices`, `/new`) | The invoices; a quick invoice with GST (5 %) and QST (9.975 %) computed by `@akinaza/core`. Akinaza prepares the figures, it never files a return |
| Clients (`/fr/app/clients?q=`) | Search the shop's clients |
| Settings | The account, the language, the shop, sign out |

Every tab's header carries the signed-in account (its avatar opens the account and settings). The paths are the web's
short addresses under the language, so a link opens the same place.

```bash
pnpm install
cd apps/mobile
pnpm lint && pnpm typecheck && pnpm test
pnpm ios               # or: pnpm android — EXPO_PUBLIC_APP_URL=http://<your machine>:3000 for a local backend
```

Tests: Jest with `jest-expo` and Testing Library (screens and the domain rules). `jest.resolver.js` lets Jest load the
ESM-only `@krizaka/*` packages. CI: `.github/workflows/mobile-ci.yml` (the org's `expo-ci`: lint, types, tests, the iOS
and Android bundle export).

Store builds are local (`eas build --local`, Xcode, Gradle), never in the cloud. TestFlight and the Play internal track
wait for the App Store Connect and Play Console records; the Download page says « bientôt » until then.
