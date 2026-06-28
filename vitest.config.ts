import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "convex",
          include: ["convex/**/*.test.ts"],
          environment: "edge-runtime",
        },
      },
      {
        test: {
          name: "node",
          include: [
            "scripts/**/*.test.ts",
            "src/**/*.test.ts",
            "middleware.test.ts",
            "localeDevMiddleware.test.ts",
            "renovate.test.ts",
            "ci.test.ts",
          ],
          environment: "node",
        },
      },
      {
        test: {
          name: "extension",
          include: ["extension/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "./src"),
          },
        },
        test: {
          name: "dom",
          include: ["src/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["./src/vitest.setup.dom.ts"],
        },
      },
    ],
  },
});
