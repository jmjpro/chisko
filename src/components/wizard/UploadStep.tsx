import { useTranslation } from "react-i18next";
import type { Id } from "../../../convex/_generated/dataModel";
import CsvDropzone from "@/components/CsvDropzone";
import WizardStep from "@/components/WizardStep";

export interface UploadStepProps {
  onFileUpload: (file: File) => void;
  uploadLoading: boolean;
  uploadProgress: number | undefined;
  uploadRetrying: boolean;
  billImportId: Id<"billImports"> | null;
  uploadError: string | null;
  setUploadError: (err: string | null) => void;
}

export default function UploadStep({
  onFileUpload,
  uploadLoading,
  uploadProgress,
  uploadRetrying,
  billImportId,
  uploadError,
  setUploadError,
}: UploadStepProps) {
  const { t: tw } = useTranslation("wizard");

  return (
    <WizardStep
      title={tw("upload_title")}
      description={tw("upload_description")}
    >
      <div className="mb-5 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
        <span className="font-semibold text-primary">
          {tw("upload_recommended_label")}
        </span>{" "}
        {tw("upload_recommended")}
      </div>

      <CsvDropzone
        onValidFile={(file) => onFileUpload(file)}
        onError={setUploadError}
        loading={uploadLoading}
        progress={uploadProgress}
        retrying={uploadRetrying}
        success={!!billImportId}
        error={uploadError}
      />
    </WizardStep>
  );
}
