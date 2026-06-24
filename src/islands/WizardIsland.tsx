import { useEffect, useRef, useState, Suspense } from "react";
import { useTranslation } from "react-i18next";
import {
  ConvexProvider,
  ConvexReactClient,
  useMutation,
  useQuery,
} from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import Footer from "../components/footer";
import { getOrCreateSessionToken } from "../lib/sessionToken";
import { parseSmartMeterCsvText } from "../../convex/lib/smartMeterCsvParser";
import Wizard from "../components/Wizard";
import MeterStep from "../components/wizard/MeterStep";
import UploadStep from "../components/wizard/UploadStep";
import HomeStep from "../components/wizard/HomeStep";
import UsageStep from "../components/wizard/UsageStep";
import ResultsStep from "../components/wizard/ResultsStep";
import i18n from "../i18n";

// Logical steps: 0=Meter, 1=Upload, 2=Home, 3=Usage, 4=Results
// Upload step (1) is skipped for non-smart-meter users.

// Entry point for the IEC smart-meter retrieval extension: it already
// knows the user has a smart meter, so skip straight to Upload instead
// of re-asking the Meter step.
function isSmartMeterRetrievalEntry() {
  return (
    new URLSearchParams(window.location.search).get("entry") ===
    "smartMeterRetrieval"
  );
}

function WizardPage() {
  const { t: tw } = useTranslation("wizard");

  const [step, setStep] = useState(() =>
    isSmartMeterRetrievalEntry() ? 1 : 0,
  );
  const [sessionId, setSessionId] = useState<Id<"sessions"> | null>(null);
  const [billImportId, setBillImportId] = useState<Id<"billImports"> | null>(
    null,
  );

  // Step 0: meter type
  const [hasSmartMeter, setHasSmartMeter] = useState<"yes" | "no" | null>(() =>
    isSmartMeterRetrievalEntry() ? "yes" : null,
  );
  const [meterNotSure, setMeterNotSure] = useState(false);
  const [cascadeCityCode, setCascadeCityCode] = useState<number | null>(null);
  const [cascadeStreetCode, setCascadeStreetCode] = useState<number | null>(
    null,
  );
  const [cascadeStreetName, setCascadeStreetName] = useState<string | null>(
    null,
  );
  const [cascadeHouseNumber, setCascadeHouseNumber] = useState<string | null>(
    null,
  );

  // Home fields
  const [placeOfResidence, setPlaceOfResidence] = useState<{
    he: string;
    en?: string;
    ar?: string;
    ru?: string;
  } | null>(null);
  const [bundleMemberships, setBundleMemberships] = useState<string[]>([]);
  const [currentSupplierId, setCurrentSupplierId] =
    useState<Id<"suppliers"> | null>(null);
  const [supplierSelectValue, setSupplierSelectValue] = useState("iec");
  const [currentPlanId, setCurrentPlanId] = useState<Id<"plans"> | null>(null);

  // Usage fields
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
  const [willingToAcceptOffBillBenefits, setWillingToAcceptOffBillBenefits] =
    useState(true);

  // Upload / generation state
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [resultError, setResultError] = useState<string | null>(null);
  const [noChangeNotice, setNoChangeNotice] = useState(false);
  const hasStartedGenerating = useRef(false);
  const previousPrimaryRef = useRef<{
    pvId: Id<"planVersions">;
    savings: number;
  } | null>(null);

  // Convex mutations / queries
  const getOrCreateSession = useMutation(api.sessions.getOrCreate);
  const submitSmartMeterCsv = useMutation(api.billImports.submitSmartMeterCsv);
  const activeIecTaozRates = useQuery(api.billImports.getActiveIecTaozRates);
  const upsertHomeProfile = useMutation(api.homeProfiles.upsert);
  const generateRecommendation = useMutation(api.recommendations.generate);
  const suppliers = useQuery(api.suppliers.list);
  const plansForCurrentSupplier = useQuery(
    api.plans.listForSupplier,
    currentSupplierId ? { supplierId: currentSupplierId } : "skip",
  );
  const rec = useQuery(
    api.recommendations.getForSession,
    sessionId && step === 4 ? { sessionId } : "skip",
  );
  const evaluatedPlans = useQuery(
    api.recommendations.getEvaluatedPlans,
    rec ? { recommendationId: rec._id } : "skip",
  );

  // israelPlaces for the Place of Residence typeahead
  const israelPlaces = useQuery(api.israelPlaces.getAll, {});

  // Smart Meter Registry queries
  const cities = useQuery(
    api.smartMeterRegistry.getCities,
    meterNotSure ? {} : "skip",
  );
  const streets = useQuery(
    api.smartMeterRegistry.getStreets,
    cascadeCityCode !== null ? { cityCode: cascadeCityCode } : "skip",
  );
  const houseNumbers = useQuery(
    api.smartMeterRegistry.getHouseNumbers,
    cascadeCityCode !== null && cascadeStreetCode !== null
      ? { cityCode: cascadeCityCode, streetCode: cascadeStreetCode }
      : "skip",
  );
  const addressFound = useQuery(
    api.smartMeterRegistry.checkAddress,
    cascadeCityCode !== null &&
      cascadeStreetCode !== null &&
      cascadeHouseNumber !== null
      ? {
          cityCode: cascadeCityCode,
          streetCode: cascadeStreetCode,
          houseNumber: cascadeHouseNumber,
        }
      : "skip",
  );

  const effectiveHasSmartMeter: "yes" | "no" | null = meterNotSure
    ? addressFound === true
      ? "yes"
      : addressFound === false
        ? "no"
        : null
    : hasSmartMeter;

  // Initialize session from localStorage
  useEffect(() => {
    getOrCreateSession({ sessionToken: getOrCreateSessionToken() })
      .then(setSessionId)
      .catch(console.error);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-generate on first arrival at results
  useEffect(() => {
    if (step !== 4 || !sessionId || hasStartedGenerating.current) return;
    hasStartedGenerating.current = true;
    void handleGenerateRecommendation();
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // After a recalculate, flag when the new recommendation didn't change
  useEffect(() => {
    if (rec === undefined || rec === null) return;
    const prev = previousPrimaryRef.current;
    if (!prev) return;
    setNoChangeNotice(
      rec.primaryPlanVersionId === prev.pvId &&
        rec.primaryAnnualSavingsAgorot === prev.savings,
    );
    previousPrimaryRef.current = null;
  }, [rec]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleMeterChoice(choice: "yes" | "no") {
    setHasSmartMeter(choice);
    setMeterNotSure(false);
    if (choice === "no") setBillImportId(null);
    resetCascade();
  }

  function resetCascade() {
    setCascadeCityCode(null);
    setCascadeStreetCode(null);
    setCascadeStreetName(null);
    setCascadeHouseNumber(null);
  }

  function handleCityChange(cityCode: number, cityName: string) {
    setCascadeCityCode(cityCode);
    setCascadeStreetCode(null);
    setCascadeStreetName(null);
    setCascadeHouseNumber(null);
    const match = israelPlaces?.find((p) => p.he === cityName);
    setPlaceOfResidence(
      match
        ? { he: match.he, en: match.en, ar: match.ar, ru: match.ru }
        : { he: cityName },
    );
  }

  function handleStreetChange(streetCode: number, streetName: string) {
    setCascadeStreetCode(streetCode);
    setCascadeStreetName(streetName);
    setCascadeHouseNumber(null);
  }

  function handleSupplierChange(rawValue: string) {
    setSupplierSelectValue(rawValue);
    setCurrentSupplierId(
      rawValue && rawValue !== "iec" ? (rawValue as Id<"suppliers">) : null,
    );
    setCurrentPlanId(null);
  }

  function toggleMembership(name: string, checked: boolean) {
    setBundleMemberships((prev) =>
      checked ? [...prev, name] : prev.filter((x) => x !== name),
    );
  }

  async function handleFileUpload(file: File) {
    if (!sessionId || !activeIecTaozRates) return;
    setUploadLoading(true);
    setUploadError(null);
    try {
      const text = await file.text();
      const parsed = parseSmartMeterCsvText(text, activeIecTaozRates.rows);
      const id = await submitSmartMeterCsv({
        sessionId,
        billingPeriodStart: parsed.billingPeriodStart,
        billingPeriodEnd: parsed.billingPeriodEnd,
        totalKwh: parsed.totalKwh,
        kwhWeekdayDay: parsed.kwhWeekdayDay,
        kwhWeekdayNight: parsed.kwhWeekdayNight,
        kwhWeekendDay: parsed.kwhWeekendDay,
        kwhWeekendNight: parsed.kwhWeekendNight,
        kwhTaozSummerPeak: parsed.kwhTaozSummerPeak,
        kwhTaozSummerOffPeak: parsed.kwhTaozSummerOffPeak,
        kwhTaozWinterPeak: parsed.kwhTaozWinterPeak,
        kwhTaozWinterOffPeak: parsed.kwhTaozWinterOffPeak,
        ...(activeIecTaozRates.effectiveFrom !== null
          ? { iecTaozRatesEffectiveFrom: activeIecTaozRates.effectiveFrom }
          : {}),
      });
      setBillImportId(id);
    } catch {
      setUploadError(tw("upload_error"));
    } finally {
      setUploadLoading(false);
    }
  }

  async function handleGenerateRecommendation() {
    if (!sessionId) return;
    const previousPrimary = rec
      ? {
          pvId: rec.primaryPlanVersionId,
          savings: rec.primaryAnnualSavingsAgorot,
        }
      : null;
    setGenerating(true);
    setResultError(null);
    setNoChangeNotice(false);
    try {
      const hpId = await upsertHomeProfile({
        sessionId,
        hasSmartMeter: effectiveHasSmartMeter ?? "unknown",
        bundleMemberships,
        placeOfResidence: placeOfResidence ?? { he: "" },
        ...(cascadeStreetName ? { street: cascadeStreetName } : {}),
        ...(cascadeHouseNumber ? { houseNumber: cascadeHouseNumber } : {}),
        currentSupplierId,
        currentPlanId,
        approximateMonthlyKwh: null,
        workFromHome,
        hasEv,
        evChargingTime: hasEv ? evChargingTime : null,
        washerDryerTime,
        acUsageLevel,
        willingToShiftUsage,
        willingToAcceptOffBillBenefits,
      });
      await generateRecommendation({
        sessionId,
        homeProfileId: hpId,
        billImportId,
      });
      previousPrimaryRef.current = previousPrimary;
    } catch {
      setResultError(tw("result_error"));
    } finally {
      setGenerating(false);
    }
  }

  // ── Step navigation ──────────────────────────────────────────────────────

  const visibleSteps =
    effectiveHasSmartMeter === "yes" ? [0, 1, 2, 3, 4] : [0, 2, 3, 4];
  const displayStep = visibleSteps.indexOf(step);
  const totalDisplaySteps = visibleSteps.length;

  function goNext() {
    const idx = visibleSteps.indexOf(step);
    if (idx < visibleSteps.length - 1) setStep(visibleSteps[idx + 1]);
  }

  function goPrev() {
    const idx = visibleSteps.indexOf(step);
    if (idx > 0) setStep(visibleSteps[idx - 1]);
  }

  const stepLabels =
    effectiveHasSmartMeter === "yes"
      ? [
          tw("step_meter"),
          tw("step_upload"),
          tw("step_home"),
          tw("step_usage"),
          tw("step_results"),
        ]
      : [
          tw("step_meter"),
          tw("step_home"),
          tw("step_usage"),
          tw("step_results"),
        ];

  const canAdvance = step === 0 ? effectiveHasSmartMeter !== null : true;

  // ── Shared field prop objects ────────────────────────────────────────────

  const homeFieldsProps = {
    placeOfResidence,
    setPlaceOfResidence,
    cascadeCityCode,
    supplierSelectValue,
    onSupplierChange: handleSupplierChange,
    suppliers: suppliers?.map((s) => ({ _id: s._id, name: s.name })),
    bundleMemberships,
    toggleMembership,
    clearMemberships: () => setBundleMemberships([]),
    israelPlaces,
    currentSupplierId,
    currentPlanId,
    onCurrentPlanChange: (planId: string | null) =>
      setCurrentPlanId(planId as Id<"plans"> | null),
    plansForCurrentSupplier,
  };

  const usageFieldsProps = {
    workFromHome,
    setWorkFromHome,
    hasEv,
    setHasEv,
    evChargingTime,
    setEvChargingTime,
    washerDryerTime,
    setWasherDryerTime,
    acUsageLevel,
    setAcUsageLevel,
    willingToShiftUsage,
    setWillingToShiftUsage,
    willingToAcceptOffBillBenefits,
    setWillingToAcceptOffBillBenefits,
  };

  // ── Step rendering ───────────────────────────────────────────────────────

  function renderStep() {
    switch (step) {
      case 0:
        return (
          <MeterStep
            hasSmartMeter={hasSmartMeter}
            meterNotSure={meterNotSure}
            onMeterChoice={handleMeterChoice}
            onMeterNotSure={() => {
              setMeterNotSure(true);
              setHasSmartMeter(null);
            }}
            cascadeCityCode={cascadeCityCode}
            cascadeStreetCode={cascadeStreetCode}
            cascadeHouseNumber={cascadeHouseNumber}
            cities={cities}
            streets={streets}
            houseNumbers={houseNumbers}
            addressFound={addressFound}
            onCityChange={handleCityChange}
            onStreetChange={handleStreetChange}
            onHouseChange={setCascadeHouseNumber}
            onResetCascade={resetCascade}
            onResetStreet={() => {
              setCascadeStreetCode(null);
              setCascadeStreetName(null);
              setCascadeHouseNumber(null);
              setHasSmartMeter(null);
            }}
            onResetHouse={() => {
              setCascadeHouseNumber(null);
              setHasSmartMeter(null);
            }}
          />
        );
      case 1:
        return (
          <UploadStep
            onFileUpload={(file) => void handleFileUpload(file)}
            uploadLoading={uploadLoading}
            billImportId={billImportId}
            uploadError={uploadError}
            setUploadError={setUploadError}
          />
        );
      case 2:
        return <HomeStep {...homeFieldsProps} />;
      case 3:
        return <UsageStep {...usageFieldsProps} />;
      case 4:
        return (
          <ResultsStep
            sessionId={sessionId}
            rec={rec}
            evaluatedPlans={evaluatedPlans}
            generating={generating}
            resultError={resultError}
            noChangeNotice={noChangeNotice}
            onRecalculate={() => void handleGenerateRecommendation()}
            effectiveHasSmartMeter={effectiveHasSmartMeter}
            onFileUpload={(file) => void handleFileUpload(file)}
            uploadLoading={uploadLoading}
            billImportId={billImportId}
            uploadError={uploadError}
            setUploadError={setUploadError}
            homeFields={homeFieldsProps}
            usageFields={usageFieldsProps}
          />
        );
      default:
        return null;
    }
  }

  return (
    <main className="flex-1 px-6 py-8 max-w-lg md:max-w-2xl mx-auto w-full">
      <Wizard
        step={displayStep}
        totalSteps={totalDisplaySteps}
        onPrev={goPrev}
        onNext={goNext}
        onSubmit={() => setStep(4)}
        canAdvance={canAdvance}
        prevLabel={tw("prev")}
        nextLabel={tw("next")}
        submitLabel={tw("submit")}
        stepLabels={stepLabels}
      >
        {renderStep()}
      </Wizard>
    </main>
  );
}

interface WizardIslandProps {
  locale: string;
  convexUrl: string;
}

const RTL_LANGUAGES = ["he", "ar"];

export default function WizardIsland({ locale, convexUrl }: WizardIslandProps) {
  const [convex] = useState(() => new ConvexReactClient(convexUrl));

  useEffect(() => {
    void i18n.changeLanguage(locale);
  }, [locale]);

  useEffect(() => {
    function syncDocumentAttrs(lang: string) {
      document.documentElement.dir = RTL_LANGUAGES.includes(lang)
        ? "rtl"
        : "ltr";
      document.documentElement.lang = lang;
    }
    syncDocumentAttrs(i18n.resolvedLanguage ?? locale);
    i18n.on("languageChanged", syncDocumentAttrs);
    return () => i18n.off("languageChanged", syncDocumentAttrs);
  }, [locale]);

  useEffect(() => {
    function handleLangChange(e: Event) {
      const { lang } = (e as CustomEvent<{ lang: string }>).detail;
      void i18n.changeLanguage(lang);
    }
    window.addEventListener("chisko:lang-change", handleLangChange);
    return () =>
      window.removeEventListener("chisko:lang-change", handleLangChange);
  }, []);

  return (
    <ConvexProvider client={convex}>
      <Suspense fallback={null}>
        <WizardPage />
        <Footer />
      </Suspense>
    </ConvexProvider>
  );
}
