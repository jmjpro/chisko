import { useTranslation } from "react-i18next";
import WizardStep from "@/components/WizardStep";
import UsageFields, { type UsageFieldsProps } from "./UsageFields";

export default function UsageStep(props: UsageFieldsProps) {
  const { t: tw } = useTranslation("wizard");

  return (
    <WizardStep title={tw("usage_title")}>
      <UsageFields {...props} />
    </WizardStep>
  );
}
