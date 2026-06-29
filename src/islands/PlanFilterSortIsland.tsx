import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Select } from "@base-ui/react/select";
import { ChevronDown } from "lucide-react";
import { MultiSelectMenu } from "../components/ui/multiSelectMenu";
import i18n from "../i18n";

interface FilterOption {
  value: string;
  label: string;
}

interface SupplierFilterOption extends FilterOption {
  logoFileName: string;
}

interface PlanFilterSortIslandProps {
  locale: string;
  filterOptions: {
    planTypes: FilterOption[];
    suppliers: SupplierFilterOption[];
  };
}

function getRowContainer() {
  return document.getElementById("plan-rows");
}

function applyFilter(
  planTypes: Set<string>,
  suppliers: Set<string>,
): { matching: number; total: number } {
  const container = getRowContainer();
  if (!container) return { matching: 0, total: 0 };
  const rows = container.querySelectorAll<HTMLElement>("[data-row-id]");
  let matching = 0;
  for (const row of rows) {
    const matchesType =
      planTypes.size === 0 || planTypes.has(row.dataset.planType ?? "");
    const matchesSupplier =
      suppliers.size === 0 || suppliers.has(row.dataset.supplier ?? "");
    const visible = matchesType && matchesSupplier;
    row.classList.toggle("hidden", !visible);
    if (visible) matching += 1;
  }
  return { matching, total: rows.length };
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
  const container = getRowContainer();
  if (!container) return;
  const rows = Array.from(
    container.querySelectorAll<HTMLElement>("[data-row-id]"),
  );
  rows.sort((a, b) => {
    const cmp = compareRows(field, a, b);
    return direction === "desc" ? -cmp : cmp;
  });
  for (const row of rows) container.appendChild(row);
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
      .closest('[role="columnheader"]')
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
    () => new Set(filterOptions.planTypes.map((o) => o.value)),
  );
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(
    () => new Set(filterOptions.suppliers.map((o) => o.value)),
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
    setSelectedPlanTypes(new Set(filterOptions.planTypes.map((o) => o.value)));
    setSelectedSuppliers(new Set(filterOptions.suppliers.map((o) => o.value)));
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

  const supplierOptions = filterOptions.suppliers.map((o) => ({
    value: o.value,
    label: o.label,
    icon: (
      <img
        src={`/suppliers/${o.logoFileName}`}
        alt=""
        loading="lazy"
        width={32}
        height={32}
        className="h-8 w-8 object-contain"
      />
    ),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <MultiSelectMenu
          label={t("filter_plan_type_label")}
          options={filterOptions.planTypes}
          selected={selectedPlanTypes}
          onSelectedChange={setSelectedPlanTypes}
        />
        <MultiSelectMenu
          label={t("filter_supplier_label")}
          options={supplierOptions}
          selected={selectedSuppliers}
          onSelectedChange={setSelectedSuppliers}
        />
        <p className="text-sm text-gray-600 ms-auto">
          {t("filter_result_count", {
            count: resultCount.matching,
            total: resultCount.total,
          })}
        </p>
      </div>
      <div className="md:hidden">
        <Select.Root
          value={sort.field}
          onValueChange={(field: SortField) =>
            setSort({ field, direction: DEFAULT_DIRECTION[field] })
          }
        >
          <Select.Trigger className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-input rounded-md bg-background hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
            <span className="font-semibold">{t("sort_by_label")}</span>
            <span>{t(`sort_option_${sort.field}`)}</span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner sideOffset={4} align="start">
              <Select.Popup className="z-50 min-w-[160px] rounded-md border border-border bg-background py-1 shadow-md outline-none">
                <Select.List>
                  <Select.Item
                    value="discount"
                    className="flex cursor-default select-none items-center px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted"
                  >
                    <Select.ItemText>
                      {t("sort_option_discount")}
                    </Select.ItemText>
                  </Select.Item>
                  <Select.Item
                    value="supplier"
                    className="flex cursor-default select-none items-center px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted"
                  >
                    <Select.ItemText>
                      {t("sort_option_supplier")}
                    </Select.ItemText>
                  </Select.Item>
                  <Select.Item
                    value="type"
                    className="flex cursor-default select-none items-center px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted"
                  >
                    <Select.ItemText>{t("sort_option_type")}</Select.ItemText>
                  </Select.Item>
                </Select.List>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      </div>
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
