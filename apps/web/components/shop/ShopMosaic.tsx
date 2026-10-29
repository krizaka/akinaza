"use client";

import { ShopGallery, shopGalleryLabels, shopGalleryLabelsFr,type ShopGalleryPhoto } from "@krizaka/ui/shop-gallery";

import type { Locale } from "@/lib/i18n";

/**
 * The shop's mosaic (akinaza#481): `ShopGallery` with its words in the page's language. The package's labels are functions, which cannot cross from a
 * server component to a client one, so the choice is made here, on the client side of the boundary (the package holds English and French).
 */
const LABELS: Partial<Record<Locale, typeof shopGalleryLabels>> = { fr: shopGalleryLabelsFr };

export function ShopMosaic({ photos, label, locale }: Readonly<{ photos: readonly ShopGalleryPhoto[]; label: string; locale: Locale }>) {
  return <ShopGallery photos={photos} label={label} labels={LABELS[locale] ?? shopGalleryLabels} />;
}
