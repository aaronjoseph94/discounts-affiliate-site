import type { Deal, DealInput, LogoHit, SiteSettings } from "./types.ts";

const jsonHeaders = { "Content-Type": "application/json" };

async function readJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

export function getDeals(): Promise<{ deals: Deal[] }> {
  return fetch("/api/deals").then((res) => readJson(res));
}

export function getSettings(): Promise<{ settings: SiteSettings }> {
  return fetch("/api/settings").then((res) => readJson(res));
}

export function updateSettings(settings: Partial<SiteSettings>): Promise<{ settings: SiteSettings }> {
  return fetch("/api/settings", {
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify(settings),
  }).then((res) => readJson(res));
}

export function login(password: string): Promise<{ ok: true }> {
  return fetch("/api/login", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ password }),
  }).then((res) => readJson(res));
}

export function logout(): Promise<{ ok: true }> {
  return fetch("/api/logout", { method: "POST" }).then((res) => readJson(res));
}

export function getSession(): Promise<{ authenticated: boolean }> {
  return fetch("/api/session").then((res) => readJson(res));
}

export function searchLogos(name: string, url: string): Promise<{ results: LogoHit[] }> {
  const params = new URLSearchParams();
  if (name.trim()) params.set("name", name.trim().slice(0, 80));
  if (url.trim()) params.set("url", url.trim().slice(0, 500));
  return fetch(`/api/logo?${params}`).then((res) => readJson(res));
}

export function createDeal(input: DealInput): Promise<{ deal: Deal }> {
  return fetch("/api/deals", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(input),
  }).then((res) => readJson(res));
}

export function updateDeal(id: string, input: DealInput): Promise<{ deal: Deal }> {
  return fetch(`/api/deals/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify(input),
  }).then((res) => readJson(res));
}

export function deleteDeal(id: string): Promise<{ ok: true }> {
  return fetch(`/api/deals/${encodeURIComponent(id)}`, { method: "DELETE" }).then((res) => readJson(res));
}

export type { DealInput };
