import { describe, expect, it } from "vitest";

import {
  checkDomain, type CustomHostnames, DOMAIN_ERROR, DOMAIN_STATE, type DomainSnapshot, dnsInstructions, newDomainToken, ownershipProven, readHostname,
  type TlsStatus, txtRecordName, txtRecordValue,
} from "./custom-domain";

const NOW = new Date("2026-10-30T12:00:00Z");
const limits = { maxAttempts: 3, lapseAttempts: 3, waitMs: 72 * 3600_000 };
const domain = (over: Partial<DomainSnapshot> = {}) => ({ hostname: "reservation.monsalon.ca", token: "abc", state: DOMAIN_STATE.pendingTxt as DomainSnapshot["state"], providerId: null, attempts: 0, createdAt: new Date("2026-10-30T10:00:00Z"), ...over });
const dnsWith = (...records: string[]) => ({ txt: async () => records });
function edge(tls: TlsStatus = "pending", fail = false): CustomHostnames & { created: string[] } {
  const created: string[] = [];
  return {
    created,
    create: async (h) => { if (fail) throw new Error("down"); created.push(h); return { id: "ch_1", tls: "pending" }; },
    status: async () => { if (fail) throw new Error("down"); return { id: "ch_1", tls }; },
    remove: async () => undefined,
  };
}

describe("readHostname", () => {
  it("reads what a merchant pastes", () => {
    expect(readHostname(" https://Reservation.MonSalon.ca:443/book?x=1 ")).toEqual({ ok: true, hostname: "reservation.monsalon.ca" });
    expect(readHostname("reservation.monsalon.ca.")).toEqual({ ok: true, hostname: "reservation.monsalon.ca" });
  });
  it("refuses an apex, an IP, a platform name and a malformed label", () => {
    expect(readHostname("monsalon.ca")).toEqual({ ok: false, reason: "apex" });
    expect(readHostname("")).toEqual({ ok: false, reason: "empty" });
    expect(readHostname("192.168.0.1")).toEqual({ ok: false, reason: "ip" });
    expect(readHostname("[::1]")).toEqual({ ok: false, reason: "ip" });
    expect(readHostname("login.akinaza.com")).toEqual({ ok: false, reason: "platform" });
    expect(readHostname("a.b.akinaza.shop")).toEqual({ ok: false, reason: "platform" });
    expect(readHostname("-bad.monsalon.ca")).toEqual({ ok: false, reason: "invalid" });
    expect(readHostname("bad_name.monsalon.ca")).toEqual({ ok: false, reason: "invalid" });
    expect(readHostname("localhost")).toEqual({ ok: false, reason: "invalid" });
  });
  it("does not take a look-alike for a platform name", () => {
    expect(readHostname("book.notakinaza.com")).toEqual({ ok: true, hostname: "book.notakinaza.com" });
  });
});

describe("ownership", () => {
  it("is proven only by the exact value at _akinaza-verify.<host>", async () => {
    expect(txtRecordName("a.b.ca")).toBe("_akinaza-verify.a.b.ca");
    expect(await ownershipProven(dnsWith(txtRecordValue("abc")), "a.b.ca", "abc")).toBe(true);
    expect(await ownershipProven(dnsWith(txtRecordValue("abd"), "other"), "a.b.ca", "abc")).toBe(false);
  });
  it("treats a resolver error as « not yet »", async () => {
    expect(await ownershipProven({ txt: async () => { throw new Error("SERVFAIL"); } }, "a.b.ca", "abc")).toBe(false);
  });
  it("gives a fresh token each time and shows the records", () => {
    const bytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));
    expect(newDomainToken(bytes)).toMatch(/^[0-9a-f]{48}$/);
    expect(newDomainToken(bytes)).not.toBe(newDomainToken(bytes));
    expect(dnsInstructions("r.m.ca", "t", "edge.akinaza.shop")).toEqual({ txt: { name: "_akinaza-verify.r.m.ca", value: "akinaza-site-verification=t" }, cname: { name: "r.m.ca", value: "edge.akinaza.shop" } });
  });
});

describe("checkDomain — the state machine", () => {
  it("pending-txt with the proof creates the hostname at the edge and waits for TLS", async () => {
    const hostnames = edge();
    const step = await checkDomain(domain({ attempts: 2 }), { dns: dnsWith(txtRecordValue("abc")), hostnames, now: NOW, limits });
    expect(step).toMatchObject({ state: DOMAIN_STATE.pendingTls, providerId: "ch_1", attempts: 0, error: null });
    expect(hostnames.created).toEqual(["reservation.monsalon.ca"]);
  });
  it("creates nothing at the edge before the proof (nothing is certified on a claim alone)", async () => {
    const hostnames = edge();
    const step = await checkDomain(domain(), { dns: dnsWith(), hostnames, now: NOW, limits });
    expect(step).toMatchObject({ state: DOMAIN_STATE.pendingTxt, attempts: 1, error: DOMAIN_ERROR.txtMissing });
    expect(hostnames.created).toEqual([]);
  });
  it("fails past the attempts or the waiting time", async () => {
    expect((await checkDomain(domain({ attempts: 2 }), { dns: dnsWith(), hostnames: edge(), now: NOW, limits })).state).toBe(DOMAIN_STATE.failed);
    expect((await checkDomain(domain({ createdAt: new Date("2026-10-20T00:00:00Z") }), { dns: dnsWith(), hostnames: edge(), now: NOW, limits })).state).toBe(DOMAIN_STATE.failed);
  });
  it("stays pending-txt (and counts) when the edge is down after the proof", async () => {
    const step = await checkDomain(domain(), { dns: dnsWith(txtRecordValue("abc")), hostnames: edge("pending", true), now: NOW, limits });
    expect(step).toMatchObject({ state: DOMAIN_STATE.pendingTxt, error: DOMAIN_ERROR.edgeUnavailable, attempts: 1 });
  });
  it("pending-tls becomes active when the certificate is issued", async () => {
    const step = await checkDomain(domain({ state: DOMAIN_STATE.pendingTls, providerId: "ch_1" }), { dns: dnsWith(), hostnames: edge("active"), now: NOW, limits });
    expect(step.state).toBe(DOMAIN_STATE.active);
  });
  it("pending-tls waits, fails when the edge refuses, and times out (releasing the hostname)", async () => {
    const pending = domain({ state: DOMAIN_STATE.pendingTls, providerId: "ch_1" });
    expect((await checkDomain(pending, { dns: dnsWith(), hostnames: edge("pending"), now: NOW, limits })).state).toBe(DOMAIN_STATE.pendingTls);
    expect(await checkDomain(pending, { dns: dnsWith(), hostnames: edge("failed"), now: NOW, limits })).toMatchObject({ state: DOMAIN_STATE.failed, error: DOMAIN_ERROR.tlsFailed, release: true });
    expect(await checkDomain({ ...pending, createdAt: new Date("2026-10-01T00:00:00Z") }, { dns: dnsWith(), hostnames: edge("pending"), now: NOW, limits })).toMatchObject({ state: DOMAIN_STATE.failed, error: DOMAIN_ERROR.tlsTimeout, release: true });
  });
  it("an edge outage never changes a pending-tls domain", async () => {
    const step = await checkDomain(domain({ state: DOMAIN_STATE.pendingTls, providerId: "ch_1" }), { dns: dnsWith(), hostnames: edge("pending", true), now: NOW, limits });
    expect(step).toMatchObject({ state: DOMAIN_STATE.pendingTls, error: DOMAIN_ERROR.edgeUnavailable });
  });
  it("an active domain keeps serving while the proof stands, and is suspended and released when it is gone for good", async () => {
    const active = domain({ state: DOMAIN_STATE.active, providerId: "ch_1" });
    expect(await checkDomain(active, { dns: dnsWith(txtRecordValue("abc")), hostnames: edge(), now: NOW, limits })).toMatchObject({ state: DOMAIN_STATE.active, attempts: 0 });
    expect(await checkDomain(active, { dns: dnsWith(), hostnames: edge(), now: NOW, limits })).toMatchObject({ state: DOMAIN_STATE.active, attempts: 1 });
    expect(await checkDomain({ ...active, attempts: 2 }, { dns: dnsWith(), hostnames: edge(), now: NOW, limits })).toMatchObject({ state: DOMAIN_STATE.suspended, release: true });
  });
  it("never advances failed, suspended or removed", async () => {
    for (const state of [DOMAIN_STATE.failed, DOMAIN_STATE.suspended, DOMAIN_STATE.removed]) {
      const hostnames = edge();
      const step = await checkDomain(domain({ state }), { dns: dnsWith(txtRecordValue("abc")), hostnames, now: NOW, limits });
      expect(step.state).toBe(state);
      expect(hostnames.created).toEqual([]);
    }
  });
});
