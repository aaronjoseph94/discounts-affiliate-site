import type { Deal, LogoHit } from "./types.ts";

async function readJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

const jsonHeaders = { "Content-Type": "application/json" };

export function getDeals(): Promise<{ deals: Deal[] }> {
  return fetch("/api/deals").then((res) => readJson(res));
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
  if (name.trim()) params.set("name", name.trim());
  if (url.trim()) params.set("url", url.trim());
  return fetch(`/api/logo?${params}`).then((res) => readJson(res));
}

export type DealInput = {
  productName: string;
  affiliateUrl: string;
  discountCode: string;
  discountPercent: number | null;
  logoUrl?: string;
  domain?: string;
};

export function createDeal(input: DealInput): Promise<{ deal: Deal }> {
  return fetch("/api/deals", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(input),
  }).then((res) => readJson(res));
}

export function updateDeal(id: string, input: DealInput): Promise<{ deal: Deal }> {
  return fetch(`/api/deals/${id}`, {
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify(input),
  }).then((res) => readJson(res));
}

export function deleteDeal(id: string): Promise<{ ok: true }> {
  return fetch(`/api/deals/${id}`, { method: "DELETE" }).then((res) => readJson(res));
}
