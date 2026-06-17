function parseDsn(
  dsn: string,
): { publicKey: string; host: string; projectId: string } | null {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace(/^\//, "");
    if (!publicKey || !projectId) return null;
    return { publicKey, host: url.host, projectId };
  } catch {
    return null;
  }
}

const PII_KEYS = new Set([
  "name",
  "phone",
  "email",
  "street",
  "housenumber",
  "placeofresidence",
]);

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = PII_KEYS.has(key.toLowerCase()) ? "[Redacted]" : redact(val);
    }
    return out;
  }
  return value;
}

export async function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  const dsn = process.env.SENTRY_DSN_BE;
  if (!dsn) return;
  const parsed = parseDsn(dsn);
  if (!parsed) return;

  const message = error instanceof Error ? error.message : String(error);
  const event = {
    exception: { values: [{ value: message }] },
    environment: process.env.SENTRY_ENVIRONMENT ?? "development",
    ...(process.env.SENTRY_RELEASE
      ? { release: process.env.SENTRY_RELEASE }
      : {}),
    ...(context ? { extra: redact(context) } : {}),
  };

  try {
    await fetch(`https://${parsed.host}/api/${parsed.projectId}/store/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=convex/1.0, sentry_key=${parsed.publicKey}`,
      },
      body: JSON.stringify(event),
    });
  } catch {
    // Reporting failures must never break the caller's own error handling.
  }
}

export async function withCapturedExceptions<T>(
  fn: () => Promise<T>,
  context?: Record<string, unknown>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    await captureException(error, context);
    throw error;
  }
}
