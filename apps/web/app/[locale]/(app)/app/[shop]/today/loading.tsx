import { PageSkeleton } from "@/components/app/PageSkeleton";

/** While the screen streams: its own boxes, nothing shifts (D6). */
export default function Loading() {
  return <PageSkeleton kind="day" />;
}
