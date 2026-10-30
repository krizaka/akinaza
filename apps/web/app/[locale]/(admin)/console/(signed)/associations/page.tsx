import { pendingAssociations } from "@akinaza/db";

import { AssociationQueue } from "@/components/admin/AssociationQueue";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** The association proofs waiting for a decision (ADR-003 addendum 2026-10-30): the administrator checks the register, then approves or refuses; audited. */
export default async function AdminAssociations() {
  const pending = await pendingAssociations(db());
  return <AssociationQueue pending={pending.map((p) => ({ id: p.id, email: p.email, kind: p.kind, reference: p.reference, note: p.note, submittedAt: p.submittedAt.toISOString() }))} />;
}
