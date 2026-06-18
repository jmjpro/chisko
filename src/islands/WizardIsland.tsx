import { useEffect, useRef, useState, Suspense } from "react";
import { useTranslation } from "react-i18next";
import {
  ConvexProvider,
  ConvexReactClient,
  useAction,
  useMutation,
  useQuery,
} from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import Header from "../components/header";
import Footer from "../components/footer";
import { generateSessionToken } from "../lib/sessionToken";
import { rewriteStorageUrl } from "../lib/rewriteStorageUrl";
import { uploadFileWithRetry } from "../lib/uploadFileWithRetry";
import Wizard from "../components/Wizard";
import MeterStep from "../components/wizard/MeterStep";
import UploadStep from "../components/wizard/UploadStep";
import HomeStep from "../components/wizard/HomeStep";
import UsageStep from "../components/wizard/UsageStep";
import ResultsStep from "../components/wizard/ResultsStep";
import i18n from "../i18n";

// Logical steps: 0=Meter, 1=Upload, 2=Home, 3=Usage, 4=Results
// Upload step (1) is skipped for non-smart-meter users.

function WizardPage({ convexUrl }: { convexUrl: string }) {
  const { t: tw } = useTranslation("wizard");

  const [step, setStep] = useState(0);
  const [sessionId, setSessionId] = useState<Id<"sessions"> | null>(null);
  const [billImportId, setBillImportId] = useState<Id<"billImports"> | null>(
    null,
  );

  // Step 0: meter type
  const [hasSmartMeter, setHasSmartMeter] = useState<"yes" | "no" | null>(null);
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
  const [uploadProgress, setUploadProgress] = useState<number | undefined>(
    undefined,
  );
  const [uploadRetrying, setUploadRetrying] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [resultError, setResultError] = useState<string | null>(null);
  const hasStartedGenerating = useRef(false);

  // Convex mutations / actions
  const getOrCreateSession = useMutation(api.sessions.getOrCreate);
  const generateUploadUrl = useMutation(api.billImports.generateUploadUrl);
  const parseSmartMeterCsv = useAction(api.billImports.parseSmartMeterCsv);
  const upsertHomeProfile = useMutation(api.homeProfiles.upsert);
  const generateRecommendation = useMutation(api.recommendations.generate);
  const suppliers = useQuery(api.suppliers.list);
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
    const key = "ec2-session-token";
    let token = localStorage.getItem(key);
    if (!token) {
      token = generateSessionToken();
      localStorage.setItem(key, token);
    }
    getOrCreateSession({ sessionToken: token })
      .then(setSessionId)
      .catch(console.error);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-generate on first arrival at results
  useEffect(() => {
    if (step !== 4 || !sessionId || hasStartedGenerating.current) return;
    hasStartedGenerating.current = true;
    void handleGenerateRecommendation();
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }

  function toggleMembership(name: string, checked: boolean) {
    setBundleMemberships((prev) =>
      checked ? [...prev, name] : prev.filter((x) => x !== name),
    );
  }

  async function handleFileUpload(file: File) {
    if (!sessionId) return;
    setUploadLoading(true);
    setUploadProgress(undefined);
    setUploadRetrying(false);
    setUploadError(null);
    try {
      const rawUploadUrl = await generateUploadUrl({});
      const uploadUrl = rewriteStorageUrl(rawUploadUrl, convexUrl);
      const { storageId } = await uploadFileWithRetry(file, uploadUrl, {
        onProgress: (percent) => {
          setUploadRetrying(false);
          setUploadProgress(percent);
        },
        onRetry: () => setUploadRetrying(true),
      });
      const id = await parseSmartMeterCsv({
        storageId: storageId as Id<"_storage">,
        sessionId,
      });
      setBillImportId(id);
    } catch {
      setUploadError(tw("upload_error"));
    } finally {
      setUploadLoading(false);
      setUploadRetrying(false);
    }
  }

  async function handleGenerateRecommendation() {
    if (!sessionId) return;
    setGenerating(true);
    setResultError(null);
    try {
      const hpId = await upsertHomeProfile({
        sessionId,
        hasSmartMeter: effectiveHasSmartMeter ?? "unknown",
        bundleMemberships,
        placeOfResidence: placeOfResidence ?? { he: "" },
        ...(cascadeStreetName ? { street: cascadeStreetName } : {}),
        ...(cascadeHouseNumber ? { houseNumber: cascadeHouseNumber } : {}),
        currentSupplierId,
        currentPlanId: null,
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
            uploadProgress={uploadProgress}
            uploadRetrying={uploadRetrying}
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
            rec={rec}
            evaluatedPlans={evaluatedPlans}
            generating={generating}
            resultError={resultError}
            onRecalculate={() => void handleGenerateRecommendation()}
            effectiveHasSmartMeter={effectiveHasSmartMeter}
            onFileUpload={(file) => void handleFileUpload(file)}
            uploadLoading={uploadLoading}
            uploadProgress={uploadProgress}
            uploadRetrying={uploadRetrying}
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

export default function WizardIsland({ locale, convexUrl }: WizardIslandProps) {
  const [convex] = useState(() => new ConvexReactClient(convexUrl));

  useEffect(() => {
    void i18n.changeLanguage(locale);
  }, [locale]);

  return (
    <ConvexProvider client={convex}>
      <Suspense fallback={null}>
        <div className="min-h-screen flex flex-col">
          <Header />
          <WizardPage convexUrl={convexUrl} />
          <Footer />
        </div>
      </Suspense>
    </ConvexProvider>
  );
}
