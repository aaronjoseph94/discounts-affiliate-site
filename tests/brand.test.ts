import { describe, expect, it } from "vitest";
import { SITE_NAME, pageTitle } from "../shared/brand.ts";

describe("pageTitle", () => {
  it("uses the brand name, with an optional section", () => {
    expect(pageTitle()).toBe(SITE_NAME);
    expect(pageTitle("Admin")).toBe(`Admin · ${SITE_NAME}`);
  });
});
