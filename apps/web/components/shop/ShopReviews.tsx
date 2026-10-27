"use client";

import { ReviewsSection, type ReviewsSectionProps } from "@krizaka/ui/shop/reviews";

import type { ReviewsView } from "@/lib/community-view";

type Props = Readonly<{
  variant: ReviewsSectionProps["variant"];
  count: 1 | 2 | 3;
  title: string;
  reviews: ReviewsView;
  /** « {stars} stars: {count} » */
  starText: string;
  replyLabel: string;
  ownerName: string;
}>;

/** The reviews section needs a function for the stars' words, which cannot cross from the server: it is built here, from the message. */
export function ShopReviews({ variant, count, title, reviews, starText, replyLabel, ownerName }: Props) {
  return (
    <ReviewsSection
      variant={variant}
      count={count}
      title={title}
      minCount={reviews.minCount}
      summary={{ score: reviews.score, count: reviews.count, distribution: reviews.distribution, scoreText: reviews.scoreText, countText: reviews.countText, summaryText: reviews.summaryText, starText: (stars: number, n: number) => starText.replace("{stars}", String(stars)).replace("{count}", String(n)) }}
      reviews={reviews.cards.map((r) => ({ id: r.id, author: r.author, date: r.date, dateTime: r.dateTime, service: r.service, rating: r.rating, ratingText: r.ratingText, text: r.text, reply: r.reply ? { label: replyLabel, author: ownerName, text: r.reply } : undefined }))}
    />
  );
}
