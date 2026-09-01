import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { routeApi } from "../netlify/functions/_shared/router.ts";

function toHeaders(req: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(", "));
  }
  return headers;
}

function toRequest(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? "localhost";
  const url = `http://${host}${req.url ?? "/"}`;
  const headers = toHeaders(req);
  const method = req.method ?? "GET";
  if (method === "GET" || method === "HEAD") {
    return Promise.resolve(new Request(url, { method, headers }));
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      resolve(
        new Request(url, {
          method,
          headers,
          body: Buffer.concat(chunks),
        }),
      );
    });
    req.on("error", reject);
  });
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
            console.error(err);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Server error" }));
          });
      });
    },
  };
}
