import { describe, it, expect } from "vitest";
import { sortPlanRowsByDiscountDesc } from "./sortPlanRows";

function row(discountPercent: number) {
  return { discountPercent };
}

describe("sortPlanRowsByDiscountDesc", () => {
  it("orders rows from highest discount to lowest", () => {
    const rows = [row(5), row(20), row(10)];

    const result = sortPlanRowsByDiscountDesc(rows);

    expect(result.map((r) => r.discountPercent)).toEqual([20, 10, 5]);
  });
});
