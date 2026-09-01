import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "codes_session";
const DAY = 24 * 60 * 60;

function envGet(name: string): string | undefined {
  try {
    const value = Netlify.env.get(name);
    if (value) return value;
  } catch {
    // Not running inside a Netlify function runtime.
  }
  return process.env[name];
}

export function adminPassword(): string | null {
  const configured = envGet("ADMIN_PASSWORD");
  if (configured) return configured;
  const context = envGet("CONTEXT");
  if (context === "production") return null;
  return "admin";
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function passwordsMatch(input: string, expected: string): boolean {
  const left = Buffer.from(input);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function createSessionToken(secret: string): string {
  const exp = Math.floor(Date.now() / 1000) + 30 * DAY;
  const payload = String(exp);
  return `${payload}.${sign(payload, secret)}`;
}

export function sessionValid(token: string | undefined, secret: string): boolean {
  if (!token || !token.includes(".")) return false;
  const [payload, sig] = token.split(".");
  const exp = Number(payload);
  if (!payload || !sig || !Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return false;
  }
  return safeEqual(sig, sign(payload, secret));
}

export function readSessionCookie(req: Request): string | undefined {
  const cookie = req.headers.get("cookie");
  if (!cookie) return undefined;
  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === COOKIE) return rest.join("=");
  }
  return undefined;
}

export function isAuthenticated(req: Request): boolean {
  const secret = adminPassword();
  if (!secret) return false;
  return sessionValid(readSessionCookie(req), secret);
}

function cookieFlags(req: Request): string {
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * DAY}${secure}`;
}

export function sessionCookie(req: Request, token: string): string {
  return `${COOKIE}=${token}; ${cookieFlags(req)}`;
}

export function clearSessionCookie(req: Request): string {
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
