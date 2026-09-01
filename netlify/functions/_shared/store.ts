/** Deals live in Netlify Blobs in production, or data/deals.json on your machine. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import type { Deal, DealInput } from "../../../shared/types.ts";
import { siteStore } from "./blobs.ts";
import { extractDomain, logoForDomain, searchLogos } from "./logo.ts";
import { seedDeals } from "./seed.ts";
import { normalizeDeal, sanitizeLogoUrl } from "./validate.ts";

const KEY = "deals.json";
const filePath = join(dirname(fileURLToPath(import.meta.url)), "../../../data/deals.json");

export const MAX_DEALS = 250;

async function readBlobs(): Promise<Deal[] | null> {
  try {
    const store = await siteStore();
    const data = await store.get(KEY, { type: "json" });
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

async function writeBlobs(deals: Deal[]): Promise<boolean> {
  try {
    const store = await siteStore();
    await store.setJSON(KEY, deals);
    return true;
  } catch {
    return false;
  }
}

function readFileDeals(): unknown[] | null {
  try {
    if (!existsSync(filePath)) return null;
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
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

function sanitizeList(rows: unknown[] | null): Deal[] | null {
  if (!rows) return null;
  const deals = rows.map(normalizeDeal).filter((deal): deal is Deal => deal !== null);
  return deals.length ? deals : null;
}

export async function listDeals(): Promise<Deal[]> {
  const fromBlobs = sanitizeList(await readBlobs());
  if (fromBlobs) return fromBlobs.slice(0, MAX_DEALS);
  const fromFile = sanitizeList(readFileDeals());
  if (fromFile) return fromFile.slice(0, MAX_DEALS);
  return structuredClone(seedDeals);
}

export async function saveDeals(deals: Deal[]): Promise<void> {
  const clean = deals.map(normalizeDeal).filter((deal): deal is Deal => deal !== null).slice(0, MAX_DEALS);
  const blobsOk = await writeBlobs(clean);
  if (blobsOk) return;
  writeFileDeals(clean);
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
    logoUrl: sanitizeLogoUrl(logoUrl, domain),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
}
