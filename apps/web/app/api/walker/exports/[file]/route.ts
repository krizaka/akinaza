import { exportAppointments, exportClients, exportInvoices } from "@akinaza/db";

import { requireShop } from "@/lib/access";
import { audit } from "@/lib/audit";
import { appointmentsCsv, appointmentsHeader, appointmentsIcs, BOM, clientsCsv, clientsHeader, type ExportFile, formatOf, icsClose, icsOpen, invoicesCsv, invoicesHeader, isExportFile, kindOf } from "@/lib/data-export";
import { db } from "@/lib/db";
import { handle, refuse } from "@/lib/http";
import { asLocale, getDictionary } from "@/lib/i18n";
import { limit } from "@/lib/rate-limit";
import { appSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Text chunks of one export, one batch of rows at a time: a big shop never sits whole in memory. */
async function* chunks(file: ExportFile, shop: { id: string; name: string; timezone: string }, locale: "fr" | "en", now: Date): AsyncGenerator<string> {
  const words = getDictionary(locale).console.exports;
  switch (file) {
    case "appointments.csv":
      yield BOM + appointmentsHeader(words);
      for await (const rows of exportAppointments(db(), shop.id)) yield appointmentsCsv(rows, words, locale, shop.timezone);
      return;
    case "appointments.ics":
      yield icsOpen(shop.name);
      for await (const rows of exportAppointments(db(), shop.id)) yield appointmentsIcs(rows, words, locale, now);
      yield icsClose();
      return;
    case "clients.csv":
      yield BOM + clientsHeader(words);
      for await (const rows of exportClients(db(), shop.id)) yield clientsCsv(rows, words, shop.timezone);
      return;
    case "invoices.csv":
      yield BOM + invoicesHeader(words);
      for await (const rows of exportInvoices(db(), shop.id)) yield invoicesCsv(rows, words);
  }
}

/**
 * The owner's data, downloaded (#420, ADR-004 §5): `appointments.csv`, `appointments.ics`, `clients.csv`, `invoices.csv`. The `privacy` permission
 * (the owner: the shop holds this data under Loi 25), audited, streamed, and only what the owner already sees: no access note, no secret, no erased person.
 */
export function GET(req: Request, ctx: { params: Promise<{ file: string }> }) {
  return handle(async () => {
    // The session and the shop come first: a caller with no right here learns nothing of which files exist.
    const { shop, session } = await requireShop(req, "privacy");
    const file = (await ctx.params).file;
    if (!isExportFile(file)) throw refuse(404, "NOT_FOUND", "Not found");
    if (!(await appSettings().get("exports.data.enabled"))) throw refuse(403, "FEATURE_OFF", "This feature is switched off", { feature: "exports.data" });
    limit("data-export", req, session.account.id, [20, 3600]);
    const locale = asLocale(new URL(req.url).searchParams.get("locale") ?? "fr");
    await audit({ action: "shop.data_exported", actorId: session.account.id, actorLabel: session.account.email, targetId: shop.id, detail: { kind: kindOf(file), format: formatOf(file) }, headers: req.headers });
    const encoder = new TextEncoder();
    const source = chunks(file, shop, locale, new Date());
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const next = await source.next();
        if (next.done) controller.close();
        else controller.enqueue(encoder.encode(next.value));
      },
      async cancel() {
        await source.return(undefined);
      },
    });
    return new Response(body, {
      headers: {
        "Content-Type": formatOf(file) === "ics" ? "text/calendar; charset=utf-8" : "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="akinaza-${file}"`,
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  });
}
