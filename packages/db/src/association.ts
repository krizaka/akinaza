import { and, asc, desc, eq } from "drizzle-orm";

import type { Db } from "./client";
import { ShopError } from "./errors";
import { accounts, associationProofs } from "./schema";

/**
 * The Association plan (ADR-003 addendum 2026-10-30): a registered non-profit, OBNL or charity pays the Starter features for
 * 1 $ a month after three free months. The shop submits ONE proof (its NEQ, its registered charity number, or the reference of its
 * incorporation document); an administrator checks it in a queue and decides (audited by the route). Until approved the account is
 * on Starter. A decision is taken once; a refused shop may submit again.
 */
export const ASSOCIATION_KINDS = ["neq", "charity", "incorporation"] as const;
export type AssociationKind = (typeof ASSOCIATION_KINDS)[number];
export const ASSOCIATION_STATUS = { pending: "pending", approved: "approved", rejected: "rejected" } as const;
export type AssociationStatus = (typeof ASSOCIATION_STATUS)[keyof typeof ASSOCIATION_STATUS];

export interface AssociationProof {
  id: string;
  kind: AssociationKind;
  reference: string;
  note: string | null;
  status: AssociationStatus;
  submittedAt: Date;
  decidedAt: Date | null;
  decisionNote: string | null;
}

/** The normal form of a reference, or null when it is not one: the NEQ is ten digits; a charity number is nine digits, RR, four digits. */
export function normalizeReference(kind: AssociationKind, raw: string): string | null {
  const text = raw.trim();
  if (kind === "neq") return /^\d{10}$/.test(text) ? text : null;
  if (kind === "charity") {
    const m = /^(\d{9})\s*RR\s*(\d{4})$/i.exec(text);
    return m ? `${m[1]}RR${m[2]}` : null;
  }
  return text.length >= 3 && text.length <= 80 ? text : null;
}

const columns = {
  id: associationProofs.id, kind: associationProofs.kind, reference: associationProofs.reference, note: associationProofs.note,
  status: associationProofs.status, submittedAt: associationProofs.submittedAt, decidedAt: associationProofs.decidedAt, decisionNote: associationProofs.decisionNote,
};

/** The account's latest proof, whatever its state, or null. */
export async function associationProofOf(db: Db, accountId: string): Promise<AssociationProof | null> {
  const [row] = await db.select(columns).from(associationProofs).where(eq(associationProofs.accountId, accountId)).orderBy(desc(associationProofs.submittedAt), desc(associationProofs.id)).limit(1);
  return (row as AssociationProof | undefined) ?? null;
}

/** Whether an administrator approved the account as an association (the latest decision stands). */
export async function associationApproved(db: Db, accountId: string): Promise<boolean> {
  return (await associationProofOf(db, accountId))?.status === ASSOCIATION_STATUS.approved;
}

/** Submits the proof. One pending at a time; none once approved; a malformed number is refused. Returns the proof's id. */
export async function submitAssociationProof(db: Db, accountId: string, input: { kind: AssociationKind; reference: string; note?: string }): Promise<string> {
  const reference = normalizeReference(input.kind, input.reference);
  if (!reference) throw new ShopError("AK_ASSOCIATION_REFERENCE");
  return db.transaction(async (tx) => {
    // Serialises the account's submissions: two at once cannot both find nothing pending.
    await tx.select({ id: accounts.id }).from(accounts).where(eq(accounts.id, accountId)).for("update");
    const [latest] = await tx.select({ status: associationProofs.status }).from(associationProofs).where(eq(associationProofs.accountId, accountId)).orderBy(desc(associationProofs.submittedAt), desc(associationProofs.id)).limit(1);
    if (latest?.status === ASSOCIATION_STATUS.pending) throw new ShopError("AK_ASSOCIATION_PENDING");
    if (latest?.status === ASSOCIATION_STATUS.approved) throw new ShopError("AK_ASSOCIATION_APPROVED");
    const [row] = await tx.insert(associationProofs).values({ accountId, kind: input.kind, reference, note: input.note?.trim().slice(0, 500) || null }).returning({ id: associationProofs.id });
    return row!.id;
  });
}

/** The proofs waiting for a decision, oldest first, with the e-mail of the account that submitted them: the administrator's queue. */
export async function pendingAssociations(db: Db): Promise<(AssociationProof & { accountId: string; email: string })[]> {
  const rows = await db
    .select({ ...columns, accountId: associationProofs.accountId, email: accounts.email })
    .from(associationProofs)
    .innerJoin(accounts, eq(accounts.id, associationProofs.accountId))
    .where(eq(associationProofs.status, ASSOCIATION_STATUS.pending))
    .orderBy(asc(associationProofs.submittedAt), asc(associationProofs.id));
  return rows as (AssociationProof & { accountId: string; email: string })[];
}

/** The administrator decides a pending proof, once. False when it is unknown or already decided. */
export async function decideAssociation(db: Db, proofId: string, adminId: string, decision: "approved" | "rejected", now: Date, note?: string): Promise<boolean> {
  const done = await db
    .update(associationProofs)
    .set({ status: decision, decidedAt: now, decidedBy: adminId, decisionNote: note?.trim().slice(0, 500) || null })
    .where(and(eq(associationProofs.id, proofId), eq(associationProofs.status, ASSOCIATION_STATUS.pending)))
    .returning({ id: associationProofs.id });
  return done.length > 0;
}
