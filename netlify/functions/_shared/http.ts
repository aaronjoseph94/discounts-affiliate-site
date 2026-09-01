/** Small JSON helpers plus conservative API security headers. */

export const API_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Cross-Origin-Opener-Policy": "same-origin",
};

export function json(data: unknown, status = 200, extra?: HeadersInit): Response {
  return Response.json(data, {
    status,
    headers: { ...API_HEADERS, ...extra },
  });
}

export function error(message: string, status: number): Response {
  return json({ error: message }, status);
}

export class DealInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DealInputError";
  }
}
