import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";

import { EXPORT_FILES, type ExportFile } from "@/lib/data-export";

type Words = { download: string; audited: string; off: string; files: Record<string, { group: string; label: string; hint: string }> };

/** The key of each file in the messages (`appointments.csv` is `appointmentsCsv`). */
export const fileKey = (file: ExportFile): string => file.replace(/\.(\w)(\w*)$/, (_, a: string, b: string) => a.toUpperCase() + b);

/**
 * Boutique › Vos données (#420): the owner's appointments, clients and invoices to download. Plain links to the streamed route: nothing is
 * built in the page, and the link carries the shop and the language, never a secret.
 */
export function DataExports({ words, enabled, href }: Readonly<{ words: Words; enabled: boolean; href: (file: ExportFile) => string }>) {
  if (!enabled) return <Alert tone="info">{words.off}</Alert>;
  const groups = [...new Set(EXPORT_FILES.map((f) => words.files[fileKey(f)]!.group))];
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <Card.Root key={group} className="flex flex-col gap-3 p-4">
          <h3 className="font-display text-base font-bold text-fg">{group}</h3>
          <p className="m-0 text-sm text-fg-muted">{words.files[fileKey(EXPORT_FILES.find((f) => words.files[fileKey(f)]!.group === group)!)]!.hint}</p>
          <div className="flex flex-wrap gap-2">
            {EXPORT_FILES.filter((f) => words.files[fileKey(f)]!.group === group).map((f) => (
              <Button key={f} asChild variant="secondary" size="md">
                <a href={href(f)} download>
                  {words.download} · {words.files[fileKey(f)]!.label}
                </a>
              </Button>
            ))}
          </div>
        </Card.Root>
      ))}
      <p className="m-0 text-sm text-fg-muted">{words.audited}</p>
    </div>
  );
}
