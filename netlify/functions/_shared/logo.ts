import type { LogoHit } from "./types.ts";

export function extractDomain(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    return host.includes(".") ? host : null;
  } catch {
    return null;
  }
}

export function logoForDomain(domain: string): string {
  return `https://logo.clearbit.com/${domain}`;
}

export function fallbackLogos(domain: string): string[] {
  return [
    `https://logo.clearbit.com/${domain}`,
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  ];
}

type ClearbitRow = {
  name?: string;
  domain?: string;
  logo?: string;
};

export async function searchLogos(name: string, url: string): Promise<LogoHit[]> {
  const domain = extractDomain(url);
  const hits: LogoHit[] = [];
  const seen = new Set<string>();

  const add = (hit: LogoHit) => {
    const key = hit.domain.toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    hits.push(hit);
  };

  if (domain) {
    add({
      name: name.trim() || domain,
      domain,
      logoUrl: logoForDomain(domain),
    });
  }

  const query = name.trim() || domain || "";
  if (query.length >= 2) {
    try {
      const res = await fetch(
        `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(query)}`,
        { headers: { Accept: "application/json" } },
      );
      if (res.ok) {
        const rows = (await res.json()) as ClearbitRow[];
        for (const row of rows.slice(0, 8)) {
          if (!row.domain) continue;
          add({
            name: row.name?.trim() || row.domain,
            domain: row.domain,
            logoUrl: row.logo || logoForDomain(row.domain),
          });
        }
      }
    } catch {
      // Brand lookup is best-effort.
    }
  }

  return hits;
}
