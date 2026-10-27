import { SlotPicker } from "@krizaka/ui/slot-picker";

import { PreviewFrame } from "@/components/home/previews/PreviewFrame";
import { getDictionary, type Locale } from "@/lib/i18n";
import { DEMO_DAYS, DEMO_PICKED } from "@/lib/landing-demo";

/** « Clients book on their own »: the storefront's own time picker (`SlotPicker`) on a demo week, one time chosen. */
export function BookPreview({ locale }: Readonly<{ locale: Locale }>) {
  const d = getDictionary(locale).landing;
  const name = new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "short" });
  const sub = new Intl.DateTimeFormat(locale, { timeZone: "UTC", day: "numeric", month: "short" });
  const days = DEMO_DAYS.map(({ id, times }) => {
    const at = new Date(`${id}T12:00:00Z`);
    return { id, label: name.format(at), sub: sub.format(at), slots: times.map((t) => ({ id: `${id}T${t}`, label: t })) };
  });
  return (
    <PreviewFrame alt={d.screens.book.alt} demo={d.preview.demo}>
      <SlotPicker days={days} label={d.preview.slotsLabel} emptyLabel={d.preview.slotsEmpty} value={DEMO_PICKED} defaultDay="2026-11-04" />
    </PreviewFrame>
  );
}
