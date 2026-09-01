import { afterEach, describe, expect, it } from "vitest";
import { readSiteCache, writeSiteCache } from "../src/lib/site-cache.ts";

const memory = new Map<string, string>();

Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
  },
  configurable: true,
});

afterEach(() => {
  memory.clear();
});

describe("site cache", () => {
  it("round-trips a title so refresh can skip the default line", () => {
    expect(readSiteCache()).toBeNull();
    writeSiteCache({ title: "  Weekend deals  ", logoUrl: "/api/site-logo?t=1" });
    expect(readSiteCache()).toEqual({ title: "Weekend deals", logoUrl: "/api/site-logo" });
  });

  it("ignores junk and data URLs", () => {
    writeSiteCache({ title: "", logoUrl: "data:image/png;base64,xxxx" });
    expect(readSiteCache()).toBeNull();
    writeSiteCache({ title: "Live title", logoUrl: "https://evil.example/x.png" });
    expect(readSiteCache()).toEqual({ title: "Live title", logoUrl: "/logo.png" });
  });
});
