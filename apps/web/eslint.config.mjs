import { krizakaUi } from "@krizaka/config/eslint/krizaka-ui";
import { krizakaNext } from "@krizaka/config/eslint/next";
import { krizakaStack } from "@krizaka/config/eslint/stack";

const config = [
  ...krizakaNext,
  // The four UI rules of the Krizaka platform (no raw palette, no `light:`, no `[var(--…)]`, no className template).
  ...krizakaUi(),
  // The stack rules, the React-effects rules and cognitive complexity (15): warnings while krizaka-ratchet freezes the debt.
  ...krizakaStack({ effects: "warn", complexity: "warn" }),
  { ignores: [".next/**", "next-env.d.ts"] },
];

export default config;
