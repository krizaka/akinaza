"use client";

import { isKrizakaApiError, krizakaFetch, useMutation, useQuery, useQueryClient } from "@krizaka/query";
import { Button } from "@krizaka/ui/button";
import { postToPreview, type ShopPage as DocumentPage } from "@krizaka/ui/shop";
import { ShopComposer,type ShopComposerMessages, type ShopComposerPreset } from "@krizaka/ui/shop-composer";
import { useCallback, useRef, useState } from "react";

import { useShopRoutes } from "@/components/app/ShopSession";
import { useI18n, useSay } from "@/lib/i18n-client";

export interface ComposerVersion {
  version: number;
  status: "draft" | "published" | "archived";
  createdAt: string;
}

export interface ShopComposerPanelProps {
  /** The draft to edit (else the published page, else the trade's starter). */
  draft: DocumentPage;
  /** What is live now: the diff of « Publish ». */
  published: DocumentPage;
  accent: string | null;
  /** The accent names the owner may choose, per look id: the short tested list of `shopPresets`. */
  accents: Readonly<Record<string, readonly string[]>>;
  presets: readonly ShopComposerPreset[];
  previewUrl: string;
  /** The versions at render time; the list then follows the queries. */
  versions: ComposerVersion[];
  /** Whether the role writes the page (owner, manager); otherwise the composer is not mounted. */
  canWrite: boolean;
}

/** « 422 » of the page routes: the issues of the document, with their paths, said in one line. */
const issuesOf = (error: unknown): string | null => {
  const body = isKrizakaApiError(error) ? error.body : null;
  const issues = (body as { issues?: { path: string; message: string }[] } | null)?.issues;
  return issues?.length ? issues.map((i) => `${i.path}: ${i.message}`).join("; ") : null;
};

const accentLabel = (name: string) => name.split(":").join(" · ");

/**
 * Boutique › Page › Layout (akinaza#402): the shop page composer of @krizaka/ui, its draft saved by itself, published after a diff, with the history
 * and the accent. Every call is a mutation or a query of @krizaka/query (no effect fetches): the draft is `PUT` whole, the server refuses a document
 * that is not valid with the path of each issue.
 */
export function ShopComposerPanel({ draft, published, accent, accents, presets, previewUrl, versions, canWrite }: Readonly<ShopComposerPanelProps>) {
  const { say } = useSay();
  const { messages, locale } = useI18n();
  const routes = useShopRoutes();
  const client = useQueryClient();
  const root = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState<DocumentPage>(draft);
  const [chosen, setChosen] = useState<string | null>(accent);
  const [note, setNote] = useState<string | null>(null);
  const keys = { versions: ["shop-page", "versions", routes.api("")] as const };

  const refreshPreview = useCallback(() => {
    const frame = root.current?.querySelector("iframe");
    postToPreview(frame?.contentWindow, window.location.origin, { source: "krizaka-shop-composer", type: "refresh" });
  }, []);

  const history = useQuery({
    queryKey: keys.versions,
    queryFn: async () => ((await krizakaFetch(routes.api("/api/walker/page/versions"))) as { versions: ComposerVersion[] }).versions,
    initialData: versions,
  });

  const save = useMutation({
    mutationFn: (page: DocumentPage) => krizakaFetch(routes.api("/api/walker/page/draft"), { method: "PUT", json: page }),
    onSuccess: () => { setNote(null); void client.invalidateQueries({ queryKey: keys.versions }); },
    onError: (error) => setNote(say("composerPanel.problems", { issues: issuesOf(error) ?? say(`errors.${isKrizakaApiError(error) ? error.code : "server"}`) })),
  });
  const publish = useMutation({
    mutationFn: async (page: DocumentPage) => {
      await krizakaFetch(routes.api("/api/walker/page/draft"), { method: "PUT", json: page });
      return krizakaFetch(routes.api("/api/walker/page/publish"), { method: "POST" });
    },
    onSuccess: () => { setNote(say("composerPanel.published")); void client.invalidateQueries({ queryKey: keys.versions }); refreshPreview(); },
    onError: (error) => setNote(`${say("composerPanel.publishFailed")} ${issuesOf(error) ?? ""}`.trim()),
  });
  const restore = useMutation({
    mutationFn: (version: number) => krizakaFetch(routes.api("/api/walker/page/rollback"), { method: "POST", json: { version } }),
    onSuccess: (_done, from) => { setNote(say("composerPanel.restored", { n: from })); void client.invalidateQueries({ queryKey: keys.versions }); refreshPreview(); },
    onError: (error) => setNote(say(`errors.${isKrizakaApiError(error) ? error.code : "server"}`)),
  });
  const pickAccent = useMutation({
    mutationFn: (value: string | null) => krizakaFetch(routes.api("/api/walker/page/accent"), { method: "PUT", json: { accent: value } }),
    onSuccess: (_done, value) => { setChosen(value); setNote(say("composerPanel.accentSaved")); refreshPreview(); },
    onError: (error) => setNote(say(`errors.${isKrizakaApiError(error) ? error.code : "server"}`)),
  });

  if (!canWrite) return <p className="m-0 rounded-lg border border-border-default p-4 text-sm text-fg-secondary">{say("composerPanel.readOnly")}</p>;

  const offered = accents[current.preset.id] ?? [];
  const named = (version: ComposerVersion) => say(version.status === "draft" ? "composerPanel.versionDraft" : version.status === "published" ? "composerPanel.versionPublished" : "composerPanel.versionArchived");
  return (
    <div ref={root} className="flex min-w-0 flex-col gap-4">
      <section aria-label={say("composerPanel.accent")} className="flex flex-col gap-2">
        <h2 className="m-0 font-display text-base font-bold text-fg">{say("composerPanel.accent")}</h2>
        <div role="group" aria-label={say("composerPanel.accent")} className="flex flex-wrap gap-2">
          <Button variant={chosen === null ? "primary" : "secondary"} size="sm" aria-pressed={chosen === null} disabled={pickAccent.isPending} onClick={() => pickAccent.mutate(null)}>{say("composerPanel.accentOwn")}</Button>
          {offered.map((name) => (
            <Button key={name} variant={chosen === name ? "primary" : "secondary"} size="sm" aria-pressed={chosen === name} disabled={pickAccent.isPending} onClick={() => pickAccent.mutate(name)}>{accentLabel(name)}</Button>
          ))}
        </div>
        <p className="m-0 text-xs text-fg-muted">{say("composerPanel.accentNote")}</p>
      </section>
      <p role="status" aria-live="polite" className="m-0 min-h-5 text-sm text-fg-secondary">{note}</p>
      <ShopComposer
        className="h-[85dvh] min-h-[32rem] rounded-lg border border-border-default"
        value={draft}
        published={published}
        previewUrl={previewUrl}
        presets={presets}
        messages={messages.console.composer as unknown as ShopComposerMessages}
        onChange={async (page) => { setCurrent(page); await save.mutateAsync(page); }}
        onPublish={async (page) => { setCurrent(page); await publish.mutateAsync(page).catch(() => undefined); }}
      />
      <details className="rounded-lg border border-border-default p-3">
        <summary className="cursor-pointer font-display text-base font-bold text-fg">{say("composerPanel.versions")}</summary>
        <p className="mb-2 mt-2 text-sm text-fg-secondary">{say("composerPanel.versionsLead")}</p>
        {history.data.length === 0 ? <p className="m-0 text-sm text-fg-secondary">{say("composerPanel.noVersions")}</p> : (
          <ul className="m-0 flex list-none flex-col divide-y divide-border-default p-0">
            {history.data.map((v) => (
              <li key={v.version} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="text-fg"><strong>{say("composerPanel.versionN", { n: v.version })}</strong> · {named(v)} · <time dateTime={v.createdAt}>{new Date(v.createdAt).toLocaleString(locale === "fr" ? "fr-CA" : "en-CA")}</time></span>
                {v.status === "archived" ? <Button variant="ghost" size="sm" disabled={restore.isPending} onClick={() => restore.mutate(v.version)}>{say("composerPanel.restore")}</Button> : null}
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}
