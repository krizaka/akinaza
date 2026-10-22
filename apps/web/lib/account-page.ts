import { cache } from "react";

import { accounts } from "@/app/accounts";

import { pageSession } from "./access";

/** The signed-in account's profile for the account pages, read once per request. */
export const accountPage = cache(async () => {
  const session = (await pageSession())!;
  const profile = await accounts().profile(session.account.id);
  return { session, profile };
});
