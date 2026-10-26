import { reviewScore } from "@akinaza/core";
import { reviewsOf } from "@akinaza/db";

import { requireShop } from "@/lib/access";
import { reviewRules } from "@/lib/community";
import { db } from "@/lib/db";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Every review of the shop (the hidden ones too) and the score as the page would show it. The owner's view: the client link stays inside. */
export function GET(req: Request) {
  return handle(async () => {
    const { shop } = await requireShop(req, "agenda");
    const reviews = await reviewsOf(db(), shop.id);
    return Response.json({
      reviews: reviews.map(({ clientId: _client, ...review }) => review),
      score: reviewScore(reviews, await reviewRules()),
    });
  });
}
