import { checkIn } from "@folioviv/db";

import { visitRoute } from "../../shared";

export const dynamic = "force-dynamic";

/** The walker starts the walk (once). */
export const POST = visitRoute(checkIn, (at) => ({ checkedInAt: at.toISOString() }));
