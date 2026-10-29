"use client";

import type { TermIssueReason } from "@akinaza/core";
import { krizakaFetch, KrizakaQueryProvider, useMutation, useQuery, useQueryClient } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { DataTable, type DataTableColumn } from "@krizaka/ui/data-table";
import { Field, Input, Textarea } from "@krizaka/ui/field";
import { useId, useMemo, useState } from "react";
import { z } from "zod";

import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";
import { addTerm, lineIssue, removeTerm, replaceTerm, termRows } from "@/lib/protected-terms-edit";

import { formatDate } from "./format";

type Say = ReturnType<typeof useSay>["say"];
type Lang = ReturnType<typeof useSay>["locale"];

const HOLDS = ["admin-slug-holds"] as const;
const TERMS = ["admin-slug-terms"] as const;
const TERMS_KEY = "slugs.protectedTerms";
const KIND_TONE = { word: "warning", pattern: "accent", comment: "neutral" } as const;

const held = z.object({
  shopId: z.string(),
  name: z.string(),
  slug: z.string(),
  term: z.string().nullable(),
  heldAt: z.string().nullable(),
  ownerEmail: z.string().nullable(),
  published: z.boolean(),
  note: z.string().nullable(),
  reviewedAt: z.string().nullable(),
});
type Held = z.infer<typeof held>;
const holdsAnswer = z.object({ held: z.array(held) });
const termsAnswer = z.object({ values: z.record(z.string(), z.unknown()) });
const reportAnswer = z.object({
  apply: z.boolean(),
  notified: z.number(),
  shops: z.array(z.object({ shopId: z.string(), name: z.string(), slug: z.string(), matched: z.string(), ownerEmail: z.string().nullable() })),
});
type Report = z.infer<typeof reportAnswer>;

/**
 * The administrator's side of the anti-phishing addresses (ADR-005, akinaza#537): the queue of held shop addresses (the term that matched, a preview,
 * clear or keep held with a reason, all audited), the protected terms (words and /regex/, a pattern that could backtrack refused where it is typed),
 * and the one-off re-judging of the shops that predate the hold (a report first, then apply).
 */
export function SlugHoldsView() {
  return (
    <KrizakaQueryProvider>
      <div className="flex flex-col gap-10" data-testid="slug-holds">
        <HoldQueue />
        <ProtectedTerms />
        <Rejudge />
      </div>
    </KrizakaQueryProvider>
  );
}

function Heading({ id, title, lead }: Readonly<{ id: string; title: string; lead: string }>) {
  return (
    <div className="flex flex-col gap-1">
      <h2 id={id} className="m-0 font-display text-lg font-bold text-fg">{title}</h2>
      <p className="m-0 max-w-[70ch] text-sm text-fg-secondary">{lead}</p>
    </div>
  );
}

/** The address as a visitor would read it in the bar, the matched part marked. */
export function AddressPreview({ slug, term }: Readonly<{ slug: string; term: string | null }>) {
  const at = term ? slug.toLowerCase().indexOf(term) : -1;
  return (
    <span className="break-all font-mono text-sm text-fg" data-testid="address-preview">
      {at >= 0 ? (
        <>
          {slug.slice(0, at)}
          <mark className="rounded-sm bg-warning-subtle px-0.5 text-fg">{slug.slice(at, at + term!.length)}</mark>
          {slug.slice(at + term!.length)}
        </>
      ) : (
        slug
      )}
      <span className="text-fg-secondary">.akinaza.shop</span>
    </span>
  );
}

function HoldQueue() {
  const { say, locale } = useSay();
  const [selected, setSelected] = useState<string | null>(null);
  const data = useQuery({ queryKey: HOLDS, queryFn: () => krizakaFetch("/api/admin/slug-holds", { schema: holdsAnswer }) });
  const columns = useMemo(() => holdColumns(say, locale, setSelected), [say, locale]);
  if (!data.data) return null;
  const rows = data.data.held;
  const current = rows.find((r) => r.shopId === selected) ?? null;
  return (
    <section aria-labelledby="holds-title" className="flex flex-col gap-3">
      <Heading id="holds-title" title={say("admin.slugHolds.queue.title")} lead={say("admin.slugHolds.queue.lead")} />
      {rows.length === 0 ? <p className="m-0 text-sm text-fg-secondary" data-testid="holds-empty">{say("admin.slugHolds.queue.empty")}</p> : <DataTable caption={say("admin.slugHolds.queue.title")} rows={rows} columns={columns} getRowId={(r) => r.shopId} rowLabel={(r) => r.name} />}
      {current ? <HoldReview shop={current} onDone={() => setSelected(null)} /> : null}
    </section>
  );
}

function holdColumns(say: Say, locale: Lang, open: (id: string) => void): DataTableColumn<Held>[] {
  return [
    { id: "name", header: say("admin.slugHolds.queue.shop"), sortable: true, filter: "text", card: "title", value: (r) => r.name },
    { id: "slug", header: say("admin.slugHolds.queue.address"), value: (r) => r.slug, cell: (r) => <AddressPreview slug={r.slug} term={r.term} /> },
    { id: "term", header: say("admin.slugHolds.queue.term"), filter: "facet", value: (r) => r.term ?? "", cell: (r) => (r.term ? <Badge tone="warning">{r.term}</Badge> : "—") },
    { id: "heldAt", header: say("admin.slugHolds.queue.heldAt"), sortable: true, value: (r) => r.heldAt ?? "", cell: (r) => (r.heldAt ? formatDate(r.heldAt, locale, true) : "—") },
    { id: "reviewed", header: say("admin.slugHolds.queue.reviewed"), value: (r) => (r.reviewedAt ? "yes" : "no"), filter: "facet", cell: (r) => (r.reviewedAt ? <Badge tone="neutral">{say("admin.slugHolds.queue.kept")}</Badge> : <Badge tone="accent">{say("admin.slugHolds.queue.new")}</Badge>) },
    { id: "open", header: say("admin.slugHolds.queue.review"), cell: (r) => <Button variant="ghost" size="sm" onClick={() => open(r.shopId)}>{say("admin.slugHolds.queue.review")}</Button> },
  ];
}

function HoldReview({ shop, onDone }: Readonly<{ shop: Held; onDone: () => void }>) {
  const { say, locale } = useSay();
  const client = useQueryClient();
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const reasonId = useId();
  const decide = useMutation({
    mutationFn: ({ path, json }: { path: string; json?: unknown }) => krizakaFetch(path, { method: "POST", ...(json ? { json } : {}) }),
    onSuccess: async () => {
      setReason("");
      await client.invalidateQueries({ queryKey: HOLDS });
      onDone();
    },
    onError: (error) => setProblem(say(`errors.${errorKey(error)}`)),
  });
  const base = `/api/admin/slug-holds/${shop.shopId}`;
  const run = (path: string, json?: unknown) => {
    setProblem(null);
    decide.mutate({ path, json });
  };
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border p-4" data-testid="hold-review">
      <div className="flex items-center justify-between gap-2">
        <h3 className="m-0 text-base font-bold text-fg">{say("admin.slugHolds.review.title", { shop: shop.name })}</h3>
        <Button variant="ghost" size="sm" onClick={onDone}>{say("admin.slugHolds.review.hide")}</Button>
      </div>
      {problem ? <Alert tone="danger">{problem}</Alert> : null}
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-fg-secondary">{say("admin.slugHolds.review.preview")}</dt>
        <dd className="m-0"><AddressPreview slug={shop.slug} term={shop.term} /></dd>
        <dt className="text-fg-secondary">{say("admin.slugHolds.queue.term")}</dt>
        <dd className="m-0">{shop.term ?? "—"}</dd>
        <dt className="text-fg-secondary">{say("admin.slugHolds.review.owner")}</dt>
        <dd className="m-0">{shop.ownerEmail ?? "—"}</dd>
        <dt className="text-fg-secondary">{say("admin.slugHolds.review.page")}</dt>
        <dd className="m-0">{say(shop.published ? "admin.slugHolds.review.published" : "admin.slugHolds.review.draft")}</dd>
        {shop.note ? (
          <>
            <dt className="text-fg-secondary">{say("admin.slugHolds.review.note")}</dt>
            <dd className="m-0">{shop.note}{shop.reviewedAt ? ` (${formatDate(shop.reviewedAt, locale, true)})` : ""}</dd>
          </>
        ) : null}
      </dl>
      <p className="m-0 text-sm text-fg-secondary">{say("admin.slugHolds.review.effect")}</p>
      <div>
        <Button variant="primary" size="md" disabled={decide.isPending} onClick={() => run(base)}>{say("admin.slugHolds.review.clear")}</Button>
      </div>
      <Field.Root>
        <Field.Label htmlFor={reasonId}>{say("admin.slugHolds.review.reason")}</Field.Label>
        <Textarea id={reasonId} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        <Field.Hint>{say("admin.slugHolds.review.reasonHint")}</Field.Hint>
      </Field.Root>
      <div>
        <Button variant="secondary" size="md" disabled={decide.isPending || reason.trim() === ""} onClick={() => run(`${base}/keep`, { reason: reason.trim() })}>{say("admin.slugHolds.review.keep")}</Button>
      </div>
    </div>
  );
}

function ProtectedTerms() {
  const { say } = useSay();
  const client = useQueryClient();
  const [problem, setProblem] = useState<string | null>(null);
  const data = useQuery({ queryKey: TERMS, queryFn: () => krizakaFetch("/api/admin/settings", { schema: termsAnswer }) });
  const save = useMutation({
    mutationFn: (value: string) => krizakaFetch(`/api/admin/settings/${TERMS_KEY}`, { method: "PUT", json: { value } }),
    onSuccess: () => client.invalidateQueries({ queryKey: TERMS }),
    onError: (error) => setProblem(say(`errors.${errorKey(error)}`)),
  });
  const stored = data.data ? String(data.data.values[TERMS_KEY] ?? "") : null;
  if (stored === null) return null;
  const change = (next: string) => {
    setProblem(null);
    return save.mutateAsync(next).then(() => true, () => false);
  };
  const rows = termRows(stored);
  return (
    <section aria-labelledby="terms-title" className="flex flex-col gap-3" data-testid="protected-terms">
      <Heading id="terms-title" title={say("admin.slugHolds.terms.title")} lead={say("admin.slugHolds.terms.lead")} />
      {problem ? <Alert tone="danger">{problem}</Alert> : null}
      <TermForm label={say("admin.slugHolds.terms.add")} submit={say("admin.slugHolds.terms.addSubmit")} initial="" busy={save.isPending} onSubmit={(line) => change(addTerm(stored, line))} clearAfter />
      {rows.length === 0 ? (
        <p className="m-0 text-sm text-fg-secondary">{say("admin.slugHolds.terms.empty")}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label={say("admin.slugHolds.terms.title")}>
          {rows.map((row) => (
            <TermItem key={`${row.index}:${row.text}`} row={row} busy={save.isPending} onEdit={(line) => change(replaceTerm(stored, row.index, line))} onRemove={() => void change(removeTerm(stored, row.index))} />
          ))}
        </ul>
      )}
    </section>
  );
}

function IssueText({ reason }: Readonly<{ reason: TermIssueReason }>) {
  const { say } = useSay();
  return <>{say(`admin.slugHolds.terms.issues.${reason}`)}</>;
}

/** One line: a word or a /pattern/, checked as it is typed with the same rules as the save. */
export function TermForm({ label, submit, initial, busy, onSubmit, clearAfter, onCancel }: Readonly<{ label: string; submit: string; initial: string; busy: boolean; onSubmit: (line: string) => Promise<boolean>; clearAfter?: boolean; onCancel?: () => void }>) {
  const { say } = useSay();
  const [line, setLine] = useState(initial);
  const id = useId();
  const issue = lineIssue(line);
  const text = line.trim();
  return (
    <div className="flex flex-col gap-2">
      <Field.Root>
        <Field.Label htmlFor={id}>{label}</Field.Label>
        <Input
          id={id}
          value={line}
          autoComplete="off"
          spellCheck={false}
          invalid={issue !== undefined}
          aria-describedby={`${id}-help`}
          onChange={(e) => setLine(e.target.value)}
        />
        {issue ? <Field.Error id={`${id}-help`} role="alert"><IssueText reason={issue} /></Field.Error> : <Field.Hint id={`${id}-help`}>{say("admin.slugHolds.terms.hint")}</Field.Hint>}
      </Field.Root>
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="md"
          disabled={busy || text === "" || issue !== undefined}
          onClick={() => void onSubmit(text).then((ok) => ok && clearAfter && setLine(""))}
        >
          {submit}
        </Button>
        {onCancel ? <Button variant="ghost" size="md" onClick={onCancel}>{say("admin.slugHolds.terms.cancel")}</Button> : null}
      </div>
    </div>
  );
}

export function TermItem({ row, busy, onEdit, onRemove }: Readonly<{ row: ReturnType<typeof termRows>[number]; busy: boolean; onEdit: (line: string) => Promise<boolean>; onRemove: () => void }>) {
  const { say } = useSay();
  const [editing, setEditing] = useState(false);
  const tone = KIND_TONE[row.kind];
  if (editing) {
    return (
      <li className="rounded-lg border border-border p-3">
        <TermForm label={say("admin.slugHolds.terms.edit")} submit={say("admin.slugHolds.terms.save")} initial={row.text} busy={busy} onSubmit={(line) => onEdit(line).then((ok) => (ok && setEditing(false), ok))} onCancel={() => setEditing(false)} />
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3" data-kind={row.kind}>
      <Badge tone={tone}>{say(`admin.slugHolds.terms.kinds.${row.kind}`)}</Badge>
      <code className="min-w-0 flex-1 break-all text-sm text-fg">{row.text}</code>
      {row.issue ? <span className="text-sm text-fg-danger" role="alert"><IssueText reason={row.issue} /></span> : null}
      {row.kind === "comment" ? null : <Button variant="ghost" size="sm" disabled={busy} onClick={() => setEditing(true)}>{say("admin.slugHolds.terms.edit")}</Button>}
      <Button variant="ghost" size="sm" disabled={busy} onClick={onRemove}>{say("admin.slugHolds.terms.remove")}</Button>
    </li>
  );
}

function reportLine(say: Say, report: Report): string {
  if (report.apply) return say("admin.slugHolds.rejudge.applied", { count: report.shops.length, notified: report.notified });
  return say(report.shops.length === 0 ? "admin.slugHolds.rejudge.foundNone" : "admin.slugHolds.rejudge.found", { count: report.shops.length });
}

function Rejudge() {
  const { say } = useSay();
  const client = useQueryClient();
  const [report, setReport] = useState<Report | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const run = useMutation({
    mutationFn: (apply: boolean) => krizakaFetch("/api/admin/slug-holds/rejudge", { method: "POST", json: { apply }, schema: reportAnswer }),
    onSuccess: async (answer) => {
      setReport(answer);
      if (answer.apply) await client.invalidateQueries({ queryKey: HOLDS });
    },
    onError: (error) => setProblem(say(`errors.${errorKey(error)}`)),
  });
  const go = (apply: boolean) => {
    setProblem(null);
    run.mutate(apply);
  };
  return (
    <section aria-labelledby="rejudge-title" className="flex flex-col gap-3" data-testid="rejudge">
      <Heading id="rejudge-title" title={say("admin.slugHolds.rejudge.title")} lead={say("admin.slugHolds.rejudge.lead")} />
      {problem ? <Alert tone="danger">{problem}</Alert> : null}
      <div>
        <Button variant="secondary" size="md" disabled={run.isPending} onClick={() => go(false)}>{say("admin.slugHolds.rejudge.dry")}</Button>
      </div>
      {report ? (
        <div className="flex flex-col gap-3" data-testid="rejudge-report">
          <Alert tone={report.apply ? "success" : "info"}>
            {reportLine(say, report)}
          </Alert>
          {report.shops.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
              {report.shops.map((s) => (
                <li key={s.shopId} className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-fg">{s.name}</span>
                  <AddressPreview slug={s.slug} term={s.matched} />
                  <Badge tone="warning">{s.matched}</Badge>
                  <span className="text-fg-secondary">{s.ownerEmail ?? "—"}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {!report.apply && report.shops.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="m-0 text-sm text-fg-secondary">{say("admin.slugHolds.rejudge.effect")}</p>
              <div>
                <Button variant="primary" size="md" disabled={run.isPending} onClick={() => go(true)}>{say("admin.slugHolds.rejudge.apply", { count: report.shops.length })}</Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
