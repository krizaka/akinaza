import { invoiceForClientAccount } from "@akinaza/db";
import { afterEach, describe, expect, it, vi } from "vitest";

import { pageSession } from "@/lib/access";

import ClientInvoicePage from "./page";

vi.mock("@akinaza/db", async (importOriginal) => ({ ...(await importOriginal<typeof import("@akinaza/db")>()), invoiceForClientAccount: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: vi.fn(() => ({})) }));
vi.mock("@/lib/access", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/access")>()), pageSession: vi.fn() }));

afterEach(() => vi.clearAllMocks());

const ALICE_INVOICE = "6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b";
const open = (id: string) => ClientInvoicePage({ params: Promise.resolve({ locale: "fr", id }) });
/** `notFound()` throws Next's 404 signal: the answer of an id that does not exist. */
const NOT_FOUND = expect.objectContaining({ digest: expect.stringMatching(/404/) });

describe("a client's invoice page (D7): another client's invoice id answers 404", () => {
  it("asks for the invoice as the signed-in account only, and answers 404 when it is someone else's", async () => {
    vi.mocked(pageSession).mockResolvedValue({ account: { id: "bob" } } as Awaited<ReturnType<typeof pageSession>>);
    vi.mocked(invoiceForClientAccount).mockResolvedValue(null);
    await expect(open(ALICE_INVOICE)).rejects.toEqual(NOT_FOUND);
    expect(invoiceForClientAccount).toHaveBeenCalledWith(expect.anything(), "bob", ALICE_INVOICE);
  });

  it("answers 404 without a session, and for an id that is not one, before reading anything", async () => {
    vi.mocked(pageSession).mockResolvedValue(null);
    await expect(open(ALICE_INVOICE)).rejects.toEqual(NOT_FOUND);
    await expect(open("KZ-00022")).rejects.toEqual(NOT_FOUND);
    expect(invoiceForClientAccount).not.toHaveBeenCalled();
  });
});
