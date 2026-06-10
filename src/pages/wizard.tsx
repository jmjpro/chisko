import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import Header from "../components/header";
import Footer from "../components/footer";

export default function WizardPage() {
  const { t } = useTranslation();
  const { t: tw } = useTranslation("wizard");
  const { t: tr } = useTranslation("recommendations");

  const [step, setStep] = useState(0);
  const [sessionId, setSessionId] = useState<Id<"sessions"> | null>(null);
  const [billImportId, setBillImportId] = useState<Id<"billImports"> | null>(
    null,
  );
  const [homeProfileId, setHomeProfileId] = useState<Id<"homeProfiles"> | null>(
    null,
  );

  // Form fields
  const [city, setCity] = useState("");
  const [bundleMemberships, setBundleMemberships] = useState<string[]>([]);
  const [currentSupplierId, setCurrentSupplierId] =
    useState<Id<"suppliers"> | null>(null);
  const [workFromHome, setWorkFromHome] = useState<
    "always" | "sometimes" | "never"
  >("sometimes");
  const [hasEv, setHasEv] = useState(false);
  const [evChargingTime, setEvChargingTime] = useState<
    "day" | "night" | "mixed" | null
  >(null);
  const [washerDryerTime, setWasherDryerTime] = useState<
    "day" | "night" | "flexible" | null
  >(null);
  const [acUsageLevel, setAcUsageLevel] = useState<
    "heavy" | "moderate" | "light" | "none"
  >("moderate");
  const [willingToShiftUsage, setWillingToShiftUsage] = useState(true);

  // Upload / generate state
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [resultError, setResultError] = useState<string | null>(null);
  const hasStartedGenerating = useRef(false);

  // Convex
  const getOrCreateSession = useMutation(api.sessions.getOrCreate);
  const generateUploadUrl = useMutation(api.billImports.generateUploadUrl);
  const parseSmartMeterCsv = useAction(api.billImports.parseSmartMeterCsv);
  const upsertHomeProfile = useMutation(api.homeProfiles.upsert);
  const generateRecommendation = useMutation(api.recommendations.generate);
  const suppliers = useQuery(api.suppliers.list);
  const rec = useQuery(
    api.recommendations.getForSession,
    sessionId && step === 9 ? { sessionId } : "skip",
  );
  const evaluatedPlans = useQuery(
    api.recommendations.getEvaluatedPlans,
    rec ? { recommendationId: rec._id } : "skip",
  );

  // Initialize session from localStorage
  useEffect(() => {
    const key = "ec2-session-token";
    let token = localStorage.getItem(key);
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem(key, token);
    }
    getOrCreateSession({ sessionToken: token })
      .then(setSessionId)
      .catch(console.error);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Generate recommendation when reaching step 9
  useEffect(() => {
    if (
      step !== 9 ||
      !sessionId ||
      !billImportId ||
      hasStartedGenerating.current
    )
      return;
    hasStartedGenerating.current = true;
    setGenerating(true);
    upsertHomeProfile({
      sessionId,
      hasSmartMeter: "yes",
      bundleMemberships,
      city,
      currentSupplierId,
      currentPlanId: null,
      approximateMonthlyKwh: null,
      workFromHome,
      hasEv,
      evChargingTime: hasEv ? evChargingTime : null,
      washerDryerTime,
      acUsageLevel,
      willingToShiftUsage,
    })
      .then((hpId) => {
        setHomeProfileId(hpId);
        return generateRecommendation({
          sessionId: sessionId,
          homeProfileId: hpId,
          billImportId: billImportId,
        });
      })
      .then(() => setGenerating(false))
      .catch(() => {
        setResultError(tw("result_error"));
        setGenerating(false);
      });
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  void homeProfileId;

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !sessionId) return;
    setUploadLoading(true);
    setUploadError(null);
    try {
      const uploadUrl = await generateUploadUrl({});
      const res = await fetch(uploadUrl, {
        method: "POST",
        body: file,
        headers: { "Content-Type": "text/csv" },
      });
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      const id = await parseSmartMeterCsv({ storageId, sessionId });
      setBillImportId(id);
    } catch {
      setUploadError(tw("upload_error"));
    } finally {
      setUploadLoading(false);
    }
  }

  function toggleMembership(name: string, checked: boolean) {
    setBundleMemberships((prev) =>
      checked ? [...prev, name] : prev.filter((x) => x !== name),
    );
  }

  function renderStep() {
    switch (step) {
      case 0:
        return (
          <>
            <h2 className="text-xl font-bold mb-4">{tw("upload_title")}</h2>
            <p className="text-slate-600 mb-4">{tw("upload_description")}</p>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                void handleFileUpload(e);
              }}
              disabled={uploadLoading}
              className="block mb-3"
            />
            {uploadLoading && (
              <p className="text-slate-500">{tw("upload_processing")}</p>
            )}
            {uploadError && <p className="text-red-600">{uploadError}</p>}
            {billImportId && (
              <p className="text-green-600">{tw("upload_success")}</p>
            )}
          </>
        );

      case 1:
        return (
          <>
            <h2 className="text-xl font-bold mb-4">{tw("city_title")}</h2>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="border rounded px-3 py-2 w-full"
              placeholder={tw("city_placeholder")}
            />
          </>
        );

      case 2:
        return (
          <>
            <h2 className="text-xl font-bold mb-4">
              {tw("memberships_title")}
            </h2>
            {(["HOT triple", "HOT Mobile", "Cellcom"] as const).map((b) => (
              <label
                key={b}
                className="flex items-center gap-2 cursor-pointer mb-2"
              >
                <input
                  type="checkbox"
                  checked={bundleMemberships.includes(b)}
                  onChange={(e) => toggleMembership(b, e.target.checked)}
                />
                {b}
              </label>
            ))}
            <label className="flex items-center gap-2 cursor-pointer mt-2">
              <input
                type="checkbox"
                checked={bundleMemberships.length === 0}
                onChange={(e) => {
                  if (e.target.checked) setBundleMemberships([]);
                }}
              />
              {tw("memberships_none")}
            </label>
          </>
        );

      case 3:
        return (
          <>
            <h2 className="text-xl font-bold mb-4">{tw("supplier_title")}</h2>
            <select
              value={currentSupplierId ?? ""}
              onChange={(e) =>
                setCurrentSupplierId(
                  e.target.value ? (e.target.value as Id<"suppliers">) : null,
                )
              }
              className="border rounded px-3 py-2 w-full"
            >
              <option value="">{tw("supplier_unknown")}</option>
              {(suppliers ?? []).map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </>
        );

      case 4:
        return (
          <>
            <h2 className="text-xl font-bold mb-4">{tw("wfh_title")}</h2>
            {(
              [
                ["always", "wfh_always"],
                ["sometimes", "wfh_sometimes"],
                ["never", "wfh_never"],
              ] as const
            ).map(([val, key]) => (
              <label
                key={val}
                className="flex items-center gap-2 cursor-pointer mb-2"
              >
                <input
                  type="radio"
                  name="wfh"
                  checked={workFromHome === val}
                  onChange={() => setWorkFromHome(val)}
                />
                {tw(key)}
              </label>
            ))}
          </>
        );

      case 5:
        return (
          <>
            <h2 className="text-xl font-bold mb-4">{tw("ev_title")}</h2>
            <div className="flex gap-4 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="ev"
                  checked={hasEv}
                  onChange={() => setHasEv(true)}
                />{" "}
                {t("yes")}
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="ev"
                  checked={!hasEv}
                  onChange={() => {
                    setHasEv(false);
                    setEvChargingTime(null);
                  }}
                />{" "}
                {t("no")}
              </label>
            </div>
            {hasEv && (
              <>
                <p className="font-medium mb-2">{tw("ev_charging_title")}</p>
                {(
                  [
                    ["day", "time_day"],
                    ["night", "time_night"],
                    ["mixed", "time_mixed"],
                  ] as const
                ).map(([val, key]) => (
                  <label
                    key={val}
                    className="flex items-center gap-2 cursor-pointer mb-2"
                  >
                    <input
                      type="radio"
                      name="evtime"
                      checked={evChargingTime === val}
                      onChange={() => setEvChargingTime(val)}
                    />
                    {tw(key)}
                  </label>
                ))}
              </>
            )}
          </>
        );

      case 6:
        return (
          <>
            <h2 className="text-xl font-bold mb-4">{tw("washer_title")}</h2>
            {(
              [
                ["day", "time_day"],
                ["night", "time_night"],
                ["flexible", "time_flexible"],
                [null, "unknown"],
              ] as const
            ).map(([val, key]) => (
              <label
                key={String(val)}
                className="flex items-center gap-2 cursor-pointer mb-2"
              >
                <input
                  type="radio"
                  name="washer"
                  checked={washerDryerTime === val}
                  onChange={() => setWasherDryerTime(val)}
                />
                {tw(key)}
              </label>
            ))}
          </>
        );

      case 7:
        return (
          <>
            <h2 className="text-xl font-bold mb-4">{tw("ac_title")}</h2>
            {(
              [
                ["heavy", "ac_heavy"],
                ["moderate", "ac_moderate"],
                ["light", "ac_light"],
                ["none", "ac_none"],
              ] as const
            ).map(([val, key]) => (
              <label
                key={val}
                className="flex items-center gap-2 cursor-pointer mb-2"
              >
                <input
                  type="radio"
                  name="ac"
                  checked={acUsageLevel === val}
                  onChange={() => setAcUsageLevel(val)}
                />
                {tw(key)}
              </label>
            ))}
          </>
        );

      case 8:
        return (
          <>
            <h2 className="text-xl font-bold mb-4">{tw("shift_title")}</h2>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="shift"
                  checked={willingToShiftUsage}
                  onChange={() => setWillingToShiftUsage(true)}
                />{" "}
                {t("yes")}
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="shift"
                  checked={!willingToShiftUsage}
                  onChange={() => setWillingToShiftUsage(false)}
                />{" "}
                {t("no")}
              </label>
            </div>
          </>
        );

      case 9:
        return renderResult();

      default:
        return null;
    }
  }

  function renderResult() {
    if (resultError) {
      return <p className="text-red-600">{resultError}</p>;
    }

    if (generating || rec === undefined) {
      return (
        <div className="text-center py-12">
          <p className="text-slate-500 text-lg">{tw("result_loading")}</p>
        </div>
      );
    }

    if (rec === null) {
      return <p className="text-red-600">{tw("result_not_found")}</p>;
    }

    const primary = evaluatedPlans?.find(
      (p) => p.planVersionId === rec.primaryPlanVersionId,
    );
    const noChange = evaluatedPlans?.find(
      (p) => p.planVersionId === rec.noChangePlanVersionId,
    );

    return (
      <>
        <h2 className="text-xl font-bold mb-6">{tw("result_title")}</h2>

        <div className="border rounded-lg p-4 mb-4 bg-blue-50">
          <p className="font-semibold text-lg">
            {primary?.supplier?.name} — {primary?.plan?.name}
          </p>
          <p className="text-green-700 mt-1">
            {tw("result_savings", {
              amount: Math.round(
                rec.primaryAnnualSavingsAgorot / 100,
              ).toLocaleString(),
            })}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {tw("result_confidence", {
              level: tw(`confidence_${rec.confidenceLevel}`),
            })}
          </p>
        </div>

        {rec.showNoChangeSeparately && noChange && (
          <div className="border rounded-lg p-4 mb-4">
            <p className="text-sm text-slate-500 mb-1">
              {tw("result_no_change_label")}
            </p>
            <p className="font-semibold">
              {noChange.supplier?.name} — {noChange.plan?.name}
            </p>
            <p className="text-green-700 mt-1">
              {tw("result_savings", {
                amount: Math.round(
                  rec.noChangePlanAnnualSavingsAgorot / 100,
                ).toLocaleString(),
              })}
            </p>
          </div>
        )}

        <p className="text-sm text-slate-500 mt-4">
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
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 px-6 py-8 max-w-lg mx-auto w-full">
        {renderStep()}

        {step < 9 && (
          <div className="flex gap-3 mt-8">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="px-4 py-2 border rounded"
              >
                {tw("prev")}
              </button>
            )}
            {step < 8 && (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 0 ? !billImportId : false}
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
              >
                {tw("next")}
              </button>
            )}
            {step === 8 && (
              <button
                onClick={() => setStep(9)}
                className="px-4 py-2 bg-green-600 text-white rounded"
              >
                {tw("submit")}
              </button>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
