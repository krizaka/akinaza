import { ACTION_KINDS, type ActionKind, applyOwnerOverrides, DEFAULT_FIGURE_THRESHOLDS, type FigureThresholds, type OwnerOverrides, sanitizeThresholds } from "@akinaza/core";

import { appSettings } from "@/lib/settings";

/**
 * The thresholds the owner's figures are judged against and the actions offered, as the administrator set them (`figures.*` settings, audited, no
 * rebuild). The domain never reads a setting: the screens call this and pass the result in. A configuration that contradicts itself is straightened.
 */
export async function figureRules(ownerOverrides: () => Promise<OwnerOverrides>): Promise<{ thresholds: FigureThresholds; offered: ActionKind[] }> {
  const { defaults, offered } = await adminFigureRules();
  // The owner's own thresholds sit on top of the administrator's, inside the bounds, unless the administrator switched tuning off.
  const tunable = await appSettings().get("figures.ownerTunable");
  return { thresholds: tunable ? applyOwnerOverrides(defaults, await ownerOverrides()) : defaults, offered };
}

/** The administrator's thresholds and the actions offered, before any owner's tuning: what « back to the usual values » means. */
export async function adminFigureRules(): Promise<{ defaults: FigureThresholds; offered: ActionKind[] }> {
  const settings = appSettings();
  const get = <K extends Parameters<typeof settings.get>[0]>(key: K) => settings.get(key);
  const [overdueWatchPct, overdueAlertPct, collectedWatchPct, collectedAlertPct, marginWatchPct, marginAlertPct, noShowWatchPct, noShowAlertPct, taxPeriodSoonDays, emptySlotMaxFillPct, emptySlotMinOffered, maxActions, actions] = await Promise.all([
    get("figures.overdueWatchPct"),
    get("figures.overdueAlertPct"),
    get("figures.collectedWatchPct"),
    get("figures.collectedAlertPct"),
    get("figures.marginWatchPct"),
    get("figures.marginAlertPct"),
    get("figures.noShowWatchPct"),
    get("figures.noShowAlertPct"),
    get("figures.taxPeriodSoonDays"),
    get("figures.emptySlotMaxFillPct"),
    get("figures.emptySlotMinOffered"),
    get("figures.maxActions"),
    get("figures.actions"),
  ]);
  const thresholds = sanitizeThresholds({ ...DEFAULT_FIGURE_THRESHOLDS, overdueWatchPct, overdueAlertPct, collectedWatchPct, collectedAlertPct, marginWatchPct, marginAlertPct, noShowWatchPct, noShowAlertPct, taxPeriodSoonDays, emptySlotMaxFillPct, emptySlotMinOffered, maxActions });
  return { defaults: thresholds, offered: ACTION_KINDS.filter((k) => (actions as readonly string[]).includes(k)) };
}
