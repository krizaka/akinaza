import { shopOfOwner } from "@akinaza/db";
import { notFound } from "next/navigation";

import { pageSession } from "./access";
import { db } from "./db";

/** The signed-in owner and their shop, for the pages of the shop's space; 404 for an account with no shop. */
export async function ownerShop() {
  const session = (await pageSession())!;
  const shop = await shopOfOwner(db(), session.account.id);
  if (!shop) notFound();
  return { session, shop };
}
