import { pullProposal } from "@akinaza/db";

import { syncRoute } from "../../shared";

export const dynamic = "force-dynamic";

/** Reads the platform's profile and stores the differences as a proposal for the owner to decide. Changes nothing else. */
export const POST = syncRoute(pullProposal);
