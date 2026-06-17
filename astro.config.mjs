import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import vercel from "@astrojs/vercel";
import sentry from "@sentry/astro";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  output: "static",
  adapter: vercel(),
  integrations: [
    react(),
    // Runtime SDK options (dsn, environment, beforeSend, replay sampling) live in
    // sentry.client.config.ts. org/project/authToken are read from SENTRY_ORG /
    // SENTRY_PROJECT / SENTRY_AUTH_TOKEN — source maps only upload when a token is set.
    sentry({
      sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // VERCEL_GIT_COMMIT_SHA is set by Vercel's build platform, not VITE_-prefixed,
    // so Vite won't expose it to client code on its own — bridge it through here.
    define: {
      "import.meta.env.VITE_SENTRY_RELEASE": JSON.stringify(
        process.env.VERCEL_GIT_COMMIT_SHA ?? "",
      ),
    },
  },
  server: {
    port: 5173,
  },
});
