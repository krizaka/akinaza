"use client";

import { Avatar } from "@krizaka/ui/avatar";

import { avatarOf } from "@/lib/avatar";

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

/** The avatar every list of clients draws: the org JSON's default picture assigned to the person's id (their name when they have no id), the same one wherever they appear. */
export function ClientAvatar({ id, name, avatarSeed, size = "sm" }: { id?: string; name: string; avatarSeed?: string | null; size?: "sm" | "md" | "lg" }) {
  return <Avatar alt="" size={size} {...avatarOf({ id: id ?? name, avatarSeed }, size === "sm" ? 256 : 512)} fallback={name.charAt(0)} />;
}
