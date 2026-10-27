import { CONSENT_TEXT_VERSION, eraseClient, eraseClientRequests } from "@akinaza/db";

import { db } from "./db";
import { mediaStorage } from "./media-storage";
import { deleteStored } from "./media-upload";

/** Removes files from the media storage, best effort: a failure is logged with the address, never the key (akinaza#210). */
export async function removeStoredFiles(urls: readonly string[]): Promise<void> {
  if (!urls.length) return;
  const media = await mediaStorage().catch(() => null);
  if (!media) return;
  for (const url of urls) {
    const removed = await deleteStored(media, url).catch(() => false);
    if (!removed) console.error(`[akinaza] a request file could not be removed from the storage: ${url}`);
  }
}

/** The erasure of a client (Loi 25): their requests and the files of those requests go first, then the file is blanked. */
export async function eraseClientEverywhere(clientId: string): Promise<boolean> {
  await removeStoredFiles(await eraseClientRequests(db(), clientId));
  return eraseClient(db(), clientId, CONSENT_TEXT_VERSION);
}
