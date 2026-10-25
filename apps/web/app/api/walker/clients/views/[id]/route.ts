import { organizeApi } from "@/lib/organize-api";

export const dynamic = "force-dynamic";

/** Rename, change the filters of, share or unshare a view (PATCH), or delete it (DELETE): only its author, and never another shop's. */
export const PATCH = (req: Request, { params }: { params: Promise<{ id: string }> }) => params.then(({ id }) => organizeApi.updateView(req, "client", id));
export const DELETE = (req: Request, { params }: { params: Promise<{ id: string }> }) => params.then(({ id }) => organizeApi.removeView(req, "client", id));
