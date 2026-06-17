import { expect, test } from "vitest";
import { scrubPii } from "./scrubPii";

test("redacts known PII keys from event.request data", () => {
  const event = {
    request: { data: { email: "user@example.com", sessionId: "abc123" } },
  };

  const scrubbed = scrubPii(event);

  expect(scrubbed.request?.data).toMatchObject({
    email: "[Redacted]",
    sessionId: "abc123",
  });
});

test("redacts known PII keys from event.extra", () => {
  const event = { extra: { phone: "0501234567", planId: "plan_1" } };

  const scrubbed = scrubPii(event);

  expect(scrubbed.extra).toMatchObject({
    phone: "[Redacted]",
    planId: "plan_1",
  });
});

test("redacts known PII keys from breadcrumb data", () => {
  const event = {
    breadcrumbs: [
      { category: "ui.click", data: { name: "Yossi", widget: "submit-btn" } },
    ],
  };

  const scrubbed = scrubPii(event);

  expect(scrubbed.breadcrumbs?.[0].data).toMatchObject({
    name: "[Redacted]",
    widget: "submit-btn",
  });
});
