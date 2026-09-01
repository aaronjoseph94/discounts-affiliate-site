/** Keep affiliate links on the public web and logos on hosts we trust. */
import { DealInputError } from "./http.ts";
import type { Deal, DealInput } from "../../../shared/types.ts";

const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

const LOGO_HOSTS = new Set([
  "logo.clearbit.com",
  "www.google.com",
  "icons.duckduckgo.com",
  "cdn.brandfetch.io",
]);

function isPrivateHost(host: string): boolean {
  const hostname = host.toLowerCase();
  if (hostname.includes(":")) return true;
  if (hostname === "localhost" || hostname === "0.0.0.0") return true;
  if (hostname.endsWith(".localhost") || hostname.endsWith(".local")) return true;
  if (/^127(?:\.\d{1,3}){3}$/.test(hostname)) return true;
  if (/^10(?:\.\d{1,3}){3}$/.test(hostname)) return true;
  if (/^192\.168(?:\.\d{1,3}){2}$/.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/.test(hostname)) return true;
  if (/^169\.254(?:\.\d{1,3}){2}$/.test(hostname)) return true;
  return false;
}

export function isPublicDomain(host: string): boolean {
  const hostname = host.replace(/^www\./i, "").toLowerCase();
  return DOMAIN_RE.test(hostname) && !isPrivateHost(hostname);
}

/** Accept http(s) only; reject credentials, protocol-relative, and private hosts. */
export function normalizeHttpUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("//") || /[\s<>]/.test(trimmed)) {
    throw new DealInputError("Affiliate URL looks invalid");
  }

  const withProto = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withProto);
  } catch {
    throw new DealInputError("Affiliate URL looks invalid");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new DealInputError("Affiliate URL looks invalid");
  }
  if (parsed.username || parsed.password || !isPublicDomain(parsed.hostname)) {
    throw new DealInputError("Affiliate URL looks invalid");
  }
  return parsed.toString();
}

export function normalizeDomain(raw: string): string {
  const host = raw.trim().replace(/^www\./i, "").toLowerCase();
  return isPublicDomain(host) ? host : "";
}

export function sanitizeLogoUrl(raw: string, domain = ""): string {
  const trimmed = raw.trim();
  if (trimmed) {
    try {
      const parsed = new URL(trimmed);
      if (
        parsed.protocol === "https:" &&
        !parsed.username &&
        !parsed.password &&
        LOGO_HOSTS.has(parsed.hostname.toLowerCase())
      ) {
        return parsed.toString();
      }
    } catch {
      // Fall through to a safe favicon URL when a domain is known.
    }
  }
  if (domain && isPublicDomain(domain)) {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
  }
  return "";
}

function cleanText(value: unknown, max: number): string {
  return String(value ?? "")
    // Strip ASCII control characters from user-supplied strings.
    // oxlint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

function cleanPercent(value: unknown): number | null {
  if (value === "" || value == null) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1) return null;
  return Math.min(100, Math.round(num));
}

export function validateDealInput(body: unknown): DealInput {
  const input = (body ?? {}) as Record<string, unknown>;
  const productName = cleanText(input.productName, 80);
  const affiliateUrl = input.affiliateUrl ? normalizeHttpUrl(cleanText(input.affiliateUrl, 500)) : "";
  const discountCode = cleanText(input.discountCode, 40);
  const discountPercent = cleanPercent(input.discountPercent);
  const domain = normalizeDomain(cleanText(input.domain, 120));
  const logoUrl = sanitizeLogoUrl(cleanText(input.logoUrl, 500), domain);

  if (!productName) throw new DealInputError("Product name is required");
  if (!affiliateUrl && !discountCode) {
    throw new DealInputError("Add an affiliate URL, a discount code, or both");
  }

  return { productName, affiliateUrl, discountCode, discountPercent, logoUrl: logoUrl || undefined, domain: domain || undefined };
}

export function normalizeDeal(value: unknown): Deal | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = cleanText(row.id, 80);
  const productName = cleanText(row.productName, 80);
  if (!id || !productName) return null;

  let affiliateUrl = "";
  try {
    affiliateUrl = row.affiliateUrl ? normalizeHttpUrl(cleanText(row.affiliateUrl, 500)) : "";
  } catch {
    affiliateUrl = "";
  }

  const discountCode = cleanText(row.discountCode, 40);
  const discountPercent = cleanPercent(row.discountPercent);
  const domain = normalizeDomain(cleanText(row.domain, 120)) || "";
  const logoUrl = sanitizeLogoUrl(cleanText(row.logoUrl, 500), domain);
  const createdAt = typeof row.createdAt === "string" && !Number.isNaN(Date.parse(row.createdAt))
    ? row.createdAt
    : new Date().toISOString();

  if (!affiliateUrl && !discountCode) return null;

  return { id, productName, affiliateUrl, discountCode, discountPercent, domain, logoUrl, createdAt };
}
