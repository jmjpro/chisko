export function sortPlanRowsByDiscountDesc<
  T extends { discountPercent: number },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.discountPercent - a.discountPercent);
}
