import { describe, expect, it } from "vitest";
import { DealInputError } from "../netlify/functions/_shared/http.ts";
import {
  normalizeDeal,
  normalizeDomain,
  normalizeHttpUrl,
  sanitizeLogoUrl,
  validateDealInput,
} from "../netlify/functions/_shared/validate.ts";

describe("normalizeHttpUrl", () => {
  it("accepts a bare hostname", () => {
    expect(normalizeHttpUrl("nike.com")).toBe("https://nike.com/");
  });

  it("rejects javascript URLs", () => {
    expect(() => normalizeHttpUrl("javascript:alert(1)")).toThrow(DealInputError);
  });

  it("rejects protocol-relative URLs", () => {
    expect(() => normalizeHttpUrl("//evil.example")).toThrow(DealInputError);
  });

  it("rejects credentials in the URL", () => {
    expect(() => normalizeHttpUrl("https://user:pass@nike.com")).toThrow(DealInputError);
  });

  it("rejects localhost and private hosts", () => {
    expect(() => normalizeHttpUrl("http://127.0.0.1")).toThrow(DealInputError);
    expect(() => normalizeHttpUrl("http://127.0.0.2")).toThrow(DealInputError);
    expect(() => normalizeHttpUrl("http://192.168.1.10")).toThrow(DealInputError);
    expect(() => normalizeHttpUrl("http://localhost:3000")).toThrow(DealInputError);
    expect(() => normalizeHttpUrl("http://[::1]/")).toThrow(DealInputError);
    expect(() => normalizeHttpUrl("http://[fd12:3456:789a:1::1]/")).toThrow(DealInputError);
  });
});

describe("validateDealInput", () => {
  it("requires a product name", () => {
    expect(() => validateDealInput({ discountCode: "SAVE" })).toThrow("Product name is required");
  });

  it("requires a URL or a code", () => {
    expect(() => validateDealInput({ productName: "Nike" })).toThrow("Add an affiliate URL");
  });

  it("accepts a code-only deal", () => {
    const deal = validateDealInput({ productName: "Nike", discountCode: "SPORT20", discountPercent: 20 });
    expect(deal.discountCode).toBe("SPORT20");
    expect(deal.affiliateUrl).toBe("");
  });

  it("clamps percents and strips control characters", () => {
    const deal = validateDealInput({
      productName: "Nike\u0000",
      discountCode: "SAVE",
      discountPercent: 250,
    });
    expect(deal.productName).toBe("Nike");
    expect(deal.discountPercent).toBe(100);
  });

  it("treats a zero percent as empty", () => {
    const deal = validateDealInput({ productName: "Nike", discountCode: "SAVE", discountPercent: 0 });
    expect(deal.discountPercent).toBeNull();
  });
});

describe("sanitizeLogoUrl", () => {
  it("keeps known logo CDNs", () => {
    expect(sanitizeLogoUrl("https://logo.clearbit.com/nike.com", "nike.com")).toBe(
      "https://logo.clearbit.com/nike.com",
    );
  });

  it("drops javascript and unknown hosts", () => {
    expect(sanitizeLogoUrl("javascript:alert(1)", "nike.com")).toContain("google.com/s2/favicons");
    expect(sanitizeLogoUrl("https://evil.example/logo.png", "nike.com")).toContain("google.com/s2/favicons");
  });
});

describe("normalizeDeal", () => {
  it("drops records that cannot be shown safely", () => {
    expect(normalizeDeal({ id: "x" })).toBeNull();
    expect(normalizeDeal({ id: "x", productName: "Nike" })).toBeNull();
  });

  it("keeps a valid record", () => {
    const deal = normalizeDeal({
      id: "seed-nike",
      productName: "Nike",
      affiliateUrl: "https://nike.com",
      discountCode: "SPORT20",
      discountPercent: 20,
      domain: "nike.com",
      logoUrl: "https://logo.clearbit.com/nike.com",
      createdAt: "2026-08-21T12:00:00.000Z",
    });
    expect(deal?.productName).toBe("Nike");
    expect(deal?.domain).toBe("nike.com");
  });
});

describe("normalizeDomain", () => {
  it("strips www and rejects junk", () => {
    expect(normalizeDomain("www.Nike.COM")).toBe("nike.com");
    expect(normalizeDomain("not a domain")).toBe("");
  });
});
