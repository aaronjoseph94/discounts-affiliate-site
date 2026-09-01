import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { extractDomain, logoForDomain, searchLogos } from "./logo.ts";
import { seedDeals } from "./seed.ts";
import type { Deal, DealInput } from "./types.ts";

const KEY = "deals.json";
const filePath = join(dirname(fileURLToPath(import.meta.url)), "../../../data/deals.json");

async function readBlobs(): Promise<Deal[] | null> {
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore({ name: "deals-db", consistency: "strong" });
    const data = await store.get(KEY, { type: "json" });
    return Array.isArray(data) ? (data as Deal[]) : null;
  } catch {
    return null;
  }
}

async function writeBlobs(deals: Deal[]): Promise<boolean> {
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore({ name: "deals-db", consistency: "strong" });
    await store.setJSON(KEY, deals);
    return true;
  } catch {
    return false;
  }
}

function readFileDeals(): Deal[] | null {
  try {
    if (!existsSync(filePath)) return null;
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Deal[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeFileDeals(deals: Deal[]): boolean {
  try {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, `${JSON.stringify(deals, null, 2)}\n`);
    return true;
  } catch {
    return false;
  }
}

export async function listDeals(): Promise<Deal[]> {
  const fromBlobs = await readBlobs();
  if (fromBlobs) return fromBlobs;
  const fromFile = readFileDeals();
  if (fromFile) return fromFile;
  return structuredClone(seedDeals);
}

export async function saveDeals(deals: Deal[]): Promise<void> {
  const blobsOk = await writeBlobs(deals);
  if (blobsOk) return;
  writeFileDeals(deals);
}

function cleanText(value: unknown, max: number): string {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function cleanPercent(value: unknown): number | null {
  if (value === "" || value == null) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.min(100, Math.max(1, Math.round(num)));
}

export function validateDealInput(body: unknown): DealInput {
  const input = (body ?? {}) as Record<string, unknown>;
  const productName = cleanText(input.productName, 80);
  const affiliateUrl = cleanText(input.affiliateUrl, 500);
  const discountCode = cleanText(input.discountCode, 40);
  const discountPercent = cleanPercent(input.discountPercent);
  const logoUrl = cleanText(input.logoUrl, 500);
  const domain = cleanText(input.domain, 120).toLowerCase();

  if (!productName) {
    throw new Error("Product name is required");
  }
  if (!affiliateUrl && !discountCode) {
    throw new Error("Add an affiliate URL, a discount code, or both");
  }
  if (affiliateUrl) {
    try {
      const parsed = new URL(affiliateUrl.includes("://") ? affiliateUrl : `https://${affiliateUrl}`);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("invalid");
      }
    } catch {
      throw new Error("Affiliate URL looks invalid");
    }
  }

  return {
    productName,
    affiliateUrl: affiliateUrl
      ? affiliateUrl.includes("://")
        ? affiliateUrl
        : `https://${affiliateUrl}`
      : "",
    discountCode,
    discountPercent,
    logoUrl: logoUrl || undefined,
    domain: domain || undefined,
  };
}

export async function decorateDeal(input: DealInput, existing?: Deal): Promise<Deal> {
  let domain = input.domain || extractDomain(input.affiliateUrl) || existing?.domain || "";
  let logoUrl = input.logoUrl || existing?.logoUrl || "";

  if (!logoUrl || !domain) {
    const hits = await searchLogos(input.productName, input.affiliateUrl);
    const picked = hits[0];
    if (picked) {
      domain = domain || picked.domain;
      logoUrl = logoUrl || picked.logoUrl;
    }
  }

  if (domain && !logoUrl) {
    logoUrl = logoForDomain(domain);
  }

  return {
    id: existing?.id ?? randomUUID(),
    productName: input.productName,
    affiliateUrl: input.affiliateUrl,
    discountCode: input.discountCode,
    discountPercent: input.discountPercent,
    domain,
    logoUrl,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
}
