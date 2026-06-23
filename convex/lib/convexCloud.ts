export function isConvexCloudEnabled(): boolean {
  return process.env.ENABLE_CONVEX_CLOUD !== "false";
}
