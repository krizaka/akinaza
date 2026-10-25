import { organizeApi } from "@/lib/organize-api";

export const dynamic = "force-dynamic";

/** The saved views of the clients list: the administrator's, the shop's shared ones, mine (GET); save one (POST). */
export const GET = (req: Request) => organizeApi.listViews(req, "client");
export const POST = (req: Request) => organizeApi.createView(req, "client");
