import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import ChiskiMascot from "@/components/chiskiMascot";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import CsvDropzone from "@/components/CsvDropzone";
import ClickThroughCta from "@/components/ClickThroughCta";
import LeaveDetailsDialog from "@/components/LeaveDetailsDialog";
import WizardStep from "@/components/WizardStep";
import HomeFields, { type HomeFieldsProps } from "./HomeFields";
import UsageFields, { type UsageFieldsProps } from "./UsageFields";

type Rec = {
  _id: Id<"recommendations">;
  primaryPlanVersionId: Id<"planVersions">;
  primaryAnnualSavingsAgorot: number;
  noChangePlanVersionId: Id<"planVersions"> | null;
  noChangePlanAnnualSavingsAgorot: number;
  showNoChangeSeparately: boolean;
  confidenceLevel: string;
  assumptions: string;
  baselineAnnualCostAgorot: number;
} | null;

type PlanVersionMechanics = {
  discountPercent: number;
  discountWindowStartHour?: number;
  discountWindowEndHour?: number;
  weekdayWindowOnly: boolean;
  benefitDelivery?: "billDiscount" | "appCredit";
};

type EvaluatedPlan = {
  planVersionId: Id<"planVersions">;
  isEligible: boolean;
  annualSavingsAgorot: number;
  supplier?: {
    _id: Id<"suppliers">;
    name: string;
    logoFileName: string;
    supportedHandoffTypes?: ("clickThrough" | "formHandoff" | "phoneBased")[];
  } | null;
  plan?: { name: string; planType: "fixed" | "day" | "night" } | null;
  planVersion?: PlanVersionMechanics | null;
};

export interface ResultsStepProps {
  sessionId: Id<"sessions"> | null;
  rec: Rec | undefined;
  evaluatedPlans: EvaluatedPlan[] | undefined;
  generating: boolean;
  resultError: string | null;
  noChangeNotice: boolean;
  onRecalculate: () => void;
  effectiveHasSmartMeter: "yes" | "no" | null;
  onFileUpload: (file: File) => void;
  uploadLoading: boolean;
  billImportId: Id<"billImports"> | null;
  uploadError: string | null;
  setUploadError: (err: string | null) => void;
  homeFields: HomeFieldsProps;
  usageFields: UsageFieldsProps;
}

function formatHour(h: number): string {
  return String(h).padStart(2, "0") + ":00";
}

function formatAgorot(agorot: number): string {
  return Math.round(agorot / 100).toLocaleString();
}

export default function ResultsStep({
  sessionId,
  rec,
  evaluatedPlans,
  generating,
  resultError,
  noChangeNotice,
  onRecalculate,
  effectiveHasSmartMeter,
  onFileUpload,
  uploadLoading,
  billImportId,
  uploadError,
  setUploadError,
  homeFields,
  usageFields,
}: ResultsStepProps) {
  const { t: tw } = useTranslation("wizard");
  const { t: tr } = useTranslation("recommendations");
  const { t: tc } = useTranslation("common");

  const [primarySheetOpen, setPrimarySheetOpen] = useState(false);
  const [noChangeSheetOpen, setNoChangeSheetOpen] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [altSheetsOpen, setAltSheetsOpen] = useState([false, false]);

  function getDiscountDescription(
    pv: PlanVersionMechanics | null | undefined,
    planType: "fixed" | "day" | "night" | undefined,
  ): string {
    if (!pv || !planType) return "";
    if (planType === "fixed") {
      return tw("plan_discount_fixed", { percent: pv.discountPercent });
    }
    const start = formatHour(pv.discountWindowStartHour ?? 0);
    const end = formatHour(pv.discountWindowEndHour ?? 0);
    const key = pv.weekdayWindowOnly
      ? "plan_discount_window_weekdays"
      : "plan_discount_window_all_days";
    return tw(key, { percent: pv.discountPercent, start, end });
  }

  function parseAssumptions(raw: string): string {
    try {
      const entries = JSON.parse(raw) as {
        key: string;
        params?: Record<string, string | number>;
      }[];
      return entries.map(({ key, params }) => tr(key, params)).join(". ");
    } catch {
      return raw;
    }
  }

  function renderSavingsBreakdown(
    annualSavingsAgorot: number,
  ): React.ReactNode {
    if (!rec) return null;
    const baseline = rec.baselineAnnualCostAgorot;
    const projected = baseline - annualSavingsAgorot;
    return (
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">
            {tw("savings_breakdown_baseline", {
              amount: formatAgorot(baseline),
            })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">
            {tw("savings_breakdown_projected", {
              amount: formatAgorot(projected),
            })}
          </span>
        </div>
        <div className="flex justify-between pt-1 border-t border-border font-medium">
          <span>
            {tw("savings_breakdown_saving", {
              amount: formatAgorot(annualSavingsAgorot),
            })}
          </span>
        </div>
        <p className="pt-2 text-xs text-muted-foreground border-t border-border">
          {parseAssumptions(rec.assumptions)}
        </p>
      </div>
    );
  }

  function renderPlanCard(
    plan: EvaluatedPlan | undefined,
    annualSavingsAgorot: number,
    label: string | null,
    isPrimary: boolean,
    sheetOpen: boolean,
    setSheetOpen: (open: boolean) => void,
    recommendationId: Id<"recommendations">,
  ): React.ReactNode {
    if (!plan) return null;
    const planType = plan.plan?.planType;
    const discountDescription = getDiscountDescription(
      plan.planVersion,
      planType,
    );

    return (
      <div
        className={
          isPrimary
            ? "rounded-lg border border-primary/30 bg-primary/5 p-4 mb-4"
            : "rounded-lg border border-border p-4 mb-4"
        }
      >
        {label && (
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-muted-foreground">{label}</p>
            {isPrimary && (
              <ChiskiMascot className="h-10 w-10 pointer-events-none" />
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          {plan.supplier && (
            <img
              src={`/suppliers/${plan.supplier.logoFileName}`}
              alt={plan.supplier.name}
              loading="lazy"
              width={48}
              height={48}
              className="h-12 w-12 object-contain shrink-0"
            />
          )}
          <p className="font-semibold text-lg">
            {plan.supplier?.name} — {plan.plan?.name}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2">
          {planType && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {tw(`plan_type_${planType}`)}
            </span>
          )}
          {discountDescription && (
            <span className="text-sm text-muted-foreground">
              {discountDescription}
            </span>
          )}
        </div>

        <p
          className={
            isPrimary ? "text-primary font-medium mt-2" : "text-primary mt-2"
          }
        >
          {tw("result_savings", {
            amount: formatAgorot(annualSavingsAgorot),
          })}
        </p>

        {plan.planVersion?.benefitDelivery === "appCredit" && (
          <p className="text-xs text-muted-foreground mt-1 bg-muted/50 rounded px-2 py-1">
            {tw("benefit_delivery_app_credit")}
          </p>
        )}

        {isPrimary && rec && (
          <p className="text-sm text-muted-foreground mt-1">
            {tw("result_confidence", {
              level: tw(`confidence_${rec.confidenceLevel}`),
            })}
          </p>
        )}

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger
            render={
              <button className="text-sm text-muted-foreground underline underline-offset-2 mt-2 hover:text-foreground transition-colors">
                {tw("savings_breakdown_title")}
              </button>
            }
          />
          <SheetContent side="bottom" className="max-h-[60vh] overflow-y-auto">
            <SheetHeader className="mb-4">
              <SheetTitle>{tw("savings_breakdown_title")}</SheetTitle>
            </SheetHeader>
            {renderSavingsBreakdown(annualSavingsAgorot)}
          </SheetContent>
        </Sheet>

        {plan.supplier && sessionId && (
          <div className="mt-3 flex flex-wrap gap-2">
            <LeaveDetailsDialog
              sessionId={sessionId}
              recommendationId={recommendationId}
              supplierId={plan.supplier._id}
              planVersionId={plan.planVersionId}
              trigger={<Button size="sm">{tc("cta_leave_details")}</Button>}
              backLabel={tc("back_to_wizard")}
            />
            {plan.supplier.supportedHandoffTypes?.includes("clickThrough") && (
              <ClickThroughCta
                sessionId={sessionId}
                supplierId={plan.supplier._id}
                planVersionId={plan.planVersionId}
              />
            )}
          </div>
        )}
      </div>
    );
  }

  function renderRecommendation() {
    if (resultError) {
      return <p className="text-destructive">{resultError}</p>;
    }

    if (
      generating ||
      rec === undefined ||
      (rec !== null && evaluatedPlans === undefined)
    ) {
      return (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">
            {tw("result_loading")}
          </p>
        </div>
      );
    }

    if (rec === null) {
      return <p className="text-destructive">{tw("result_not_found")}</p>;
    }

    const primary = evaluatedPlans?.find(
      (p) => p.planVersionId === rec.primaryPlanVersionId,
    );
    const noChange = evaluatedPlans?.find(
      (p) => p.planVersionId === rec.noChangePlanVersionId,
    );
    const alternatives = (evaluatedPlans ?? [])
      .filter(
        (p) => p.isEligible && p.planVersionId !== rec.primaryPlanVersionId,
      )
      .slice(0, 2);

    return (
      <>
        {renderPlanCard(
          primary,
          rec.primaryAnnualSavingsAgorot,
          tw("rank_label", { rank: 1 }),
          true,
          primarySheetOpen,
          setPrimarySheetOpen,
          rec._id,
        )}

        {alternatives.length > 0 && (
          <button
            className="text-sm text-muted-foreground underline underline-offset-2 mb-4 hover:text-foreground transition-colors"
            onClick={() => setShowAlternatives((v) => !v)}
          >
            {showAlternatives
              ? tw("hide_options")
              : tw("show_more_options", { count: alternatives.length })}
          </button>
        )}

        {showAlternatives &&
          alternatives.map((alt, i) => (
            <React.Fragment key={alt.planVersionId}>
              {renderPlanCard(
                alt,
                alt.annualSavingsAgorot,
                tw("rank_label", { rank: i + 2 }),
                false,
                altSheetsOpen[i],
                (open) =>
                  setAltSheetsOpen((prev) => {
                    const next = [...prev];
                    next[i] = open;
                    return next;
                  }),
                rec._id,
              )}
            </React.Fragment>
          ))}

        {rec.showNoChangeSeparately &&
          noChange &&
          renderPlanCard(
            noChange,
            rec.noChangePlanAnnualSavingsAgorot,
            tw("result_no_change_label"),
            false,
            noChangeSheetOpen,
            setNoChangeSheetOpen,
            rec._id,
          )}
      </>
    );
  }

  return (
    <WizardStep title={tw("result_title")}>
      {renderRecommendation()}

      <div className="mt-8 pt-6 border-t border-border">
        <h3 className="text-base font-semibold mb-4">
          {tw("review_answers_title")}
        </h3>

        <div className="space-y-5">
          {effectiveHasSmartMeter === "yes" && (
            <div>
              <p className="text-sm font-medium mb-2">{tw("upload_title")}</p>
              <CsvDropzone
                onValidFile={(file) => onFileUpload(file)}
                onError={setUploadError}
                loading={uploadLoading}
                success={!!billImportId}
                error={uploadError}
              />
            </div>
          )}

          {/* City shown even when pre-filled from lookup */}
          <HomeFields {...homeFields} cascadeCityCode={null} />

          <UsageFields {...usageFields} namePrefix="review_" />
        </div>

        <Button
          onClick={onRecalculate}
          disabled={generating}
          className="mt-6 w-full"
        >
          {tw("recalculate")}
        </Button>
        {noChangeNotice && (
          <p className="text-sm text-muted-foreground mt-2 text-center">
            {tw("recalculate_no_effect")}
          </p>
        )}
      </div>
    </WizardStep>
  );
}
