import { and, desc, eq, isNull } from "drizzle-orm";

import type { Db } from "./client";
import { ShopError } from "./errors";
import { clientNotes as notes, clients } from "./schema";

// @fixed: a note is a line or a paragraph, never a document (the table refuses more)
const MAX_NOTE = 2000;

export interface ClientNote {
  id: string;
  body: string;
  /** The name the author showed when they wrote it. */
  author: string;
  createdAt: string;
}

/** A client file's notes, newest first; none for a client of another shop. */
export async function clientNotes(db: Db, shopId: string, clientId: string): Promise<ClientNote[]> {
  const rows = await db.select({ id: notes.id, body: notes.body, author: notes.authorName, createdAt: notes.createdAt }).from(notes).where(and(eq(notes.shopId, shopId), eq(notes.clientId, clientId))).orderBy(desc(notes.createdAt));
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

/** Signs and dates a note on one of the shop's client files. Another shop's (or an erased) client is unknown; an empty note is refused. */
export async function addClientNote(db: Db, shopId: string, clientId: string, author: { accountId: string; name: string }, body: string, at: Date): Promise<ClientNote> {
  const text = body.trim();
  if (!text) throw new ShopError("AK_NOTE_EMPTY");
  if (text.length > MAX_NOTE) throw new ShopError("AK_NOTE_TOO_LONG");
  const [client] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, clientId), eq(clients.shopId, shopId), isNull(clients.erasedAt)));
  if (!client) throw new ShopError("AK_CLIENT_UNKNOWN");
  const [row] = await db.insert(notes).values({ shopId, clientId, authorAccountId: author.accountId, authorName: author.name, body: text, createdAt: at }).returning();
  return { id: row!.id, body: row!.body, author: row!.authorName, createdAt: row!.createdAt.toISOString() };
}
