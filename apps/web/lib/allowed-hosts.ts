import { publicHost } from "./indexing";
import { SHOP_LOOKUP_PATH } from "./shop-directory";
import { isShopDomainRoot, shopHostOf } from "./shop-domain";

type Env = Record<string, string | undefined>;

const bare = (host: string | null | undefined) => (host ?? "").trim().toLowerCase().replace(/:\d+$/, "");
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** The platform's own probes name an address of their own (the container's, the load balancer's): only these paths answer whatever the host says. */
export const HOST_FREE_PATHS = ["/api/healthz", "/healthz", SHOP_LOOKUP_PATH];

/**
 * ADR-005 slice 4 (#536): the hosts this deployment serves, and no other. A request that names another host (a Host header an
 * attacker chose, a look-alike, a name pointed at our address) is answered 421 before anything is routed or built from it.
 *  - the public host (APP_PUBLIC_URL) and its apex, the dev host (APP_DEV_HOST), the console (admin.<apex>), a shop's own
 *    address (<slug>.<apex>, and <slug>.<APP_SHOP_DOMAIN> with the shop domain and its www; one well-formed label, never a platform name: `shopOfHost`);
 *  - `APP_ALLOWED_HOSTS` (comma separated, exact names) for a deployment with an address of its own (a preview);
 *  - loopback in development, or when the declared public origin is itself loopback (the CI server).
 * Pure: the environment is a parameter.
 */
export function isAllowedHost(host: string | null | undefined, env: Env): boolean {
  const name = bare(host);
  if (!name) return false;
  const site = publicHost(env);
  const apex = site.replace(/^www\./, "");
  const known = [site, apex, bare(env.APP_DEV_HOST), ...(env.APP_ALLOWED_HOSTS ?? "").split(",").map(bare)];
  if (known.includes(name) || name === `admin.${apex}` || shopHostOf(name, env) !== null || isShopDomainRoot(name, env)) return true;
  return LOOPBACK.has(name) && (env.NODE_ENV !== "production" || LOOPBACK.has(site));
}
