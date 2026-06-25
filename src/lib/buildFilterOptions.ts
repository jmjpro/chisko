interface FilterableRow {
  planType: string;
  supplierName: string;
  supplierLabel: string;
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

  const supplierLabels = new Map<string, string>();
  for (const row of rows) {
    if (!supplierLabels.has(row.supplierName)) {
      supplierLabels.set(row.supplierName, row.supplierLabel);
    }
  }
  const suppliers = Array.from(supplierLabels, ([value, label]) => ({
    value,
    label,
  }));

  return { planTypes, suppliers };
}
