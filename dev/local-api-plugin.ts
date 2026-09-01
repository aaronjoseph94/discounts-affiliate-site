/** Vite middleware that runs the same API router as Netlify Functions. */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { routeApi } from "../netlify/functions/_shared/router.ts";

const MAX_BODY_BYTES = 32_768;
const MAX_SETTINGS_BODY_BYTES = 900_000;

function toHeaders(req: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(", "));
  }
  return headers;
}

function maxBodyBytes(url?: string): number {
  const path = (url ?? "").split("?")[0];
  return path === "/api/settings" ? MAX_SETTINGS_BODY_BYTES : MAX_BODY_BYTES;
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  if (req.readableEnded) return Promise.resolve(Buffer.alloc(0));
  const max = maxBodyBytes(req.url);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let done = false;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > max) {
        if (!done) {
          done = true;
          reject(new Error("Payload too large"));
        }
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!done) {
        done = true;
        resolve(Buffer.concat(chunks));
      }
    });
    req.on("error", (err) => {
      if (!done) {
        done = true;
        reject(err);
      }
    });
  });
}

async function toRequest(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? "localhost";
  const url = `http://${host}${req.url ?? "/"}`;
  const headers = toHeaders(req);
  const method = req.method ?? "GET";
  if (method === "GET" || method === "HEAD") {
    return new Request(url, { method, headers });
  }

  const body = await readBody(req);
  return new Request(url, {
    method,
    headers,
    body,
    duplex: "half",
  } as RequestInit);
}

async function writeResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  res.end(Buffer.from(await response.arrayBuffer()));
}

export function localApiPlugin(): Plugin {
  return {
    name: "local-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/api/")) {
          next();
          return;
        }

        void toRequest(req)
          .then(routeApi)
          .then((response) => writeResponse(res, response))
          .catch((err: unknown) => {
            const tooLarge = err instanceof Error && err.message === "Payload too large";
            if (!res.headersSent) {
              res.statusCode = tooLarge ? 400 : 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: tooLarge ? "Request is too large" : "Server error" }));
            }
            if (!tooLarge) console.error(err);
          });
      });
    },
  };
}
