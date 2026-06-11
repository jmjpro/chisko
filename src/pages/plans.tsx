import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import Header from "../components/header";
import Footer from "../components/footer";

function formatHour(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

export default function PlansPage() {
  const { t } = useTranslation();
  const { t: tSuppliers } = useTranslation("suppliers");
  const { t: tPlans } = useTranslation("plans");

  const data = useQuery(api.plans.listActive);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 px-6 py-8 overflow-x-auto">
        <h1 className="text-2xl font-bold mb-6">{t("plans_page_title")}</h1>
        {data === undefined ? (
          <p className="text-muted-foreground">…</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-start">
                <th className="pb-2 pe-6 font-semibold text-start">
                  {t("table_supplier")}
                </th>
                <th className="pb-2 pe-6 font-semibold text-start">
                  {t("table_plan")}
                </th>
                <th className="pb-2 pe-6 font-semibold text-start">
                  {t("table_type")}
                </th>
                <th className="pb-2 pe-6 font-semibold text-start">
                  {t("table_discount")}
                </th>
                <th className="pb-2 pe-6 font-semibold text-start">
                  {t("table_window")}
                </th>
                <th className="pb-2 font-semibold text-start">
                  {t("table_weekday_only")}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => {
                const isFixed = row.planType === "fixed";
                const window =
                  !isFixed &&
                  row.discountWindowStartHour !== null &&
                  row.discountWindowEndHour !== null
                    ? `${formatHour(row.discountWindowStartHour)}–${formatHour(row.discountWindowEndHour)}`
                    : "—";
                const weekdayOnly = isFixed
                  ? "—"
                  : row.weekdayWindowOnly
                    ? t("yes")
                    : t("all_week");

                return (
                  <tr key={row.pvId} className="border-b last:border-0">
                    <td className="py-3 pe-6">
                      {tSuppliers(row.supplierName)}
                    </td>
                    <td className="py-3 pe-6">{tPlans(row.planName)}</td>
                    <td className="py-3 pe-6">
                      {t(`plan_type_${row.planType}`)}
                    </td>
                    <td className="py-3 pe-6 tnum">{row.discountPercent}%</td>
                    <td className="py-3 pe-6">{window}</td>
                    <td className="py-3">{weekdayOnly}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </main>
      <Footer />
    </div>
  );
}
