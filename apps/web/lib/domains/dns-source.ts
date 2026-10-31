import type { TxtResolver } from "@akinaza/core";

import { systemTxt } from "./dns-txt";
import { harnessDns } from "./edge-hostnames";

/** The resolver of the configuration: the system's, or the harness's in development and tests. */
export const dnsOf = (vars: Record<string, string | undefined>): TxtResolver => (vars.APP_EDGE_PROVIDER === "memory" && vars.NODE_ENV !== "production" ? harnessDns : systemTxt);
