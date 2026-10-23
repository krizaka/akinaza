import { parseFieldKey, saveEditedTranslation, shopLanguagesOf,translatableFields } from "@akinaza/db";
import { z } from "zod";

import { requireOwner } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, readJson, refuse } from "@/lib/http";

export const dynamic = "force-dynamic";

const body = z.object({ locale: z.enum(["fr", "en", "es"]), key: z.string().max(120), text: z.string().trim().min(1).max(2000) });

/** The owner's own wording of one translated text: it becomes theirs (`edited`) and is never overwritten without asking. */
export function PUT(req: Request) {
  return handle(async () => {
    const { shop } = await requireOwner(req);
    const input = await readJson(req, body);
    const languages = await shopLanguagesOf(db(), shop.id);
    if (input.locale === languages.source || !languages.enabled.includes(input.locale)) throw refuse(409, "LANGUAGE_NOT_ENABLED", "That language is not on");
    if (!parseFieldKey(input.key)) throw refuse(404, "NOT_FOUND", "Not found");
    const field = (await translatableFields(db(), shop.id, languages.source)).find((f) => f.key === input.key);
    if (!field) throw refuse(404, "NOT_FOUND", "Not found");
    await saveEditedTranslation(db(), shop.id, input.locale, input.key, input.text, field.sourceHash);
    return Response.json({ ok: true });
  });
}
