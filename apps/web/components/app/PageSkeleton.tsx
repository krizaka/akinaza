"use client";

import { DashboardLayout, Widget } from "@krizaka/ui/dashboard-layout";
import { Skeleton, SkeletonText } from "@krizaka/ui/skeleton";

import { useSay } from "@/lib/i18n-client";

const Rows = ({ count, height = "h-12" }: { count: number; height?: string }) => (
  <div className="flex flex-col gap-2">
    {Array.from({ length: count }, (_, i) => (
      <Skeleton key={i} shape="rect" className={height} />
    ))}
  </div>
);

/**
 * An owner screen while its data streams (D6, § 2.5 of the direction): drawn in the page's own boxes — the day's heading, binder
 * and two columns; a list's heading, strip, filters and rows; a file's header and sections — so nothing shifts when it arrives.
 * Never a full-page spinner; the skeletons stand still under reduced motion (@krizaka/ui).
 */
export function PageSkeleton({ kind }: { kind: "day" | "list" | "detail" }) {
  const { say } = useSay();
  const busy = { "aria-busy": true, "aria-label": say("states.loading") } as const;
  if (kind === "day")
    return (
      <div {...busy}>
        <DashboardLayout eyebrow={<Skeleton className="h-3 w-24" />} title={<Skeleton className="h-8 w-72 max-w-full" />} actions={<Skeleton className="h-8 w-64" />} toolbar={<div className="flex w-full flex-col gap-4"><Skeleton className="h-10 w-48" /><Skeleton className="h-9 w-full max-w-xl" /></div>}>
          <Widget span={3} title={<Skeleton className="h-4 w-40" />}>
            <Rows count={3} height="h-14" />
          </Widget>
          <div className="flex min-w-0 flex-col gap-4 sm:col-span-2 xl:col-span-1">
            <Widget title={<Skeleton className="h-4 w-28" />}>
              <Rows count={2} height="h-8" />
            </Widget>
            <Widget title={<Skeleton className="h-4 w-24" />}>
              <Skeleton shape="rect" className="h-20" />
            </Widget>
          </div>
        </DashboardLayout>
      </div>
    );
  if (kind === "detail")
    return (
      <div {...busy} className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Skeleton shape="circle" className="h-14" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-7 w-64 max-w-full" />
            <Skeleton className="h-3 w-80 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-9 w-80 max-w-full" />
        <SkeletonText lines={4} />
        <Rows count={3} />
      </div>
    );
  return (
    <div {...busy} className="flex flex-col gap-5">
      <Skeleton className="h-8 w-48" />
      <Skeleton shape="rect" className="h-24" />
      <Skeleton className="h-10 w-full" />
      <Rows count={6} />
    </div>
  );
}
