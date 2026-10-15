import { Badge } from "@krizaka/ui/badge";
import { Card } from "@krizaka/ui/card";
import { DescriptionList } from "@krizaka/ui/description-list";

import { overview } from "@/lib/admin";
import { query } from "@/lib/db";
import { asLocale, getDictionary } from "@/lib/i18n";
import { realtimeBus } from "@/lib/realtime";
import { APP_VERSION } from "@/lib/site";

async function reachable(run: () => Promise<unknown>): Promise<boolean> {
  try {
    await run();
    return true;
  } catch {
    return false;
  }
}

/** Health (version, database, realtime) and the counts — read on the server at each visit. */
export default async function AdminOverview({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const t = getDictionary(locale).console.admin;
  const [o, db] = await Promise.all([overview(), reachable(() => query("SELECT 1"))]);
  const up = (ok: boolean) => <Badge tone={ok ? "success" : "danger"}>{ok ? t.up : t.down}</Badge>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card.Root className="p-4">
        <h2 className="mb-3 font-display text-base font-bold text-fg">{t.health}</h2>
        <DescriptionList
          items={[
            { term: t.version, details: <code className="font-mono text-xs" data-testid="app-version">{APP_VERSION}</code> },
            { term: t.database, details: up(db) },
            { term: t.realtime, details: up(realtimeBus().connected) },
          ]}
        />
      </Card.Root>
      <Card.Root className="p-4">
        <h2 className="mb-3 font-display text-base font-bold text-fg">{t.counts}</h2>
        <DescriptionList
          items={[
            { term: t.accounts, details: `${o.accounts} · ${o.admins} ${t.admins} · ${o.suspended} ${t.suspended}` },
            { term: t.shops, details: String(o.shops) },
            { term: t.clients, details: String(o.clients) },
            { term: t.today, details: String(o.appointmentsToday) },
            { term: t.invoices, details: String(o.invoices) },
          ]}
        />
      </Card.Root>
    </div>
  );
}
