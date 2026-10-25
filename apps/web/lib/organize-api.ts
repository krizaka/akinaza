import { actorOf, tagCounts, type WorkspaceKind } from "@akinaza/db";
import { MARKERS, type ViewFilters } from "@krizaka/organize/contract";
import { z } from "zod";

import { requireShop } from "./access";
import { handle, idParam, readJson } from "./http";
import { ensureWorkspace, rows, workspace } from "./workspace";

/**
 * The HTTP surface of the shop's tags and saved views (akinaza#337), one set of routes per kind (`/api/walker/clients/tags`,
 * `/api/walker/invoices/views`…). Every handler goes through `requireShop` — the permission of the kind, so a role without it never
 * gets here — and passes the shop and the member's role to the layer, which refuses a tag write from staff (403) and answers 404 to
 * any tag, view or entity id of another shop. There is no route that moves an invoice's state: it is derived from the ledger.
 */
const PERMISSION = { client: "clients", invoice: "invoices" } as const satisfies Record<WorkspaceKind, "clients" | "invoices">;

const run = (req: Request, kind: WorkspaceKind, work: (ctx: { shopId: string; actor: ReturnType<typeof actorOf>; ws: ReturnType<typeof workspace> }) => Promise<Response>) =>
  handle(async () => {
    const { session, shop, role } = await requireShop(req, PERMISSION[kind]);
    await ensureWorkspace(shop.id);
    return work({ shopId: shop.id, actor: actorOf(session.account, role), ws: workspace(shop.id) });
  });

const tagBody = z.object({ name: z.string(), marker: z.enum(MARKERS) });
const tagPatch = z.object({ name: z.string().optional(), marker: z.enum(MARKERS).optional() });
const ids = z.array(z.string().uuid()).min(1).max(1000);
const applyBody = z.object({ ids, add: z.array(z.string().uuid()).max(50).optional(), remove: z.array(z.string().uuid()).max(50).optional() });
// The layer checks the filters as they came (the same rules as an address); here they only have to be an object.
const filters = z.record(z.string(), z.unknown());
const viewBody = z.object({ name: z.string(), filters, shared: z.boolean().optional() });
const viewPatch = z.object({ name: z.string().optional(), filters: filters.optional(), shared: z.boolean().optional() });

const noStore = { "Cache-Control": "private, no-store" };

export const organizeApi = {
  listTags: (req: Request, kind: WorkspaceKind) =>
    run(req, kind, async ({ shopId, ws }) => {
      const tags = await ws.tags.list(shopId, kind);
      const counts = Object.fromEntries(await tagCounts(rows, kind, shopId));
      return Response.json({ tags, counts }, { headers: noStore });
    }),
  createTag: (req: Request, kind: WorkspaceKind) =>
    run(req, kind, async ({ shopId, actor, ws }) => Response.json({ tag: await ws.tags.create(shopId, actor, kind, await readJson(req, tagBody)) }, { status: 201 })),
  updateTag: (req: Request, kind: WorkspaceKind, id: string) =>
    run(req, kind, async ({ shopId, actor, ws }) => Response.json({ tag: await ws.tags.update(shopId, actor, kind, idParam(id), await readJson(req, tagPatch)) })),
  removeTag: (req: Request, kind: WorkspaceKind, id: string) =>
    run(req, kind, async ({ shopId, actor, ws }) => {
      await ws.tags.remove(shopId, actor, kind, idParam(id));
      return Response.json({ ok: true });
    }),
  /** Bulk tag and untag: at most 200 entities, one transaction, one audit line per entity. */
  applyTags: (req: Request, kind: WorkspaceKind) =>
    run(req, kind, async ({ shopId, actor, ws }) => Response.json({ changed: await ws.tags.apply(shopId, actor, kind, await readJson(req, applyBody)) })),
  listViews: (req: Request, kind: WorkspaceKind) => run(req, kind, async ({ shopId, actor, ws }) => Response.json(await ws.views.list(shopId, actor, kind), { headers: noStore })),
  createView: (req: Request, kind: WorkspaceKind) =>
    run(req, kind, async ({ shopId, actor, ws }) => {
      const body = await readJson(req, viewBody);
      return Response.json({ view: await ws.views.create(shopId, actor, kind, { ...body, filters: body.filters as ViewFilters }) }, { status: 201 });
    }),
  updateView: (req: Request, kind: WorkspaceKind, id: string) =>
    run(req, kind, async ({ shopId, actor, ws }) => {
      const body = await readJson(req, viewPatch);
      return Response.json({ view: await ws.views.update(shopId, actor, idParam(id), { ...body, filters: body.filters as ViewFilters | undefined }) });
    }),
  removeView: (req: Request, kind: WorkspaceKind, id: string) =>
    run(req, kind, async ({ shopId, actor, ws }) => {
      await ws.views.remove(shopId, actor, idParam(id));
      return Response.json({ ok: true });
    }),
};
