import { useTranslation } from "react-i18next";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";

export interface ClickThroughCtaProps {
  sessionId: Id<"sessions">;
  supplierId: Id<"suppliers">;
  planVersionId: Id<"planVersions">;
}

export default function ClickThroughCta({
  sessionId,
  supplierId,
  planVersionId,
}: ClickThroughCtaProps) {
  const { t } = useTranslation("common");
  const href = `/out/${supplierId}/${planVersionId}?sessionId=${sessionId}`;

  return (
    <Button
      size="sm"
      variant="outline"
      nativeButton={false}
      render={<a href={href}>{t("cta_click_through")}</a>}
    />
  );
}
