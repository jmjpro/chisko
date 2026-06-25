import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";

interface FilterOption {
  value: string;
  label: string;
}

interface PlanFilterSortIslandProps {
  locale: string;
  filterOptions: {
    planTypes: FilterOption[];
    suppliers: FilterOption[];
  };
}

function getRowTrees() {
  return [
    document.getElementById("plan-table-body"),
    document.getElementById("plan-card-list"),
  ].filter((el): el is HTMLElement => el !== null);
}

function applyFilter(
  planTypes: Set<string>,
  suppliers: Set<string>,
): { matching: number; total: number } {
  const trees = getRowTrees();
  let matching = 0;
  let total = 0;
  trees.forEach((tree, treeIndex) => {
    const rows = tree.querySelectorAll<HTMLElement>("[data-row-id]");
    if (treeIndex === 0) total = rows.length;
    for (const row of rows) {
      const matchesType =
        planTypes.size === 0 || planTypes.has(row.dataset.planType ?? "");
      const matchesSupplier =
        suppliers.size === 0 || suppliers.has(row.dataset.supplier ?? "");
      const visible = matchesType && matchesSupplier;
      row.classList.toggle("hidden", !visible);
      if (treeIndex === 0 && visible) matching += 1;
    }
  });
  return { matching, total };
}

function toggleInSet(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

type SortField = "discount" | "supplier" | "type";
type SortDirection = "asc" | "desc";

const PLAN_TYPE_ORDER: Record<string, number> = { fixed: 0, day: 1, night: 2 };

const DEFAULT_DIRECTION: Record<SortField, SortDirection> = {
  discount: "desc",
  supplier: "asc",
  type: "asc",
};

function compareRows(field: SortField, a: HTMLElement, b: HTMLElement): number {
  switch (field) {
    case "discount":
      return Number(a.dataset.discount) - Number(b.dataset.discount);
    case "supplier":
      return (a.dataset.supplierLabel ?? "").localeCompare(
        b.dataset.supplierLabel ?? "",
      );
    case "type":
      return (
        (PLAN_TYPE_ORDER[a.dataset.planType ?? ""] ?? 0) -
        (PLAN_TYPE_ORDER[b.dataset.planType ?? ""] ?? 0)
      );
  }
}

function applySort(field: SortField, direction: SortDirection) {
  for (const tree of getRowTrees()) {
    const rows = Array.from(
      tree.querySelectorAll<HTMLElement>("[data-row-id]"),
    );
    rows.sort((a, b) => {
      const cmp = compareRows(field, a, b);
      return direction === "desc" ? -cmp : cmp;
    });
    for (const row of rows) tree.appendChild(row);
  }
}

const SORT_ARROWS: Record<SortDirection, string> = { asc: "↑", desc: "↓" };
const NEUTRAL_SORT_INDICATOR = "↕";

function updateSortIndicators(
  activeField: SortField,
  direction: SortDirection,
) {
  for (const header of document.querySelectorAll<HTMLElement>(
    "[data-sort-field]",
  )) {
    const field = header.dataset.sortField as SortField;
    const isActive = field === activeField;
    const indicator = header.querySelector<HTMLElement>(
      "[data-sort-indicator]",
    );
    if (indicator) {
      indicator.textContent = isActive
        ? SORT_ARROWS[direction]
        : NEUTRAL_SORT_INDICATOR;
      indicator.classList.toggle("text-gray-700", isActive);
      indicator.classList.toggle("text-gray-400", !isActive);
    }
    header
      .closest("th")
      ?.setAttribute(
        "aria-sort",
        isActive ? (direction === "asc" ? "ascending" : "descending") : "none",
      );
  }
}

export default function PlanFilterSortIsland({
  locale,
  filterOptions,
}: PlanFilterSortIslandProps) {
  const { t } = useTranslation("common");

  useEffect(() => {
    void i18n.changeLanguage(locale);
  }, [locale]);

  const [selectedPlanTypes, setSelectedPlanTypes] = useState<Set<string>>(
    new Set(),
  );
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(
    new Set(),
  );
  const [sort, setSort] = useState<{
    field: SortField;
    direction: SortDirection;
  }>({
    field: "discount",
    direction: "desc",
  });
  const [resultCount, setResultCount] = useState({ matching: 0, total: 0 });

  useEffect(() => {
    // Synchronously derives a display-only count from the DOM right after
    // applyFilter toggles row visibility; deferring would flash stale counts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResultCount(applyFilter(selectedPlanTypes, selectedSuppliers));
  }, [selectedPlanTypes, selectedSuppliers]);

  const isEmpty = resultCount.matching === 0 && resultCount.total > 0;

  const clearFilters = () => {
    setSelectedPlanTypes(new Set());
    setSelectedSuppliers(new Set());
  };

  useEffect(() => {
    applySort(sort.field, sort.direction);
    updateSortIndicators(sort.field, sort.direction);
  }, [sort]);

  useEffect(() => {
    const headers = document.querySelectorAll<HTMLElement>("[data-sort-field]");
    const listeners = Array.from(headers).map((header) => {
      const field = header.dataset.sortField as SortField;
      const onClick = () =>
        setSort((prev) =>
          prev.field === field
            ? { field, direction: prev.direction === "desc" ? "asc" : "desc" }
            : { field, direction: DEFAULT_DIRECTION[field] },
        );
      header.addEventListener("click", onClick);
      return { header, onClick };
    });
    return () => {
      for (const { header, onClick } of listeners) {
        header.removeEventListener("click", onClick);
      }
    };
  }, []);

  return (
    <div className="flex flex-col gap-4 mb-6">
      <p className="text-sm text-gray-600">
        {t("filter_result_count", {
          count: resultCount.matching,
          total: resultCount.total,
        })}
      </p>
      <fieldset className="flex flex-wrap items-center gap-3">
        <legend className="font-semibold text-sm mb-1">
          {t("filter_plan_type_label")}
        </legend>
        {filterOptions.planTypes.map((option) => (
          <label
            key={option.value}
            className="flex items-center gap-1.5 text-sm"
          >
            <input
              type="checkbox"
              value={option.value}
              checked={selectedPlanTypes.has(option.value)}
              onChange={() =>
                setSelectedPlanTypes((prev) => toggleInSet(prev, option.value))
              }
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-wrap items-center gap-3">
        <legend className="font-semibold text-sm mb-1">
          {t("filter_supplier_label")}
        </legend>
        {filterOptions.suppliers.map((option) => (
          <label
            key={option.value}
            className="flex items-center gap-1.5 text-sm"
          >
            <input
              type="checkbox"
              value={option.value}
              checked={selectedSuppliers.has(option.value)}
              onChange={() =>
                setSelectedSuppliers((prev) => toggleInSet(prev, option.value))
              }
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <label className="md:hidden flex items-center gap-2 text-sm">
        {t("sort_by_label")}
        <select
          value={sort.field}
          onChange={(event) => {
            const field = event.target.value as SortField;
            setSort({ field, direction: DEFAULT_DIRECTION[field] });
          }}
        >
          <option value="discount">{t("sort_option_discount")}</option>
          <option value="supplier">{t("sort_option_supplier")}</option>
          <option value="type">{t("sort_option_type")}</option>
        </select>
      </label>
      {isEmpty && (
        <div className="flex flex-col items-start gap-2 text-sm text-gray-600">
          <p>{t("filter_empty_state_message")}</p>
          <button type="button" className="underline" onClick={clearFilters}>
            {t("filter_clear_button")}
          </button>
        </div>
      )}
    </div>
  );
}
