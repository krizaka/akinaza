"use client";

import type { BookingPreselect } from "@akinaza/core";
import { krizakaFetch, useQuery } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { Checkbox } from "@krizaka/ui/checkbox";
import { createKrizakaForm } from "@krizaka/ui/form";
import Link from "next/link";
import { useEffect, useState } from "react";
import { z } from "zod";

import { useCall } from "@/components/app/useCall";
import { bookingDefaults } from "@/lib/booking-defaults";
import { useSay } from "@/lib/i18n-client";

export interface BookingData {
  shop: { id: string; name: string; slug: string };
  services: { id: string; nameFr: string; nameEn: string; durationMinutes: number; priceCents: number; capacity: number }[];
  zones: { id: string; name: string }[];
  client: { id: string; fullName: string } | null;
  dogs: { id: string; name: string }[];
  /** What the visitor chose on the shop page (the address): the service, the area and the time, already checked against the shop. */
  preselect: BookingPreselect;
  timeZone: string;
  bookingsHref: string;
}

type Say = ReturnType<typeof useSay>["say"];
const i18nOf = (say: Say, locale: string) => ({ t: (key: string, vars?: Readonly<Record<string, string | number | boolean | Date | null | undefined>>) => say(key, vars as Record<string, string | number> | undefined), locale });
const money = (cents: number, locale: string) => new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);

/** Join the shop (a file, with consents) → add a dog → pick a walk → book. Each step shows once the one before is done. */
export function BookingFlow({ data }: { data: BookingData }) {
  return (
    <div className="flex flex-col gap-4">
      {!data.client ? <JoinCard data={data} /> : null}
      {data.client && data.dogs.length === 0 ? <DogCard clientId={data.client.id} /> : null}
      {data.client && data.dogs.length > 0 ? (
        <>
          <AnotherDog clientId={data.client.id} />
          <BookCard data={data} clientId={data.client.id} />
          <AccessCard clientId={data.client.id} />
        </>
      ) : null}
    </div>
  );
}

const joinForm = createKrizakaForm({
  schema: z.object({ fullName: z.string().trim().min(2).max(120), phone: z.string().trim().min(7).max(40), consentService: z.boolean(), consentReminders: z.boolean() }),
  defaultValues: { fullName: "", phone: "", consentService: false, consentReminders: false },
});

function JoinCard({ data }: { data: BookingData }) {
  const { say, locale } = useSay();
  const call = useCall();
  const [needConsent, setNeedConsent] = useState(false);
  const form = joinForm.useForm({
    i18n: i18nOf(say, locale),
    onSubmit: async (values) => {
      setNeedConsent(!values.consentService);
      if (!values.consentService) return;
      await call.run("/api/me/join", { json: { shopId: data.shop.id, fullName: values.fullName, phone: values.phone, language: locale, consentService: true, consentReminders: values.consentReminders } });
    },
  });
  return (
    <Card.Root className="p-4">
      <h2 className="font-display text-lg font-bold text-fg">{say("book.joinTitle")}</h2>
      <p className="mb-4 text-fg-secondary">{say("book.joinIntro", { shop: data.shop.name })}</p>
      <form.Form aria-label={say("book.joinTitle")} className="flex flex-col gap-4">
        <form.TextField name="fullName" label={say("book.fullName")} autoComplete="name" />
        <form.TextField name="phone" label={say("book.phone")} type="tel" autoComplete="tel" />
        <form.Checkbox name="consentService" label={say("book.consentService", { shop: data.shop.name })} />
        <form.Checkbox name="consentReminders" label={say("book.consentReminders")} />
        {needConsent ? <Alert tone="danger">{say("errors.CONSENT_REQUIRED")}</Alert> : null}
        {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
        <form.Submit size="lg" className="w-full sm:w-auto sm:self-start">
          {say("book.join")}
        </form.Submit>
      </form.Form>
    </Card.Root>
  );
}

const dogForm = createKrizakaForm({
  schema: z.object({
    name: z.string().trim().min(1).max(80),
    breed: z.string().trim().max(80),
    size: z.string(),
    temperament: z.string().trim().max(500),
    vetName: z.string().trim().max(120),
    vetPhone: z.string().trim().max(40),
    emergencyName: z.string().trim().max(120),
    emergencyPhone: z.string().trim().max(40),
  }),
  defaultValues: { name: "", breed: "", size: "", temperament: "", vetName: "", vetPhone: "", emergencyName: "", emergencyPhone: "" },
});

function DogCard({ clientId, onDone }: { clientId: string; onDone?: () => void }) {
  const { say, locale } = useSay();
  const call = useCall();
  const form = dogForm.useForm({
    i18n: i18nOf(say, locale),
    onSubmit: async (v) => {
      const profile = {
        ...(v.breed ? { breed: v.breed } : {}),
        ...(v.size ? { size: v.size } : {}),
        ...(v.temperament ? { temperament: v.temperament } : {}),
        ...(v.vetName && v.vetPhone ? { vet: { name: v.vetName, phone: v.vetPhone } } : {}),
        ...(v.emergencyName && v.emergencyPhone ? { emergency: { name: v.emergencyName, phone: v.emergencyPhone } } : {}),
      };
      if ((await call.run("/api/me/dependants", { json: { clientId, kind: "dog", name: v.name, profile } })) !== null) onDone?.();
    },
  });
  return (
    <Card.Root className="p-4">
      <h2 className="mb-4 font-display text-lg font-bold text-fg">{say("book.dogTitle")}</h2>
      <form.Form aria-label={say("book.dogTitle")} className="grid gap-4 sm:grid-cols-2">
        <form.TextField name="name" label={say("book.dogName")} />
        <form.TextField name="breed" label={say("book.breed")} />
        <form.Select name="size" label={say("book.size")} options={(["small", "medium", "large"] as const).map((s) => ({ value: s, label: say(`clients.sizes.${s}`) }))} placeholder="—" />
        <form.TextField name="temperament" label={say("book.temperament")} hint={say("book.temperamentHint")} />
        <form.TextField name="vetName" label={say("book.vetName")} />
        <form.TextField name="vetPhone" label={say("book.vetPhone")} type="tel" />
        <form.TextField name="emergencyName" label={say("book.emergencyName")} />
        <form.TextField name="emergencyPhone" label={say("book.emergencyPhone")} type="tel" />
        <div className="flex flex-col gap-3 sm:col-span-2">
          {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
          <form.Submit size="lg" className="w-full sm:w-auto sm:self-start">
            {say("book.addDog")}
          </form.Submit>
        </div>
      </form.Form>
    </Card.Root>
  );
}

/** A second dog on the file, without leaving the page: the button opens the same form as the first. */
function AnotherDog({ clientId }: { clientId: string }) {
  const { say } = useSay();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <Button size="md" variant="outline" className="self-start" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {say("book.addAnother")}
      </Button>
      {open ? <DogCard key="another" clientId={clientId} onDone={() => setOpen(false)} /> : null}
    </div>
  );
}

const bookForm = createKrizakaForm({
  schema: z.object({ serviceId: z.string().min(1), zoneId: z.string(), dogIds: z.array(z.string()).min(1), startsAt: z.string().min(1) }),
  defaultValues: { serviceId: "", zoneId: "", dogIds: [] as string[], startsAt: "" },
});

interface SlotView {
  startsAt: string;
  endsAt: string;
  seatsLeft: number;
  capacity: number;
  joins: boolean;
}

function BookCard({ data, clientId }: { data: BookingData; clientId: string }) {
  const { say, locale } = useSay();
  const call = useCall();
  const [booked, setBooked] = useState(false);
  const form = bookForm.useForm({
    i18n: i18nOf(say, locale),
    defaultValues: bookingDefaults({ services: data.services, zones: data.zones, dogs: data.dogs, preselect: data.preselect }),
    onSubmit: async (v) => {
      const done = await call.run("/api/me/bookings", { json: { clientId, serviceId: v.serviceId, zoneId: v.zoneId || null, dependantIds: v.dogIds, startsAt: v.startsAt } });
      if (done !== null) setBooked(true);
    },
  });
  if (booked) {
    return (
      <Alert tone="success" title={say("book.done")}>
        <Link className="font-semibold underline" href={data.bookingsHref}>
          {say("book.seeBookings")}
        </Link>
      </Alert>
    );
  }
  return (
    <Card.Root className="p-4">
      <h2 className="mb-4 font-display text-lg font-bold text-fg">{say("book.pick")}</h2>
      <form.Form aria-label={say("book.pick")} className="flex flex-col gap-4">
        <form.Select name="serviceId" label={say("book.service")} options={data.services.map((s) => ({ value: s.id, label: `${locale === "fr" ? s.nameFr : s.nameEn} · ${money(s.priceCents, locale)}` }))} />
        {data.zones.length ? <form.Select name="zoneId" label={say("book.zone")} options={data.zones.map((z) => ({ value: z.id, label: z.name }))} /> : null}
        <form.Field name="dogIds">
          {(field) => (
            <fieldset className="flex flex-col gap-2" aria-describedby={field.errorId}>
              <legend className="mb-1 text-sm font-medium text-fg">
                {say("book.dogs")} <span className="font-normal text-fg-secondary">· {say("book.dogsHint")}</span>
              </legend>
              {data.dogs.map((dog) => {
                const ids = (field.value as string[]) ?? [];
                return (
                  <Checkbox key={dog.id} checked={ids.includes(dog.id)} onCheckedChange={(checked) => field.setValue(checked === true ? [...ids, dog.id] : ids.filter((id) => id !== dog.id))}>
                    {dog.name}
                  </Checkbox>
                );
              })}
              {field.error ? (
                <p id={field.errorId} className="text-sm text-danger">
                  {field.error}
                </p>
              ) : null}
            </fieldset>
          )}
        </form.Field>
        <form.Watch name="serviceId">
          {(serviceId) => (
            <form.Watch name="zoneId">
              {(zoneId) => <form.Field name="startsAt">{(field) => <SlotPicker slug={data.shop.slug} serviceId={serviceId as string} zoneId={(zoneId as string) || null} timeZone={data.timeZone} value={field.value as string} onPick={field.setValue} error={field.error} />}</form.Field>}
            </form.Watch>
          )}
        </form.Watch>
        {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
        <form.Submit size="lg" variant="primary" className="w-full sm:w-auto sm:self-start">
          {say("book.confirm")}
        </form.Submit>
      </form.Form>
    </Card.Root>
  );
}

function SlotPicker({ slug, serviceId, zoneId, timeZone, value, onPick, error }: { slug: string; serviceId: string; zoneId: string | null; timeZone: string; value: string; onPick: (v: string) => void; error: string | undefined }) {
  const { say, locale } = useSay();
  const slots = useQuery({
    queryKey: ["slots", slug, serviceId, zoneId],
    enabled: !!serviceId,
    queryFn: () => krizakaFetch(`/api/shops/${slug}/slots`, { query: { serviceId, zoneId } }) as Promise<{ slots: SlotView[] }>,
  });
  // A time carried from the shop page that is no longer free (someone booked it meanwhile) is dropped, never submitted.
  const offered = slots.data?.slots;
  useEffect(() => {
    if (offered && value && !offered.some((s) => s.startsAt === value)) onPick("");
  }, [offered, value, onPick]);
  const lang = locale === "fr" ? "fr-CA" : "en-CA";
  const dayKey = (iso: string) => new Date(iso).toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long", timeZone });
  const groups = new Map<string, SlotView[]>();
  for (const s of slots.data?.slots ?? []) groups.set(dayKey(s.startsAt), [...(groups.get(dayKey(s.startsAt)) ?? []), s]);
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-medium text-fg">{say("book.slots")}</legend>
      {slots.isPending ? <p className="text-fg-secondary">{say("book.slotsLoading")}</p> : null}
      {slots.data && groups.size === 0 ? <p className="text-fg-secondary">{say("book.slotsNone")}</p> : null}
      {[...groups.entries()].slice(0, 7).map(([day, list]) => (
        <div key={day} className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-fg first-letter:uppercase">{day}</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={day}>
            {list.map((s) => (
              <Button key={s.startsAt} type="button" role="radio" aria-checked={value === s.startsAt} size="md" variant={value === s.startsAt ? "primary" : "secondary"} onClick={() => onPick(s.startsAt)}>
                {new Date(s.startsAt).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit", timeZone })}
                {s.joins ? <span className="ml-2 text-xs opacity-80">{say("book.seats", { left: s.seatsLeft, max: s.capacity })}</span> : null}
              </Button>
            ))}
          </div>
        </div>
      ))}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </fieldset>
  );
}

const accessForm = createKrizakaForm({ schema: z.object({ notes: z.string().trim().max(500) }), defaultValues: { notes: "" } });

function AccessCard({ clientId }: { clientId: string }) {
  const { say, locale } = useSay();
  const call = useCall();
  const [saved, setSaved] = useState(false);
  const form = accessForm.useForm({
    i18n: i18nOf(say, locale),
    onSubmit: async (v) => {
      setSaved(false);
      if ((await call.run("/api/me/access-notes", { json: { clientId, notes: v.notes || null } }, { refresh: false })) !== null) {
        setSaved(true);
        form.reset();
      }
    },
  });
  return (
    <Card.Root className="p-4">
      <h2 className="font-display text-base font-bold text-fg">{say("book.accessTitle")}</h2>
      <p className="mb-3 text-sm text-fg-secondary">{say("book.accessHint")}</p>
      <form.Form aria-label={say("book.accessTitle")} className="flex flex-col gap-3">
        <form.TextArea name="notes" label={say("book.accessNotes")} rows={2} maxLength={500} />
        {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
        {saved ? <Alert tone="success">{say("book.accessSaved")}</Alert> : null}
        <form.Submit size="md" variant="secondary" className="w-full sm:w-auto sm:self-start">
          {say("book.accessSave")}
        </form.Submit>
      </form.Form>
    </Card.Root>
  );
}
