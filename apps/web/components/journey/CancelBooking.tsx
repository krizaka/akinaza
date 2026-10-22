"use client";

import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useCall } from "@/components/app/useCall";

/** Cancels the booking in two taps (ask, then confirm), with the answer on the spot; the page refreshes to the cancelled state. */
export function CancelBooking({ bookingId, clientId, words }: { bookingId: string; clientId: string; words: { cancel: string; confirm: string; cancelling: string } }) {
  const call = useCall();
  const router = useRouter();
  const [asked, setAsked] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!asked) {
    return (
      <Button variant="secondary" size="md" onClick={() => setAsked(true)}>
        {words.cancel}
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="danger"
        size="md"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const done = await call.run(`/api/me/bookings/${bookingId}/cancel`, { json: { clientId } });
          setBusy(false);
          if (done !== null) router.refresh();
        }}
      >
        {busy ? words.cancelling : words.confirm}
      </Button>
      {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
    </div>
  );
}
