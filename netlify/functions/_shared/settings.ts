/** Homepage title and logo. Same Blobs store as deals; local files when Blobs is not available. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_TAGLINE } from "../../../shared/brand.ts";
import type { SiteSettings } from "../../../shared/types.ts";
import { siteStore } from "./blobs.ts";
import { DealInputError } from "./http.ts";

const SETTINGS_KEY = "settings.json";
const LOGO_KEY = "site-logo.png";
const settingsPath = join(dirname(fileURLToPath(import.meta.url)), "../../../data/settings.json");
const logoPath = join(dirname(fileURLToPath(import.meta.url)), "../../../data/site-logo.png");
const defaultLogoPath = join(dirname(fileURLToPath(import.meta.url)), "../../../public/logo.png");

export const defaultSettings: SiteSettings = {
  title: DEFAULT_TAGLINE,
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

/** PNG / JPEG / WebP magic bytes. Rejects HTML or other files labeled as images. */
export function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

function normalizeLogoUrl(value: unknown, fallback: string, allowDataUrl: boolean): string {
  const raw = String(value ?? "").trim();
  if (raw === "/logo.png" || raw === "/api/site-logo") return raw;
  if (allowDataUrl && DATA_URL_RE.test(raw)) {
    if (raw.length > 900_000) throw new DealInputError("Logo must be under 700KB");
    return raw;
  }
  return fallback;
}

export function normalizeSettings(
  value: unknown,
  existing?: SiteSettings,
  allowDataUrl = false,
): SiteSettings {
  const current = existing ?? defaultSettings;
  return {
    title: cleanTitle((value as { title?: unknown } | null)?.title) || current.title || defaultSettings.title,
    logoUrl: normalizeLogoUrl(
      (value as { logoUrl?: unknown } | null)?.logoUrl,
      current.logoUrl || defaultSettings.logoUrl,
      allowDataUrl,
    ),
  };
}

async function readSettingsBlobs(): Promise<unknown | null> {
  try {
    const store = await siteStore();
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
    const store = await siteStore();
    await store.setJSON(SETTINGS_KEY, settings);
    return settings;
  } catch {
    mkdirSync(dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
    return settings;
  }
}

export function parseDataImage(dataUrl: string): { type: string; bytes: Buffer } {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  if (!match) throw new DealInputError("Use a PNG, JPG, or WebP logo");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length < 32 || bytes.length > 700_000) {
    throw new DealInputError("Logo must be under 700KB");
  }
  const type = sniffImageType(bytes);
  if (!type) throw new DealInputError("Use a PNG, JPG, or WebP logo");
  return { type, bytes };
}

export async function writeSiteLogo(dataUrl: string): Promise<string> {
  const { bytes, type } = parseDataImage(dataUrl);
  try {
    const store = await siteStore();
    const payload = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(payload).set(bytes);
    await store.set(LOGO_KEY, payload, { metadata: { contentType: type } });
  } catch {
    mkdirSync(dirname(logoPath), { recursive: true });
    writeFileSync(logoPath, bytes);
  }
  return "/api/site-logo";
}

export async function readSiteLogo(): Promise<{ body: Buffer; type: string } | null> {
  try {
    const store = await siteStore();
    const data = await store.get(LOGO_KEY, { type: "arrayBuffer" });
    if (data) {
      const body = Buffer.from(data);
      return { body, type: sniffImageType(body) ?? "image/png" };
    }
  } catch {
    // Fall through to local files.
  }
  const path = existsSync(logoPath) ? logoPath : existsSync(defaultLogoPath) ? defaultLogoPath : null;
  if (!path) return null;
  const body = readFileSync(path);
  return { body, type: sniffImageType(body) ?? "image/png" };
}

export async function saveSettings(input: unknown): Promise<SiteSettings> {
  const current = await getSettings();
  let next = normalizeSettings(input, current, true);
  if (next.logoUrl.startsWith("data:image/")) {
    next = { ...next, logoUrl: await writeSiteLogo(next.logoUrl) };
  }
  return persistSettings(next);
}
