// @template: app-list-detail
import { SHOP_ROLES } from "@akinaza/db";

import { TeamPanel } from "@/components/app/TeamPanel";
import { asLocale, getDictionary } from "@/lib/i18n";
import { memberShop } from "@/lib/member-shop";
import { titleOf } from "@/lib/page-title";
import { team } from "@/lib/team";

export const dynamic = "force-dynamic";
export const generateMetadata = titleOf("team");

/** The shop's team: members with their role, pending invitations, and the invitation form. The roles one may hand out are read from the role table. */
export default async function Team({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const { session, shop, role } = await memberShop("team");
  const roles = team();
  const [members, invitations] = await Promise.all([roles.members(shop.id), roles.pendingInvitations(shop.id, new Date())]);
  const manages = SHOP_ROLES.manages[role];
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-bold text-fg">{getDictionary(locale).console.team.title}</h1>
      <TeamPanel
        timeZone={shop.timezone}
        assignable={[...manages]}
        members={members.map((m) => ({ accountId: m.accountId, email: m.email, name: m.name, role: m.role, since: m.since.toISOString(), manageable: manages.includes(m.role), isYou: m.accountId === session.account.id }))}
        invitations={invitations.map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt.toISOString() }))}
      />
    </div>
  );
}
