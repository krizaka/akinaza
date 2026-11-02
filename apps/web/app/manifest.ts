import type { MetadataRoute } from "next";

import { PRODUCT_NAME } from "@/lib/brand";

/** The installable app's name is the commercial name of `@krizaka/org`, drawn at build. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PRODUCT_NAME,
    short_name: PRODUCT_NAME,
    start_url: "/",
    display: "standalone",
    icons: [
      { src: "/icon2.png", sizes: "192x192", type: "image/png" },
      { src: "/icon3.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
