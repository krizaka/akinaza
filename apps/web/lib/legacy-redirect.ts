import { pageSession } from "./access";
import { asLocale } from "./i18n";
import { lastMember } from "./member-shop";
import { shopRoutes } from "./routes";

type Legacy = "clients" | "invoices" | "books" | "team" | "setup";

/**
 * An old address (`/app/clients`, from before the shop was in the path): a 307 to the same page of the shop last worked in, a 404 for someone
 * who runs no shop, the sign-in for nobody. It answers 307 and not 308 on purpose: the target depends on who asks and on the last shop,
 * so a browser must never keep it. Every other old address is a 308 in `next.config.mjs`.
 */
export const legacyRedirect =
  (page: Legacy) =>
  async (req: Request, { params }: { params: Promise<{ locale: string }> }): Promise<Response> => {
    const locale = asLocale((await params).locale);
    const to = (path: string) => new Response(null, { status: 307, headers: { Location: path } });
    const session = await pageSession();
    if (!session) return to(`/${locale}/sign-in`);
    const member = await lastMember(session.account.id);
    if (!member) return new Response("Not found", { status: 404 });
    const routes = shopRoutes(locale, member.shop.id);
    return to(page === "books" ? routes.books() : routes[page]);
  };
