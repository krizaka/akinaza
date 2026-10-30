import { PaymentsError } from "@krizaka/payments";

import { requireSession } from "@/lib/access";
import { subscriptionOf } from "@/lib/billing";
import { query } from "@/lib/db";
import { env } from "@/lib/env";
import { handle, refuse } from "@/lib/http";
import { paymentsFrom } from "@/lib/payments/config";
import { limit } from "@/lib/rate-limit";
import { requestNow } from "@/app/request-now";

export const dynamic = "force-dynamic";

/** The hosted page where the member manages the subscription, reads the invoices and cancels. */
export function POST(req: Request) {
  return handle(async () => {
    const e = env();
    const port = paymentsFrom(e);
    if (!port) throw refuse(503, "PAYMENTS_OFF", "Payment is not available yet");
    const { account } = await requireSession(req);
    limit("billing", req, account.id, [20, 3600]);
    const sub = await subscriptionOf(query, account.id, requestNow());
    if (!sub.customerId) throw refuse(409, "NO_SUBSCRIPTION", "There is no subscription to manage");
    try {
      const page = await port.portal(sub.customerId, `${e.APP_PUBLIC_URL.replace(/\/$/, "")}/${account.locale}/app`, account.locale);
      return Response.json({ url: page.url });
    } catch (error) {
      if (error instanceof PaymentsError) throw refuse(502, "PAYMENTS_UNAVAILABLE", "The billing page could not be opened");
      throw error;
    }
  });
}
