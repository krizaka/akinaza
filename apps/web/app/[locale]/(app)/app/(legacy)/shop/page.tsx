import { legacyRedirect } from "@/lib/legacy-redirect";

export const dynamic = "force-dynamic";

/** The address from before the shop was in the path: it opens the same page in the shop last worked in. */
export default legacyRedirect("setup");
