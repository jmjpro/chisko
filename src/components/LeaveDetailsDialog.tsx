import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useConvex, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export interface LeaveDetailsDialogProps {
  sessionId: Id<"sessions">;
  recommendationId?: Id<"recommendations">;
  supplierId: Id<"suppliers">;
  planVersionId: Id<"planVersions">;
  trigger: React.ReactElement;
  backLabel?: string;
}

type FanOutItem = {
  supplierId: Id<"suppliers">;
  planVersionId: Id<"planVersions">;
  supplierName: string;
  logoFileName: string;
};

type Step =
  | { kind: "form" }
  | { kind: "fanOut"; leadId: Id<"leads">; scope: FanOutItem[] }
  | { kind: "confirmation"; count: number };

const PHONE_PATTERN = /^0\d{8,9}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LeaveDetailsDialog({
  sessionId,
  recommendationId,
  supplierId,
  planVersionId,
  trigger,
  backLabel,
}: LeaveDetailsDialogProps) {
  const { t } = useTranslation("common");
  const convex = useConvex();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>({ kind: "form" });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{
    name?: string;
    phone?: string;
    email?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const submitLeadForm = useMutation(api.leads.submitLeadForm);
  const confirmSupplierFanOut = useMutation(api.leads.confirmSupplierFanOut);

  function resetState() {
    setStep({ kind: "form" });
    setName("");
    setPhone("");
    setEmail("");
    setErrors({});
    setChecked({});
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetState();
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!name.trim()) next.name = t("lead_form_name_required");
    if (!phone.trim()) next.phone = t("lead_form_phone_required");
    else if (!PHONE_PATTERN.test(phone.trim()))
      next.phone = t("lead_form_phone_invalid");
    if (email.trim() && !EMAIL_PATTERN.test(email.trim()))
      next.email = t("lead_form_email_invalid");
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmitStep1(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const { leadId } = await submitLeadForm({
        sessionId,
        recommendationId,
        supplierId,
        planVersionId,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
      });
      const scope = await convex.query(api.leads.getFanOutScope, {
        sessionId,
        recommendationId,
        excludeSupplierId: supplierId,
      });
      if (scope.length === 0) {
        setStep({ kind: "confirmation", count: 1 });
        return;
      }
      setChecked(
        Object.fromEntries(scope.map((item) => [item.supplierId, true])),
      );
      setStep({ kind: "fanOut", leadId, scope });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmFanOut() {
    if (step.kind !== "fanOut") return;
    const fanOuts = step.scope
      .filter((item) => checked[item.supplierId])
      .map((item) => ({
        supplierId: item.supplierId,
        planVersionId: item.planVersionId,
      }));
    if (fanOuts.length > 0) {
      await confirmSupplierFanOut({ leadId: step.leadId, fanOuts });
    }
    setStep({ kind: "confirmation", count: fanOuts.length + 1 });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => handleOpenChange(next)}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        {step.kind === "form" && (
          <form onSubmit={(e) => void handleSubmitStep1(e)}>
            <DialogHeader>
              <DialogTitle>{t("lead_form_title")}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3 px-6">
              <label className="flex flex-col gap-1 text-sm">
                {t("lead_form_name_label")}
                <input
                  className="rounded border border-border px-2 py-1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {errors.name && (
                  <span className="text-xs text-destructive">
                    {errors.name}
                  </span>
                )}
              </label>
              <label className="flex flex-col gap-1 text-sm">
                {t("lead_form_phone_label")}
                <input
                  className="rounded border border-border px-2 py-1"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                {errors.phone && (
                  <span className="text-xs text-destructive">
                    {errors.phone}
                  </span>
                )}
              </label>
              <label className="flex flex-col gap-1 text-sm">
                {t("lead_form_email_label")}
                <input
                  className="rounded border border-border px-2 py-1"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {errors.email && (
                  <span className="text-xs text-destructive">
                    {errors.email}
                  </span>
                )}
              </label>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {t("lead_form_submit")}
              </Button>
            </DialogFooter>
          </form>
        )}

        {step.kind === "fanOut" && (
          <>
            <DialogHeader>
              <DialogTitle>{t("fan_out_title")}</DialogTitle>
              <DialogDescription>{t("fan_out_description")}</DialogDescription>
            </DialogHeader>
            <ul className="flex flex-col gap-2 px-6">
              {step.scope.map((item) => (
                <li key={item.supplierId}>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!checked[item.supplierId]}
                      onChange={(e) =>
                        setChecked((prev) => ({
                          ...prev,
                          [item.supplierId]: e.target.checked,
                        }))
                      }
                    />
                    <img
                      src={`/suppliers/${item.logoFileName}`}
                      alt={item.supplierName}
                      loading="lazy"
                      width={40}
                      height={40}
                      className="h-10 w-10 object-contain"
                    />
                    {item.supplierName}
                  </label>
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep({ kind: "confirmation", count: 1 })}>
                {t("fan_out_decline")}
              </Button>
              <Button onClick={() => void handleConfirmFanOut()}>
                {t("fan_out_confirm")}
              </Button>
            </DialogFooter>
          </>
        )}

        {step.kind === "confirmation" && (
          <>
            <DialogHeader>
              <DialogTitle>
                {t("fan_out_confirmation", { count: step.count })}
              </DialogTitle>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>
                {backLabel ?? t("back_to_plans")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
