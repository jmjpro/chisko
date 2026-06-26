// @vitest-environment happy-dom
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
      {
        value: "Bezek Electricity",
        label: "Bezek Electricity Co.",
        logoFileName: "bezek.webp",
      },
      {
        value: "Acme Power",
        label: "Acme Power",
        logoFileName: "acme.webp",
      },
    ],
  };
}

const mountedFixtures: HTMLElement[] = [];

function mountRowFixtures() {
  const fixture = document.createElement("div");
  fixture.innerHTML = `
    <div id="plan-rows">
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
    <div role="row">
      <div role="columnheader" aria-sort="none"><button data-sort-field="discount">discount<span data-sort-indicator>↕</span></button></div>
      <div role="columnheader" aria-sort="none"><button data-sort-field="supplier">supplier<span data-sort-indicator>↕</span></button></div>
      <div role="columnheader" aria-sort="none"><button data-sort-field="type">type<span data-sort-indicator>↕</span></button></div>
    </div>
    <div id="plan-rows">
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

async function openMenu(triggerLabel: string) {
  await userEvent.click(screen.getByRole("button", { name: triggerLabel }));
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

  it("renders trigger buttons for plan type and supplier, with all options checked by default", async () => {
    render(
      <PlanFilterSortIsland locale="en" filterOptions={baseFilterOptions()} />,
    );

    expect(
      screen.getByRole("button", { name: "filter_plan_type_label" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "filter_supplier_label" }),
    ).toBeInTheDocument();

    await openMenu("filter_plan_type_label");
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Fixed" }),
    ).toBeChecked();
    expect(screen.getByRole("menuitemcheckbox", { name: "Day" })).toBeChecked();
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Night" }),
    ).toBeChecked();

    await openMenu("filter_supplier_label");
    expect(
      screen.getByRole("menuitemcheckbox", { name: /Bezek Electricity Co\./ }),
    ).toBeChecked();
    expect(
      screen.getByRole("menuitemcheckbox", { name: /Acme Power/ }),
    ).toBeChecked();
  });

  it("renders a logo for each supplier inside the supplier dropdown", async () => {
    render(
      <PlanFilterSortIsland locale="en" filterOptions={baseFilterOptions()} />,
    );

    await openMenu("filter_supplier_label");

    const bezekItem = screen.getByRole("menuitemcheckbox", {
      name: /Bezek Electricity Co\./,
    });
    const logo = bezekItem.querySelector("img");

    expect(logo).toHaveAttribute("src", "/suppliers/bezek.webp");
    expect(logo).toHaveAttribute("alt", "");
    expect(logo).toHaveAttribute("loading", "lazy");
    expect(logo).toHaveAttribute("width", "32");
    expect(logo).toHaveAttribute("height", "32");
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

  it("unchecking a plan type hides rows of that type, leaving other rows visible", async () => {
    mountRowFixtures();
    render(
      <PlanFilterSortIsland locale="en" filterOptions={baseFilterOptions()} />,
    );

    await openMenu("filter_plan_type_label");
    await userEvent.click(
      screen.getByRole("menuitemcheckbox", { name: "Fixed" }),
    );

    expect(
      document.querySelector('#plan-rows [data-row-id="pv1"]'),
    ).toHaveClass("hidden");
    expect(
      document.querySelector('#plan-rows [data-row-id="pv2"]'),
    ).not.toHaveClass("hidden");
  });

  it("unions multiple checked values within the same facet, but intersects across facets", async () => {
    mountRowFixtures();
    render(
      <PlanFilterSortIsland locale="en" filterOptions={baseFilterOptions()} />,
    );

    // Uncheck Night only — both pv1 (fixed) and pv2 (day) still show (union within facet)
    await openMenu("filter_plan_type_label");
    await userEvent.click(
      screen.getByRole("menuitemcheckbox", { name: "Night" }),
    );
    expect(
      document.querySelector('#plan-rows [data-row-id="pv1"]'),
    ).not.toHaveClass("hidden");
    expect(
      document.querySelector('#plan-rows [data-row-id="pv2"]'),
    ).not.toHaveClass("hidden");

    // Now uncheck Bezek — pv1 (Bezek/fixed) hides even though Fixed is still selected
    await openMenu("filter_supplier_label");
    await userEvent.click(
      screen.getByRole("menuitemcheckbox", { name: /Bezek Electricity Co\./ }),
    );
    expect(
      document.querySelector('#plan-rows [data-row-id="pv1"]'),
    ).toHaveClass("hidden");
    expect(
      document.querySelector('#plan-rows [data-row-id="pv2"]'),
    ).not.toHaveClass("hidden");
  });

  it("selecting Plan Type from the mobile sort-by select reorders the rows using the canonical Fixed/Day/Night order", async () => {
    mountSortFixtures();
    render(
      <PlanFilterSortIsland locale="en" filterOptions={baseFilterOptions()} />,
    );

    await userEvent.selectOptions(
      screen.getByLabelText("sort_by_label"),
      "type",
    );

    expect(rowIdsOf("plan-rows")).toEqual(["fixed", "day", "night"]);
  });

  it("clicking a desktop sort header sorts by that field's natural default direction first, then toggles on a second click", async () => {
    mountSortFixtures();
    render(
      <PlanFilterSortIsland locale="en" filterOptions={baseFilterOptions()} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /^supplier/ }));
    expect(rowIdsOf("plan-rows")).toEqual(["fixed", "day", "night"]);

    await userEvent.click(screen.getByRole("button", { name: /^supplier/ }));
    expect(rowIdsOf("plan-rows")).toEqual(["night", "day", "fixed"]);
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
    expect(supplierHeader.closest('[role="columnheader"]')).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    expect(typeHeader.querySelector("[data-sort-indicator]")).toHaveTextContent(
      "↕",
    );
    expect(typeHeader.closest('[role="columnheader"]')).toHaveAttribute(
      "aria-sort",
      "none",
    );

    await userEvent.click(supplierHeader);

    expect(
      supplierHeader.querySelector("[data-sort-indicator]"),
    ).toHaveTextContent("↓");
    expect(supplierHeader.closest('[role="columnheader"]')).toHaveAttribute(
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

    await openMenu("filter_plan_type_label");
    await userEvent.click(
      screen.getByRole("menuitemcheckbox", { name: "Fixed" }),
    );

    expect(
      screen.getByText('filter_result_count|{"count":1,"total":2}'),
    ).toBeInTheDocument();
  });

  it("shows an empty-state message with a clear-filters control when the filter combination matches no rows, and clearing restores all rows", async () => {
    mountRowFixtures();
    render(
      <PlanFilterSortIsland locale="en" filterOptions={baseFilterOptions()} />,
    );

    // Uncheck Fixed and Day — only Night selected, but no night rows in the fixture
    await openMenu("filter_plan_type_label");
    await userEvent.click(
      screen.getByRole("menuitemcheckbox", { name: "Fixed" }),
    );
    await userEvent.click(
      screen.getByRole("menuitemcheckbox", { name: "Day" }),
    );
    await userEvent.keyboard("{Escape}");

    expect(screen.getByText("filter_empty_state_message")).toBeInTheDocument();
    expect(
      document.querySelector('#plan-rows [data-row-id="pv1"]'),
    ).toHaveClass("hidden");
    expect(
      document.querySelector('#plan-rows [data-row-id="pv2"]'),
    ).toHaveClass("hidden");

    await userEvent.click(
      screen.getByRole("button", { name: "filter_clear_button" }),
    );

    expect(
      screen.queryByText("filter_empty_state_message"),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector('#plan-rows [data-row-id="pv1"]'),
    ).not.toHaveClass("hidden");
    expect(
      document.querySelector('#plan-rows [data-row-id="pv2"]'),
    ).not.toHaveClass("hidden");

    // All plan type options are checked again after clearing
    await openMenu("filter_plan_type_label");
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Fixed" }),
    ).toBeChecked();
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Night" }),
    ).toBeChecked();
  });
});
