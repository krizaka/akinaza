import { z } from "zod";

import { STUDIO, type StudioInput, studioInput, studioOutput, type StudioRun, type TaxStudio } from "./contract";

export class StudioError extends Error {
  constructor(
    readonly code: "STUDIO_NOT_CONFIGURED" | "STUDIO_UNAVAILABLE" | "STUDIO_KEY" | "STUDIO_CREDITS" | "STUDIO_REFUSED" | "STUDIO_SHAPE",
    message: string,
  ) {
    super(message);
    this.name = "StudioError";
  }
}

const run = z.object({ id: z.string().min(1), status: z.string(), outputs: z.unknown().optional() });
const STATUS: Record<string, StudioRun["status"]> = { PENDING: "running", QUEUED: "running", RUNNING: "running", SUCCEEDED: "succeeded", FAILED: "failed", CANCELLED: "cancelled" };

/**
 * The Studio through Orazaka's edge, with Akinaza's `oz_` service key: `POST /api/v1/studios/{studio}/runs` starts a run
 * (its id is the trace kept with the prepared return), `GET /api/v1/studios/runs/{id}` reads it. Inputs and outputs are
 * checked against the contract; a malformed answer is refused, never guessed.
 */
export function orazakaTaxStudio(options: { baseUrl: string; apiKey: string | undefined; fetch?: typeof fetch; timeoutMs?: number }): TaxStudio {
  const doFetch = options.fetch ?? fetch;
  const base = options.baseUrl.replace(/\/$/, "");
  async function call(path: string, body?: unknown): Promise<StudioRun> {
    if (!options.apiKey) throw new StudioError("STUDIO_NOT_CONFIGURED", "AI_API_KEY is not set");
    let res: Response;
    try {
      res = await doFetch(`${base}${path}`, {
        method: body ? "POST" : "GET",
        headers: { authorization: `Bearer ${options.apiKey}`, accept: "application/json", ...(body ? { "content-type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
      });
    } catch {
      throw new StudioError("STUDIO_UNAVAILABLE", "Orazaka did not answer");
    }
    if (res.status === 401 || res.status === 403) throw new StudioError("STUDIO_KEY", "Orazaka refused Akinaza's key");
    if (res.status === 402) throw new StudioError("STUDIO_CREDITS", "No Orazaka credits left");
    if (!res.ok) throw new StudioError(res.status >= 500 ? "STUDIO_UNAVAILABLE" : "STUDIO_REFUSED", `Orazaka answered ${res.status}`);
    const parsed = run.safeParse(await res.json().catch(() => undefined));
    if (!parsed.success) throw new StudioError("STUDIO_SHAPE", "The run does not match the contract");
    const status = STATUS[parsed.data.status.toUpperCase()] ?? "failed";
    let outputs: StudioRun["outputs"] = null;
    if (status === "succeeded") {
      const out = studioOutput.safeParse(parsed.data.outputs);
      if (!out.success) throw new StudioError("STUDIO_SHAPE", "The Studio's outputs do not match the contract");
      outputs = out.data;
    }
    return { runId: parsed.data.id, status, outputs };
  }
  return {
    start: (input: StudioInput) => call(`/api/v1/studios/${STUDIO}/runs`, { inputs: studioInput.parse(input) }),
    get: (runId: string) => call(`/api/v1/studios/runs/${encodeURIComponent(runId)}`),
  };
}
