import { Avatar } from "@krizaka/ui/avatar";
import { Card } from "@krizaka/ui/card";
import { DescriptionList } from "@krizaka/ui/description-list";

import { ChangePasswordForm } from "@/components/account/AccountForms";
import { pageSession } from "@/lib/access";
import { asLocale, getDictionary } from "@/lib/i18n";

/** The account: the picture (Krizaka's default, from the account id), the e-mail, the language, the role, the password. */
export default async function Profile({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const t = getDictionary(locale).console.account.profile;
  const session = (await pageSession())!;
  const { account } = session;
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-4">
        <Avatar size="lg" alt={t.avatar} defaultAvatar={{ brand: "akinaza", seed: account.id, kind: "person" }} />
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-bold text-fg">{t.title}</h1>
          <p className="text-fg-secondary">{t.description}</p>
        </div>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card.Root className="p-4">
          <DescriptionList
            items={[
              { term: t.email, details: account.email },
              { term: t.language, details: account.locale === "fr" ? "Français" : "English" },
              { term: t.role, details: account.role === "ADMIN" ? t.roleAdmin : t.roleUser },
            ]}
          />
        </Card.Root>
        <Card.Root className="p-4">
          <h2 className="mb-3 font-display text-base font-bold text-fg">{t.passwordTitle}</h2>
          <ChangePasswordForm />
        </Card.Root>
      </div>
    </div>
  );
}
