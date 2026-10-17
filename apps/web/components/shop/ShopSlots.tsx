"use client";

import { SlotPicker } from "@krizaka/ui/slot-picker";
import Link from "next/link";

import type { DayView } from "@/lib/storefront";

/** The next free times: each one a link to the booking with the service, the area and the time already chosen. */
export function ShopSlots({ days, label, emptyLabel }: { days: DayView[]; label: string; emptyLabel: string }) {
  return <SlotPicker days={days} label={label} emptyLabel={emptyLabel} linkAs={Link} />;
}
