import { organizeApi } from "@/lib/organize-api";

export const dynamic = "force-dynamic";

/** The shop's client tags with how many clients wear each (GET), and a new tag from the owner or the manager (POST). */
export const GET = (req: Request) => organizeApi.listTags(req, "client");
export const POST = (req: Request) => organizeApi.createTag(req, "client");
