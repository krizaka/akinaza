"use client";

import { krizakaFetch } from "@krizaka/query";
import { Button } from "@krizaka/ui/button";
import { useState } from "react";

/** The one button of the stop page: a press sends it, the answer is said in place. */
export function StopBrief({ token, words }: Readonly<{ token: string; words: { button: string; done: string; invalid: string } }>) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "invalid">("idle");
  if (state === "done" || state === "invalid") return <p role="status" className="text-fg">{state === "done" ? words.done : words.invalid}</p>;
  return (
    <Button
      variant="primary"
      disabled={state === "busy"}
      onClick={async () => {
        setState("busy");
        try {
          await krizakaFetch("/api/brief/stop", { method: "POST", json: { token } });
          setState("done");
        } catch {
          setState("invalid");
        }
      }}
    >
      {words.button}
    </Button>
  );
}
