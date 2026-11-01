import { accountDataWith, accountsAt } from "@/lib/account-access";
import { dataKey, readEnv } from "@/lib/env";
import { productName } from "@/lib/brand-name";
import { appSettings } from "@/lib/settings";

/** The account service and the member's data, wired to this deployment's public address and data key (the edge reads the environment; `lib/` never does). */
export const accounts = () => accountsAt(readEnv().APP_PUBLIC_URL);
export const accountData = (accountId: string) => accountDataWith(accountId, dataKey());

/** How long a password reset link lives: the administrator's setting. */
export const passwordResetTtlMinutes = () => appSettings().get("auth.passwordResetTtlMinutes");

/** The account service for a password reset, with the link's lifetime read from the settings. */
export const passwordResets = async () => accountsAt(readEnv().APP_PUBLIC_URL, { passwordResetTtlMinutes: await passwordResetTtlMinutes(), product: await productName() });
