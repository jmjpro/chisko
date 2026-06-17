import { expect, test, vi, beforeEach, afterEach } from "vitest";
import { captureException, withCapturedExceptions } from "./sentry";

beforeEach(() => {
  vi.stubEnv(
    "SENTRY_DSN_BE",
    "https://publickey123@o123.ingest.de.sentry.io/456",
  );
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("posts to the Sentry ingest URL derived from the DSN, with the error message", async () => {
  await captureException(new Error("boom"));

  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(url).toBe("https://o123.ingest.de.sentry.io/api/456/store/");
  const body = JSON.parse(init.body);
  expect(body.exception.values[0].value).toBe("boom");
});

test("redacts known PII keys from context before sending", async () => {
  await captureException(new Error("boom"), {
    email: "user@example.com",
    sessionId: "abc123",
  });

  const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
  const body = JSON.parse(init.body);
  expect(body.extra.email).toBe("[Redacted]");
  expect(body.extra.sessionId).toBe("abc123");
});

test("no-ops when SENTRY_DSN_BE is unset", async () => {
  vi.unstubAllEnvs();

  await captureException(new Error("boom"));

  expect(fetch).not.toHaveBeenCalled();
});

test("never throws, even if the underlying fetch rejects", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

  await expect(captureException(new Error("boom"))).resolves.toBeUndefined();
});

test("tags the event with SENTRY_ENVIRONMENT, defaulting to development when unset", async () => {
  await captureException(new Error("boom"));
  let body = JSON.parse(
    (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
  );
  expect(body.environment).toBe("development");

  vi.stubEnv("SENTRY_ENVIRONMENT", "production");
  await captureException(new Error("boom"));
  body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[1][1].body);
  expect(body.environment).toBe("production");
});

test("tags the event with SENTRY_RELEASE when set, omits it when unset", async () => {
  await captureException(new Error("boom"));
  let body = JSON.parse(
    (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
  );
  expect(body.release).toBeUndefined();

  vi.stubEnv("SENTRY_RELEASE", "abc123sha");
  await captureException(new Error("boom"));
  body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[1][1].body);
  expect(body.release).toBe("abc123sha");
});

test("withCapturedExceptions returns the wrapped function's result on success", async () => {
  const result = await withCapturedExceptions(() => Promise.resolve(42));

  expect(result).toBe(42);
  expect(fetch).not.toHaveBeenCalled();
});

test("withCapturedExceptions reports to Sentry and rethrows on failure", async () => {
  await expect(
    withCapturedExceptions(() => Promise.reject(new Error("boom")), {
      sessionId: "abc123",
    }),
  ).rejects.toThrow("boom");

  const body = JSON.parse(
    (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
  );
  expect(body.exception.values[0].value).toBe("boom");
  expect(body.extra.sessionId).toBe("abc123");
});
