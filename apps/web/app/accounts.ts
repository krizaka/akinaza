import { accountDataWith, accountsAt } from "@/lib/account-access";
import { dataKey, readEnv } from "@/lib/env";

/** The account service and the member's data, wired to this deployment's public address and data key (the edge reads the environment; `lib/` never does). */
export const accounts = () => accountsAt(readEnv().APP_PUBLIC_URL);
export const accountData = (accountId: string) => accountDataWith(accountId, dataKey());
