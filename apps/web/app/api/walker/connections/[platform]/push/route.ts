import { pushChanges } from "@akinaza/db";

import { syncRoute } from "../../shared";

export const dynamic = "force-dynamic";

/** Publishes Akinaza's values to the platform. A difference nobody decided yet is left alone and reported. */
export const POST = syncRoute(pushChanges);
