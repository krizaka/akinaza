"use client";

import { ReviewCard, ReviewSummary } from "@krizaka/ui/reviews";

import type { ReviewsView as Reviews } from "@/lib/community-view";

/** The score as a stamp with its distribution, and the latest verified reviews; the shop's reply indented under its review. */
export function ReviewsView({ reviews, starText, replyLabel, ownerName, label }: Readonly<{ reviews: Reviews; /** « {stars} stars: {count} » */ starText: string; replyLabel: string; ownerName: string; label: string }>) {
  return (
    <div className="flex flex-col gap-6" data-reviews="">
      <ReviewSummary score={reviews.score} count={reviews.count} distribution={reviews.distribution} minCount={reviews.minCount} scoreText={reviews.scoreText} countText={reviews.countText} summaryText={reviews.summaryText} starText={(stars, n) => starText.replace("{stars}", String(stars)).replace("{count}", String(n))} />
      <ul aria-label={label} className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
        {reviews.cards.map((r) => (
          <li key={r.id}>
            <ReviewCard author={r.author} date={r.date} dateTime={r.dateTime} service={r.service} rating={r.rating} ratingText={r.ratingText} text={r.text} reply={r.reply ? { label: replyLabel, author: ownerName, text: r.reply } : undefined} />
          </li>
        ))}
      </ul>
    </div>
  );
}
