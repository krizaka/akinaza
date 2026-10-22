import { requireSession } from "@/lib/access";
import { customerOf } from "@/lib/billing";
import { query } from "@/lib/db";
import { env } from "@/lib/env";
import { handle, HttpError, refuse } from "@/lib/http";
import { paymentsFrom } from "@/lib/payments/config";
import { PaymentsError } from "@/lib/payments/port";
import { limit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** The founder offer: a hosted payment page for the signed-in account (the amount, GST and QST are the processor's). */
export function POST(req: Request) {
  return handle(async () => {
    const e = env();
    const port = paymentsFrom(e);
    if (!port) throw refuse(503, "PAYMENTS_OFF", "Payment is not available yet");
    const url = new URL(req.url);
    const redirect = url.searchParams.get("redirect") === "1";
    const locale = url.searchParams.get("locale") === "fr" ? "fr" : "en";
    // A form on the public page: no session sends the visitor to sign in (a redirect), the API answers 401 as usual.
    const { account } = await requireSession(req).catch((error) => {
      if (redirect && error instanceof HttpError && error.status === 401) throw new HttpError(303, "Sign in first", { code: "UNAUTHENTICATED" }, { Location: `/${locale}/sign-in` });
      throw error;
    });
    limit("billing", req, account.id, [20, 3600]);
    try {
      const customerId = await customerOf(query, account.id, () => port.createCustomer(account.email, account.id));
      const base = `${e.APP_PUBLIC_URL.replace(/\/$/, "")}/${account.locale}`;
      const session = await port.checkout({ kind: "founder", customerId, accountId: account.id, successUrl: `${base}/app?billing=success`, cancelUrl: `${base}?billing=cancelled`, locale: account.locale });
      return redirect ? new Response(null, { status: 303, headers: { Location: session.url } }) : Response.json({ url: session.url });
    } catch (error) {
      if (error instanceof PaymentsError) throw refuse(502, "PAYMENTS_UNAVAILABLE", "The payment page could not be opened");
      throw error;
    }
  });
}
