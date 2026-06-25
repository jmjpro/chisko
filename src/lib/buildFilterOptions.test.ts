import { describe, it, expect } from "vitest";
import { buildFilterOptions } from "./buildFilterOptions";

const common = {
  plan_type_fixed: "Fixed",
  plan_type_day: "Day",
  plan_type_night: "Night",
};

function row(planType: string, supplierName: string, supplierLabel: string) {
  return { planType, supplierName, supplierLabel };
}

describe("buildFilterOptions", () => {
  it("lists only the plan types present in the rows, in canonical Fixed/Day/Night order regardless of input order", () => {
    const rows = [
      row("night", "s1", "Supplier One"),
      row("fixed", "s1", "Supplier One"),
    ];

    const result = buildFilterOptions(rows, common);

    expect(result.planTypes).toEqual([
      { value: "fixed", label: "Fixed" },
      { value: "night", label: "Night" },
    ]);
  });

  it("dedupes suppliers by name, keeping the first-seen display label", () => {
    const rows = [
      row("fixed", "s1", "Supplier One"),
      row("day", "s1", "Supplier One"),
      row("night", "s2", "Supplier Two"),
    ];

    const result = buildFilterOptions(rows, common);

    expect(result.suppliers).toEqual([
      { value: "s1", label: "Supplier One" },
      { value: "s2", label: "Supplier Two" },
    ]);
  });
});
