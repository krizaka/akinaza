import { sendDueBriefs } from "@/lib/brief";
import { mailSettings } from "@/lib/env";

/** The Monday e-mails that are due. The ticker (`instrumentation.ts`) calls it; safe from several instances (claimed per shop and week). */
export const sendDueBriefsAt = (now: Date) => sendDueBriefs(now, mailSettings());
