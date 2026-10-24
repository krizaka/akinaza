// @template: app-list-detail
import { localDay } from "@akinaza/core";
import { SHOP_ROLES, shopStaff, teamTimeOff } from "@akinaza/db";
import { PageHeader } from "@krizaka/ui/page-header";

import { TeamPanel } from "@/components/app/TeamPanel";
import { TimeOffCard } from "@/components/app/TimeOffCard";
import { db } from "@/lib/db";
import { asLocale, getDictionary } from "@/lib/i18n";
import { may, memberShop } from "@/lib/member-shop";
import { titleOf } from "@/lib/page-title";
import { team } from "@/lib/team";

export const dynamic = "force-dynamic";
export const generateMetadata = titleOf("team");

/** The shop's team: members with their role, pending invitations, and the invitation form. The roles one may hand out are read from the role table. */
export default async function Team({ params }: { params: Promise<{ locale: string; shop: string }> }) {
  const { locale: rawLocale, shop: shopId } = await params;
  const locale = asLocale(rawLocale);
  const { session, shop, role } = await memberShop(shopId, "team");
  const roles = team();
  const now = new Date();
  const [members, invitations, people, timeOff] = await Promise.all([roles.members(shop.id), roles.pendingInvitations(shop.id, now), shopStaff(db(), shop.id), teamTimeOff(db(), shop.id, localDay(now, shop.timezone))]);
  const manages = SHOP_ROLES.manages[role];
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={getDictionary(locale).console.team.title} />
      <TeamPanel
        timeZone={shop.timezone}
        assignable={[...manages]}
        members={members.map((m) => ({ accountId: m.accountId, email: m.email, name: m.name, role: m.role, since: m.since.toISOString(), manageable: manages.includes(m.role), isYou: m.accountId === session.account.id }))}
        invitations={invitations.map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt.toISOString() }))}
      />
      {may(role, "schedule") ? <TimeOffCard data={{ staff: people, timeOff }} /> : null}
    </div>
  );
}
