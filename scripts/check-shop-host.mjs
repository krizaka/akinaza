// A seeded shop through its own domain, end to end (ADR-005 slices 4-5, akinaza#538, #549). Against a built server that declares APP_SHOP_DOMAIN
// (ci-after-build.sh starts one on its own port): the shop answers on <slug>.<shop domain> with its strict policy and no cookie of the app, the booking's last
// step is a hop to the app, an unknown shop is a 404, the old addresses are 308s, and the shop host has its own robots.txt, sitemap and canonical.
// Usage: node scripts/check-shop-host.mjs --base http://127.0.0.1:3001 --shop-domain shops.localhost --slug pattes-saint-henri --port 3001
import { request } from "node:http";
import { pathToFileURL } from "node:url";

/** One request with a Host of our choosing (fetch refuses to forge it): resolves to { status, headers, body }. */
function ask(base, host, path, headers = {}) {
  const url = new URL(path, base);
  return new Promise((resolve, reject) => {
    const req = request({ hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers: { host, ...headers } }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

/** The problems of a shop's page on its own host: pure, so each rule is tested without a server. */
export function shopPageProblems(answer, { origin, appOrigin }) {
  const problems = [];
  const csp = String(answer.headers["content-security-policy"] ?? "");
  const scripts = csp.split("; ").find((d) => d.startsWith("script-src ")) ?? "";
  if (answer.status !== 200) problems.push(`the page answered ${answer.status}`);
  if (!/'nonce-[^']+'/.test(scripts) || scripts.includes("'unsafe-inline'")) problems.push(`script-src is not the strict one: ${scripts}`);
  if (!csp.includes(`frame-ancestors ${appOrigin}`)) problems.push("frame-ancestors is not the app");
  if (!csp.includes(`form-action 'self' ${appOrigin}`)) problems.push("form-action does not name the app");
  const set = [].concat(answer.headers["set-cookie"] ?? []);
  for (const line of set) {
    if (/session/i.test(line)) problems.push(`a session cookie is set on the shop host: ${line.split("=")[0]}`);
    if (/;\s*domain=/i.test(line)) problems.push(`a cookie has a Domain: ${line.split("=")[0]}`);
  }
  if (!String(answer.headers["x-robots-tag"] ?? "").includes("noindex")) problems.push("the page is not noindex");
  if (!/no-store/.test(String(answer.headers["cache-control"] ?? ""))) problems.push("the page can be cached");
  if (!answer.body.includes(`<link rel="canonical" href="${origin}/`)) problems.push(`the canonical is not on ${origin}`);
  return problems;
}

/**
 * Whether a redirect leads to `target` on the app. Next relativizes a Location that points at its own listen origin (resolve-routes: getRelativeURL against
 * `http://localhost:<port>`), and this check's server declares that very origin as the app's; in production the app is another origin, so the header is absolute.
 * A relative Location is the same address only when the app origin is the listen origin (`listenOrigin`); anything else is a miss.
 */
export function leadsTo(answer, target, { listenOrigin } = {}) {
  const location = String(answer.headers.location ?? "");
  const url = new URL(target);
  const relative = `${url.pathname}${url.search}`;
  return answer.status === 308 && (location === target || (url.origin === listenOrigin && location === relative));
}

async function main() {
  const args = process.argv.slice(2);
  const arg = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
  const base = arg("--base", "http://127.0.0.1:3001");
  const domain = arg("--shop-domain", "shops.localhost");
  const slug = arg("--slug", "pattes-saint-henri");
  const port = arg("--port", "3001");
  const origin = `http://${slug}.${domain}:${port}`;
  const appOrigin = `http://localhost:${port}`;
  const shopHost = `${slug}.${domain}:${port}`;
  const problems = [];
  const expect = (ok, what) => ok || problems.push(what);

  const page = await ask(base, shopHost, "/fr", { cookie: "akinaza_session=forged; theme=dark" });
  problems.push(...shopPageProblems(page, { origin, appOrigin }).map((p) => `GET ${shopHost}/fr: ${p}`));
  expect(!page.body.includes("forged"), "the session cookie reached the page");

  const hop = await ask(base, shopHost, `/fr/s/${slug}/service/1/confirm?slot=9`);
  expect(leadsTo(hop, `${appOrigin}/fr/s/${slug}/service/1/confirm?slot=9`, { listenOrigin: appOrigin }), `the booking hop is ${hop.status} ${hop.headers.location}`);

  const ghost = await ask(base, `no-such-shop.${domain}:${port}`, "/fr");
  expect(ghost.status === 404 && String(ghost.headers["x-robots-tag"]).includes("noindex") && !ghost.body.includes("no-such-shop"), `an unknown shop answered ${ghost.status}`);

  const robots = await ask(base, shopHost, "/robots.txt");
  expect(robots.body.includes("Disallow: /") && robots.body.includes(`Sitemap: ${origin}/sitemap.xml`), "robots.txt is not closed with its Sitemap line");
  const sitemap = await ask(base, shopHost, "/sitemap.xml");
  expect(sitemap.status === 200 && sitemap.body.includes(`<loc>${origin}/fr</loc>`), `the shop sitemap answered ${sitemap.status} without ${origin}/fr`);

  const old = await ask(base, `localhost:${port}`, `/fr/s/${slug}?look=b`);
  expect(old.status === 308 && old.headers.location === `${origin}/fr?look=b`, `the old path address is ${old.status} ${old.headers.location}`);
  const legacy = await ask(base, `${slug}.localhost:${port}`, "/fr");
  expect(legacy.status === 308 && legacy.headers.location === `${origin}/fr`, `the legacy host is ${legacy.status} ${legacy.headers.location}`);

  const stranger = await ask(base, `${slug}.${domain}.evil.example`, "/fr");
  expect(stranger.status === 421, `a look-alike host answered ${stranger.status}`);

  console.log(`check-shop-host: ${slug} on ${shopHost}, 9 requests`);
  if (problems.length) {
    console.error(`${problems.length} problem(s):\n${problems.map((p) => `  ${p}`).join("\n")}`);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
