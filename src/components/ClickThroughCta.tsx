import { useTranslation } from "react-i18next";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";

export interface ClickThroughCtaProps {
  sessionId: Id<"sessions">;
  supplierId: Id<"suppliers">;
  planVersionId: Id<"planVersions">;
  supplierName: string;
  className?: string;
}

export default function ClickThroughCta({
  sessionId,
  supplierId,
  planVersionId,
  supplierName,
  className,
}: ClickThroughCtaProps) {
  const { t } = useTranslation("common");
  const { t: tSupplier } = useTranslation("suppliers");
  const href = `/out/${supplierId}/${planVersionId}?sessionId=${sessionId}`;
  const label = t("cta_click_through", { supplier: tSupplier(supplierName) });

  return (
    <Button
      size="sm"
      variant="outline"
      className={className}
      nativeButton={false}
      render={<a href={href}>{label}</a>}
    />
  );
}
