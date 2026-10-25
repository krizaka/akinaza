"use client";

import { Avatar } from "@krizaka/ui/avatar";

export interface ClientRowView {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  visits: number;
  lastVisitAt: string | null;
  nextVisitAt: string | null;
  spentCents: number;
  /** What the client still owes on the invoices that stand (D5). */
  owedCents: number;
}

/** The avatar every list of clients draws: the person's initials on the brand's gradient, the same one wherever they appear. */
export function ClientAvatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" | "lg" }) {
  return <Avatar alt="" size={size} defaultAvatar={{ brand: "akinaza", seed: name }} fallback={name.charAt(0)} />;
}
