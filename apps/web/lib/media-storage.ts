import { createStorage, defineLayout, type Storage } from "@krizaka/storage/node";
import { type DeploymentStorage, openResolved, resolveStorage } from "@krizaka/storage/resolve";
import { readStorageSettings } from "@krizaka/storage/settings";

import { systemClock } from "@/app/system-clock";

import { appSettings } from "./settings";

/** Everything the owners' and the clients' files live under: the layout the storage checks every key against. */
export const MEDIA_ROOT = "user/akinaza/shops/";
export const mediaLayout = defineLayout([MEDIA_ROOT]);

/**
 * The media storage as the deployment's environment says it (`MEDIA_STORAGE_*`, `MEDIA_CDN_HOSTNAME`): a zone with its pull hostname, no
 * key prefix (the keys of the files already published stay the same), nothing encrypted (the files are public on the CDN). Off — `none`,
 * so every upload fails closed with a 503 — until the key, the zone and the CDN are all set. The administrator's `storage.*` settings win over it.
 */
export function deploymentMedia(source: Record<string, string | undefined> = process.env): DeploymentStorage {
  const accessKey = source.MEDIA_STORAGE_API_KEY?.trim();
  const zone = source.MEDIA_STORAGE_ZONE?.trim();
  const pullHostname = source.MEDIA_CDN_HOSTNAME?.trim();
  const environment = source.NODE_ENV === "production" ? "prod" : "dev";
  if (!accessKey || !zone || !pullHostname) return { environment, provider: "none" };
  return { environment, provider: "http", http: { endpoint: source.MEDIA_STORAGE_ENDPOINT?.trim() || "storage.bunnycdn.com", zone, accessKey, pullHostname } };
}

export interface MediaStorage {
  storage: Storage;
  /** The host that serves the files; an address of ours is `https://<cdn>/<key>`. */
  cdn: string;
  /** The key of one of our CDN addresses, or null for anything else (another host, another prefix, a traversal). */
  keyOf(url: string): string | null;
}

/** The key behind a CDN address of this host, only under the media root: nothing else can be named through it. */
export function keyOfAddress(cdn: string, url: string): string | null {
  const head = `https://${cdn}/`;
  if (!url.startsWith(head)) return null;
  const key = url.slice(head.length);
  return key.startsWith(MEDIA_ROOT) && !key.includes("..") ? key : null;
}

export interface MediaStorageOptions {
  /** The limit of THIS upload (a photo, a reel…); the administrator's `storage.maxMegabytes` applies when it is not given. */
  maxBytes?: number;
  source?: Record<string, string | undefined>;
  fetchImpl?: Parameters<typeof openResolved>[2]["fetch"];
  /** The settings of the administrator, read from the database by default (a test passes them). */
  admin?: Awaited<ReturnType<typeof readStorageSettings>>;
}

/**
 * The storage of the owners' and clients' files, or null when keeping is off (the routes answer 503). The provider is the administrator's
 * choice (`storage.*`, through `resolveStorage`) over the environment's.
 */
export async function mediaStorage(options: MediaStorageOptions = {}): Promise<MediaStorage | null> {
  const env = deploymentMedia(options.source);
  const admin = options.admin ?? (await readStorageSettings((key) => appSettings().get(key) as Promise<string | number>));
  const resolved = resolveStorage(env, admin);
  if (resolved.provider === "none") return null;
  const fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, { method: init.method, headers: init.headers, body: init.body as BodyInit | undefined }));
  const opened = openResolved(resolved, env, { fetch: fetchImpl, clock: systemClock });
  if (!opened) return null;
  const maxBytes = options.maxBytes ?? resolved.settings.maxMegabytes * 1024 * 1024;
  const storage = createStorage({ store: opened.store, layout: mediaLayout, limits: { maxBytes, signedUrlSeconds: resolved.settings.signedUrlSeconds } });
  const cdn = resolved.settings.pullHostname;
  return { storage, cdn, keyOf: (url) => keyOfAddress(cdn, url) };
}
