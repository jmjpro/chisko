import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CsvDropzone from "./CsvDropzone";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}|${JSON.stringify(opts)}` : key,
  }),
}));

describe("CsvDropzone", () => {
  it("shows the processing message while loading", () => {
    render(
      <CsvDropzone onValidFile={vi.fn()} onError={vi.fn()} loading={true} />,
    );

    expect(screen.getByText("upload_processing")).toBeInTheDocument();
  });

  it("shows the success message once processed", () => {
    render(
      <CsvDropzone onValidFile={vi.fn()} onError={vi.fn()} success={true} />,
    );

    expect(screen.getByText("upload_success")).toBeInTheDocument();
  });
});
