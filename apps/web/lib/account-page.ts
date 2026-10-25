import { cache } from "react";

import { accounts } from "@/app/accounts";

import { pageSession } from "./access";
import { accountSectionsFor } from "./account-sections";
import { query } from "./db";
import { lastMember } from "./member-shop";

/** Where an account's « member since » is read when it works in no shop: the shops' own default zone (Québec). */
const HOME_TIMEZONE = "America/Toronto";

/**
 * Everything an account page needs, read once per request: the session, the profile, the shop the person works in (their role
 * there), the sections they may open, and when the account was opened (in the shop's zone).
 */
export const accountPage = cache(async () => {
  const session = (await pageSession())!;
  const [profile, member, [opened]] = await Promise.all([
    accounts().profile(session.account.id),
    lastMember(session.account.id),
    query<{ created_at: Date }>("SELECT created_at FROM accounts WHERE id = $1", [session.account.id]),
  ]);
  return {
    session,
    profile,
    member,
    sections: accountSectionsFor(member?.role ?? null),
    openedAt: opened?.created_at ?? null,
    timeZone: member?.shop.timezone ?? HOME_TIMEZONE,
  };
});
