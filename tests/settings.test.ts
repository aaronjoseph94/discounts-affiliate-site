import { describe, expect, it } from "vitest";
import { DealInputError } from "../netlify/functions/_shared/http.ts";
import {
  defaultSettings,
  normalizeSettings,
  parseDataImage,
  sniffImageType,
} from "../netlify/functions/_shared/settings.ts";

function pngBytes(length = 40): Buffer {
  const bytes = Buffer.alloc(length);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return bytes;
}

describe("normalizeSettings", () => {
  it("keeps the current logo when only the title changes", () => {
    const next = normalizeSettings(
      { title: "New headline" },
      { title: "Old", logoUrl: "/api/site-logo" },
    );
    expect(next).toEqual({ title: "New headline", logoUrl: "/api/site-logo" });
  });

  it("accepts the default and uploaded logo paths", () => {
    expect(normalizeSettings({ logoUrl: "/logo.png" }).logoUrl).toBe("/logo.png");
    expect(normalizeSettings({ logoUrl: "/api/site-logo" }).logoUrl).toBe("/api/site-logo");
  });

  it("does not expose data URLs on public reads", () => {
    const sneaky = `data:image/png;base64,${pngBytes().toString("base64")}`;
    expect(normalizeSettings({ logoUrl: sneaky }).logoUrl).toBe(defaultSettings.logoUrl);
  });

  it("rejects oversized data URLs when uploading", () => {
    const huge = `data:image/png;base64,${"A".repeat(900_001)}`;
    expect(() => normalizeSettings({ logoUrl: huge }, undefined, true)).toThrow(DealInputError);
  });

  it("falls back for unknown logo URLs", () => {
    expect(normalizeSettings({ logoUrl: "https://evil.example/x.png" }).logoUrl).toBe(defaultSettings.logoUrl);
  });
});

describe("parseDataImage", () => {
  it("accepts a PNG and rejects a file that is not an image", () => {
    const png = parseDataImage(`data:image/png;base64,${pngBytes().toString("base64")}`);
    expect(png.type).toBe("image/png");
    expect(sniffImageType(png.bytes)).toBe("image/png");

    const html = Buffer.from(`<!doctype html>${"x".repeat(40)}`);
    expect(() => parseDataImage(`data:image/png;base64,${html.toString("base64")}`)).toThrow(DealInputError);
  });
});
