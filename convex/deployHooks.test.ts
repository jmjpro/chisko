/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, vi, beforeEach, afterEach } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true } as Response));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("triggerVercel POSTs to VERCEL_DEPLOY_HOOK_URL when set", async () => {
  const hookUrl = "https://api.vercel.com/v1/integrations/deploy/test-hook";
  vi.stubEnv("VERCEL_DEPLOY_HOOK_URL", hookUrl);

  const t = convexTest(schema, modules);
  await t.action(internal.internal.deployHooks.triggerVercel, {});

  expect(fetch).toHaveBeenCalledWith(hookUrl, { method: "POST" });
});

test("triggerVercel is a no-op when VERCEL_DEPLOY_HOOK_URL is not set", async () => {
  vi.stubEnv("VERCEL_DEPLOY_HOOK_URL", "");

  const t = convexTest(schema, modules);
  await t.action(internal.internal.deployHooks.triggerVercel, {});

  expect(fetch).not.toHaveBeenCalled();
});
