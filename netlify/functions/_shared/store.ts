/** Deal persistence: Netlify Blobs in production, data/deals.json locally. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import type { Deal, DealInput, SiteSettings } from "../../../shared/types.ts";
import { extractDomain, logoForDomain, searchLogos } from "./logo.ts";
import { seedDeals } from "./seed.ts";
import { normalizeDeal, sanitizeLogoUrl } from "./validate.ts";

const KEY = "deals.json";
const SETTINGS_KEY = "settings.json";
const filePath = join(dirname(fileURLToPath(import.meta.url)), "../../../data/deals.json");
const settingsPath = join(dirname(fileURLToPath(import.meta.url)), "../../../data/settings.json");

export const defaultSettings: SiteSettings = {
  title: "Discount codes and affiliate deals, ready to copy.",
};

function normalizeSettings(value: unknown): SiteSettings {
  const title = String((value as { title?: unknown } | null)?.title ?? "")
    // oxlint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 140);
  return { title: title || defaultSettings.title };
}

async function readBlobs(): Promise<Deal[] | null> {
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore({ name: "deals-db", consistency: "strong" });
    const data = await store.get(KEY, { type: "json" });
    return Array.isArray(data) ? data : null;
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
  if (fromBlobs) return fromBlobs;
  const fromFile = sanitizeList(readFileDeals());
  if (fromFile) return fromFile;
  return structuredClone(seedDeals);
}

export async function saveDeals(deals: Deal[]): Promise<void> {
  const clean = deals.map(normalizeDeal).filter((deal): deal is Deal => deal !== null);
  const blobsOk = await writeBlobs(clean);
  if (blobsOk) return;
  writeFileDeals(clean);
}

async function readSettingsBlobs(): Promise<unknown | null> {
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore({ name: "deals-db", consistency: "strong" });
    return await store.get(SETTINGS_KEY, { type: "json" });
  } catch {
    return null;
  }
}

function readFileSettings(): unknown | null {
  try {
    if (!existsSync(settingsPath)) return null;
    return JSON.parse(readFileSync(settingsPath, "utf8")) as unknown;
  } catch {
    return null;
  }
}

export async function getSettings(): Promise<SiteSettings> {
  const fromBlobs = await readSettingsBlobs();
  if (fromBlobs) return normalizeSettings(fromBlobs);
  const fromFile = readFileSettings();
  if (fromFile) return normalizeSettings(fromFile);
  return { ...defaultSettings };
}

export async function saveSettings(input: unknown): Promise<SiteSettings> {
  const settings = normalizeSettings(input);
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore({ name: "deals-db", consistency: "strong" });
    await store.setJSON(SETTINGS_KEY, settings);
    return settings;
  } catch {
    mkdirSync(dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
    return settings;
  }
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
