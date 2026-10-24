import type { ShopClient } from "@akinaza/core";

const plain = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Whether a client file answers a search: any word of it in the name, the phone, the e-mail or a dependant's name, accents and case aside. */
export function matchesClient(client: Pick<ShopClient, "fullName" | "phone" | "email" | "dependants">, search: string): boolean {
  const words = plain(search).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = plain([client.fullName, client.phone, client.email, ...client.dependants.map((d) => d.name)].filter(Boolean).join(" "));
  return words.every((word) => haystack.includes(word));
}
