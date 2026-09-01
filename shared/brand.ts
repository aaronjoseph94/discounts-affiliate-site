/** Site name used in tabs, headings, and the default homepage tagline. */
export const SITE_NAME = "Discounts & Deals";
export const DEFAULT_TAGLINE = "Discount codes and affiliate deals, ready to copy.";

export function pageTitle(section?: string): string {
  return section ? `${section} · ${SITE_NAME}` : SITE_NAME;
}
