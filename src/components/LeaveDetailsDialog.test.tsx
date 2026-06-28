import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "../../convex/_generated/dataModel";
import LeaveDetailsDialog from "./LeaveDetailsDialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}|${JSON.stringify(opts)}` : key,
  }),
}));

const { mockSubmitLeadForm, mockConfirmSupplierFanOut, mockConvexQuery } =
  vi.hoisted(() => ({
    mockSubmitLeadForm: vi.fn(),
    mockConfirmSupplierFanOut: vi.fn(),
    mockConvexQuery: vi.fn(),
  }));

vi.mock("convex/react", async () => {
  const { api } = await import("../../convex/_generated/api");
  const { getFunctionName } = await import("convex/server");
  return {
    useMutation: (ref: unknown) => {
      const name = getFunctionName(
        ref as Parameters<typeof getFunctionName>[0],
      );
      if (name === getFunctionName(api.leads.submitLeadForm))
        return mockSubmitLeadForm;
      if (name === getFunctionName(api.leads.confirmSupplierFanOut))
        return mockConfirmSupplierFanOut;
      throw new Error(`unexpected mutation ref in test: ${name}`);
    },
    useConvex: () => ({ query: mockConvexQuery }),
  };
});

const sessionId = "session1" as Id<"sessions">;
const supplierId = "supplier1" as Id<"suppliers">;
const planVersionId = "pv1" as Id<"planVersions">;
const otherSupplierId = "supplier2" as Id<"suppliers">;
const otherPlanVersionId = "pv2" as Id<"planVersions">;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

async function openDialog() {
  render(
    <LeaveDetailsDialog
      sessionId={sessionId}
      supplierId={supplierId}
      planVersionId={planVersionId}
      trigger={<button>cta_leave_details</button>}
    />,
  );
  await userEvent.click(screen.getByText("cta_leave_details"));
}

describe("LeaveDetailsDialog", () => {
  it("submits step 1 and transitions to the fan-out list", async () => {
    mockSubmitLeadForm.mockResolvedValue({
      leadId: "lead1" as Id<"leads">,
      referralId: "referral1" as Id<"referrals">,
    });
    mockConvexQuery.mockResolvedValue([
      {
        supplierId: otherSupplierId,
        planVersionId: otherPlanVersionId,
        supplierName: "Other Supplier",
        logoFileName: "other.webp",
      },
    ]);

    await openDialog();

    await userEvent.type(
      screen.getByLabelText("lead_form_name_label"),
      "Yossi",
    );
    await userEvent.type(
      screen.getByLabelText("lead_form_phone_label"),
      "0501234567",
    );
    await userEvent.click(screen.getByText("lead_form_submit"));

    await waitFor(() =>
      expect(mockSubmitLeadForm).toHaveBeenCalledWith({
        sessionId,
        recommendationId: undefined,
        supplierId,
        planVersionId,
        name: "Yossi",
        phone: "0501234567",
        email: null,
      }),
    );

    expect(await screen.findByText("fan_out_title")).toBeInTheDocument();
    expect(screen.getByText("Other Supplier")).toBeInTheDocument();
  });

  it("renders each fan-out supplier's logo with a meaningful alt, lazy loading, and explicit dimensions", async () => {
    mockSubmitLeadForm.mockResolvedValue({
      leadId: "lead1" as Id<"leads">,
      referralId: "referral1" as Id<"referrals">,
    });
    mockConvexQuery.mockResolvedValue([
      {
        supplierId: otherSupplierId,
        planVersionId: otherPlanVersionId,
        supplierName: "Other Supplier",
        logoFileName: "other.webp",
      },
    ]);

    await openDialog();
    await userEvent.type(
      screen.getByLabelText("lead_form_name_label"),
      "Yossi",
    );
    await userEvent.type(
      screen.getByLabelText("lead_form_phone_label"),
      "0501234567",
    );
    await userEvent.click(screen.getByText("lead_form_submit"));
    await screen.findByText("fan_out_title");

    const logo = screen.getByAltText("Other Supplier");
    expect(logo).toHaveAttribute("src", "/suppliers/other.webp");
    expect(logo).toHaveAttribute("loading", "lazy");
    expect(logo).toHaveAttribute("width", "40");
    expect(logo).toHaveAttribute("height", "40");
  });

  it("blocks submission and shows errors for missing name/phone, without calling submitLeadForm", async () => {
    await openDialog();

    await userEvent.click(screen.getByText("lead_form_submit"));

    expect(screen.getByText("lead_form_name_required")).toBeInTheDocument();
    expect(screen.getByText("lead_form_phone_required")).toBeInTheDocument();
    expect(mockSubmitLeadForm).not.toHaveBeenCalled();
  });

  it("blocks submission for an invalid phone number", async () => {
    await openDialog();

    await userEvent.type(
      screen.getByLabelText("lead_form_name_label"),
      "Yossi",
    );
    await userEvent.type(screen.getByLabelText("lead_form_phone_label"), "abc");
    await userEvent.click(screen.getByText("lead_form_submit"));

    expect(screen.getByText("lead_form_phone_invalid")).toBeInTheDocument();
    expect(mockSubmitLeadForm).not.toHaveBeenCalled();
  });

  it("confirming fan-out sends only checked suppliers and shows the confirmation count", async () => {
    const leadId = "lead1" as Id<"leads">;
    mockSubmitLeadForm.mockResolvedValue({
      leadId,
      referralId: "referral1" as Id<"referrals">,
    });
    mockConfirmSupplierFanOut.mockResolvedValue([
      "referral2" as Id<"referrals">,
    ]);
    mockConvexQuery.mockResolvedValue([
      {
        supplierId: otherSupplierId,
        planVersionId: otherPlanVersionId,
        supplierName: "Other Supplier",
        logoFileName: "other.webp",
      },
      {
        supplierId: "supplier3" as Id<"suppliers">,
        planVersionId: "pv3" as Id<"planVersions">,
        supplierName: "Third Supplier",
        logoFileName: "third.webp",
      },
    ]);

    await openDialog();
    await userEvent.type(
      screen.getByLabelText("lead_form_name_label"),
      "Yossi",
    );
    await userEvent.type(
      screen.getByLabelText("lead_form_phone_label"),
      "0501234567",
    );
    await userEvent.click(screen.getByText("lead_form_submit"));
    await screen.findByText("fan_out_title");

    // Both suppliers are pre-checked; uncheck "Third Supplier".
    await userEvent.click(screen.getByLabelText(/Third Supplier/));
    await userEvent.click(screen.getByText("fan_out_confirm"));

    await waitFor(() =>
      expect(mockConfirmSupplierFanOut).toHaveBeenCalledWith({
        leadId,
        fanOuts: [
          { supplierId: otherSupplierId, planVersionId: otherPlanVersionId },
        ],
      }),
    );

    expect(
      await screen.findByText('fan_out_confirmation|{"count":2}'),
    ).toBeInTheDocument();
    expect(screen.getByText("back_to_plans")).toBeInTheDocument();
  });

  it("clicking the back button on the confirmation step closes the dialog", async () => {
    const leadId = "lead1" as Id<"leads">;
    mockSubmitLeadForm.mockResolvedValue({ leadId });
    mockConfirmSupplierFanOut.mockResolvedValue([]);
    mockConvexQuery.mockResolvedValue([
      {
        supplierId: otherSupplierId,
        planVersionId: otherPlanVersionId,
        supplierName: "Other Supplier",
        logoFileName: "other.webp",
      },
    ]);

    await openDialog();
    await userEvent.type(screen.getByLabelText("lead_form_name_label"), "Yossi");
    await userEvent.type(screen.getByLabelText("lead_form_phone_label"), "0501234567");
    await userEvent.click(screen.getByText("lead_form_submit"));
    await screen.findByText("fan_out_title");
    await userEvent.click(screen.getByText("fan_out_confirm"));
    await screen.findByText('fan_out_confirmation|{"count":2}');

    await userEvent.click(screen.getByText("back_to_plans"));

    await waitFor(() =>
      expect(screen.queryByText('fan_out_confirmation|{"count":2}')).not.toBeInTheDocument(),
    );
  });

  it("renders the backLabel prop instead of the default on the confirmation step", async () => {
    mockSubmitLeadForm.mockResolvedValue({ leadId: "lead1" as Id<"leads"> });
    mockConfirmSupplierFanOut.mockResolvedValue([]);
    mockConvexQuery.mockResolvedValue([
      {
        supplierId: otherSupplierId,
        planVersionId: otherPlanVersionId,
        supplierName: "Other Supplier",
        logoFileName: "other.webp",
      },
    ]);

    render(
      <LeaveDetailsDialog
        sessionId={sessionId}
        supplierId={supplierId}
        planVersionId={planVersionId}
        backLabel="back_to_wizard"
        trigger={<button>cta_leave_details</button>}
      />,
    );
    await userEvent.click(screen.getByText("cta_leave_details"));
    await userEvent.type(screen.getByLabelText("lead_form_name_label"), "Yossi");
    await userEvent.type(screen.getByLabelText("lead_form_phone_label"), "0501234567");
    await userEvent.click(screen.getByText("lead_form_submit"));
    await screen.findByText("fan_out_title");
    await userEvent.click(screen.getByText("fan_out_confirm"));
    await screen.findByText('fan_out_confirmation|{"count":2}');

    expect(screen.getByText("back_to_wizard")).toBeInTheDocument();
    expect(screen.queryByText("back_to_plans")).not.toBeInTheDocument();
  });

  it("declining fan-out shows confirmation for the primary supplier without creating additional referrals", async () => {
    mockSubmitLeadForm.mockResolvedValue({
      leadId: "lead1" as Id<"leads">,
      referralId: "referral1" as Id<"referrals">,
    });
    mockConvexQuery.mockResolvedValue([
      {
        supplierId: otherSupplierId,
        planVersionId: otherPlanVersionId,
        supplierName: "Other Supplier",
        logoFileName: "other.webp",
      },
    ]);

    await openDialog();
    await userEvent.type(
      screen.getByLabelText("lead_form_name_label"),
      "Yossi",
    );
    await userEvent.type(
      screen.getByLabelText("lead_form_phone_label"),
      "0501234567",
    );
    await userEvent.click(screen.getByText("lead_form_submit"));
    await screen.findByText("fan_out_title");

    await userEvent.click(screen.getByText("fan_out_decline"));

    expect(mockConfirmSupplierFanOut).not.toHaveBeenCalled();
    expect(
      await screen.findByText('fan_out_confirmation|{"count":1}'),
    ).toBeInTheDocument();
  });

  it("shows confirmation for the primary supplier when the fan-out scope is empty", async () => {
    mockSubmitLeadForm.mockResolvedValue({
      leadId: "lead1" as Id<"leads">,
      referralId: "referral1" as Id<"referrals">,
    });
    mockConvexQuery.mockResolvedValue([]);

    await openDialog();
    await userEvent.type(
      screen.getByLabelText("lead_form_name_label"),
      "Yossi",
    );
    await userEvent.type(
      screen.getByLabelText("lead_form_phone_label"),
      "0501234567",
    );
    await userEvent.click(screen.getByText("lead_form_submit"));

    expect(
      await screen.findByText('fan_out_confirmation|{"count":1}'),
    ).toBeInTheDocument();
    expect(screen.queryByText("fan_out_title")).not.toBeInTheDocument();
  });

  it("blocks submission for an invalid email", async () => {
    await openDialog();

    await userEvent.type(
      screen.getByLabelText("lead_form_name_label"),
      "Yossi",
    );
    await userEvent.type(
      screen.getByLabelText("lead_form_phone_label"),
      "0501234567",
    );
    await userEvent.type(
      screen.getByLabelText("lead_form_email_label"),
      "not-an-email",
    );
    await userEvent.click(screen.getByText("lead_form_submit"));

    expect(screen.getByText("lead_form_email_invalid")).toBeInTheDocument();
    expect(mockSubmitLeadForm).not.toHaveBeenCalled();
  });

  it("resets to step 1 the next time it's opened, after a full submit+confirm flow", async () => {
    mockSubmitLeadForm.mockResolvedValue({
      leadId: "lead1" as Id<"leads">,
      referralId: "referral1" as Id<"referrals">,
    });
    mockConfirmSupplierFanOut.mockResolvedValue([
      "referral2" as Id<"referrals">,
    ]);
    mockConvexQuery.mockResolvedValue([
      {
        supplierId: otherSupplierId,
        planVersionId: otherPlanVersionId,
        supplierName: "Other Supplier",
        logoFileName: "other.webp",
      },
    ]);

    render(
      <LeaveDetailsDialog
        sessionId={sessionId}
        supplierId={supplierId}
        planVersionId={planVersionId}
        trigger={<button>cta_leave_details</button>}
      />,
    );

    await userEvent.click(screen.getByText("cta_leave_details"));
    await userEvent.type(
      screen.getByLabelText("lead_form_name_label"),
      "Yossi",
    );
    await userEvent.type(
      screen.getByLabelText("lead_form_phone_label"),
      "0501234567",
    );
    await userEvent.click(screen.getByText("lead_form_submit"));
    await screen.findByText("fan_out_title");
    await userEvent.click(screen.getByText("fan_out_confirm"));
    await screen.findByText('fan_out_confirmation|{"count":2}');

    // Close (e.g. via Escape) and reopen on the same trigger.
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        screen.queryByText('fan_out_confirmation|{"count":2}'),
      ).not.toBeInTheDocument(),
    );
    await userEvent.click(screen.getByText("cta_leave_details"));

    expect(await screen.findByText("lead_form_title")).toBeInTheDocument();
    expect(screen.getByLabelText("lead_form_name_label")).toHaveValue("");
  });
});
