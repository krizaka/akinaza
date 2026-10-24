import { headers } from "next/headers";

import { NotFoundPage } from "@/components/NotFoundPage";
import { asLocale } from "@/lib/i18n";
import { LOCALE_HEADER } from "@/lib/locale-negotiation";

/** A missing page inside a language segment: the same 404 as an unknown address, in the address's language (proxy.ts sets it). */
export default async function NotFound() {
  return <NotFoundPage locale={asLocale((await headers()).get(LOCALE_HEADER) ?? "")} />;
}
