interface PlanRow {
  planType: string;
  discountWindowStartHour: number | null;
  discountWindowEndHour: number | null;
  weekdayWindowOnly: boolean;
  supplierName: string;
  planName: string;
}

function formatHour(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

export function buildPlanRows<T extends PlanRow>(
  rows: T[],
  common: Record<string, string>,
  suppliers: Record<string, string>,
  plans: Record<string, string>,
) {
  return rows.map((row) => {
    const isFixed = row.planType === "fixed";
    const window =
      !isFixed &&
      row.discountWindowStartHour !== null &&
      row.discountWindowEndHour !== null
        ? `${formatHour(row.discountWindowStartHour)}–${formatHour(row.discountWindowEndHour)}`
        : common.all_day;
    const weekdayOnly = isFixed
      ? common.no
      : row.weekdayWindowOnly
        ? common.yes
        : common.all_week;
    return {
      ...row,
      window,
      weekdayOnly,
      supplierLabel: suppliers[row.supplierName] ?? row.supplierName,
      planLabel: plans[row.planName] ?? row.planName,
      typeLabel: common[`plan_type_${row.planType}`] ?? row.planType,
    };
  });
}
