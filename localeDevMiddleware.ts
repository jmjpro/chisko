import type { AstroIntegration } from "astro";
import type { IncomingMessage, ServerResponse } from "node:http";
import middleware from "./middleware.js";

// Astro 6 dev mode hands `middleware.ts` an empty headers object for
// prerendered routes (see ADR-0010), so the locale redirect never fires
// under `astro dev`. Vite's own Connect pipeline still sees the real
// incoming request, so run the production middleware function there
// directly instead of reimplementing its logic.
//
// `middleware.ts` also uses `rewrite()` for unmatched paths under a known
// locale prefix (see ADR-0010's "Rewrite signal handling" section). Vercel's
// edge platform interprets the resulting `x-middleware-rewrite` header
// automatically in production; `astro dev` has no equivalent, so this
// rewrites `req.url` and hands off to Vite/Astro's own pipeline instead.
export default function localeDevMiddleware(): AstroIntegration {
  return {
    name: "locale-dev-middleware",
    hooks: {
      "astro:server:setup": ({ server }) => {
        server.middlewares.use(
          (req: IncomingMessage, res: ServerResponse, next: () => void) => {
            const headers = new Headers();
            for (const [key, value] of Object.entries(req.headers)) {
              if (typeof value === "string") headers.set(key, value);
              else if (Array.isArray(value)) headers.set(key, value.join(", "));
            }

            const url = new URL(
              req.url ?? "/",
              `http://${req.headers.host ?? "localhost"}`,
            );
            const response = middleware(new Request(url, { headers }));
            if (!response) {
              next();
              return;
            }

            const rewriteTarget = response.headers.get("x-middleware-rewrite");
            if (rewriteTarget) {
              const destination = new URL(rewriteTarget);
              req.url = destination.pathname + destination.search;
              next();
              return;
            }

            res.statusCode = response.status;
            response.headers.forEach((value, key) => res.setHeader(key, value));
            res.end();
          },
        );
      },
    },
  };
}
