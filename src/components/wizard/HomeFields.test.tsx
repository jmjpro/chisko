import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HomeFields, { type HomeFieldsProps } from "./HomeFields";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}|${JSON.stringify(opts)}` : key,
    i18n: { language: "en" },
  }),
}));

function baseProps(overrides: Partial<HomeFieldsProps> = {}): HomeFieldsProps {
  return {
    placeOfResidence: null,
    setPlaceOfResidence: vi.fn(),
    cascadeCityCode: null,
    supplierSelectValue: "iec",
    onSupplierChange: vi.fn(),
    suppliers: [{ _id: "supplier1", name: "Acme Power" }],
    bundleMemberships: [],
    toggleMembership: vi.fn(),
    clearMemberships: vi.fn(),
    israelPlaces: [],
    currentSupplierId: null,
    currentPlanId: null,
    onCurrentPlanChange: vi.fn(),
    plansForCurrentSupplier: undefined,
    ...overrides,
  };
}

describe("HomeFields current-plan picker", () => {
  it("does not show a plan picker when no real supplier is selected", () => {
    render(<HomeFields {...baseProps({ currentSupplierId: null })} />);

    expect(screen.queryByText("current_plan_title")).not.toBeInTheDocument();
  });

  it("shows the plan picker, listing the selected supplier's plans plus a skip option, once a real supplier is selected", () => {
    render(
      <HomeFields
        {...baseProps({
          currentSupplierId: "supplier1",
          plansForCurrentSupplier: [
            { _id: "plan1", name: "Acme Fixed", planType: "fixed" },
            { _id: "plan2", name: "Acme Night", planType: "night" },
          ],
        })}
      />,
    );

    expect(screen.getByText("current_plan_title")).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Acme Fixed" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Acme Night" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "current_plan_skip" }),
    ).toBeInTheDocument();
  });

  it("calls onCurrentPlanChange with the selected plan id", async () => {
    const onCurrentPlanChange = vi.fn();
    render(
      <HomeFields
        {...baseProps({
          currentSupplierId: "supplier1",
          plansForCurrentSupplier: [
            { _id: "plan1", name: "Acme Fixed", planType: "fixed" },
          ],
          onCurrentPlanChange,
        })}
      />,
    );

    await userEvent.selectOptions(
      screen.getByLabelText("current_plan_title"),
      "plan1",
    );

    expect(onCurrentPlanChange).toHaveBeenCalledWith("plan1");
  });

  it("reveals the explanation text when the explanation toggle is activated", async () => {
    render(
      <HomeFields
        {...baseProps({
          currentSupplierId: "supplier1",
          plansForCurrentSupplier: [],
        })}
      />,
    );

    expect(
      screen.queryByText("current_plan_explanation"),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "current_plan_explanation_toggle" }),
    );

    expect(screen.getByText("current_plan_explanation")).toBeInTheDocument();
  });
});
