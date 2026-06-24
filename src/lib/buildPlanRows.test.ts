import { describe, it, expect } from "vitest";
import { buildPlanRows } from "./buildPlanRows";

const common = {
  all_day: "24/7",
  no: "No",
  yes: "Yes",
  all_week: "All week",
  plan_type_fixed: "Fixed",
  plan_type_day: "Day",
};
const suppliers = { "Bezek Electricity": "Bezek Electricity Co." };
const plans = { "Bezek Day": "Bezek Day Plan" };

function row(overrides: Partial<Parameters<typeof buildPlanRows>[0][number]>) {
  return {
    pvId: "pv1",
    supplierId: "s1",
    supplierName: "Bezek Electricity",
    supportedHandoffTypes: [],
    planName: "Bezek Day",
    planType: "day",
    discountPercent: 15,
    discountWindowStartHour: 7,
    discountWindowEndHour: 17,
    weekdayWindowOnly: true,
    ...overrides,
  };
}

describe("buildPlanRows", () => {
  it("computes window and weekdayOnly for a day/night plan within a discount window", () => {
    const [result] = buildPlanRows([row({})], common, suppliers, plans);
    expect(result.window).toBe("07:00–17:00");
    expect(result.weekdayOnly).toBe("Yes");
  });

  it("a fixed plan always shows 24/7 window and No for weekday-only, regardless of stored hours", () => {
    const [result] = buildPlanRows(
      [
        row({
          planType: "fixed",
          discountWindowStartHour: null,
          discountWindowEndHour: null,
          weekdayWindowOnly: false,
        }),
      ],
      common,
      suppliers,
      plans,
    );
    expect(result.window).toBe("24/7");
    expect(result.weekdayOnly).toBe("No");
  });

  it("a non-fixed plan with no weekday restriction shows 'all week'", () => {
    const [result] = buildPlanRows(
      [row({ weekdayWindowOnly: false })],
      common,
      suppliers,
      plans,
    );
    expect(result.weekdayOnly).toBe("All week");
  });

  it("resolves supplier, plan, and type labels from the translation catalogs", () => {
    const [result] = buildPlanRows([row({})], common, suppliers, plans);
    expect(result.supplierLabel).toBe("Bezek Electricity Co.");
    expect(result.planLabel).toBe("Bezek Day Plan");
    expect(result.typeLabel).toBe("Day");
  });

  it("falls back to the raw name when a supplier or plan is missing from the catalog", () => {
    const [result] = buildPlanRows(
      [row({ supplierName: "Unknown Co", planName: "Mystery Plan" })],
      common,
      suppliers,
      plans,
    );
    expect(result.supplierLabel).toBe("Unknown Co");
    expect(result.planLabel).toBe("Mystery Plan");
  });
});
