import { APP_VIDEOS } from "./app-videos";

/**
 * Whether `/download` is public: it shows the videos the e2e tests recorded of the apps (krizaka/.github#315). No app is offered for
 * download yet (no store, no TestFlight, no release asset), so the page says nothing of availability and has no button; it is parked
 * (404, out of the footer and the sitemap) while the manifest holds no video.
 */
export const downloadPageOpen = (videos: readonly unknown[] = APP_VIDEOS): boolean => videos.length > 0;
