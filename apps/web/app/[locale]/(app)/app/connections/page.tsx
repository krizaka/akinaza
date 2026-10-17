import { FIELD_MAPPINGS, mappedFields, type Platform, PLATFORMS, type SyncField } from "@akinaza/core";
import { localProfile, openProposals, shopOfOwner, syncConnections, syncLogOf } from "@akinaza/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { type ConnectionsData,ConnectionsView } from "@/components/app/Connections";
import { pageSession } from "@/lib/access";
import { valueLines } from "@/lib/connections-view";
import { availablePlatforms } from "@/lib/connectors";
import { db } from "@/lib/db";
import { readEnv } from "@/lib/env";
import { asLocale, getDictionary } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.meta.connections };
}

const isPlatform = (v: string | undefined): v is Platform => !!v && (PLATFORMS as readonly string[]).includes(v);

/** The owner's connections to Google, Facebook and Instagram: what syncs, what each platform says, what happened. */
export default async function ConnectionsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const locale = asLocale((await params).locale);
  const query = await searchParams;
  const session = (await pageSession())!;
  const shop = await shopOfOwner(db(), session.account.id);
  if (!shop) notFound();
  const [connections, proposals, log, local] = await Promise.all([syncConnections(db(), shop.id), openProposals(db(), shop.id), syncLogOf(db(), shop.id), localProfile(db(), shop.id)]);
  const enabled = availablePlatforms(readEnv().APP_SOCIAL_SYNC);
  const data: ConnectionsData = {
    enabled: enabled.length > 0,
    platforms: PLATFORMS.map((platform) => {
      const row = connections.find((c) => c.platform === platform);
      const fields = mappedFields(platform);
      return {
        platform,
        fields,
        readOnly: fields.filter((f) => FIELD_MAPPINGS[platform][f]?.direction === "pull"),
        status: row?.status ?? "disconnected",
        externalLabel: row?.externalLabel ?? null,
        lastSyncAt: row?.lastSyncAt?.toISOString() ?? null,
      };
    }),
    proposals: proposals.map((p) => ({ id: p.id, platform: p.platform, items: p.items.filter((i) => i.decision === "pending").map((i) => ({ field: i.field, state: i.state, localValue: i.localValue, remoteValue: i.remoteValue })) })),
    log: log.map((l) => ({ id: l.id, platform: l.platform, field: l.field as SyncField | null, outcome: l.outcome, at: l.at.toISOString(), reason: typeof (l.detail as { reason?: unknown }).reason === "string" ? (l.detail as { reason: string }).reason : null })),
    mine: (["hours", "description", "phone", "website"] as const).flatMap((field) => {
      const lines = valueLines(field, local[field], locale);
      return lines ? [{ field, lines }] : [];
    }),
    flash: isPlatform(query.connected) ? { kind: "connected", platform: query.connected, code: null } : query.connect_error && /^[A-Z_]+$/.test(query.connect_error) ? { kind: "error", platform: isPlatform(query.platform) ? query.platform : null, code: query.connect_error } : null,
  };
  return <ConnectionsView data={data} />;
}
