import { createFoliovivApi, createQueries } from "@folioviv/client";
import { createApiClient, createAppDiscovery, createSessionStore, secureStorage } from "@krizaka/app-client";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

import { currentLocale } from "./i18n";

/**
 * The app's wiring, once: where the backend is comes from the signed manifest on krizaka.com (ADR-003), not from the
 * build; `EXPO_PUBLIC_APP_URL` points a development build at another machine, `EXPO_PUBLIC_APP_ENV` picks the manifest entry.
 */
export const PRODUCT = "folioviv";
export const APP_VERSION = Constants.expoConfig?.version ?? "0.0.0";

/** Until a verified manifest answers: the development app (www.folioviv.com is the public « coming soon » face, not the app). */
const BAKED = { apiBase: "https://dev.folioviv.com", webBase: "https://dev.folioviv.com" } as const;
// @fixed: a phone call that waits longer is a phone that has lost its network
const API_TIMEOUT_MS = 20_000;

const storage = secureStorage(SecureStore);
export const session = createSessionStore({ storage, key: "folioviv.session" });

export const discovery = createAppDiscovery({
  product: PRODUCT,
  hostSuffix: "folioviv.com",
  appVersion: APP_VERSION,
  baked: BAKED,
  storage,
  env: { url: process.env.EXPO_PUBLIC_APP_URL, environment: process.env.EXPO_PUBLIC_APP_ENV },
});

export const api = createApiClient({
  baseUrl: () => discovery.getService(PRODUCT).apiBase,
  session,
  fetch: (input, init) => fetch(input, init),
  language: currentLocale,
  productName: "Folioviv",
  timeoutMs: API_TIMEOUT_MS,
});

export const folioviv = createFoliovivApi(api, session);
export const queries = createQueries(folioviv);

/** The website, for what the app leaves to it (creating an account, the legal pages). */
export const webUrl = (path = ""): string => `${discovery.getService(PRODUCT).webBase}${path}`;

/** The id `@krizaka/ui` and `@krizaka/org` know this product by. */
export const BRAND_ID = "folioviv";
