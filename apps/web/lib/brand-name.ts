import { displayName } from "@krizaka/org";
import { DISPLAY_NAME_KEY } from "@krizaka/settings";

import { BRAND_ID } from "./brand";
import { appSettings } from "./settings";

/** The name to show in this request: the administrator's `brand.displayName`, else the commercial name. */
export async function productName(): Promise<string> {
  return displayName(BRAND_ID, await appSettings().get(DISPLAY_NAME_KEY, { userId: null }));
}
