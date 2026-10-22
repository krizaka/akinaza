import { notFound, redirect } from "next/navigation";

import { pageSession } from "./access";
import { asLocale } from "./i18n";
import { lastMember } from "./member-shop";
import { shopRoutes } from "./routes";

type Legacy = "clients" | "invoices" | "books" | "team" | "setup";

/** A page for an old address (`/app/clients`): the same page of the shop last worked in; a 404 for someone who runs no shop. */
export const legacyRedirect =
  (page: Legacy) =>
  async ({ params }: { params: Promise<{ locale: string }> }): Promise<never> => {
    const locale = asLocale((await params).locale);
    const { account } = (await pageSession())!;
    const member = await lastMember(account.id);
    if (!member) notFound();
    const routes = shopRoutes(locale, member.shop.id);
    return redirect(page === "books" ? routes.books() : routes[page]);
  };
