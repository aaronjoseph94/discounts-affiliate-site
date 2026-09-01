/** One place for the name in the tab and the default homepage line. */
export const SITE_NAME = "Discounts & Deals";
export const DEFAULT_TAGLINE = "Discount codes and affiliate deals, ready to copy.";

export function pageTitle(section?: string): string {
  return section ? `${section} · ${SITE_NAME}` : SITE_NAME;
}
