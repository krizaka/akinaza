import { checkOut } from "@akinaza/db";

import { visitRoute } from "../../shared";

export const dynamic = "force-dynamic";

/** The walker ends the walk: it is done, and its reports can be written. */
export const POST = visitRoute(checkOut, (at, { minutes }) => ({ checkedOutAt: at.toISOString(), minutes }));
