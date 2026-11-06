import { resolveTxt } from "node:dns/promises";

import type { TxtResolver } from "@folioviv/core";

/** The system resolver's TXT answer (chunks of one record joined), `[]` when the name has none. A failure is « not yet »: the state machine retries. */
export const systemTxt: TxtResolver = {
  txt: async (name) => (await resolveTxt(name).catch((): string[][] => [])).map((chunks) => chunks.join("")),
};
