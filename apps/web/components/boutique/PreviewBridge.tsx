"use client";

import { connectShopPreview } from "@krizaka/ui/shop";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * The page's side of the composer's preview (akinaza#402): outlines the section the composer selected and reads the page again when the draft was
 * saved. It only answers the composer of this origin (the bridge refuses any other). A subscription to the window, not data: no fetch here.
 */
export function PreviewBridge() {
  const router = useRouter();
  useEffect(() => connectShopPreview({ composerOrigin: window.location.origin, onRefresh: () => router.refresh() }), [router]);
  return null;
}
