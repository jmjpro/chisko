import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import ClickThroughCta from "@/components/ClickThroughCta";
import { getSharedConvexClient, sharedSession } from "@/lib/chiskoSession";
import i18n from "../i18n";

interface ClickThroughIslandProps {
  locale: string;
  convexUrl: string;
  supplierId: Id<"suppliers">;
  planVersionId: Id<"planVersions">;
  supplierName: string;
}

export default function ClickThroughIsland({
  locale,
  convexUrl,
  supplierId,
  planVersionId,
  supplierName,
}: ClickThroughIslandProps) {
  const { t } = useTranslation("common");
  const { t: tSupplier } = useTranslation("suppliers");
  const [client] = useState(() => getSharedConvexClient(convexUrl));
  const [sessionId, setSessionId] = useState<Id<"sessions"> | null>(null);

  useEffect(() => {
    void i18n.changeLanguage(locale);
  }, [locale]);

  useEffect(() => {
    sharedSession.getOrCreate(client).then(setSessionId).catch(console.error);
  }, [client]);

  if (!sessionId) {
    return (
      <Button size="sm" variant="outline" disabled>
        {t("cta_click_through", { supplier: tSupplier(supplierName) })}
      </Button>
    );
  }

  return (
    <ClickThroughCta
      sessionId={sessionId}
      supplierId={supplierId}
      planVersionId={planVersionId}
      supplierName={supplierName}
    />
  );
}
