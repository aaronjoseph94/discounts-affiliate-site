import { describe, expect, it } from "vitest";
import { logoFileError } from "../src/lib/logo-file.ts";

describe("logoFileError", () => {
  it("rejects an oversized or non-image file", () => {
    const huge = new File([new Uint8Array(700_001)], "x.png", { type: "image/png" });
    expect(logoFileError(huge)).toMatch(/700KB/);
    const text = new File(["nope"], "x.txt", { type: "text/plain" });
    expect(logoFileError(text)).toMatch(/PNG/);
  });
});
