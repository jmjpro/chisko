import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PlanFilterSortIsland from "./PlanFilterSortIsland";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}|${JSON.stringify(opts)}` : key,
    i18n: { language: "en" },
  }),
}));

const { changeLanguageMock } = vi.hoisted(() => ({
  changeLanguageMock: vi.fn(),
}));

vi.mock("../i18n", () => ({
  default: { changeLanguage: changeLanguageMock },
}));

function baseFilterOptions() {
  return {
    planTypes: [
      { value: "fixed", label: "Fixed" },
      { value: "day", label: "Day" },
      { value: "night", label: "Night" },
    ],
    suppliers: [
      { value: "Bezek Electricity", label: "Bezek Electricity Co." },
      { value: "Acme Power", label: "Acme Power" },
    ],
  };
}

const mountedFixtures: HTMLElement[] = [];

function mountRowFixtures() {
  const fixture = document.createElement("div");
  fixture.innerHTML = `
    <table>
      <tbody id="plan-table-body">
        <tr data-row-id="pv1" data-plan-type="fixed" data-supplier="Bezek Electricity" data-discount="10"></tr>
        <tr data-row-id="pv2" data-plan-type="day" data-supplier="Acme Power" data-discount="20"></tr>
      </tbody>
    </table>
    <div id="plan-card-list">
      <div data-row-id="pv1" data-plan-type="fixed" data-supplier="Bezek Electricity" data-discount="10"></div>
      <div data-row-id="pv2" data-plan-type="day" data-supplier="Acme Power" data-discount="20"></div>
    </div>
  `;
  document.body.appendChild(fixture);
  mountedFixtures.push(fixture);
  return fixture;
}

function mountSortFixtures() {
  const fixture = document.createElement("div");
  fixture.innerHTML = `
    <table>
      <thead>
        <tr>
          <th aria-sort="none"><button data-sort-field="discount">discount<span data-sort-indicator>↕</span></button></th>
          <th aria-sort="none"><button data-sort-field="supplier">supplier<span data-sort-indicator>↕</span></button></th>
          <th aria-sort="none"><button data-sort-field="type">type<span data-sort-indicator>↕</span></button></th>
        </tr>
      </thead>
    </table>
    <table>
      <tbody id="plan-table-body">
        <tr data-row-id="night" data-plan-type="night" data-supplier-label="Zeta Co" data-discount="30"></tr>
        <tr data-row-id="fixed" data-plan-type="fixed" data-supplier-label="Alpha Co" data-discount="10"></tr>
        <tr data-row-id="day" data-plan-type="day" data-supplier-label="Mid Co" data-discount="20"></tr>
      </tbody>
    </table>
    <div id="plan-card-list">
      <div data-row-id="night" data-plan-type="night" data-supplier-label="Zeta Co" data-discount="30"></div>
      <div data-row-id="fixed" data-plan-type="fixed" data-supplier-label="Alpha Co" data-discount="10"></div>
      <div data-row-id="day" data-plan-type="day" data-supplier-label="Mid Co" data-discount="20"></div>
    </div>
  `;
  document.body.appendChild(fixture);
  mountedFixtures.push(fixture);
  return fixture;
}

function rowIdsOf(containerId: string) {
  return Array.from(
    document.querySelectorAll(`#${containerId} [data-row-id]`),
  ).map((el) => (el as HTMLElement).dataset.rowId);
}

describe("PlanFilterSortIsland", () => {
  it("switches the shared i18n instance to the locale passed in via props, so it doesn't race other islands for the active language", () => {
    render(
      <PlanFilterSortIsland locale="ar" filterOptions={baseFilterOptions()} />,
    );

    expect(changeLanguageMock).toHaveBeenCalledWith("ar");
  });

  afterEach(() => {
    while (mountedFixtures.length > 0) {
      mountedFixtures.pop()?.remove();
    }
  });

  it("renders a checkbox for every plan type and every supplier option", () => {
    render(
      <PlanFilterSortIsland locale="en" filterOptions={baseFilterOptions()} />,
    );

    expect(screen.getByRole("checkbox", { name: "Fixed" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Day" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Night" })).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Bezek Electricity Co." }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Acme Power" }),
    ).toBeInTheDocument();
  });

  it("renders a mobile sort-by select listing discount, supplier, and plan type", () => {
    render(
      <PlanFilterSortIsland locale="en" filterOptions={baseFilterOptions()} />,
    );

    const select = screen.getByLabelText("sort_by_label");
    expect(select).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "sort_option_discount" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "sort_option_supplier" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "sort_option_type" }),
    ).toBeInTheDocument();
  });

  it("checking a plan-type checkbox hides non-matching rows in both the table and card-list trees, leaving matching rows visible", async () => {
    mountRowFixtures();
    render(
      <PlanFilterSortIsland locale="en" filterOptions={baseFilterOptions()} />,
    );

    await userEvent.click(screen.getByRole("checkbox", { name: "Fixed" }));

    const tableFixedRow = document.querySelector(
      '#plan-table-body [data-row-id="pv1"]',
    );
    const tableDayRow = document.querySelector(
      '#plan-table-body [data-row-id="pv2"]',
    );
    const cardFixedRow = document.querySelector(
      '#plan-card-list [data-row-id="pv1"]',
    );
    const cardDayRow = document.querySelector(
      '#plan-card-list [data-row-id="pv2"]',
    );

    expect(tableFixedRow).not.toHaveClass("hidden");
    expect(cardFixedRow).not.toHaveClass("hidden");
    expect(tableDayRow).toHaveClass("hidden");
    expect(cardDayRow).toHaveClass("hidden");
  });

  it("unions multiple checked values within the same facet, but intersects across facets", async () => {
    mountRowFixtures();
    render(
      <PlanFilterSortIsland locale="en" filterOptions={baseFilterOptions()} />,
    );

    await userEvent.click(screen.getByRole("checkbox", { name: "Fixed" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Day" }));

    expect(
      document.querySelector('#plan-table-body [data-row-id="pv1"]'),
    ).not.toHaveClass("hidden");
    expect(
      document.querySelector('#plan-table-body [data-row-id="pv2"]'),
    ).not.toHaveClass("hidden");

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Bezek Electricity Co." }),
    );

    expect(
      document.querySelector('#plan-table-body [data-row-id="pv1"]'),
    ).not.toHaveClass("hidden");
    expect(
      document.querySelector('#plan-table-body [data-row-id="pv2"]'),
    ).toHaveClass("hidden");
  });

  it("selecting Plan Type from the mobile sort-by select reorders both DOM trees using the canonical Fixed/Day/Night order", async () => {
    mountSortFixtures();
    render(
      <PlanFilterSortIsland locale="en" filterOptions={baseFilterOptions()} />,
    );

    await userEvent.selectOptions(
      screen.getByLabelText("sort_by_label"),
      "type",
    );

    expect(rowIdsOf("plan-table-body")).toEqual(["fixed", "day", "night"]);
    expect(rowIdsOf("plan-card-list")).toEqual(["fixed", "day", "night"]);
  });

  it("clicking a desktop sort header sorts by that field's natural default direction first, then toggles on a second click", async () => {
    mountSortFixtures();
    render(
      <PlanFilterSortIsland locale="en" filterOptions={baseFilterOptions()} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /^supplier/ }));
    expect(rowIdsOf("plan-table-body")).toEqual(["fixed", "day", "night"]);

    await userEvent.click(screen.getByRole("button", { name: /^supplier/ }));
    expect(rowIdsOf("plan-table-body")).toEqual(["night", "day", "fixed"]);
  });

  it("shows a directional arrow on the active sort header and a neutral indicator on the others, flipping the arrow on toggle", async () => {
    mountSortFixtures();
    render(
      <PlanFilterSortIsland locale="en" filterOptions={baseFilterOptions()} />,
    );
    const supplierHeader = screen.getByRole("button", { name: /^supplier/ });
    const typeHeader = screen.getByRole("button", { name: /^type/ });

    await userEvent.click(supplierHeader);

    expect(
      supplierHeader.querySelector("[data-sort-indicator]"),
    ).toHaveTextContent("↑");
    expect(supplierHeader.closest("th")).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    expect(typeHeader.querySelector("[data-sort-indicator]")).toHaveTextContent(
      "↕",
    );
    expect(typeHeader.closest("th")).toHaveAttribute("aria-sort", "none");

    await userEvent.click(supplierHeader);

    expect(
      supplierHeader.querySelector("[data-sort-indicator]"),
    ).toHaveTextContent("↓");
    expect(supplierHeader.closest("th")).toHaveAttribute(
      "aria-sort",
      "descending",
    );
  });

  it("shows the count of rows currently matching the filter out of the total, updating as filters change", async () => {
    mountRowFixtures();
    render(
      <PlanFilterSortIsland locale="en" filterOptions={baseFilterOptions()} />,
    );

    expect(
      screen.getByText('filter_result_count|{"count":2,"total":2}'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "Fixed" }));

    expect(
      screen.getByText('filter_result_count|{"count":1,"total":2}'),
    ).toBeInTheDocument();
  });

  it("shows an empty-state message with a clear-filters control when the filter combination matches no rows, and clearing restores all rows", async () => {
    mountRowFixtures();
    render(
      <PlanFilterSortIsland locale="en" filterOptions={baseFilterOptions()} />,
    );

    await userEvent.click(screen.getByRole("checkbox", { name: "Night" }));

    expect(screen.getByText("filter_empty_state_message")).toBeInTheDocument();
    expect(
      document.querySelector('#plan-table-body [data-row-id="pv1"]'),
    ).toHaveClass("hidden");

    await userEvent.click(
      screen.getByRole("button", { name: "filter_clear_button" }),
    );

    expect(
      screen.queryByText("filter_empty_state_message"),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector('#plan-table-body [data-row-id="pv1"]'),
    ).not.toHaveClass("hidden");
    expect(screen.getByRole("checkbox", { name: "Night" })).not.toBeChecked();
  });
});
