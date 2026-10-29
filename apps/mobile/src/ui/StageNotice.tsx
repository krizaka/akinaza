import { EnvironmentNotice } from "@krizaka/ui/native";
import * as React from "react";

import { useI18n } from "@/i18n";
import { appStage } from "@/stage";

/**
 * « Development version, data can be reset, not a commercial offer » (akinaza#368): the `EnvironmentNotice` of @krizaka/ui, once, in the root
 * layout, so every screen of the phone app carries it as the web does. `prod` renders nothing. Never a banner of our own, never an `if` per screen.
 */
export function StageNotice({ stage = appStage() }: Readonly<{ stage?: string }>) {
  const { t } = useI18n();
  return <EnvironmentNotice stage={stage} title={t("stage.title")} message={t("stage.message")} />;
}
