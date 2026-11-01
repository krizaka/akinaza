import { BRIEF_KIND, DEFAULT_BRIEF_RULES, SHOP_ACTION, shopBrief,type ShopRecommendation } from "@akinaza/core";
import { briefActionsOf, briefMailShops, briefSnapshot, claimBriefAction, claimBriefDelivery, enqueueMail, mailById, reachableClients, recordBriefResult, schema } from "@akinaza/db";
import { isBriefDue, weekOf } from "@krizaka/brief";
import { eq } from "drizzle-orm";

import { productName } from "./brand-name";
import { db } from "./db";
import { formatMoney } from "./format";
import { format, getDictionary, type Locale } from "./i18n";
import { deliver } from "./mail";
import type { MailSettings } from "./mail-settings";
import { renderMailTemplate } from "./mail-templates";
import { shopRoutes } from "./routes";

/** The coming days the brief looks at for free time. */
const AHEAD_DAYS = 7;

export interface BriefShop {
  id: string;
  name: string;
  slug: string | null;
  published: boolean;
  timezone: string;
}

/** This week's brief of a shop, and what was already done with it (by recommendation id). */
export async function loadShopBrief(shop: BriefShop, now: Date) {
  const at = weekOf(now, shop.timezone);
  const snapshot = await briefSnapshot(db(), shop.id, { week: at.week, today: at.localDate, monday: at.monday }, { lookBackWeeks: DEFAULT_BRIEF_RULES.lookBackWeeks, aheadDays: AHEAD_DAYS });
  const brief = shopBrief(snapshot);
  const services = Object.fromEntries((await serviceNames(shop.id)).map((s) => [s.id, { fr: s.nameFr, en: s.nameEn }]));
  return { week: at.week, items: brief.items, done: await briefActionsOf(db(), shop.id, at.week), services, publicPage: shop.published && !!shop.slug };
}

function serviceNames(shopId: string) {
  return db().select({ id: schema.services.id, nameFr: schema.services.nameFr, nameEn: schema.services.nameEn }).from(schema.services).where(eq(schema.services.shopId, shopId));
}

/** « jeudi et samedi » / « Thursday and Saturday » for local days `YYYY-MM-DD`. */
export function daysInWords(days: readonly string[], locale: "fr" | "en"): string {
  const tag = locale === "fr" ? "fr-CA" : "en-CA";
  const names = [...new Set(days.map((d) => new Date(`${d}T12:00:00Z`).toLocaleDateString(tag, { weekday: "long", timeZone: "UTC" })))];
  return new Intl.ListFormat(tag, { style: "long", type: "conjunction" }).format(names);
}

export class BriefActionError extends Error {
  constructor(readonly code: "BRIEF_UNKNOWN" | "BRIEF_DONE" | "SHOP_NOT_PUBLIC") {
    super(code);
  }
}

/**
 * Runs the invitation of this week's gaps card. The recommendation is computed again here — the client sends only its id,
 * never the list — and claimed once (BRIEF_DONE the second time); every invitee's consent is read again; each mail goes
 * through the outbox (it waits when no provider is set). Returns what went out.
 */
export async function inviteRegulars(shop: BriefShop, recommendationId: string, now: Date, settings: MailSettings, send: typeof fetch = fetch) {
  const brief = await loadShopBrief(shop, now);
  const item = brief.items.find((i): i is ShopRecommendation & { action: { kind: typeof SHOP_ACTION.invite } } => i.id === recommendationId && i.kind === BRIEF_KIND.gaps);
  if (!item || item.action.kind !== SHOP_ACTION.invite) throw new BriefActionError("BRIEF_UNKNOWN");
  if (!brief.publicPage || !shop.slug) throw new BriefActionError("SHOP_NOT_PUBLIC");
  if (!(await claimBriefAction(db(), shop.id, item.id, SHOP_ACTION.invite))) throw new BriefActionError("BRIEF_DONE");
  const payload = item.action.payload as { clientIds: string[]; days: string[] };
  const invitees = await reachableClients(db(), shop.id, payload.clientIds);
  const result = { sent: 0, pending: 0, failed: 0, skipped: payload.clientIds.length - invitees.length };
  for (const client of invitees) {
    const mail = renderMailTemplate(
      "brief-invite",
      { shop: shop.name, client: client.fullName.split(" ")[0] ?? client.fullName, days: daysInWords(payload.days, client.language), url: `${settings.appUrl}/${client.language}/s/${shop.slug}` },
      { locale: client.language, appUrl: settings.appUrl, now, product: await productName() },
    );
    const id = await enqueueMail(db(), { to: client.email, locale: mail.locale, template: "brief-invite", subject: mail.subject, html: mail.html, text: mail.text, relatedKind: "brief", relatedId: client.id });
    const queued = await mailById(db(), id);
    result[queued ? await deliver(db(), queued, now, settings, send) : "pending"] += 1;
  }
  await recordBriefResult(db(), shop.id, item.id, result);
  return result;
}

/** One line per card, in the owner's language: the fact and its figure, as the Today card says them. */
export function briefLines(items: readonly ShopRecommendation[], services: Record<string, { fr: string; en: string }>, locale: Locale): string[] {
  const t = getDictionary(locale).console.brief.mail;
  const money = (cents: number | undefined) => formatMoney(cents ?? 0, locale);
  return items.map((item) => {
    const f = item.figures;
    switch (item.kind) {
      case BRIEF_KIND.gaps:
        return format(t.gaps, { slots: f.freeSlots ?? 0, missed: money(f.missedCents), invitees: f.invitees ?? 0 });
      case BRIEF_KIND.pricing:
        return format(t.pricing, { service: services[item.subject]?.[locale] ?? "", time: f.timeSharePct ?? 0, revenue: f.revenueSharePct ?? 0, suggested: money(f.suggestedCents), gain: money(f.monthlyGainCents) });
      default:
        return format(t.taxes, { setAside: money(f.setAsideCents), invoiced: money(f.invoicedCents), available: money(f.availableCents) });
    }
  });
}

/**
 * The Monday e-mail of every shop whose brief is due (Monday from 7:00 in its own time zone, or later in the week when a
 * tick was missed): claimed once per shop and week (several instances never send twice), nothing sent for an empty week,
 * a one-click way to stop it. The ticker (`instrumentation.ts`) calls it with the wall clock.
 */
export async function sendDueBriefs(now: Date, settings: MailSettings, send: typeof fetch = fetch) {
  const counts = { sent: 0, pending: 0, failed: 0, empty: 0 };
  for (const shop of await briefMailShops(db())) {
    if (!isBriefDue(now, shop.timezone, shop.lastWeek)) continue;
    const brief = await loadShopBrief(shop, now);
    const token = await claimBriefDelivery(db(), shop.id, brief.week, brief.items.length);
    if (!token) continue;
    if (brief.items.length === 0) {
      counts.empty += 1;
      continue;
    }
    const locale = shop.ownerLocale;
    const lines = briefLines(brief.items, brief.services, locale);
    const mail = renderMailTemplate(
      "brief-weekly",
      { shop: shop.name, line1: lines[0]!, line2: lines[1] ?? "", has2: lines.length > 1, line3: lines[2] ?? "", has3: lines.length > 2, url: `${settings.appUrl}${shopRoutes(locale, shop.id).today()}`, stop: `${settings.appUrl}/${locale}/brief/stop/${token}` },
      { locale, appUrl: settings.appUrl, now, product: await productName() },
    );
    const id = await enqueueMail(db(), { to: shop.ownerEmail, locale: mail.locale, template: "brief-weekly", subject: mail.subject, html: mail.html, text: mail.text, relatedKind: "brief", relatedId: shop.id });
    const queued = await mailById(db(), id);
    counts[queued ? await deliver(db(), queued, now, settings, send) : "pending"] += 1;
  }
  return counts;
}
