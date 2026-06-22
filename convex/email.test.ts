import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import {
  failingFetch,
  okFetch,
  seedSession,
  seedSupplierAndPlan,
} from "./testHelpers.shared";

const modules = import.meta.glob("./**/*.ts");
const RESEND_URL = "https://api.resend.com/emails";

beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "test_key");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test("sendDeliveryNotification emails the lead's details to the configured recipient", async () => {
  const t = convexTest(schema, modules);
  const sessionId = await seedSession(t);
  const { supplierId, planVersionId } = await seedSupplierAndPlan(t);
  const { referralId } = await t.mutation(api.leads.submitLeadForm, {
    sessionId,
    supplierId,
    planVersionId,
    name: "Yossi",
    phone: "0501234567",
    email: "yossi@example.com",
  });

  const fetchMock = okFetch();
  vi.stubGlobal("fetch", fetchMock);

  await t.action(internal.email.sendDeliveryNotification, { referralId });

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe(RESEND_URL);
  const body = JSON.parse(options.body as string);
  expect(body.to).toBe("jmjpro+chisko_form@gmail.com");
  expect(body.text).toContain("Yossi");
  expect(body.text).toContain("0501234567");
  expect(body.text).toContain("yossi@example.com");
  expect(body.text).toContain("Test Supplier");
});

test("sendDeliveryNotification throws when Resend returns an error", async () => {
  const t = convexTest(schema, modules);
  const sessionId = await seedSession(t);
  const { supplierId, planVersionId } = await seedSupplierAndPlan(t);
  const { referralId } = await t.mutation(api.leads.submitLeadForm, {
    sessionId,
    supplierId,
    planVersionId,
    name: "Yossi",
    phone: "0501234567",
    email: null,
  });

  vi.stubGlobal("fetch", failingFetch("invalid recipient"));

  await expect(
    t.action(internal.email.sendDeliveryNotification, { referralId }),
  ).rejects.toThrow(/invalid recipient/);
});
