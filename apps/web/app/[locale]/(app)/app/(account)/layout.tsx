import { SpaceChrome } from "@/components/app/SpaceChrome";
import { pageSession } from "@/lib/access";
import { asLocale } from "@/lib/i18n";
import { lastMember } from "@/lib/member-shop";

/** The account's own pages (home, profile): the frame around the shop the person last worked in, or the client's frame when they run none. */
export default async function AccountLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const locale = asLocale((await params).locale);
  const { account } = (await pageSession())!;
  return (
    <SpaceChrome locale={locale} account={account} member={await lastMember(account.id)}>
      {children}
    </SpaceChrome>
  );
}
