import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "../../../convex/_generated/dataModel";
import ResultsStep, { type ResultsStepProps } from "./ResultsStep";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}|${JSON.stringify(opts)}` : key,
    i18n: { language: "en" },
  }),
}));

const { mockSubmitLeadForm, mockConfirmSupplierFanOut, mockConvexQuery } =
  vi.hoisted(() => ({
    mockSubmitLeadForm: vi.fn(),
    mockConfirmSupplierFanOut: vi.fn(),
    mockConvexQuery: vi.fn(),
  }));

vi.mock("convex/react", async () => {
  const { api } = await import("../../../convex/_generated/api");
  const { getFunctionName } = await import("convex/server");
  return {
    useMutation: (ref: unknown) => {
      const name = getFunctionName(
        ref as Parameters<typeof getFunctionName>[0],
      );
      if (name === getFunctionName(api.leads.submitLeadForm))
        return mockSubmitLeadForm;
      if (name === getFunctionName(api.leads.confirmSupplierFanOut))
        return mockConfirmSupplierFanOut;
      throw new Error(`unexpected mutation ref in test: ${name}`);
    },
    useConvex: () => ({ query: mockConvexQuery }),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mockConvexQuery.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

const sessionId = "session1" as Id<"sessions">;
const recommendationId = "rec1" as Id<"recommendations">;
const primaryPlanVersionId = "pv1" as Id<"planVersions">;
const primarySupplierId = "supplier1" as Id<"suppliers">;

function baseProps(
  overrides: Partial<ResultsStepProps> = {},
): ResultsStepProps {
  const homeFields = {
    placeOfResidence: null,
    setPlaceOfResidence: vi.fn(),
    cascadeCityCode: null,
    supplierSelectValue: "iec",
    onSupplierChange: vi.fn(),
    suppliers: [],
    bundleMemberships: [],
    toggleMembership: vi.fn(),
    clearMemberships: vi.fn(),
    israelPlaces: [],
    currentSupplierId: null,
    currentPlanId: null,
    onCurrentPlanChange: vi.fn(),
    plansForCurrentSupplier: undefined,
  };
  const usageFields = {
    workFromHome: "sometimes" as const,
    setWorkFromHome: vi.fn(),
    hasEv: false,
    setHasEv: vi.fn(),
    evChargingTime: null,
    setEvChargingTime: vi.fn(),
    washerDryerTime: null,
    setWasherDryerTime: vi.fn(),
    acUsageLevel: "moderate" as const,
    setAcUsageLevel: vi.fn(),
    willingToShiftUsage: true,
    setWillingToShiftUsage: vi.fn(),
    willingToAcceptOffBillBenefits: true,
    setWillingToAcceptOffBillBenefits: vi.fn(),
  };

  return {
    sessionId,
    rec: {
      _id: recommendationId,
      primaryPlanVersionId,
      primaryAnnualSavingsAgorot: 100000,
      noChangePlanVersionId: null,
      noChangePlanAnnualSavingsAgorot: 0,
      showNoChangeSeparately: false,
      confidenceLevel: "high",
      assumptions: "[]",
      baselineAnnualCostAgorot: 500000,
    },
    evaluatedPlans: [
      {
        planVersionId: primaryPlanVersionId,
        isEligible: true,
        annualSavingsAgorot: 100000,
        supplier: {
          _id: primarySupplierId,
          name: "Acme Energy",
          logoFileName: "acme.webp",
        },
        plan: { name: "Acme Fixed", planType: "fixed" },
        planVersion: {
          discountPercent: 7,
          weekdayWindowOnly: false,
          benefitDelivery: "billDiscount",
        },
      },
    ],
    generating: false,
    resultError: null,
    noChangeNotice: false,
    onRecalculate: vi.fn(),
    effectiveHasSmartMeter: null,
    onFileUpload: vi.fn(),
    uploadLoading: false,
    billImportId: null,
    uploadError: null,
    setUploadError: vi.fn(),
    homeFields,
    usageFields,
    ...overrides,
  };
}

const rec: ResultsStepProps["rec"] = {
  _id: "rec1" as Id<"recommendations">,
  primaryPlanVersionId: "pv1" as Id<"planVersions">,
  primaryAnnualSavingsAgorot: 5000,
  noChangePlanVersionId: "pv1" as Id<"planVersions">,
  noChangePlanAnnualSavingsAgorot: 5000,
  showNoChangeSeparately: false,
  confidenceLevel: "high",
  assumptions: "[]",
  baselineAnnualCostAgorot: 100_000,
};

describe("ResultsStep recalculate flicker", () => {
  it("keeps showing the loading state while evaluatedPlans re-subscribes after rec changes, instead of dropping the card", () => {
    render(
      <ResultsStep
        {...baseProps({ rec, evaluatedPlans: undefined, generating: false })}
      />,
    );

    expect(screen.getByText("result_loading")).toBeInTheDocument();
  });

  it("renders the primary plan card once both rec and evaluatedPlans have settled", () => {
    render(
      <ResultsStep
        {...baseProps({
          rec,
          evaluatedPlans: [
            {
              planVersionId: rec.primaryPlanVersionId,
              isEligible: true,
              annualSavingsAgorot: 5000,
              supplier: { name: "Acme Power", logoFileName: "acme.webp" },
              plan: { name: "Acme Fixed", planType: "fixed" },
              planVersion: {
                discountPercent: 7,
                weekdayWindowOnly: false,
              },
            },
          ],
          generating: false,
        })}
      />,
    );

    expect(screen.queryByText("result_loading")).not.toBeInTheDocument();
    expect(screen.getByText(/Acme Power/)).toBeInTheDocument();
  });

  it("renders the supplier logo inline before the supplier — plan line on the recommendation card", () => {
    render(
      <ResultsStep
        {...baseProps({
          rec,
          evaluatedPlans: [
            {
              planVersionId: rec.primaryPlanVersionId,
              isEligible: true,
              annualSavingsAgorot: 5000,
              supplier: { name: "Acme Power", logoFileName: "acme.webp" },
              plan: { name: "Acme Fixed", planType: "fixed" },
              planVersion: {
                discountPercent: 7,
                weekdayWindowOnly: false,
              },
            },
          ],
          generating: false,
        })}
      />,
    );

    const logo = screen.getByAltText("Acme Power");
    expect(logo).toHaveAttribute("src", "/suppliers/acme.webp");
    expect(logo).toHaveAttribute("loading", "lazy");
    expect(logo).toHaveAttribute("width", "48");
    expect(logo).toHaveAttribute("height", "48");
    expect(logo.compareDocumentPosition(screen.getByText(/Acme Power/))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});

describe("ResultsStep recalculate no-effect notice", () => {
  it("shows a notice when recalculating produced the same recommendation", () => {
    render(<ResultsStep {...baseProps({ rec, noChangeNotice: true })} />);

    expect(screen.getByText("recalculate_no_effect")).toBeInTheDocument();
  });

  it("does not show the notice by default", () => {
    render(<ResultsStep {...baseProps({ rec })} />);

    expect(screen.queryByText("recalculate_no_effect")).not.toBeInTheDocument();
  });
});

describe("ResultsStep — leave-details CTA wiring", () => {
  it("opens the lead-capture dialog wired to the clicked card's supplier and plan", async () => {
    render(<ResultsStep {...baseProps()} />);

    await userEvent.click(screen.getByText("cta_leave_details"));

    expect(await screen.findByText("lead_form_title")).toBeInTheDocument();

    mockSubmitLeadForm.mockResolvedValue({
      leadId: "lead1" as Id<"leads">,
      referralId: "referral1" as Id<"referrals">,
    });
    await userEvent.type(
      screen.getByLabelText("lead_form_name_label"),
      "Yossi",
    );
    await userEvent.type(
      screen.getByLabelText("lead_form_phone_label"),
      "0501234567",
    );
    await userEvent.click(screen.getByText("lead_form_submit"));

    expect(mockSubmitLeadForm).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId,
        recommendationId,
        supplierId: primarySupplierId,
        planVersionId: primaryPlanVersionId,
      }),
    );
  });
});

describe("ResultsStep — Chiski mascot", () => {
  it("shows the mascot on the Primary Recommendation card", () => {
    render(<ResultsStep {...baseProps()} />);

    expect(screen.getByRole("img", { name: /Chiski/i })).toBeInTheDocument();
  });

  it("does not show the mascot on Alternative Recommendation cards", async () => {
    const altPlanVersionId = "pv2" as Id<"planVersions">;
    render(
      <ResultsStep
        {...baseProps({
          evaluatedPlans: [
            {
              planVersionId: primaryPlanVersionId,
              isEligible: true,
              annualSavingsAgorot: 100000,
              supplier: {
                _id: primarySupplierId,
                name: "Acme Energy",
                logoFileName: "acme.webp",
              },
              plan: { name: "Acme Fixed", planType: "fixed" },
              planVersion: { discountPercent: 7, weekdayWindowOnly: false },
            },
            {
              planVersionId: altPlanVersionId,
              isEligible: true,
              annualSavingsAgorot: 80000,
              supplier: {
                _id: "supplier2" as Id<"suppliers">,
                name: "Beta Power",
                logoFileName: "beta.webp",
              },
              plan: { name: "Beta Fixed", planType: "fixed" },
              planVersion: { discountPercent: 5, weekdayWindowOnly: false },
            },
          ],
        })}
      />,
    );

    await userEvent.click(screen.getByText(/show_more_options/));

    expect(screen.getAllByRole("img", { name: /Chiski/i })).toHaveLength(1);
  });
});

describe("ResultsStep — CTA order", () => {
  it("renders Leave Details before Switch without an Agent on the primary card", () => {
    render(
      <ResultsStep
        {...baseProps({
          evaluatedPlans: [
            {
              planVersionId: primaryPlanVersionId,
              isEligible: true,
              annualSavingsAgorot: 100000,
              supplier: {
                _id: primarySupplierId,
                name: "Acme Energy",
                logoFileName: "acme.webp",
                supportedHandoffTypes: ["clickThrough", "formHandoff"],
              },
              plan: { name: "Acme Fixed", planType: "fixed" },
              planVersion: { discountPercent: 7, weekdayWindowOnly: false },
            },
          ],
        })}
      />,
    );

    const leaveDetails = screen.getByText("cta_leave_details");
    const switchWithout = screen.getByRole("button", {
      name: /cta_click_through/,
    });
    expect(leaveDetails.compareDocumentPosition(switchWithout)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("renders Leave Details before Switch without an Agent on Alternative Recommendation cards", async () => {
    const altPlanVersionId = "pv2" as Id<"planVersions">;
    render(
      <ResultsStep
        {...baseProps({
          evaluatedPlans: [
            {
              planVersionId: primaryPlanVersionId,
              isEligible: true,
              annualSavingsAgorot: 100000,
              supplier: {
                _id: primarySupplierId,
                name: "Acme Energy",
                logoFileName: "acme.webp",
                supportedHandoffTypes: ["clickThrough", "formHandoff"],
              },
              plan: { name: "Acme Fixed", planType: "fixed" },
              planVersion: { discountPercent: 7, weekdayWindowOnly: false },
            },
            {
              planVersionId: altPlanVersionId,
              isEligible: true,
              annualSavingsAgorot: 80000,
              supplier: {
                _id: "supplier2" as Id<"suppliers">,
                name: "Beta Power",
                logoFileName: "beta.webp",
                supportedHandoffTypes: ["clickThrough", "formHandoff"],
              },
              plan: { name: "Beta Fixed", planType: "fixed" },
              planVersion: { discountPercent: 5, weekdayWindowOnly: false },
            },
          ],
        })}
      />,
    );

    await userEvent.click(screen.getByText(/show_more_options/));

    const [, altLeaveDetails] = screen.getAllByText("cta_leave_details");
    const [, altSwitchWithout] = screen.getAllByRole("button", {
      name: /cta_click_through/,
    });
    expect(altLeaveDetails.compareDocumentPosition(altSwitchWithout)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});

describe("ResultsStep — click-through CTA", () => {
  it("shows the click-through CTA alongside Leave Details when the supplier supports clickThrough", () => {
    render(
      <ResultsStep
        {...baseProps({
          evaluatedPlans: [
            {
              planVersionId: primaryPlanVersionId,
              isEligible: true,
              annualSavingsAgorot: 100000,
              supplier: {
                _id: primarySupplierId,
                name: "Acme Energy",
                logoFileName: "acme.webp",
                supportedHandoffTypes: ["clickThrough", "formHandoff"],
              },
              plan: { name: "Acme Fixed", planType: "fixed" },
              planVersion: {
                discountPercent: 7,
                weekdayWindowOnly: false,
                benefitDelivery: "billDiscount",
              },
            },
          ],
        })}
      />,
    );

    const cta = screen.getByRole("button", { name: /cta_click_through/ });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute(
      "href",
      `/out/${primarySupplierId}/${primaryPlanVersionId}?sessionId=${sessionId}`,
    );
    expect(screen.getByText("cta_leave_details")).toBeInTheDocument();
  });

  it("does not show the click-through CTA when the supplier doesn't support clickThrough", () => {
    render(<ResultsStep {...baseProps()} />);

    expect(
      screen.queryByRole("button", { name: /cta_click_through/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("cta_leave_details")).toBeInTheDocument();
  });
});
