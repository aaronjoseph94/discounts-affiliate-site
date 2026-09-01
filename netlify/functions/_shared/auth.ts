/** Signed cookie so /admin stays logged in without keeping the password around. */
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "dd_session";
const DAY = 24 * 60 * 60;

function envGet(name: string): string | undefined {
  try {
    const value = Netlify.env.get(name);
    if (value) return value;
  } catch {
    // Local Vite middleware is plain Node, not the Netlify function runtime.
  }
  return process.env[name];
}

function isProduction(): boolean {
  const context = envGet("CONTEXT") || envGet("NODE_ENV");
  return context === "production";
}

const LOCAL_DEV_PASSWORD = "Gitfogmf94!";

export function adminPassword(): string | null {
  const fromEnv = envGet("ADMIN_PASSWORD")?.trim();
  if (fromEnv) return fromEnv;
  // Public repo: never ship the local default as the production secret.
  if (envGet("CONTEXT") === "production") return null;
  return LOCAL_DEV_PASSWORD;
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

/** Constant-time compare via hashes so password length is not leaked. */
export function passwordsMatch(input: string, expected: string): boolean {
  const left = createHmac("sha256", "codes-compare").update(input).digest();
  const right = createHmac("sha256", "codes-compare").update(expected).digest();
  return timingSafeEqual(left, right);
}

export function createSessionToken(secret: string): string {
  const exp = Math.floor(Date.now() / 1000) + 30 * DAY;
  const payload = String(exp);
  return `${payload}.${sign(payload, secret)}`;
}

export function sessionValid(token: string | undefined, secret: string): boolean {
  if (!token || !token.includes(".")) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const exp = Number(payload);
  if (!payload || !sig || !Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return false;
  }
  const expected = sign(payload, secret);
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
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
  const secure = isProduction() || new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * DAY}${secure}`;
}

export function sessionCookie(req: Request, token: string): string {
  return `${COOKIE}=${token}; ${cookieFlags(req)}`;
}

export function clearSessionCookie(req: Request): string {
  const secure = isProduction() || new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
