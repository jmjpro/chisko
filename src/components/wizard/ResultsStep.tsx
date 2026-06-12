import { useTranslation } from "react-i18next";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import CsvDropzone from "@/components/CsvDropzone";
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
} | null;

type EvaluatedPlan = {
  planVersionId: Id<"planVersions">;
  supplier?: { name: string } | null;
  plan?: { name: string } | null;
};

export interface ResultsStepProps {
  rec: Rec | undefined;
  evaluatedPlans: EvaluatedPlan[] | undefined;
  generating: boolean;
  resultError: string | null;
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

export default function ResultsStep({
  rec,
  evaluatedPlans,
  generating,
  resultError,
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

  function renderRecommendation() {
    if (resultError) {
      return <p className="text-destructive">{resultError}</p>;
    }

    if (generating || rec === undefined) {
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

    return (
      <>
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 mb-4">
          <p className="font-semibold text-lg">
            {primary?.supplier?.name} — {primary?.plan?.name}
          </p>
          <p className="text-primary font-medium mt-1">
            {tw("result_savings", {
              amount: Math.round(
                rec.primaryAnnualSavingsAgorot / 100,
              ).toLocaleString(),
            })}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {tw("result_confidence", {
              level: tw(`confidence_${rec.confidenceLevel}`),
            })}
          </p>
        </div>

        {rec.showNoChangeSeparately && noChange && (
          <div className="rounded-lg border border-border p-4 mb-4">
            <p className="text-sm text-muted-foreground mb-1">
              {tw("result_no_change_label")}
            </p>
            <p className="font-semibold">
              {noChange.supplier?.name} — {noChange.plan?.name}
            </p>
            <p className="text-primary mt-1">
              {tw("result_savings", {
                amount: Math.round(
                  rec.noChangePlanAnnualSavingsAgorot / 100,
                ).toLocaleString(),
              })}
            </p>
          </div>
        )}

        <p className="text-sm text-muted-foreground mt-4">
          {(() => {
            try {
              const entries = JSON.parse(rec.assumptions) as {
                key: string;
                params?: Record<string, string | number>;
              }[];
              return entries
                .map(({ key, params }) => tr(key, params))
                .join(". ");
            } catch {
              return rec.assumptions;
            }
          })()}
        </p>
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
      </div>
    </WizardStep>
  );
}
