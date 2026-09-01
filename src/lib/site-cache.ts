/** Last-seen homepage title and logo, so refresh does not flash the default line. */

const KEY = "dd_site";

export type CachedSite = {
  title: string;
  logoUrl: string;
};

function cleanTitle(value: unknown): string {
  return String(value ?? "")
    // oxlint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 140);
}

function cleanLogo(value: unknown): string {
  const raw = String(value ?? "").trim().split("?")[0];
  if (raw === "/logo.png" || raw === "/api/site-logo") return raw;
  return "/logo.png";
}

export function readSiteCache(): CachedSite | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "") as unknown;
    const title = cleanTitle((parsed as { title?: unknown } | null)?.title);
    if (!title) return null;
    return { title, logoUrl: cleanLogo((parsed as { logoUrl?: unknown }).logoUrl) };
  } catch {
    return null;
  }
}

export function writeSiteCache(settings: { title?: string; logoUrl?: string }): CachedSite | null {
  const title = cleanTitle(settings.title);
  if (!title) return null;
  const next = { title, logoUrl: cleanLogo(settings.logoUrl) };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode can block storage; the page still works, it just may flash once.
  }
  return next;
}
