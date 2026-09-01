/** Vite + the local /api plugin so `npm run dev` matches Netlify Functions. */
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { localApiPlugin } from "./dev/local-api-plugin.ts";

export default defineConfig({
  plugins: [react(), localApiPlugin()],
});
