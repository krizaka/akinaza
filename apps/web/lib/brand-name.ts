import { displayName } from "@krizaka/org";
import { DISPLAY_NAME_KEY } from "@krizaka/settings";

import { CODE_NAME } from "./brand";
import { appSettings } from "./settings";

/** The name to show in this request: the administrator's `brand.displayName`, else the commercial name. */
export async function productName(): Promise<string> {
  return displayName(CODE_NAME, await appSettings().get(DISPLAY_NAME_KEY, { userId: null }));
}
