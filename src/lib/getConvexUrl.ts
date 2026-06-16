export function getConvexUrl(url: string | undefined): string {
  if (!url) {
    throw new Error(
      "VITE_CONVEX_URL is not set. Each deployment needs its own Convex backend URL " +
        "(see docs/adr/0011-per-pr-ephemeral-backends-no-shared-dev-domain.md).",
    );
  }
  return url;
}
