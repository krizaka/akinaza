"use client";

import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { Field, Textarea } from "@krizaka/ui/field";
import { useId, useState } from "react";

import { useCall } from "@/components/app/useCall";
import { useSay } from "@/lib/i18n-client";

export interface ReviewLine {
  id: string;
  firstName: string;
  lastInitial: string;
  rating: number;
  body: string;
  serviceName: string;
  verified: boolean;
  state: "published" | "hidden_by_owner" | "removed_by_admin" | "pending";
  reply: string;
  createdAt: string;
}
export interface ReviewsPanelProps {
  reviews: ReviewLine[];
  score: { count: number; score: number | null; shown: boolean };
  minCount: number;
}

function ReviewRow({ review }: { review: ReviewLine }) {
  const { say } = useSay();
  const call = useCall();
  const id = useId();
  const [reply, setReply] = useState(review.reply);
  const [ok, setOk] = useState(false);
  const patch = async (json: { reply?: string; state?: "published" | "hidden_by_owner" }) => setOk((await call.run(`/api/walker/reviews/${review.id}`, { method: "PATCH", json })) !== null);
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border-default p-3">
      <p className="m-0 flex flex-wrap items-center gap-2 text-sm font-semibold text-fg">
        <span>{review.firstName} {review.lastInitial ? `${review.lastInitial}.` : ""}</span>
        <span aria-label={`${review.rating} / 5`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
        <Badge tone={review.verified ? "success" : "neutral"} size="sm">{say(review.verified ? "studio.reviews.verified" : "studio.reviews.unverified")}</Badge>
        {review.state === "hidden_by_owner" ? <Badge tone="neutral" size="sm">{say("studio.reviews.hiddenBadge")}</Badge> : null}
        {review.state === "removed_by_admin" ? <Badge tone="danger" size="sm">{say("studio.reviews.removedBadge")}</Badge> : null}
        {review.state === "pending" ? <Badge tone="neutral" size="sm">{say("studio.reviews.pendingBadge")}</Badge> : null}
      </p>
      {review.serviceName ? <p className="m-0 text-xs text-fg-secondary">{review.serviceName}</p> : null}
      {review.body ? <p className="m-0 break-words text-sm text-fg">{review.body}</p> : null}
      {review.state !== "removed_by_admin" ? (
        <>
          <Field.Root>
            <Field.Label htmlFor={id}>{say("studio.reviews.reply")}</Field.Label>
            <Textarea id={id} rows={2} maxLength={1000} value={reply} onChange={(e) => { setReply(e.target.value); setOk(false); }} />
          </Field.Root>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="md" disabled={call.pending || reply === review.reply} onClick={() => void patch({ reply })}>{say("studio.reviews.sendReply")}</Button>
            <Button variant="ghost" size="md" disabled={call.pending} onClick={() => void patch({ state: review.state === "hidden_by_owner" ? "published" : "hidden_by_owner" })}>{say(review.state === "hidden_by_owner" ? "studio.reviews.show" : "studio.reviews.hide")}</Button>
          </div>
        </>
      ) : null}
      {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
      {ok ? <p className="m-0 text-xs text-fg-secondary" role="status">{say("studio.reviews.saved")}</p> : null}
    </li>
  );
}

/** Boutique › Avis (#313): every review of the shop, with the score as the page would show it; the owner replies in public or hides a review from the page. */
export function ReviewsPanel({ reviews, score, minCount }: ReviewsPanelProps) {
  const { say } = useSay();
  return (
    <Card.Root className="flex flex-col gap-4 p-4">
      <div>
        <h2 className="font-display text-base font-bold text-fg">{say("studio.reviews.title")}</h2>
        <p className="m-0 text-sm text-fg-secondary">{say("studio.reviews.lead")}</p>
      </div>
      <p className="m-0 text-sm font-semibold text-fg" data-testid="review-score">
        {score.shown && score.score !== null ? say("studio.reviews.score", { score: score.score.toLocaleString(undefined, { minimumFractionDigits: 1 }), count: score.count }) : say("studio.reviews.notShown", { min: minCount, count: score.count })}
      </p>
      {reviews.length === 0 ? <p className="m-0 text-sm text-fg-secondary">{say("studio.reviews.none")}</p> : <ul className="m-0 flex list-none flex-col gap-3 p-0">{reviews.map((r) => <ReviewRow key={r.id} review={r} />)}</ul>}
    </Card.Root>
  );
}
