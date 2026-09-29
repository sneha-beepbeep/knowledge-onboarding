import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

// The Cloudflare plugin runs the Worker (API + D1 + R2) inside `vite dev`,
// so one command serves the whole app locally.
export default defineConfig({
  plugins: [react(), cloudflare()],
});
