import { EnvironmentNotice } from "@krizaka/ui/environment-notice";

import { appEnvironment } from "@/lib/env";
import { getDictionary, type Locale } from "@/lib/i18n";

/**
 * « Development version, data can be reset, not a commercial offer » (akinaza#440): the `EnvironmentNotice` of @krizaka/ui, once, in the
 * root layout, so every page of the deployment carries it, public site and signed-in space. The stage is `APP_ENVIRONMENT`, read once
 * (at build too: the pages are static); `prod` renders nothing. Never a banner of our own, never an `if` per page.
 * `data-top-chrome` marks this block as standing above the page in the flow. The site bar is `sticky` (zero height) right after it, so it
 * starts under the notice and sticks to the top once the notice has scrolled away: CSS only, no layout listener (as yomizaka#449).
 */
export function StageNotice({ locale, stage = appEnvironment() }: Readonly<{ locale: Locale; stage?: string }>) {
  const { title, message } = getDictionary(locale).stage;
  return <EnvironmentNotice data-top-chrome stage={stage} title={title} message={message} />;
}
