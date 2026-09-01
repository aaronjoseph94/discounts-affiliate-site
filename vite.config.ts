import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { localApiPlugin } from "./dev/local-api-plugin.ts";

export default defineConfig({
  plugins: [react(), localApiPlugin()],
});
