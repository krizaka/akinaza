"use client";

import type { Platform, SyncField } from "@akinaza/core";
import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { Checkbox } from "@krizaka/ui/checkbox";
import { ConfirmButton } from "@krizaka/ui/confirm-button";
import { RadioGroup } from "@krizaka/ui/radio-group";
import { useState } from "react";

import { useCall } from "@/components/app/useCall";
import { valueLines } from "@/lib/connections-view";
import { useSay } from "@/lib/i18n-client";

/** What the Connections screen needs, plain (the server picks it; no token is ever part of it). */
export interface ConnectionsData {
  /** Whether connections are switched on in this environment. */
  enabled: boolean;
  /** The fields each platform syncs (from the mapping). */
  platforms: { platform: Platform; fields: SyncField[]; readOnly: SyncField[]; status: "connected" | "needs_reconnect" | "disconnected"; externalLabel: string | null; lastSyncAt: string | null }[];
  proposals: { id: string; platform: Platform; items: { field: SyncField; state: "changed" | "remote_only" | "local_only"; localValue: unknown; remoteValue: unknown }[] }[];
  log: { id: number; platform: Platform; field: SyncField | null; outcome: string; at: string; reason: string | null }[];
  /** Akinaza's values, to paste where no connection exists (Apple Maps, Bing, Yelp). */
  mine: { field: SyncField; lines: string[] }[];
  flash: { kind: "connected" | "error"; platform: Platform | null; code: string | null } | null;
}

const GUIDANCE = [
  { id: "apple", href: "https://businessconnect.apple.com" },
  { id: "bing", href: "https://www.bing.com/forbusiness" },
  { id: "yelp", href: "https://business.yelp.com" },
] as const;

export function ConnectionsView({ data }: { data: ConnectionsData }) {
  const { say } = useSay();
  const [message, setMessage] = useState<string | null>(null);
  const flash = data.flash;
  const name = (p: Platform) => say(`connections.platforms.${p}.name`);
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold text-fg">{say("connections.title")}</h1>
        <p className="text-fg-secondary">{say("connections.intro")}</p>
        <p className="text-sm text-fg-muted">{say("connections.privacy")}</p>
      </header>
      {!data.enabled ? <Alert tone="info">{say("connections.off")}</Alert> : null}
      {flash?.kind === "connected" && flash.platform ? <Alert tone="success">{say("connections.flash.connected", { platform: name(flash.platform) })}</Alert> : null}
      {flash?.kind === "error" && flash.code ? <Alert tone="danger">{say(`errors.${flash.code}`)}</Alert> : null}
      {message ? (
        <Alert tone="success" role="status">
          {message}
        </Alert>
      ) : null}
      {data.proposals.map((proposal) => (
        <ProposalCard key={proposal.id} proposal={proposal} onDone={setMessage} />
      ))}
      <div className="grid gap-4 lg:grid-cols-2">
        {data.platforms.map((p) => (
          <PlatformCard key={p.platform} platform={p} enabled={data.enabled} onMessage={setMessage} />
        ))}
      </div>
      <section aria-labelledby="guidance-title" className="flex flex-col gap-3">
        <h2 id="guidance-title" className="font-display text-lg font-bold text-fg">
          {say("connections.guidance.title")}
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {GUIDANCE.map((g) => (
            <Card.Root key={g.id} className="flex flex-col gap-2 p-4">
              <h3 className="font-display text-base font-bold text-fg">{say(`connections.guidance.${g.id}.name`)}</h3>
              <p className="text-sm text-fg-secondary">{say(`connections.guidance.${g.id}.text`)}</p>
              <a className="text-sm font-semibold text-fg-accent underline" href={g.href} rel="noopener noreferrer" target="_blank">
                {say("connections.guidance.open")}
              </a>
            </Card.Root>
          ))}
        </div>
        {data.mine.length ? (
          <Card.Root className="p-4">
            <h3 className="mb-2 font-display text-base font-bold text-fg">{say("connections.guidance.values")}</h3>
            <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
              {data.mine.map((m) => (
                <div key={m.field} className="contents">
                  <dt className="font-semibold text-fg-secondary">{say(`connections.fields.${m.field}`)}</dt>
                  <dd className="text-fg">
                    {m.lines.map((l) => (
                      <span key={l} className="block">
                        {l}
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </Card.Root>
        ) : null}
      </section>
      <LogCard log={data.log} />
    </div>
  );
}

function PlatformCard({ platform: p, enabled, onMessage }: { platform: ConnectionsData["platforms"][number]; enabled: boolean; onMessage: (m: string | null) => void }) {
  const { say, locale } = useSay();
  const call = useCall();
  const [consenting, setConsenting] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const label = say(`connections.platforms.${p.platform}.name`);
  const fields = p.fields.map((f) => say(`connections.fields.${f}`)).join(", ");
  const connected = p.status === "connected";
  const date = (iso: string) => new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  const fieldList = (list: string[]) => list.map((f) => say(`connections.fields.${f}`)).join(", ");

  const connect = async () => {
    const out = await call.run<{ authorizeUrl: string }>(`/api/walker/connections/${p.platform}/connect`, { json: { consent: agreed } }, { refresh: false });
    if (out) window.location.assign(out.authorizeUrl);
  };
  const pull = async () => {
    const out = await call.run<{ proposalId: string | null; needsDecision: string[] }>(`/api/walker/connections/${p.platform}/pull`);
    if (out) onMessage(out.needsDecision.length ? say("connections.flash.imported", { count: out.needsDecision.length }) : say("connections.flash.upToDate", { platform: label }));
  };
  const push = async () => {
    const out = await call.run<{ pushed: string[]; needsDecision: string[] }>(`/api/walker/connections/${p.platform}/push`);
    if (!out) return;
    const parts = [out.pushed.length ? say("connections.flash.published", { platform: label, fields: fieldList(out.pushed) }) : say("connections.flash.nothingToPublish", { platform: label })];
    if (out.needsDecision.length) parts.push(say("connections.flash.held", { fields: fieldList(out.needsDecision) }));
    onMessage(parts.join(" "));
  };
  const disconnect = async () => {
    if ((await call.run(`/api/walker/connections/${p.platform}/disconnect`)) !== null) {
      setConsenting(false);
      setAgreed(false);
      onMessage(say("connections.flash.disconnected", { platform: label }));
    }
  };

  return (
    <Card.Root className="flex flex-col gap-3 p-4" data-platform={p.platform}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-base font-bold text-fg">{label}</h2>
        <Badge tone={connected ? "success" : p.status === "needs_reconnect" ? "warning" : "neutral"}>{say(`connections.status.${enabled ? p.status : "soon"}`)}</Badge>
      </div>
      <p className="text-sm text-fg-secondary">{say(`connections.platforms.${p.platform}.what`)}</p>
      <p className="text-sm text-fg-muted">{say("connections.syncs", { fields })}</p>
      {connected ? (
        <p className="text-sm text-fg-muted">
          {p.externalLabel ? <span className="block">{say("connections.account", { label: p.externalLabel })}</span> : null}
          <span className="block">{p.lastSyncAt ? say("connections.lastSync", { date: date(p.lastSyncAt) }) : say("connections.neverSynced")}</span>
        </p>
      ) : null}
      {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
      {enabled && connected ? (
        <div className="flex flex-wrap gap-2">
          <Button size="md" variant="primary" disabled={call.pending} onClick={pull}>
            {say("connections.actions.import", { platform: label })}
          </Button>
          <Button size="md" variant="secondary" disabled={call.pending} onClick={push}>
            {say("connections.actions.publish", { platform: label })}
          </Button>
          <ConfirmButton size="md" variant="ghost" disabled={call.pending} confirmLabel={say("connections.actions.disconnectConfirm", { platform: label })} onConfirm={disconnect}>
            {say("connections.actions.disconnect")}
          </ConfirmButton>
        </div>
      ) : null}
      {enabled && !connected && !consenting ? (
        <div>
          <Button size="md" variant="primary" onClick={() => setConsenting(true)}>
            {say(p.status === "needs_reconnect" ? "connections.actions.reconnect" : "connections.actions.connect")}
          </Button>
        </div>
      ) : null}
      {enabled && !connected && consenting ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border-default p-3" role="group" aria-label={say("connections.consent.title", { platform: label })}>
          <p className="font-semibold text-fg">{say("connections.consent.title", { platform: label })}</p>
          <p className="text-sm text-fg-secondary">{say("connections.consent.text", { platform: label, fields })}</p>
          <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)}>
            {say("connections.consent.checkbox", { platform: label })}
          </Checkbox>
          <div className="flex flex-wrap gap-2">
            <Button size="md" variant="primary" disabled={!agreed || call.pending} onClick={connect}>
              {say("connections.consent.continue", { platform: label })}
            </Button>
            <Button size="md" variant="ghost" onClick={() => setConsenting(false)}>
              {say("connections.actions.cancel")}
            </Button>
          </div>
        </div>
      ) : null}
    </Card.Root>
  );
}

function ProposalCard({ proposal, onDone }: { proposal: ConnectionsData["proposals"][number]; onDone: (m: string | null) => void }) {
  const { say, locale } = useSay();
  const call = useCall();
  const [choice, setChoice] = useState<Partial<Record<SyncField, "accept" | "keep">>>({});
  const label = say(`connections.platforms.${proposal.platform}.name`);
  const chosen = Object.entries(choice) as [SyncField, "accept" | "keep"][];
  const apply = async () => {
    if ((await call.run(`/api/walker/sync-proposals/${proposal.id}`, { json: { decisions: chosen.map(([field, decision]) => ({ field, decision })) } })) !== null) {
      setChoice({});
      onDone(say("connections.proposal.applied"));
    }
  };
  return (
    <Card.Root className="flex flex-col gap-4 p-4" aria-labelledby={`proposal-${proposal.id}`}>
      <div>
        <h2 id={`proposal-${proposal.id}`} className="font-display text-lg font-bold text-fg">
          {say("connections.proposal.title", { platform: label })}
        </h2>
        <p className="text-sm text-fg-secondary">{say("connections.proposal.intro")}</p>
      </div>
      <ul className="flex flex-col gap-4">
        {proposal.items.map((item) => {
          const field = say(`connections.fields.${item.field}`);
          return (
            <li key={item.field} className="flex flex-col gap-2 border-t border-border-default pt-3 first:border-t-0 first:pt-0" data-field={item.field}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-fg">{field}</h3>
                <Badge tone={item.state === "changed" ? "warning" : "accent"}>{say(`connections.proposal.state.${item.state}`, { platform: label })}</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Side title={say("connections.proposal.akinaza")} lines={valueLines(item.field, item.localValue, locale)} empty={say("connections.proposal.empty")} />
                <Side title={say("connections.proposal.theirs", { platform: label })} lines={valueLines(item.field, item.remoteValue, locale)} empty={say("connections.proposal.empty")} />
              </div>
              <RadioGroup.Root variant="list" label={say("connections.proposal.choose", { field })} value={choice[item.field] ?? ""} onValueChange={(v) => setChoice((c) => ({ ...c, [item.field]: v as "accept" | "keep" }))}>
                <RadioGroup.Item value="keep">{say("connections.proposal.keepMine")}</RadioGroup.Item>
                <RadioGroup.Item value="accept">{say("connections.proposal.useTheirs", { platform: label })}</RadioGroup.Item>
              </RadioGroup.Root>
            </li>
          );
        })}
      </ul>
      {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="md" variant="primary" disabled={chosen.length === 0 || call.pending} onClick={apply}>
          {say("connections.proposal.apply")}
        </Button>
        {chosen.length > 0 && chosen.length < proposal.items.length ? <span className="text-sm text-fg-muted">{say("connections.proposal.pending")}</span> : null}
      </div>
    </Card.Root>
  );
}

function Side({ title, lines, empty }: { title: string; lines: string[] | null; empty: string }) {
  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">{title}</p>
      {lines ? (
        lines.map((l) => (
          <p key={l} className="text-sm text-fg">
            {l}
          </p>
        ))
      ) : (
        <p className="text-sm text-fg-muted">{empty}</p>
      )}
    </div>
  );
}

function LogCard({ log }: { log: ConnectionsData["log"] }) {
  const { say, locale } = useSay();
  const when = (iso: string) => new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
  return (
    <section aria-labelledby="log-title" className="flex flex-col gap-2">
      <h2 id="log-title" className="font-display text-lg font-bold text-fg">
        {say("connections.log.title")}
      </h2>
      {log.length === 0 ? (
        <p className="text-sm text-fg-muted">{say("connections.log.empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-default rounded-lg border border-border-default">
          {log.map((l) => {
            const platform = say(`connections.platforms.${l.platform}.name`);
            return (
              <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm">
                <span className="text-fg">
                  {say("connections.log.line", { platform, field: l.field ? say(`connections.fields.${l.field}`) : "—", outcome: say(`connections.log.outcome.${l.outcome}`) })}
                  {l.reason ? <span className="text-fg-muted"> ({say(`connections.log.reason.${l.reason}`, { platform })})</span> : null}
                </span>
                <time className="text-xs text-fg-muted" dateTime={l.at}>
                  {when(l.at)}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
