import {
  adminPassword,
  clearSessionCookie,
  createSessionToken,
  isAuthenticated,
  passwordsMatch,
  sessionCookie,
} from "./auth.ts";
import { searchLogos } from "./logo.ts";
import { decorateDeal, listDeals, saveDeals, validateDealInput } from "./store.ts";

function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(data, { status, headers });
}

function error(message: string, status: number): Response {
  return json({ error: message }, status);
}

async function requireAdmin(req: Request): Promise<Response | null> {
  if (isAuthenticated(req)) return null;
  if (!adminPassword()) {
    return error("Set ADMIN_PASSWORD in Netlify before using the admin.", 503);
  }
  return error("Sign in to continue", 401);
}

async function readBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export async function routeApi(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = req.method.toUpperCase();

  try {
    if (path === "/api/session" && method === "GET") {
      return json({ authenticated: isAuthenticated(req) });
    }

    if (path === "/api/login" && method === "POST") {
      const secret = adminPassword();
      if (!secret) {
        return error("Set ADMIN_PASSWORD in Netlify before using the admin.", 503);
      }
      const body = (await readBody(req)) as { password?: string };
      if (!passwordsMatch(String(body.password ?? ""), secret)) {
        return error("Wrong password", 401);
      }
      return json(
        { ok: true },
        200,
        { "Set-Cookie": sessionCookie(req, createSessionToken(secret)) },
      );
    }

    if (path === "/api/logout" && method === "POST") {
      return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie(req) });
    }

    if (path === "/api/logo" && method === "GET") {
      const results = await searchLogos(url.searchParams.get("name") ?? "", url.searchParams.get("url") ?? "");
      return json({ results });
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
      const id = decodeURIComponent(dealMatch[1]);
      const deals = await listDeals();
      const index = deals.findIndex((deal) => deal.id === id);
      if (index === -1) return error("Deal not found", 404);
      const deal = await decorateDeal(validateDealInput(await readBody(req)), deals[index]);
      deals[index] = deal;
      await saveDeals(deals);
      return json({ deal });
    }

    if (dealMatch && method === "DELETE") {
      const denied = await requireAdmin(req);
      if (denied) return denied;
      const id = decodeURIComponent(dealMatch[1]);
      const deals = await listDeals();
      const next = deals.filter((deal) => deal.id !== id);
      if (next.length === deals.length) return error("Deal not found", 404);
      await saveDeals(next);
      return json({ ok: true });
    }

    return error("Not found", 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    const status = message.includes("required") || message.includes("invalid") || message.includes("Add an")
      ? 400
      : 500;
    if (status === 500) console.error(err);
    return error(message, status);
  }
}
