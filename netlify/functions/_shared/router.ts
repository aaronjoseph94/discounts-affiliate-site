import {
  adminPassword,
  clearSessionCookie,
  createSessionToken,
  isAuthenticated,
  passwordsMatch,
  sessionCookie,
} from "./auth.ts";
import { DealInputError, error, json } from "./http.ts";
import { searchLogos } from "./logo.ts";
import { clientKey, rateLimit } from "./rate-limit.ts";
import { decorateDeal, getSettings, listDeals, readSiteLogo, saveDeals, saveSettings } from "./store.ts";
import { validateDealInput } from "./validate.ts";

const MAX_BODY_BYTES = 32_768;
const MAX_SETTINGS_BODY_BYTES = 900_000;

async function requireAdmin(req: Request): Promise<Response | null> {
  if (isAuthenticated(req)) return null;
  if (!adminPassword()) {
    return error("Set ADMIN_PASSWORD in Netlify before using the admin.", 503);
  }
  return error("Sign in to continue", 401);
}

async function readBody(req: Request, max = MAX_BODY_BYTES): Promise<unknown> {
  const raw = await req.text();
  if (raw.length > max) {
    throw new DealInputError("Request is too large");
  }
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new DealInputError("Invalid JSON");
  }
}

function dealIdFromPath(match: RegExpMatchArray): string | null {
  try {
    const id = decodeURIComponent(match[1] ?? "").trim();
    return id && id.length <= 80 ? id : null;
  } catch {
    return null;
  }
}

export async function routeApi(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = req.method.toUpperCase();

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }

  try {
    if (path === "/api/session" && method === "GET") {
      return json({ authenticated: isAuthenticated(req) });
    }

    if (path === "/api/login" && method === "POST") {
      if (!rateLimit(`login:${clientKey(req)}`, 5, 15 * 60 * 1000)) {
        return error("Too many sign-in attempts. Try again later.", 429);
      }
      const secret = adminPassword();
      if (!secret) {
        return error("Set ADMIN_PASSWORD in Netlify before using the admin.", 503);
      }
      const body = (await readBody(req)) as { password?: unknown };
      if (!passwordsMatch(String(body.password ?? ""), secret)) {
        return error("Wrong password", 401);
      }
      return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(req, createSessionToken(secret)) });
    }

    if (path === "/api/logout" && method === "POST") {
      return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie(req) });
    }

    if (path === "/api/logo" && method === "GET") {
      if (!rateLimit(`logo:${clientKey(req)}`, 30, 60 * 1000)) {
        return error("Too many logo lookups. Try again shortly.", 429);
      }
      const results = await searchLogos(url.searchParams.get("name") ?? "", url.searchParams.get("url") ?? "");
      return json({ results });
    }

    if (path === "/api/settings" && method === "GET") {
      return json({ settings: await getSettings() });
    }

    if (path === "/api/settings" && method === "PATCH") {
      const denied = await requireAdmin(req);
      if (denied) return denied;
      return json({ settings: await saveSettings(await readBody(req, MAX_SETTINGS_BODY_BYTES)) });
    }

    if (path === "/api/site-logo" && method === "GET") {
      const logo = await readSiteLogo();
      if (!logo) return error("Logo not found", 404);
      return new Response(Uint8Array.from(logo.body), {
        headers: {
          "Content-Type": logo.type,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    if (path === "/api/deals" && method === "GET") {
      const deals = await listDeals();
      deals.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      return json({ deals });
    }

    if (path === "/api/deals" && method === "POST") {
      const denied = await requireAdmin(req);
      if (denied) return denied;
      const deal = await decorateDeal(validateDealInput(await readBody(req)));
      const deals = await listDeals();
      deals.unshift(deal);
      await saveDeals(deals);
      return json({ deal }, 201);
    }

    const dealMatch = path.match(/^\/api\/deals\/([^/]+)$/);
    if (dealMatch && method === "PATCH") {
      const denied = await requireAdmin(req);
      if (denied) return denied;
      const id = dealIdFromPath(dealMatch);
      if (!id) return error("Deal not found", 404);
      const deals = await listDeals();
      const index = deals.findIndex((deal) => deal.id === id);
      if (index === -1) return error("Deal not found", 404);
      const body = (await readBody(req)) as Record<string, unknown>;
      const existing = deals[index];
      const deal = await decorateDeal(
        validateDealInput({
          productName: body.productName ?? existing.productName,
          affiliateUrl: body.affiliateUrl ?? existing.affiliateUrl,
          discountCode: body.discountCode ?? existing.discountCode,
          discountPercent: body.discountPercent ?? existing.discountPercent,
          logoUrl: body.logoUrl ?? existing.logoUrl,
          domain: body.domain ?? existing.domain,
        }),
        existing,
      );
      deals[index] = deal;
      await saveDeals(deals);
      return json({ deal });
    }

    if (dealMatch && method === "DELETE") {
      const denied = await requireAdmin(req);
      if (denied) return denied;
      const id = dealIdFromPath(dealMatch);
      if (!id) return error("Deal not found", 404);
      const deals = await listDeals();
      const next = deals.filter((deal) => deal.id !== id);
      if (next.length === deals.length) return error("Deal not found", 404);
      await saveDeals(next);
      return json({ ok: true });
    }

    if (path.startsWith("/api/")) {
      return error("Method not allowed", 405);
    }
    return error("Not found", 404);
  } catch (err) {
    if (err instanceof DealInputError) return error(err.message, 400);
    console.error(err);
    return error("Server error", 500);
  }
}
