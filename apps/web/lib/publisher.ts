import { org } from "@krizaka/org";

/**
 * The publisher's legal facts for the legal pages (akinaza#375): read from `@krizaka/org` (the one org JSON), never written in a
 * message. The catalogues carry `{publisher}`, `{city}` and `{region}`; a page passes these values to `format`.
 */
export function publisherVars() {
  return { publisher: org.company.legalName, city: org.company.city, region: org.company.region };
}
