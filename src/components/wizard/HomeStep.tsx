import { useTranslation } from "react-i18next";
import WizardStep from "@/components/WizardStep";
import HomeFields, { type HomeFieldsProps } from "./HomeFields";

export default function HomeStep(props: HomeFieldsProps) {
  const { t: tw } = useTranslation("wizard");

  return (
    <WizardStep title={tw("home_title")}>
      <HomeFields {...props} />
    </WizardStep>
  );
}
