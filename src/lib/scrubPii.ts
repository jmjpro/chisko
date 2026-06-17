type SentryLikeEvent = {
  request?: { data?: unknown };
  extra?: Record<string, unknown>;
  breadcrumbs?: { data?: unknown }[];
};

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

export function scrubPii<T extends SentryLikeEvent>(event: T): T {
  return {
    ...event,
    ...(event.request ? { request: redact(event.request) } : {}),
    ...(event.extra
      ? { extra: redact(event.extra) as Record<string, unknown> }
      : {}),
    ...(event.breadcrumbs
      ? {
          breadcrumbs: event.breadcrumbs.map((b) => ({
            ...b,
            ...(b.data ? { data: redact(b.data) } : {}),
          })),
        }
      : {}),
  };
}
