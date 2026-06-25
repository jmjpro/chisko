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

const { mockSendMail } = vi.hoisted(() => ({
  mockSendMail: vi.fn().mockResolvedValue({ messageId: "smtp_test_id" }),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail: mockSendMail })),
  },
}));

const modules = import.meta.glob("./**/*.ts");
const RESEND_URL = "https://api.resend.com/emails";

beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "test_key");
  mockSendMail.mockClear();
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

test("sendDeliveryNotification sends via SMTP when LOCAL_SMTP_HOST is set", async () => {
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

  vi.unstubAllEnvs();
  vi.stubEnv("LOCAL_SMTP_HOST", "localhost");
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  await t.action(internal.email.sendDeliveryNotification, { referralId });

  expect(fetchMock).not.toHaveBeenCalled();
  expect(mockSendMail).toHaveBeenCalledTimes(1);
  const mail = mockSendMail.mock.calls[0][0];
  expect(mail.to).toBe("jmjpro+chisko_form@gmail.com");
  expect(mail.text).toContain("Yossi");
  expect(mail.text).toContain("0501234567");
  expect(mail.text).toContain("yossi@example.com");
  expect(mail.text).toContain("Test Supplier");
});

test("sendDeliveryNotification logs an error and no-ops when neither LOCAL_SMTP_HOST nor RESEND_API_KEY is set", async () => {
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

  vi.unstubAllEnvs();
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  await t.action(internal.email.sendDeliveryNotification, { referralId });

  expect(fetchMock).not.toHaveBeenCalled();
  expect(mockSendMail).not.toHaveBeenCalled();
  expect(errorSpy).toHaveBeenCalledWith(
    expect.stringContaining("LOCAL_SMTP_HOST"),
  );
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
