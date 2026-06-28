import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConvexProvider } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import LeaveDetailsDialog from "@/components/LeaveDetailsDialog";
import { getSharedConvexClient, sharedSession } from "@/lib/chiskoSession";
import i18n from "../i18n";

interface LeaveDetailsIslandProps {
  locale: string;
  convexUrl: string;
  supplierId: Id<"suppliers">;
  planVersionId: Id<"planVersions">;
}

export default function LeaveDetailsIsland({
  locale,
  convexUrl,
  supplierId,
  planVersionId,
}: LeaveDetailsIslandProps) {
  const { t } = useTranslation("common");
  const [client] = useState(() => getSharedConvexClient(convexUrl));
  const [sessionId, setSessionId] = useState<Id<"sessions"> | null>(null);

  useEffect(() => {
    void i18n.changeLanguage(locale);
  }, [locale]);

  useEffect(() => {
    sharedSession.getOrCreate(client).then(setSessionId).catch(console.error);
  }, [client]);

  return (
    <ConvexProvider client={client}>
      {sessionId ? (
        <LeaveDetailsDialog
          sessionId={sessionId}
          supplierId={supplierId}
          planVersionId={planVersionId}
          trigger={<Button size="sm">{t("cta_leave_details")}</Button>}
        />
      ) : (
        <Button size="sm" disabled>
          {t("cta_leave_details")}
        </Button>
      )}
    </ConvexProvider>
  );
}
