import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["lib/**/*.test.{ts,tsx}", "app/**/*.test.ts", "components/**/*.test.tsx"], environment: "node",
    // The URL-state adapter reads `next/navigation`: inlined so a test can stand a history-backed one in its place (see ExploreView.dom.test).
    server: { deps: { inline: ["nuqs", "@krizaka/query"] } },
  },
});
