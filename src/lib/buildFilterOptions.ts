interface FilterableRow {
  planType: string;
  supplierName: string;
  supplierLabel: string;
  logoFileName: string;
}

const PLAN_TYPE_ORDER = ["fixed", "day", "night"];

export function buildFilterOptions(
  rows: FilterableRow[],
  common: Record<string, string>,
) {
  const presentPlanTypes = new Set(rows.map((row) => row.planType));
  const planTypes = PLAN_TYPE_ORDER.filter((planType) =>
    presentPlanTypes.has(planType),
  ).map((planType) => ({
    value: planType,
    label: common[`plan_type_${planType}`] ?? planType,
  }));

  const supplierOptions = new Map<
    string,
    { label: string; logoFileName: string }
  >();
  for (const row of rows) {
    if (!supplierOptions.has(row.supplierName)) {
      supplierOptions.set(row.supplierName, {
        label: row.supplierLabel,
        logoFileName: row.logoFileName,
      });
    }
  }
  const suppliers = Array.from(
    supplierOptions,
    ([value, { label, logoFileName }]) => ({ value, label, logoFileName }),
  );

  return { planTypes, suppliers };
}
