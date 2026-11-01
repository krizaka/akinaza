import { Badge } from "@krizaka/ui/badge";

import { PreviewFrame } from "@/components/home/previews/PreviewFrame";
import { format, getDictionary, type Locale } from "@/lib/i18n";
import { DEMO_DAYS, DEMO_PICKED } from "@/lib/landing-demo";

/** « Clients book on their own »: a client picks a free time; it is booked and no longer offered to anyone else. */
export function BookPreview({ locale }: Readonly<{ locale: Locale }>) {
  const t = getDictionary(locale).landing;
  const [dayId, picked] = DEMO_PICKED.split("T") as [string, string];
  const times = DEMO_DAYS.find((d) => d.id === dayId)?.times ?? [];
  const day = new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${dayId}T12:00:00Z`));
  const left = times.filter((time) => time !== picked);
  return (
    <PreviewFrame
      alt={format(t.screens.book.alt, { day, time: picked })}
      demo={t.preview.demo}
      action={{
        label: format(t.preview.book.action, { day }),
        body: (
          <span className="flex flex-wrap gap-1.5">
            {times.map((time) => (
              <Badge key={time} size="md" tone={time === picked ? "accent" : "neutral"}>
                {time}
              </Badge>
            ))}
          </span>
        ),
      }}
      result={{
        label: t.preview.book.result,
        body: (
          <>
            <span className="block text-base font-semibold tabular-nums">{`${day} · ${picked}`}</span>
            <span className="block text-fg-secondary">{format(t.preview.book.others, { times: left.join(" · ") })}</span>
          </>
        ),
      }}
    />
  );
}
