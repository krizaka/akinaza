import { createAkinazaApi, createQueries } from "@akinaza/client";
import { createApiClient, createAppDiscovery, createSessionStore, secureStorage } from "@krizaka/app-client";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

import { currentLocale } from "./i18n";

/**
 * The app's wiring, once: where the backend is comes from the signed manifest on krizaka.com (ADR-003), not from the
 * build; `EXPO_PUBLIC_APP_URL` points a development build at another machine, `EXPO_PUBLIC_APP_ENV` picks the manifest entry.
 */
export const PRODUCT = "akinaza";
export const APP_VERSION = Constants.expoConfig?.version ?? "0.0.0";

/** Until a verified manifest answers: the address the web answers on (dev.akinaza.com redirects there). */
const BAKED = { apiBase: "https://www.akinaza.com", webBase: "https://www.akinaza.com" } as const;
// @fixed: a phone call that waits longer is a phone that has lost its network
const API_TIMEOUT_MS = 20_000;

const storage = secureStorage(SecureStore);
export const session = createSessionStore({ storage, key: "akinaza.session" });

export const discovery = createAppDiscovery({
  product: PRODUCT,
  hostSuffix: "akinaza.com",
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
  productName: "Akinaza",
  timeoutMs: API_TIMEOUT_MS,
});

export const akinaza = createAkinazaApi(api, session);
export const queries = createQueries(akinaza);

/** The website, for what the app leaves to it (creating an account, the legal pages). */
export const webUrl = (path = ""): string => `${discovery.getService(PRODUCT).webBase}${path}`;
