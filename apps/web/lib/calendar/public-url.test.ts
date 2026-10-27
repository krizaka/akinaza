import { CalendarSourceError } from "@akinaza/core";
import { describe, expect, it } from "vitest";

import { assertPublicHost, isPrivateAddress, parseCalendarUrl } from "./public-url";

describe("an address the server may fetch (no SSRF)", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fe80::1", "fd12:3456::1", "::ffff:10.0.0.1", "not-an-ip"])("%s is not public", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });
  it.each(["8.8.8.8", "172.32.0.1", "142.250.80.46", "2606:4700:4700::1111", "::ffff:8.8.8.8"])("%s is public", (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });

  it("reads webcal:// as https and accepts a plain public address", () => {
    expect(parseCalendarUrl(" webcal://calendar.example.com/ical/x.ics ").toString()).toBe("https://calendar.example.com/ical/x.ics");
  });
  it.each(["http://calendar.example.com/x.ics", "ftp://x.example.com/a", "https://user:pw@calendar.example.com/x", "https://calendar.example.com:8443/x", "https://localhost/x", "https://printer.local/x", "https://intranet/x", "https://127.0.0.1/x", "https://[::1]/x", "https://169.254.169.254/latest", "file:///etc/passwd", "nonsense"])("refuses %s", (raw) => {
    expect(() => parseCalendarUrl(raw)).toThrow(CalendarSourceError);
  });

  it("refuses a name that resolves to a private address, even when only one of its answers is", async () => {
    const url = parseCalendarUrl("https://rebind.example.com/x.ics");
    await expect(assertPublicHost(url, async () => ["8.8.8.8", "10.0.0.5"])).rejects.toMatchObject({ code: "AK_CAL_INVALID" });
    await expect(assertPublicHost(url, async () => ["8.8.8.8"])).resolves.toBeUndefined();
    await expect(assertPublicHost(url, async () => { throw new Error("ENOTFOUND"); })).rejects.toMatchObject({ code: "AK_CAL_UNREACHABLE", retryable: true });
  });
});
