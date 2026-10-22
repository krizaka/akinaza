import { organizeOver as over } from "@akinaza/db";

import { query } from "./db";

/** « organize » over the app's pool: a shop's name, description, avatar, tags and collection, and the owner's collections and tags. */
export const organize = () => over(async (sql, params) => query(sql, params as unknown[]));
