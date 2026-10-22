import { organizeOver as over } from "@akinaza/db";

import { requireSession } from "./access";
import { query } from "./db";
import { handle, idParam } from "./http";

/** « organize » over the app's pool: a shop's name, description, avatar, tags and collection, and the owner's collections and tags. */
export const organize = () => over(async (sql, params) => query(sql, params as unknown[]));

/** A route on one of the signed-in owner's items (`/…/[id]`): the owner, the id and « organize ». Anything the package refuses answers its stable code. */
export const onItem = (req: Request, params: Promise<{ id: string }>, run: (owner: string, id: string, o: ReturnType<typeof organize>) => Promise<unknown>) =>
  handle(async () => {
    const owner = (await requireSession(req)).account.id;
    return Response.json(await run(owner, idParam((await params).id), organize()));
  });
