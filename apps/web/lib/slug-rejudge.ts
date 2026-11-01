import { type Db, enqueueMail, mailById, rejudgeShops } from "@akinaza/db";

import { productName } from "./brand-name";
import { deliver } from "./mail";
import type { MailSettings } from "./mail-settings";
import { renderMailTemplate } from "./mail-templates";
import { shopRoutes } from "./routes";
import { slugPolicy } from "./slug-policy";

export interface RejudgeReport {
  shops: { shopId: string; name: string; slug: string; matched: string; ownerEmail: string | null }[];
  /** Owners e-mailed (a shop without an owner address is held without a mail). */
  notified: number;
}

type Rejudged = Awaited<ReturnType<typeof rejudgeShops>>[number];

/** Tells one owner their shop is held (no owner address: held without a mail). Returns whether a mail was queued. */
async function notifyOwner(db: Db, shop: Rejudged, options: { now: Date; settings: MailSettings; send?: typeof fetch }): Promise<boolean> {
  if (!shop.ownerEmail) {
    return false;
  }
  const locale = shop.ownerLocale;
  const mail = renderMailTemplate(
    "slug-held",
    { shop: shop.name, address: shop.slug, url: `${options.settings.appUrl}${shopRoutes(locale, shop.shopId).setup}` },
    { locale, appUrl: options.settings.appUrl, now: options.now, product: await productName() },
  );
  const id = await enqueueMail(db, { to: shop.ownerEmail, locale: mail.locale, template: "slug-held", subject: mail.subject, html: mail.html, text: mail.text, relatedKind: "slug_hold", relatedId: shop.shopId });
  const queued = await mailById(db, id);
  if (queued) {
    await deliver(db, queued, options.now, options.settings, options.send);
  }
  return true;
}

/**
 * The one-off job (ADR-005, #537): shops created before the hold existed are judged against the current terms. The dry run reports who would be held;
 * the apply holds them and tells each owner the documented way (the `slug-held` mail, in the owner's language, with the link to choose another address).
 */
export async function rejudgeAndNotify(db: Db, options: { apply: boolean; now: Date; settings: MailSettings; send?: typeof fetch }): Promise<RejudgeReport> {
  const { terms } = await slugPolicy();
  const found = await rejudgeShops(db, terms ?? [], { apply: options.apply });
  const sent = options.apply ? await Promise.all(found.map((shop) => notifyOwner(db, shop, options))) : [];
  const notified = sent.filter(Boolean).length;
  return { shops: found.map(({ shopId, name, slug, matched, ownerEmail }) => ({ shopId, name, slug, matched, ownerEmail })), notified };
}
