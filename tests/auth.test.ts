import { describe, expect, it } from "vitest";
import { createSessionToken, passwordsMatch, sessionValid } from "../netlify/functions/_shared/auth.ts";
import { extractDomain } from "../netlify/functions/_shared/logo.ts";

describe("passwordsMatch", () => {
  it("accepts the matching password", () => {
    expect(passwordsMatch("admin", "admin")).toBe(true);
  });

  it("rejects a different password of another length", () => {
    expect(passwordsMatch("ad", "admin")).toBe(false);
    expect(passwordsMatch("admin!", "admin")).toBe(false);
  });
});

describe("session tokens", () => {
  it("accepts a fresh token and rejects a tampered one", () => {
    const token = createSessionToken("secret");
    expect(sessionValid(token, "secret")).toBe(true);
    expect(sessionValid(token, "other")).toBe(false);
    expect(sessionValid(`${token}x`, "secret")).toBe(false);
    expect(sessionValid(undefined, "secret")).toBe(false);
  });
});

describe("extractDomain", () => {
  it("reads a public host and ignores unsafe schemes", () => {
    expect(extractDomain("https://www.nike.com/path")).toBe("nike.com");
    expect(extractDomain("javascript:alert(1)")).toBeNull();
    expect(extractDomain("//evil.example")).toBeNull();
  });
});
