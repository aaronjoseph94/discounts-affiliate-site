/** Deal persistence: Netlify Blobs in production, data/deals.json locally. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import type { Deal, DealInput, SiteSettings } from "../../../shared/types.ts";
import { DealInputError } from "./http.ts";
import { extractDomain, logoForDomain, searchLogos } from "./logo.ts";
import { seedDeals } from "./seed.ts";
import { normalizeDeal, sanitizeLogoUrl } from "./validate.ts";

const KEY = "deals.json";
const SETTINGS_KEY = "settings.json";
const filePath = join(dirname(fileURLToPath(import.meta.url)), "../../../data/deals.json");
const settingsPath = join(dirname(fileURLToPath(import.meta.url)), "../../../data/settings.json");

const LOGO_KEY = "site-logo.png";
const logoPath = join(dirname(fileURLToPath(import.meta.url)), "../../../data/site-logo.png");
const defaultLogoPath = join(dirname(fileURLToPath(import.meta.url)), "../../../public/logo.png");

export const defaultSettings: SiteSettings = {
  title: "Discount codes and affiliate deals, ready to copy.",
  logoUrl: "/logo.png",
};

const DATA_URL_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\s]+$/;

function cleanTitle(value: unknown): string {
  return String(value ?? "")
    // oxlint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 140);
}

function normalizeLogoUrl(value: unknown, fallback: string): string {
  const raw = String(value ?? "").trim();
  if (raw === "/logo.png" || raw === "/api/site-logo") return raw;
  if (DATA_URL_RE.test(raw)) {
    if (raw.length > 900_000) throw new DealInputError("Logo must be under 700KB");
    return raw;
  }
  return fallback;
}

export function normalizeSettings(value: unknown, existing?: SiteSettings): SiteSettings {
  const current = existing ?? defaultSettings;
  return {
    title: cleanTitle((value as { title?: unknown } | null)?.title) || current.title || defaultSettings.title,
    logoUrl: normalizeLogoUrl((value as { logoUrl?: unknown } | null)?.logoUrl, current.logoUrl || defaultSettings.logoUrl),
  };
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

async function persistSettings(settings: SiteSettings): Promise<SiteSettings> {
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

export async function saveSettings(input: unknown): Promise<SiteSettings> {
  const current = await getSettings();
  let next = normalizeSettings(input, current);
  if (next.logoUrl.startsWith("data:image/")) {
    next = { ...next, logoUrl: await writeSiteLogo(next.logoUrl) };
  }
  return persistSettings(next);
}

function sniffImageType(bytes: Buffer): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF") return "image/webp";
  return "image/png";
}

function parseDataImage(dataUrl: string): { mime: string; bytes: Buffer } {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  if (!match) throw new DealInputError("Use a PNG, JPG, or WebP logo");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length < 32 || bytes.length > 700_000) {
    throw new DealInputError("Logo must be under 700KB");
  }
  return { mime: match[1], bytes };
}

export async function writeSiteLogo(dataUrl: string): Promise<string> {
  const { bytes } = parseDataImage(dataUrl);
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore({ name: "deals-db", consistency: "strong" });
    const payload = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(payload).set(bytes);
    await store.set(LOGO_KEY, payload, { metadata: { contentType: "image/png" } });
  } catch {
    mkdirSync(dirname(logoPath), { recursive: true });
    writeFileSync(logoPath, bytes);
  }
  return "/api/site-logo";
}

export async function readSiteLogo(): Promise<{ body: Buffer; type: string } | null> {
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore({ name: "deals-db", consistency: "strong" });
    const data = await store.get(LOGO_KEY, { type: "arrayBuffer" });
    if (data) {
      const body = Buffer.from(data);
      return { body, type: sniffImageType(body) };
    }
  } catch {
    // Fall through to local files.
  }
  const path = existsSync(logoPath) ? logoPath : existsSync(defaultLogoPath) ? defaultLogoPath : null;
  if (!path) return null;
  const body = readFileSync(path);
  return { body, type: sniffImageType(body) };
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
