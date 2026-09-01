/** Brand logo lookup: domain from the affiliate URL, then Clearbit suggest. */
import type { LogoHit } from "../../../shared/types.ts";
import { isPublicDomain, normalizeDomain } from "./validate.ts";

export function extractDomain(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("//")) return null;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const host = normalizeDomain(url.hostname);
    return host || null;
  } catch {
    return null;
  }
}

export function logoForDomain(domain: string): string {
  const host = normalizeDomain(domain);
  return host ? `https://logo.clearbit.com/${host}` : "";
}

type ClearbitRow = {
  name?: string;
  domain?: string;
  logo?: string;
};

export async function searchLogos(name: string, url: string): Promise<LogoHit[]> {
  const queryName = name.trim().slice(0, 80);
  const queryUrl = url.trim().slice(0, 500);
  const domain = extractDomain(queryUrl);
  const hits: LogoHit[] = [];
  const seen = new Set<string>();

  const add = (hit: LogoHit) => {
    const key = normalizeDomain(hit.domain);
    if (!key || seen.has(key)) return;
    seen.add(key);
    hits.push({ ...hit, domain: key, logoUrl: hit.logoUrl || logoForDomain(key) });
  };

  if (domain) {
    add({
      name: queryName || domain,
      domain,
      logoUrl: logoForDomain(domain),
    });
  }

  const query = queryName || domain || "";
  if (query.length >= 2) {
    try {
      const res = await fetch(
        `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(query)}`,
        { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(4000) },
      );
      if (res.ok) {
        const rows = (await res.json()) as ClearbitRow[];
        if (Array.isArray(rows)) {
          for (const row of rows.slice(0, 8)) {
            if (!row.domain || !isPublicDomain(row.domain)) continue;
            add({
              name: (row.name?.trim() || row.domain).slice(0, 80),
              domain: row.domain,
              logoUrl: row.logo || logoForDomain(row.domain),
            });
          }
        }
      }
    } catch {
      // Brand lookup is best-effort and must not fail deal saves.
    }
  }

  return hits;
}
