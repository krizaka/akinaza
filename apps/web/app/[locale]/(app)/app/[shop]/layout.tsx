import { notFound } from "next/navigation";

import { ShopSession } from "@/components/app/ShopSession";
import { SpaceChrome } from "@/components/app/SpaceChrome";
import { pageSession } from "@/lib/access";
import { asLocale } from "@/lib/i18n";
import { lastMember, memberOf } from "@/lib/member-shop";

/** One shop's space, named by the address: a shop the person does not belong to is a 404, whatever the cookie says. */
export default async function ShopLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string; shop: string }> }>) {
  const { locale: raw, shop: shopId } = await params;
  const locale = asLocale(raw);
  const { account } = (await pageSession())!;
  const member = await memberOf(account.id, shopId);
  if (!member) notFound();
  const last = await lastMember(account.id);
  return (
    <SpaceChrome locale={locale} account={account} member={member}>
      <ShopSession locale={locale} shopId={shopId} remembered={last?.shop.id === shopId}>
        {children}
      </ShopSession>
    </SpaceChrome>
  );
}
