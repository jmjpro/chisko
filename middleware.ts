import { rewrite } from "@vercel/functions";
import {
  LANG_COOKIE,
  LOCALES,
  PREFIXED_LOCALES,
  parseAcceptLanguage,
  type Locale,
} from "./src/lib/locale.js";
import { TOP_LEVEL_ROUTES } from "./src/lib/routes.js";

export const config = {
  matcher: ["/((?!_astro/|locales/|_server-islands/).*)"],
};

function getCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}

export default function middleware(request: Request): Response | undefined {
  const { pathname } = new URL(request.url);

  if (pathname.startsWith("/_") || /\.\w+$/.test(pathname)) return undefined;

  if (pathname.startsWith("/r/")) return undefined;

  const prefixLocale = PREFIXED_LOCALES.find(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
  );
  if (prefixLocale) {
    const rest = pathname.slice(`/${prefixLocale}`.length) || "/";
    if (!TOP_LEVEL_ROUTES.includes(rest)) {
      return rewrite(new URL(`/${prefixLocale}/404`, request.url));
    }
    return undefined;
  }

  const cookieVal = getCookie(request, LANG_COOKIE);
  const preferred: Locale = (LOCALES as readonly string[]).includes(
    cookieVal ?? "",
  )
    ? (cookieVal as Locale)
    : parseAcceptLanguage(request.headers.get("accept-language"));

  if (preferred === "he") return undefined;

  const target = `/${preferred}${pathname === "/" ? "/" : pathname}`;
  return Response.redirect(new URL(target, request.url), 302);
}
