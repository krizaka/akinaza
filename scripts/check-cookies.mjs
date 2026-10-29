// Every cookie the built app sets is host-only (ADR-005 slice 1, akinaza#534): no `Domain=`, `Path=/`, and `__Host-` prefixed (with Secure) when the
// origin is https. It crawls the public pages, the shop page and the sign-in, and reads each `Set-Cookie`.
// Usage: node scripts/check-cookies.mjs --base http://localhost:3000 [--email <e> --password <p>]
import { pathToFileURL } from "node:url";

/** The problems of the cookies one answer sets: pure, so each rule is tested without a server. */
export function cookieProblems(setCookies, { https }) {
  const problems = [];
  for (const line of setCookies) {
    const name = line.split("=")[0].trim();
    const attributes = line.split(";").slice(1).map((a) => a.trim().toLowerCase());
    if (attributes.some((a) => a.startsWith("domain="))) problems.push(`${name}: has a Domain attribute`);
    if (!attributes.includes("path=/")) problems.push(`${name}: Path is not /`);
    if (https && !name.startsWith("__Host-")) problems.push(`${name}: not __Host- prefixed on https`);
    if (https && !attributes.includes("secure")) problems.push(`${name}: not Secure on https`);
  }
  return problems;
}

async function main() {
  const args = process.argv.slice(2);
  const arg = (flag) => args[args.indexOf(flag) + 1];
  const base = arg("--base") ?? "http://localhost:3000";
  const https = base.startsWith("https://");
  const paths = ["/fr", "/en", "/fr/s/pattes-saint-henri", "/fr/pricing", "/api/me"];
  const problems = [];
  let seen = 0;
  const read = (answer, where) => {
    const lines = answer.headers.getSetCookie();
    seen += lines.length;
    for (const p of cookieProblems(lines, { https })) problems.push(`${where}: ${p}`);
  };
  for (const path of paths) read(await fetch(`${base}${path}`, { redirect: "manual" }), `GET ${path}`);
  if (arg("--email")) {
    const answer = await fetch(`${base}/api/auth/sign-in`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: arg("--email"), password: arg("--password") }) });
    if (answer.status !== 200) problems.push(`POST /api/auth/sign-in answered ${answer.status}`);
    read(answer, "POST /api/auth/sign-in");
    if (answer.headers.getSetCookie().length === 0) problems.push("sign-in set no session cookie");
  }
  console.log(`check-cookies: ${seen} Set-Cookie line(s) on ${paths.length} page(s)${arg("--email") ? " and the sign-in" : ""}`);
  if (problems.length) {
    console.error(`${problems.length} problem(s):\n${problems.map((p) => `  ${p}`).join("\n")}`);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
