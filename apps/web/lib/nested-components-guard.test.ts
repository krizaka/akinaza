// Guard for Sonar S6478 (#343): a component defined inside a component fails lint, so the 33 sites cannot come back.
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const nested = `export function Page({ rows }: { rows: string[] }) {
  const Cell = () => <b>{rows.length}</b>;
  return <ul><Cell /></ul>;
}
`;
const flat = `const Cell = ({ n }: { n: number }) => <b>{n}</b>;
export function Page({ rows }: { rows: string[] }) {
  return <ul><Cell n={rows.length} /></ul>;
}
`;

describe("react/no-unstable-nested-components is an error on the web app (S6478)", () => {
  const lint = async (code: string) => {
    const eslint = new ESLint({ cwd: process.cwd() });
    const [result] = await eslint.lintText(code, { filePath: "components/zz-probe.tsx" });
    return result.messages.filter((m) => m.ruleId === "react/no-unstable-nested-components" || /during render/.test(m.message));
  };

  it("refuses a component defined inside a component", async () => {
    const found = await lint(nested);
    expect(found.length).toBeGreaterThan(0);
    expect(found.some((m) => m.severity === 2)).toBe(true);
  }, 30_000);

  it("accepts the same component at module level", async () => {
    expect(await lint(flat)).toEqual([]);
  }, 30_000);
});
