"use client";

import { BillingIcon, ClockIcon, HomeIcon, LogoutIcon, ServerIcon, ShieldIcon, UserIcon, UsersIcon } from "@krizaka/icons";
import { krizakaFetch, useMutation } from "@krizaka/query";
import { AkinazaLogo } from "@krizaka/ui";
import { AppShell } from "@krizaka/ui/app-shell";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { languagesFor,LanguageSwitch } from "@krizaka/ui/language-switch";
import { ThemeToggle } from "@krizaka/ui/theme";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useSay } from "@/lib/i18n-client";

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "";
const ICONS = { today: <ClockIcon />, bookings: <ClockIcon />, clients: <UsersIcon />, shop: <HomeIcon />, books: <BillingIcon />, overview: <HomeIcon />, profile: <UserIcon />, users: <UserIcon />, shops: <UsersIcon />, invoices: <BillingIcon />, team: <UsersIcon />, ledger: <ShieldIcon />, operations: <ServerIcon />, audit: <ClockIcon /> } as const;

/**
 * The signed-in frame (@krizaka/ui AppShell): the shop's space (`/app`) and the administration (admin.akinaza.com)
 * share it — the mark, the sections, the language, the theme, sign-out and the DEV build.
 */
export function AppFrame({ locale, email, base, items, hrefs, admin = false, switcher, children }: { locale: "en" | "fr"; email: string; base: string; items: (keyof typeof ICONS)[]; hrefs?: Partial<Record<keyof typeof ICONS, string>>; admin?: boolean; switcher?: React.ReactNode; children: React.ReactNode }) {
  const { say } = useSay();
  const router = useRouter();
  const path = usePathname() ?? "";
  const rest = path.slice(`/${locale}`.length);
  const signOut = useMutation({
    mutationFn: () => krizakaFetch("/api/auth/sign-out", { method: "POST" }),
    onSettled: () => {
      router.replace(`/${locale}/sign-in`);
      router.refresh();
    },
  });
  const isCurrent = (to: string) => path === to || (to !== `/${locale}` && path.startsWith(`${to}/`));
  return (
    <AppShell.Root skipLabel={say("shell.skip")}>
      <AppShell.Sidebar
        label={say(admin ? "shell.admin" : "shell.title")}
        brand={
          <Link href={base} className="inline-flex items-center gap-2">
            <AkinazaLogo size={24} animated={false} /> Akinaza {admin ? <Badge tone="warning">{say("shell.dev")}</Badge> : null}
          </Link>
        }
        closeLabel={say("shell.closeMenu")}
        collapseLabels={[say("shell.collapse"), say("shell.expand")]}
        footer={
          <div className="flex flex-col gap-1 px-3 pb-2 text-xs text-fg-muted">
            <span className="truncate" title={email}>
              {say("shell.signedInAs", { email })}
            </span>
            {VERSION ? <span data-testid="app-version">{say("shell.devBuild", { version: VERSION })}</span> : null}
          </div>
        }
      >
        {switcher ? <div className="px-3 pb-2">{switcher}</div> : null}
        {items.map((key) => {
          const to = hrefs?.[key] ?? (key === (admin ? "overview" : "today") || key === "bookings" ? base : `${base}/${key}`);
          return (
            <AppShell.Item key={key} asChild label={say(`shell.${key}`)} icon={ICONS[key]} current={isCurrent(to)}>
              <Link href={to}>{say(`shell.${key}`)}</Link>
            </AppShell.Item>
          );
        })}
      </AppShell.Sidebar>
      <AppShell.Body>
        <AppShell.Header
          title={say(admin ? "shell.admin" : "shell.title")}
          menuLabel={say("shell.openMenu")}
          actions={
            <>
              <LanguageSwitch label={say("shell.language")} current={locale} languages={languagesFor(`/${locale}${rest}`)} linkAs={Link} />
              <ThemeToggle label={say("shell.theme")} variant="ghost" />
              <Button size="sm" variant="secondary" loading={signOut.isPending} onClick={() => signOut.mutate()}>
                <LogoutIcon size={16} /> <span className="hidden sm:inline">{say("shell.signOut")}</span>
              </Button>
            </>
          }
        />
        <AppShell.Main>{children}</AppShell.Main>
      </AppShell.Body>
    </AppShell.Root>
  );
}
