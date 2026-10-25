import { organizeApi } from "@/lib/organize-api";

export const dynamic = "force-dynamic";

/** Rename or recolour a tag (PATCH), or remove it (DELETE): another shop's tag is a 404. */
export const PATCH = (req: Request, { params }: { params: Promise<{ id: string }> }) => params.then(({ id }) => organizeApi.updateTag(req, "client", id));
export const DELETE = (req: Request, { params }: { params: Promise<{ id: string }> }) => params.then(({ id }) => organizeApi.removeTag(req, "client", id));
