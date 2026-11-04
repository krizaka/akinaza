import { CODE_NAME } from "@/lib/brand";
import { appEnvironment } from "@/lib/env";
import { format, getDictionary, type Locale } from "@/lib/i18n";

/**
 * « code name: akinaza » / « nom de code : akinaza »: the line under the commercial name on a DEVELOPMENT deployment, so a person can
 * follow the host (dev.akinaza.com) to the screen (« Folioviv »). `null` in production (`APP_ENVIRONMENT=prod`): a commercial domain never
 * shows the code name. The stage is the one `StageNotice` reads; the words are the `stage.codeName` messages.
 */
export function codeNameLine(locale: Locale, stage: string = appEnvironment()): string | null {
  if (stage === "prod") return null;
  return format(getDictionary(locale).stage.codeName, { code: CODE_NAME });
}
