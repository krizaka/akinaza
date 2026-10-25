import { organizeApi } from "@/lib/organize-api";

export const dynamic = "force-dynamic";

/** The shop's invoice tags with how many invoices wear each (GET), and a new tag from the owner or the manager (POST). */
export const GET = (req: Request) => organizeApi.listTags(req, "invoice");
export const POST = (req: Request) => organizeApi.createTag(req, "invoice");
