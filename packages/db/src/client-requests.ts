import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "./client";
import { ShopError } from "./errors";
import { clientRequestFiles, clientRequests, clients, services, shopZones, staff } from "./schema";

/**
 * « Mes demandes » (akinaza#210): a client keeps a request at a shop — a service, a preferred person, an area, a note, a
 * few files — to renew it in one tap. Every operation is on the client's own file (the caller proved it with
 * `requireOwnClient`); the files' bytes are on the media storage, this keeps their addresses. Deleting a request, or
 * erasing the client, answers the addresses to remove from the storage.
 */
export const CLIENT_REQUEST_RULES = { maxRequests: 20, maxFiles: 5 } as const;

const refuse = (code: string): never => {
  throw new ShopError(code);
};

export const clientRequestInputSchema = z.object({
  serviceId: z.uuid(),
  staffId: z.uuid().nullish(),
  zoneId: z.uuid().nullish(),
  title: z.string().trim().min(1).max(80),
  note: z.string().trim().max(500).nullish(),
});
export type ClientRequestInput = z.input<typeof clientRequestInputSchema>;

export interface ClientRequestView {
  id: string;
  title: string;
  note: string | null;
  serviceId: string;
  serviceNameFr: string;
  serviceNameEn: string;
  staffId: string | null;
  staffName: string | null;
  zoneId: string | null;
  files: { id: string; url: string; kind: "image" | "pdf" }[];
  createdAt: Date;
}

/** Saves a request on the client's file; the service, the person and the area must be the client's shop's own. */
export async function saveClientRequest(db: Db, clientId: string, raw: ClientRequestInput): Promise<string> {
  const input = clientRequestInputSchema.parse(raw);
  const [client] = await db.select({ shopId: clients.shopId }).from(clients).where(eq(clients.id, clientId));
  if (!client) return refuse("AK_CLIENT_UNKNOWN");
  const [service] = await db.select({ id: services.id }).from(services).where(and(eq(services.id, input.serviceId), eq(services.shopId, client.shopId)));
  if (!service) return refuse("AK_SERVICE_UNKNOWN");
  if (input.staffId && !(await db.select({ id: staff.id }).from(staff).where(and(eq(staff.id, input.staffId), eq(staff.shopId, client.shopId)))).length) refuse("AK_STAFF_UNKNOWN");
  if (input.zoneId && !(await db.select({ id: shopZones.id }).from(shopZones).where(and(eq(shopZones.id, input.zoneId), eq(shopZones.shopId, client.shopId)))).length) refuse("AK_ZONE_REQUIRED");
  const [{ count }] = (await db.select({ count: sql<number>`count(*)::int` }).from(clientRequests).where(eq(clientRequests.clientId, clientId))) as [{ count: number }];
  if (count >= CLIENT_REQUEST_RULES.maxRequests) refuse("AK_REQUESTS_FULL");
  const [row] = await db
    .insert(clientRequests)
    .values({ clientId, serviceId: input.serviceId, staffId: input.staffId ?? null, zoneId: input.zoneId ?? null, title: input.title, note: input.note || null })
    .returning({ id: clientRequests.id });
  return row!.id;
}

/** The client's requests at the shop, newest first, with their files. */
export async function clientRequestsOf(db: Db, clientId: string): Promise<ClientRequestView[]> {
  const rows = await db
    .select({ r: clientRequests, serviceNameFr: services.nameFr, serviceNameEn: services.nameEn, staffName: staff.name })
    .from(clientRequests)
    .innerJoin(services, eq(services.id, clientRequests.serviceId))
    .leftJoin(staff, eq(staff.id, clientRequests.staffId))
    .where(eq(clientRequests.clientId, clientId))
    .orderBy(desc(clientRequests.createdAt));
  const files = rows.length ? await db.select().from(clientRequestFiles).where(inArray(clientRequestFiles.requestId, rows.map((x) => x.r.id))).orderBy(asc(clientRequestFiles.createdAt)) : [];
  return rows.map(({ r, serviceNameFr, serviceNameEn, staffName }) => ({
    id: r.id,
    title: r.title,
    note: r.note,
    serviceId: r.serviceId,
    serviceNameFr,
    serviceNameEn,
    staffId: r.staffId,
    staffName,
    zoneId: r.zoneId,
    files: files.filter((f) => f.requestId === r.id).map((f) => ({ id: f.id, url: f.url, kind: f.kind })),
    createdAt: r.createdAt,
  }));
}

/** The request, when it is this client's; else refused as unknown (one cannot tell another's from none). */
export async function ownClientRequest(db: Db, clientId: string, requestId: string): Promise<{ id: string; shopId: string }> {
  const [row] = await db
    .select({ id: clientRequests.id, shopId: clients.shopId })
    .from(clientRequests)
    .innerJoin(clients, eq(clients.id, clientRequests.clientId))
    .where(and(eq(clientRequests.id, requestId), eq(clientRequests.clientId, clientId)));
  return row ?? refuse("AK_REQUEST_UNKNOWN");
}

/** Records a file stored for a request (its address, kind and size), within the per-request limit. */
export async function addClientRequestFile(db: Db, clientId: string, requestId: string, file: { url: string; kind: "image" | "pdf"; bytes: number }): Promise<string> {
  await ownClientRequest(db, clientId, requestId);
  const [{ count }] = (await db.select({ count: sql<number>`count(*)::int` }).from(clientRequestFiles).where(eq(clientRequestFiles.requestId, requestId))) as [{ count: number }];
  if (count >= CLIENT_REQUEST_RULES.maxFiles) refuse("AK_REQUEST_FILES_FULL");
  const [row] = await db.insert(clientRequestFiles).values({ requestId, url: file.url, kind: file.kind, bytes: file.bytes }).returning({ id: clientRequestFiles.id });
  return row!.id;
}

/** Removes one file of a request; answers its address, for the storage. */
export async function removeClientRequestFile(db: Db, clientId: string, requestId: string, fileId: string): Promise<string | null> {
  await ownClientRequest(db, clientId, requestId);
  const [row] = await db.delete(clientRequestFiles).where(and(eq(clientRequestFiles.id, fileId), eq(clientRequestFiles.requestId, requestId))).returning({ url: clientRequestFiles.url });
  return row?.url ?? null;
}

/** Deletes a request and its files' rows; answers the files' addresses, for the storage. */
export async function deleteClientRequest(db: Db, clientId: string, requestId: string): Promise<string[]> {
  await ownClientRequest(db, clientId, requestId);
  const files = await db.select({ url: clientRequestFiles.url }).from(clientRequestFiles).where(eq(clientRequestFiles.requestId, requestId));
  await db.delete(clientRequests).where(eq(clientRequests.id, requestId));
  return files.map((f) => f.url);
}

/** Every request of a client, removed (the erasure of Loi 25); answers the files' addresses, for the storage. */
export async function eraseClientRequests(db: Db, clientId: string): Promise<string[]> {
  const files = await db
    .select({ url: clientRequestFiles.url })
    .from(clientRequestFiles)
    .innerJoin(clientRequests, eq(clientRequests.id, clientRequestFiles.requestId))
    .where(eq(clientRequests.clientId, clientId));
  await db.delete(clientRequests).where(eq(clientRequests.clientId, clientId));
  return files.map((f) => f.url);
}
