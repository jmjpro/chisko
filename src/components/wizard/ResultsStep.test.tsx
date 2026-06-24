import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ResultsStep, { type ResultsStepProps } from "./ResultsStep";
import type { Id } from "../../../convex/_generated/dataModel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}|${JSON.stringify(opts)}` : key,
    i18n: { language: "en" },
  }),
}));

function baseProps(
  overrides: Partial<ResultsStepProps> = {},
): ResultsStepProps {
  return {
    rec: undefined,
    evaluatedPlans: undefined,
    generating: false,
    resultError: null,
    noChangeNotice: false,
    onRecalculate: vi.fn(),
    effectiveHasSmartMeter: "no",
    onFileUpload: vi.fn(),
    uploadLoading: false,
    billImportId: null,
    uploadError: null,
    setUploadError: vi.fn(),
    homeFields: {
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
    },
    usageFields: {
      workFromHome: "sometimes",
      setWorkFromHome: vi.fn(),
      hasEv: false,
      setHasEv: vi.fn(),
      evChargingTime: null,
      setEvChargingTime: vi.fn(),
      washerDryerTime: null,
      setWasherDryerTime: vi.fn(),
      acUsageLevel: "moderate",
      setAcUsageLevel: vi.fn(),
      willingToShiftUsage: false,
      setWillingToShiftUsage: vi.fn(),
      willingToAcceptOffBillBenefits: true,
      setWillingToAcceptOffBillBenefits: vi.fn(),
    },
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
              supplier: { name: "Acme Power" },
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
