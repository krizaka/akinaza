import { notFound, redirect } from "next/navigation";

import { pageSession } from "@/lib/access";
import { boutiqueSectionsAllowed, firstBoutiqueSection } from "@/lib/boutique";
import { asLocale } from "@/lib/i18n";
import { may,memberOf } from "@/lib/member-shop";
import { shopRoutes } from "@/lib/routes";

export const dynamic = "force-dynamic";

/** Boutique, without a section: the first one the role may open (the owner's page, the manager's team). A role with none is a 404. */
export default async function BoutiqueIndex({ params }: { params: Promise<{ locale: string; shop: string }> }) {
  const { locale: rawLocale, shop: shopId } = await params;
  const locale = asLocale(rawLocale);
  const { account } = (await pageSession())!;
  const member = await memberOf(account.id, shopId);
  if (!member) {notFound();}
  const first = firstBoutiqueSection(boutiqueSectionsAllowed((permission) => may(member.role, permission)));
  if (!first) {notFound();}
  redirect(shopRoutes(locale, shopId).boutique(first));
}
