import { ImageResponse } from "next/og";

import { PRODUCT_NAME } from "@/lib/brand";

export const dynamic = "force-static";

/** The social card, drawn at build: the name, the promise, the forest green and copper of the brand. */
export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "linear-gradient(135deg, #0f1a13 0%, #0f1018 55%, #0c0c0e 100%)", color: "#f4f4f5", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 72, height: 72, background: "#2d8049", borderRadius: 12 }} />
          <div style={{ fontSize: 64, fontWeight: 800 }}>{PRODUCT_NAME}</div>
        </div>
        <div style={{ fontSize: 48, fontWeight: 700, marginTop: 40 }}>Run your shop, for less.</div>
        <div style={{ fontSize: 28, marginTop: 20, color: "#a1a1aa" }}>Bookings, bilingual invoices with GST/QST, your tax return prepared.</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
