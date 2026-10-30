import { krizakaUi } from "@krizaka/config/eslint/krizaka-ui";
import { krizakaNext } from "@krizaka/config/eslint/next";
import { krizakaStack } from "@krizaka/config/eslint/stack";

const config = [
  ...krizakaNext,
  // The four UI rules of the Krizaka platform (no raw palette, no `light:`, no `[var(--…)]`, no className template).
  ...krizakaUi(),
  // The stack rules and the Sonar layer (ADR-013): warnings while krizaka-ratchet holds each count (they only go down).
  ...krizakaStack({ severity: "warn", effects: "warn", complexity: "warn", sonar: "warn", codeRules: "off" }),
  // Sonar S6478 (#343): a component or render function defined inside a component is re-created on each render; build it at module level.
  { rules: { "react/no-unstable-nested-components": ["error", { allowAsProps: false }] } },
  { ignores: [".next/**", "next-env.d.ts"] },
];

export default config;
