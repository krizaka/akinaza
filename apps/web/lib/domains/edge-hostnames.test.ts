import { describe, expect, it, vi } from "vitest";

import { edgeHostnames, edgeTarget, tlsOf } from "./edge-hostnames";

const configured = { APP_EDGE_PROVIDER: "cloudflare", APP_EDGE_API_TOKEN: "t", APP_EDGE_ZONE_ID: "z1" };
const answer = (result: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify({ success: status < 400, result }), { status }));

describe("the edge service behind CustomHostnames (ADR-005 §3, akinaza#539)", () => {
  it("reads only a final « active » as active and only known dead ends as failed; everything else waits", () => {
    expect(tlsOf("active")).toBe("active");
    expect(tlsOf("pending_validation")).toBe("pending");
    expect(tlsOf("initializing")).toBe("pending");
    expect(tlsOf(undefined)).toBe("pending");
    expect(tlsOf("validation_timed_out")).toBe("failed");
  });

  it("is off without a provider, a token and a zone; the memory harness is refused in production", () => {
    expect(edgeHostnames({})).toBeNull();
    expect(edgeHostnames({ APP_EDGE_PROVIDER: "cloudflare" })).toBeNull();
    expect(edgeHostnames({ APP_EDGE_PROVIDER: "memory", NODE_ENV: "production" })).toBeNull();
    expect(edgeHostnames({ APP_EDGE_PROVIDER: "memory", NODE_ENV: "test" })).not.toBeNull();
  });

  it("creates a hostname with the token in a header (never in the URL) and reports the certificate", async () => {
    const fetcher = answer({ id: "h1", status: "pending", ssl: { status: "pending_validation" } });
    const report = await edgeHostnames(configured, fetcher as never)!.create("reservation.monsalon.ca");
    expect(report).toEqual({ id: "h1", tls: "pending" });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.cloudflare.com/client/v4/zones/z1/custom_hostnames");
    expect(url).not.toContain("t=");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer t");
    expect(JSON.parse(init.body as string)).toMatchObject({ hostname: "reservation.monsalon.ca", ssl: { method: "http", type: "dv" } });
  });

  it("an active hostname needs both the hostname and its certificate active", async () => {
    expect(await edgeHostnames(configured, answer({ id: "h1", status: "active", ssl: { status: "active" } }) as never)!.status("h1")).toEqual({ id: "h1", tls: "active" });
    expect((await edgeHostnames(configured, answer({ id: "h1", status: "active", ssl: { status: "pending_issuance" } }) as never)!.status("h1")).tls).toBe("pending");
  });

  it("an error from the service is thrown, so the state machine keeps the domain where it is", async () => {
    await expect(edgeHostnames(configured, answer({}, 500) as never)!.status("h1")).rejects.toThrow("edge 500");
  });

  it("tells merchants where to point their CNAME", () => {
    expect(edgeTarget({})).toBe("edge.akinaza.shop");
    expect(edgeTarget({ APP_EDGE_CNAME_TARGET: " Edge.Example.Shop " })).toBe("edge.example.shop");
  });
});
