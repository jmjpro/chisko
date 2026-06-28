import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { Id } from "../../convex/_generated/dataModel";
import ClickThroughCta from "./ClickThroughCta";

vi.mock("react-i18next", () => ({
  useTranslation: (ns?: string) => ({
    t: (key: string, opts?: { supplier?: string }) => {
      if (ns === "suppliers") return key;
      return opts ? `${key}(${opts.supplier ?? ""})` : key;
    },
    i18n: { language: "en" },
  }),
}));

afterEach(() => {
  cleanup();
});

const sessionId = "session1" as Id<"sessions">;
const supplierId = "supplier1" as Id<"suppliers">;
const planVersionId = "pv1" as Id<"planVersions">;

describe("ClickThroughCta", () => {
  it("renders a link whose label includes the supplier name", () => {
    render(
      <ClickThroughCta
        sessionId={sessionId}
        supplierId={supplierId}
        planVersionId={planVersionId}
        supplierName="Acme Energy"
      />,
    );

    expect(
      screen.getByText("cta_click_through(Acme Energy)"),
    ).toBeInTheDocument();
  });

  it("links to the out route for the given supplier and plan", () => {
    render(
      <ClickThroughCta
        sessionId={sessionId}
        supplierId={supplierId}
        planVersionId={planVersionId}
        supplierName="Acme Energy"
      />,
    );

    expect(
      screen.getByRole("button", { name: /cta_click_through/ }),
    ).toHaveAttribute(
      "href",
      `/out/${supplierId}/${planVersionId}?sessionId=${sessionId}`,
    );
  });
});
