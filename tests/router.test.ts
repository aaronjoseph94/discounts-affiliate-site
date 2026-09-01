import { describe, expect, it } from "vitest";
import { routeApi } from "../netlify/functions/_shared/router.ts";

describe("routeApi", () => {
  it("rejects an unauthenticated settings update", async () => {
    const res = await routeApi(
      new Request("http://localhost/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Hacked" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects a non-JSON content type", async () => {
    const res = await routeApi(
      new Request("http://localhost/api/login", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "password=nope",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const res = await routeApi(
      new Request("http://localhost/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON" });
  });

  it("rejects a body that is too large", async () => {
    const res = await routeApi(
      new Request("http://localhost/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: `{"password":"${"x".repeat(40_000)}"}`,
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Request is too large" });
  });

  it("returns settings and the default site logo", async () => {
    const settings = await routeApi(new Request("http://localhost/api/settings"));
    expect(settings.status).toBe(200);
    const body = (await settings.json()) as { settings: { logoUrl: string } };
    expect(body.settings.logoUrl).toBe("/logo.png");

    const logo = await routeApi(new Request("http://localhost/api/site-logo"));
    expect(logo.status).toBe(200);
    expect(logo.headers.get("content-type")).toBe("image/png");

    const head = await routeApi(new Request("http://localhost/api/site-logo", { method: "HEAD" }));
    expect(head.status).toBe(200);
    expect(await head.arrayBuffer()).toHaveProperty("byteLength", 0);
  });

  it("keeps logo lookup behind the admin session", async () => {
    const res = await routeApi(new Request("http://localhost/api/logo?name=Nike"));
    expect(res.status).toBe(401);
  });

  it("rejects a cross-site write", async () => {
    const res = await routeApi(
      new Request("http://localhost/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
        body: JSON.stringify({ password: "nope" }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("rejects unknown API methods", async () => {
    const res = await routeApi(new Request("http://localhost/api/deals", { method: "PUT" }));
    expect(res.status).toBe(405);
  });
});
