/** Production API entry. Local Vite uses the same router via dev/local-api-plugin.ts. */
import type { Config } from "@netlify/functions";
import { routeApi } from "./_shared/router.ts";

export default async (req: Request) => routeApi(req);

export const config: Config = {
  path: ["/api/deals", "/api/deals/:id", "/api/login", "/api/logout", "/api/session", "/api/logo"],
  method: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
};
