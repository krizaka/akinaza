import { actorOf, ensureShopWorkspace, workspaceOf } from "@akinaza/db";
import type { Query } from "@krizaka/organize";

import { systemClock } from "@/app/system-clock";

import { query, transaction } from "./db";

/** « The workspace, organised » over the app's pool (akinaza#337): the shop's tags and saved views for clients and invoices. */
const deps = { transaction, clock: systemClock };

export const workspace = (shopId: string) => workspaceOf(deps, shopId);

/** The first visit seeds the administrator's defaults and the shop's default tag set (idempotent, one read once done). */
export const ensureWorkspace = (shopId: string) => ensureShopWorkspace(deps, shopId);

export { actorOf };

/** The app's pool as the layer's SQL runner (for the list queries: the ids a filter keeps, the tags' counts). */
export const rows: Query = (text, params) => query(text, params) as never;
