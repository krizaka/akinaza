import { organizeApi } from "@/lib/organize-api";

export const dynamic = "force-dynamic";

/** Bulk tag and untag `{ ids, add, remove }`: at most 200 invoices, one transaction, one audit line per invoice. One id of another shop and nothing changes (404). */
export const POST = (req: Request) => organizeApi.applyTags(req, "invoice");
