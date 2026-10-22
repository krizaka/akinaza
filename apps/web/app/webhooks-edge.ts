import { openField, sealField } from "@akinaza/db";

import { dataKey } from "@/lib/env";
import { sendWebhook, webhooks } from "@/lib/webhooks";

/** The webhooks of this deployment: endpoint secrets are sealed with the data key (the edge reads the environment; `lib/` never does). */
export const hooks = () => webhooks({ seal: (plain) => sealField(plain, dataKey(), "webhook-secret"), open: (sealed) => openField(sealed, dataKey(), "webhook-secret") });

/** Sends what is due. The ticker (`instrumentation.ts`) calls it; safe from several instances (deliveries are leased). */
export const deliverDueWebhooks = (now: Date) => hooks().deliverDue(now, sendWebhook, { limit: 50 });
