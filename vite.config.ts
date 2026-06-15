import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Minimal Vite config kept for tooling compatibility (vitest, etc.).
// The main dev/build pipeline now runs through Astro (astro.config.mjs).
export default defineConfig({
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
