export function rewriteStorageUrl(
  uploadUrl: string,
  convexUrl: string | undefined,
): string {
  if (!convexUrl) return uploadUrl;
  try {
    const url = new URL(uploadUrl);
    if (url.hostname !== "127.0.0.1") return uploadUrl;
    const convex = new URL(convexUrl);
    if (convex.hostname === "127.0.0.1" || convex.hostname === "localhost")
      return uploadUrl;
    url.hostname = convex.hostname;
    return url.toString();
  } catch {
    return uploadUrl;
  }
}
