import { describe, expect, it } from "vitest";
import { DealInputError } from "../netlify/functions/_shared/http.ts";
import { defaultSettings, normalizeSettings } from "../netlify/functions/_shared/store.ts";

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

  it("rejects oversized data URLs", () => {
    const huge = `data:image/png;base64,${"A".repeat(900_001)}`;
    expect(() => normalizeSettings({ logoUrl: huge })).toThrow(DealInputError);
  });

  it("falls back for unknown logo URLs", () => {
    expect(normalizeSettings({ logoUrl: "https://evil.example/x.png" }).logoUrl).toBe(defaultSettings.logoUrl);
  });
});
