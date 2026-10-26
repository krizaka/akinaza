import { legacyRedirect } from "@/lib/legacy-redirect";

export const dynamic = "force-dynamic";

/** The address from before the shop was in the path: a 307 to the same page of the shop last worked in (a configuration cannot know it, so it is not a 308 in `next.config`). */
export const GET = legacyRedirect("books");
