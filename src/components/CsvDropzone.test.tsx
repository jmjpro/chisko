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
  it("renders the upload progress percentage instead of the spinner", () => {
    render(
      <CsvDropzone
        onValidFile={vi.fn()}
        onError={vi.fn()}
        loading={true}
        progress={42}
      />,
    );

    expect(screen.getByText(/upload_progress/)).toHaveTextContent("42");
  });

  it("shows a retrying indicator while loading and retrying", () => {
    render(
      <CsvDropzone
        onValidFile={vi.fn()}
        onError={vi.fn()}
        loading={true}
        retrying={true}
      />,
    );

    expect(screen.getByText("upload_retrying")).toBeInTheDocument();
  });
});
