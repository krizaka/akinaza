# Folioviv for the Mac

The owner's back office (the day, clients, invoices, books, the shop) in a native window. No point of sale: it stays a stub
behind `APP_POS_ENABLED` (#79's countertop scope is closed, D9). Tauri 2 on
`tauri-plugin-krizaka` of [`krizaka-tauri-kit`](https://github.com/krizaka/krizaka-tauri-kit) (ADR-005).

The window shows the hosted web app, which stays the one place where the screens are written (the web's `/app` space). The native layer adds what a
browser tab cannot:

- the menu bar in the Mac's language (`src-tauri/menu/fr.json`, `en.json`; French unless the Mac speaks English), the web rail's
  order and words: ⌘1 Aujourd'hui · ⌘2 Clients · ⌘3 Factures · ⌘4 Livres · ⌘5 Boutique (Today · Clients · Invoices · Books · Shop)
  — the web's own paths, in the shop and the language of the page on screen (`/en/app/<shop>/settings`), else the web's short
  address that opens the shop last worked in (`apps/web/lib/app-addresses.test.ts` checks each is a live page of the web); ⌘R
  reloads the page;
- `folioviv://app/…` and `https://www.folioviv.com/app/…` links that open the same page in the window;
- the navigation guard: the window stays on Folioviv's own address, other web links open in the browser, the rest is refused. The hosted page has no Tauri capability: it cannot call the app, and nothing on the Mac is
readable from it.

```bash
pnpm install
cd apps/desktop
pnpm check                        # Rust tests (the sections' addresses, the menu's words); on macOS, as in desktop.yml
FOLIOVIV_APP_URL=http://localhost:3000 pnpm tauri dev
```

The deployment shown is `https://www.folioviv.com` (dev.folioviv.com redirects there); a build for another one sets `FOLIOVIV_APP_URL`
(https, or loopback in development).

## Release

A `desktop-v<version>` tag builds the arm64 `.dmg` (workflow `desktop.yml`, the org's `tauri-macos.yml`) and attaches it to the release. It is
not signed until a Developer ID Application certificate and the notarisation credentials are secrets of the repository
(`APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_TEAM_ID`, `APPLE_API_ISSUER`, `APPLE_API_KEY`,
`APPLE_API_KEY_P8`): until then right-click the app, then Open.
