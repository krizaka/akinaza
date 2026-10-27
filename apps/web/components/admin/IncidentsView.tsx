"use client";

import { krizakaFetch, KrizakaQueryProvider, useMutation, useQuery, useQueryClient } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { DataTable, type DataTableColumn } from "@krizaka/ui/data-table";
import { createKrizakaForm } from "@krizaka/ui/form";
import { useMemo, useState } from "react";
import { z } from "zod";

import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";
import type { AdminIncident } from "@/lib/incidents";

import { formatDate } from "./format";

/** The form kit's translator over the console's messages. */
const formI18n = (say: Say, locale: Lang) => ({ i18n: { t: (key: string, vars?: Readonly<Record<string, string | number | boolean | Date | null | undefined>>) => say(key, vars as Record<string, string | number> | undefined), locale } });

type Say = ReturnType<typeof useSay>["say"];
type Lang = ReturnType<typeof useSay>["locale"];

const KEY = ["admin-incidents"] as const;
const list = z.object({ incidents: z.array(z.custom<AdminIncident>()) });
const KINDS = ["access", "use", "communication", "loss"] as const;
const LEVELS = ["low", "medium", "high"] as const;
const TONE = { open: "warning", assessed: "accent", closed: "neutral" } as const;

const openForm = createKrizakaForm({
  schema: z.object({ kind: z.enum(KINDS), description: z.string().trim().min(1).max(2000), information: z.string().trim().min(1).max(600), personsConcerned: z.string().trim().max(9), drill: z.boolean() }),
  defaultValues: { kind: "access" as (typeof KINDS)[number], description: "", information: "", personsConcerned: "", drill: false },
});
const assessForm = createKrizakaForm({
  schema: z.object({ sensitivity: z.enum(LEVELS), consequences: z.enum(LEVELS), likelihood: z.enum(LEVELS), seriousInjury: z.boolean(), rationale: z.string().trim().min(1).max(2000) }),
  defaultValues: { sensitivity: "medium" as (typeof LEVELS)[number], consequences: "medium" as (typeof LEVELS)[number], likelihood: "medium" as (typeof LEVELS)[number], seriousInjury: false, rationale: "" },
});
const noticeForm = createKrizakaForm({
  schema: z.object({ target: z.enum(["cai", "persons"]), channel: z.string().trim().min(1).max(40), reference: z.string().trim().max(200) }),
  defaultValues: { target: "cai" as "cai" | "persons", channel: "form", reference: "" },
});
const measureForm = createKrizakaForm({ schema: z.object({ text: z.string().trim().min(1).max(1000) }), defaultValues: { text: "" } });

/** Runs one call of the incident API and refreshes the register; the refusal's stable code becomes a translated sentence. */
function useStep(onProblem: (message: string | null) => void) {
  const { say } = useSay();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ path, json }: { path: string; json: unknown }) => krizakaFetch(path, { method: "POST", json }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
    onError: (error) => onProblem(say(`errors.${errorKey(error)}`)),
  });
}

/**
 * The confidentiality incident register (Loi 25, ss. 3.5 to 3.8; akinaza#392): open an incident, assess the risk of serious injury, record the
 * notices to the Commission and to the people concerned, close it, export the register. It holds facts and categories of information, never a person's data.
 */
export function IncidentsView() {
  return (
    <KrizakaQueryProvider>
      <IncidentsBody />
    </KrizakaQueryProvider>
  );
}

function IncidentsBody() {
  const { say, locale } = useSay();
  const [selected, setSelected] = useState<string | null>(null);
  const data = useQuery({ queryKey: KEY, queryFn: () => krizakaFetch("/api/admin/incidents", { schema: list }) });
  const columns = useMemo(() => incidentColumns(say, locale, setSelected), [say, locale]);
  if (!data.data) return null;
  const incidents = data.data.incidents;
  const current = incidents.find((i) => i.id === selected) ?? null;
  return (
    <div className="flex flex-col gap-8" data-testid="incidents">
      <div className="flex flex-col gap-2">
        <h1 className="m-0 font-display text-xl font-bold text-fg">{say("admin.incidents.title")}</h1>
        <p className="m-0 max-w-[70ch] text-sm text-fg-secondary">{say("admin.incidents.lead")}</p>
        <div className="flex gap-2">
          <Button variant="secondary" size="md" asChild>
            <a href="/api/admin/incidents/export?format=csv" download>
              {say("admin.incidents.exportCsv")}
            </a>
          </Button>
          <Button variant="ghost" size="md" asChild>
            <a href="/api/admin/incidents/export?format=json" download>
              {say("admin.incidents.exportJson")}
            </a>
          </Button>
        </div>
      </div>
      <OpenIncident />
      <section aria-label={say("admin.incidents.register")} className="flex flex-col gap-2">
        <h2 className="m-0 font-display text-lg font-bold text-fg">{say("admin.incidents.register")}</h2>
        {incidents.length === 0 ? <p className="m-0 text-sm text-fg-secondary">{say("admin.incidents.empty")}</p> : <DataTable caption={say("admin.incidents.register")} rows={incidents} columns={columns} getRowId={(i) => i.id} rowLabel={(i) => i.id} />}
      </section>
      {current ? <IncidentPanel incident={current} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function riskLabel(say: Say, i: AdminIncident): string {
  if (!i.assessment) return "—";
  return say(i.assessment.seriousInjury ? "admin.incidents.serious" : "admin.incidents.notSerious");
}

function incidentColumns(say: Say, locale: Lang, open: (id: string) => void): DataTableColumn<AdminIncident>[] {
  return [
    { id: "awareAt", header: say("admin.incidents.awareAt"), sortable: true, value: (i) => i.awareAt, cell: (i) => formatDate(i.awareAt, locale, true) },
    { id: "kind", header: say("admin.incidents.kind"), value: (i) => i.kind, filter: "facet", cell: (i) => say(`admin.incidents.kinds.${i.kind}`) },
    { id: "status", header: say("admin.incidents.status"), value: (i) => i.status, filter: "facet", cell: (i) => <Badge tone={TONE[i.status]}>{say(`admin.incidents.statuses.${i.status}`)}</Badge> },
    { id: "risk", header: say("admin.incidents.risk"), cell: (i) => riskLabel(say, i) },
    { id: "drill", header: say("admin.incidents.drill"), cell: (i) => (i.drill ? <Badge tone="neutral">{say("admin.incidents.drillBadge")}</Badge> : "") },
    { id: "description", header: say("admin.incidents.description"), card: "title", value: (i) => i.description },
    { id: "open", header: say("admin.incidents.details"), cell: (i) => <Button variant="ghost" size="sm" onClick={() => open(i.id)}>{say("admin.incidents.details")}</Button> },
  ];
}

function OpenIncident() {
  const { say, locale } = useSay();
  const [shown, setShown] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const step = useStep(setProblem);
  const form = openForm.useForm({
    ...formI18n(say, locale),
    onSubmit: async (values) => {
      setProblem(null);
      const persons = values.personsConcerned === "" ? undefined : Number(values.personsConcerned);
      await step.mutateAsync({ path: "/api/admin/incidents", json: { kind: values.kind, description: values.description, information: values.information.split(",").map((s) => s.trim()).filter(Boolean), personsConcerned: Number.isInteger(persons) ? persons : undefined, drill: values.drill } });
      form.reset();
      setShown(false);
    },
  });
  if (!shown) {
    return (
      <div>
        <Button variant="primary" size="md" onClick={() => setShown(true)}>
          {say("admin.incidents.open")}
        </Button>
      </div>
    );
  }
  return (
    <section aria-label={say("admin.incidents.open")} className="flex flex-col gap-3" data-testid="incident-new">
      <h2 className="m-0 font-display text-lg font-bold text-fg">{say("admin.incidents.open")}</h2>
      {problem ? <Alert tone="danger">{problem}</Alert> : null}
      <form.Form aria-label={say("admin.incidents.open")} className="flex flex-col gap-4">
        <form.Select name="kind" label={say("admin.incidents.kind")} options={KINDS.map((value) => ({ value, label: say(`admin.incidents.kinds.${value}`) }))} />
        <form.TextArea name="description" label={say("admin.incidents.description")} hint={say("admin.incidents.descriptionHint")} rows={3} />
        <form.TextField name="information" label={say("admin.incidents.information")} hint={say("admin.incidents.informationHint")} autoComplete="off" />
        <form.TextField name="personsConcerned" label={say("admin.incidents.persons")} inputMode="numeric" />
        <form.Checkbox name="drill" label={say("admin.incidents.drillLabel")} />
        <div className="flex gap-2">
          <form.Submit size="md">{say("admin.incidents.openSubmit")}</form.Submit>
          <Button variant="ghost" size="md" onClick={() => setShown(false)}>
            {say("admin.incidents.cancel")}
          </Button>
        </div>
      </form.Form>
    </section>
  );
}

function IncidentPanel({ incident, onClose }: Readonly<{ incident: AdminIncident; onClose: () => void }>) {
  const { say, locale } = useSay();
  const [problem, setProblem] = useState<string | null>(null);
  const step = useStep(setProblem);
  const path = `/api/admin/incidents/${incident.id}`;
  const act = (json: unknown) => {
    setProblem(null);
    return step.mutateAsync({ path, json });
  };
  const levels = LEVELS.map((value) => ({ value, label: say(`admin.incidents.levels.${value}`) }));
  const assess = assessForm.useForm({ ...formI18n(say, locale), onSubmit: async (values) => { await act({ action: "assess", assessment: values }); } });
  const notice = noticeForm.useForm({ ...formI18n(say, locale), onSubmit: async (values) => { await act({ action: "notice", target: values.target, channel: values.channel, ...(values.reference ? { reference: values.reference } : {}) }); } });
  const measure = measureForm.useForm({ ...formI18n(say, locale), onSubmit: async (values) => { await act({ action: "measure", text: values.text }); measure.reset(); } });
  const closed = incident.status === "closed";
  return (
    <section aria-label={say("admin.incidents.details")} className="flex flex-col gap-4" data-testid="incident-panel">
      <div className="flex items-center justify-between gap-2">
        <h2 className="m-0 font-display text-lg font-bold text-fg">{say(`admin.incidents.kinds.${incident.kind}`)} · {formatDate(incident.awareAt, locale, true)}</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>{say("admin.incidents.hide")}</Button>
      </div>
      {problem ? <Alert tone="danger">{problem}</Alert> : null}
      <p className="m-0 text-sm text-fg-secondary">{incident.description}</p>
      <p className="m-0 text-sm text-fg-secondary">{say("admin.incidents.retain", { date: formatDate(incident.retainUntil, locale) })}</p>
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
        <li>{say("admin.incidents.caiNotice")} : {incident.caiNoticeAt ? formatDate(incident.caiNoticeAt, locale, true) : "—"}</li>
        <li>{say("admin.incidents.personsNotice")} : {incident.personsNoticeAt ? formatDate(incident.personsNoticeAt, locale, true) : "—"}</li>
        {incident.measures.map((m) => <li key={`${m.at}${m.text}`}>{formatDate(m.at, locale, true)} — {m.text}</li>)}
      </ul>
      {closed ? (
        <Alert tone="info">{say("admin.incidents.closedNote")}</Alert>
      ) : (
        <>
          <assess.Form aria-label={say("admin.incidents.assess")} className="flex flex-col gap-3">
            <h3 className="m-0 text-base font-bold text-fg">{say("admin.incidents.assess")}</h3>
            <assess.Select name="sensitivity" label={say("admin.incidents.sensitivity")} options={levels} />
            <assess.Select name="consequences" label={say("admin.incidents.consequences")} options={levels} />
            <assess.Select name="likelihood" label={say("admin.incidents.likelihood")} options={levels} />
            <assess.Checkbox name="seriousInjury" label={say("admin.incidents.seriousInjury")} />
            <assess.TextArea name="rationale" label={say("admin.incidents.rationale")} rows={3} />
            <div><assess.Submit size="md">{say("admin.incidents.assessSubmit")}</assess.Submit></div>
          </assess.Form>
          <measure.Form aria-label={say("admin.incidents.measure")} className="flex flex-col gap-3">
            <h3 className="m-0 text-base font-bold text-fg">{say("admin.incidents.measure")}</h3>
            <measure.TextArea name="text" label={say("admin.incidents.measureText")} rows={2} />
            <div><measure.Submit size="md">{say("admin.incidents.measureSubmit")}</measure.Submit></div>
          </measure.Form>
          {incident.assessment?.seriousInjury ? (
            <notice.Form aria-label={say("admin.incidents.notice")} className="flex flex-col gap-3">
              <h3 className="m-0 text-base font-bold text-fg">{say("admin.incidents.notice")}</h3>
              <notice.Select name="target" label={say("admin.incidents.target")} options={(["cai", "persons"] as const).map((value) => ({ value, label: say(`admin.incidents.targets.${value}`) }))} />
              <notice.Select name="channel" label={say("admin.incidents.channel")} options={(["form", "email", "letter", "public"] as const).map((value) => ({ value, label: say(`admin.incidents.channels.${value}`) }))} />
              <notice.TextField name="reference" label={say("admin.incidents.reference")} autoComplete="off" />
              <div><notice.Submit size="md">{say("admin.incidents.noticeSubmit")}</notice.Submit></div>
            </notice.Form>
          ) : null}
          <div className="flex gap-2">
            <Button variant="secondary" size="md" disabled={step.isPending} onClick={() => void act({ action: "drill", drill: !incident.drill }).catch(() => undefined)}>
              {say(`admin.incidents.${incident.drill ? "unmarkDrill" : "markDrill"}`)}
            </Button>
            <Button variant="primary" size="md" disabled={step.isPending} onClick={() => void act({ action: "close" }).catch(() => undefined)}>
              {say("admin.incidents.close")}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
