import { CONSENT_TEXT_VERSION, eraseClient, eraseClientRequests } from "@akinaza/db";

import { db } from "./db";
import { deleteStored, mediaSettings } from "./media-upload";

/** Removes files from the media storage, best effort: a failure is logged with the address, never the key (akinaza#210). */
export async function removeStoredFiles(urls: readonly string[]): Promise<void> {
  const settings = mediaSettings();
  if (!settings || !urls.length) return;
  for (const url of urls) {
    const removed = await deleteStored(settings, url).catch(() => false);
    if (!removed) console.error(`[akinaza] a request file could not be removed from the storage: ${url}`);
  }
}

/** The erasure of a client (Loi 25): their requests and the files of those requests go first, then the file is blanked. */
export async function eraseClientEverywhere(clientId: string): Promise<boolean> {
  await removeStoredFiles(await eraseClientRequests(db(), clientId));
  return eraseClient(db(), clientId, CONSENT_TEXT_VERSION);
}
