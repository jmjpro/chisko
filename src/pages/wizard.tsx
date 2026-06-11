import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { AddressCombobox } from "@/components/ui/combobox";
import Header from "../components/header";
import Footer from "../components/footer";
import CsvDropzone from "../components/CsvDropzone";
import Wizard from "../components/Wizard";
import WizardStep from "../components/WizardStep";

// Logical steps: 0=Meter, 1=Upload, 2=Home, 3=Usage, 4=Results
// Upload step (1) is skipped for non-smart-meter users.

export default function WizardPage() {
  const { t, i18n } = useTranslation();
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

  // Step 0: meter type
  const [hasSmartMeter, setHasSmartMeter] = useState<"yes" | "no" | null>(null);
  const [meterNotSure, setMeterNotSure] = useState(false);
  // Cascading address picker (only used in meterNotSure path)
  const [cascadeCityCode, setCascadeCityCode] = useState<number | null>(null);
  const [cascadeCityName, setCascadeCityName] = useState<string | null>(null);
  const [cascadeStreetCode, setCascadeStreetCode] = useState<number | null>(
    null,
  );
  const [cascadeStreetName, setCascadeStreetName] = useState<string | null>(
    null,
  );
  const [cascadeHouseNumber, setCascadeHouseNumber] = useState<string | null>(
    null,
  );

  // Form fields
  const [city, setCity] = useState("");
  const [bundleMemberships, setBundleMemberships] = useState<string[]>([]);
  const [currentSupplierId, setCurrentSupplierId] =
    useState<Id<"suppliers"> | null>(null);
  const [supplierSelectValue, setSupplierSelectValue] = useState("iec");
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

  // Smart Meter Registry — cascading picker queries (city deferred until needed)
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

  // Derive smart meter status: explicit choice when the user picked yes/no,
  // or resolved from the Smart Meter Registry lookup when they chose "not sure".
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
      token = crypto.randomUUID();
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

  // ── Step 0 handlers ──────────────────────────────────────────────────────

  function handleMeterChoice(choice: "yes" | "no") {
    setHasSmartMeter(choice);
    setMeterNotSure(false);
    if (choice === "no") setBillImportId(null);
    resetCascade();
  }

  function handleMeterNotSure() {
    setMeterNotSure(true);
    setHasSmartMeter(null);
  }

  function resetCascade() {
    setCascadeCityCode(null);
    setCascadeCityName(null);
    setCascadeStreetCode(null);
    setCascadeStreetName(null);
    setCascadeHouseNumber(null);
  }

  function handleCascadeCityChange(cityCode: number, cityName: string) {
    setCascadeCityCode(cityCode);
    setCascadeCityName(cityName);
    setCascadeStreetCode(null);
    setCascadeStreetName(null);
    setCascadeHouseNumber(null);
    setCity(cityName); // pre-fill city for "Your Home" step
  }

  function handleCascadeStreetChange(streetCode: number, streetName: string) {
    setCascadeStreetCode(streetCode);
    setCascadeStreetName(streetName);
    setCascadeHouseNumber(null);
  }

  function handleCascadeHouseChange(houseNumber: string) {
    setCascadeHouseNumber(houseNumber);
  }

  void cascadeCityName;
  void cascadeStreetName;

  // ── Recommendation generation ────────────────────────────────────────────

  async function handleGenerateRecommendation() {
    if (!sessionId) return;
    setGenerating(true);
    setResultError(null);
    try {
      const hpId = await upsertHomeProfile({
        sessionId,
        hasSmartMeter: effectiveHasSmartMeter ?? "unknown",
        bundleMemberships,
        city,
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
      });
      setHomeProfileId(hpId);
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

  void homeProfileId;

  async function handleFileUpload(file: File) {
    if (!sessionId) return;
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

  // ── Step navigation ──────────────────────────────────────────────────────

  // Upload step (logical 1) only appears for smart meter users
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

  function goToResults() {
    setStep(4);
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

  // ── Step rendering ────────────────────────────────────────────────────────

  function renderStep() {
    switch (step) {
      // ── Step 0: Meter type ───────────────────────────────────────────────
      case 0:
        return (
          <WizardStep title={tw("meter_title")}>
            <div className="space-y-3 mb-6">
              {/* Smart meter */}
              <label className="flex items-center gap-4 cursor-pointer rounded-lg border border-input p-3 hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <input
                  type="radio"
                  name="meterType"
                  checked={hasSmartMeter === "yes" && !meterNotSure}
                  onChange={() => handleMeterChoice("yes")}
                  className="accent-primary shrink-0"
                />
                <img
                  src="/meterSmart.webp"
                  alt=""
                  className="h-16 w-auto rounded"
                />
                <span className="text-sm font-medium">
                  {tw("meter_smart_label")}
                </span>
              </label>

              {/* Manual meter */}
              <label className="flex items-center gap-4 cursor-pointer rounded-lg border border-input p-3 hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <input
                  type="radio"
                  name="meterType"
                  checked={hasSmartMeter === "no" && !meterNotSure}
                  onChange={() => handleMeterChoice("no")}
                  className="accent-primary shrink-0"
                />
                <img
                  src="/meterManual.webp"
                  alt=""
                  className="h-16 w-auto rounded"
                />
                <span className="text-sm font-medium">
                  {tw("meter_manual_label")}
                </span>
              </label>

              {/* Not sure */}
              <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-input p-3 hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <input
                  type="radio"
                  name="meterType"
                  checked={meterNotSure}
                  onChange={handleMeterNotSure}
                  className="accent-primary shrink-0"
                />
                <span className="text-sm font-medium">
                  {tw("meter_not_sure_label")}
                </span>
              </label>
            </div>

            {/* Cascading address picker */}
            {meterNotSure && (
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm font-semibold mb-3">
                  {tw("meter_lookup_title")}
                </p>

                {i18n.language !== "he" && (
                  <p className="text-xs text-muted-foreground mb-3">
                    {tw("meter_lookup_hebrew_note")}
                  </p>
                )}

                {/* City */}
                <div className="mb-3">
                  <label className="block text-xs font-medium mb-1">
                    {tw("meter_lookup_city")}
                  </label>
                  <AddressCombobox
                    items={(cities ?? []).map((c) => ({
                      value: c.cityCode,
                      label: c.cityName,
                    }))}
                    value={cascadeCityCode}
                    onValueChange={(item) => {
                      if (!item) {
                        resetCascade();
                        return;
                      }
                      handleCascadeCityChange(item.value as number, item.label);
                    }}
                    placeholder={tw("meter_lookup_city_placeholder")}
                    emptyText={tw("meter_lookup_no_results")}
                    loading={cities === undefined}
                  />
                </div>

                {/* Street */}
                {cascadeCityCode !== null && (
                  <div className="mb-3">
                    <label className="block text-xs font-medium mb-1">
                      {tw("meter_lookup_street")}
                    </label>
                    <AddressCombobox
                      items={(streets ?? []).map((s) => ({
                        value: s.streetCode,
                        label: s.streetName,
                      }))}
                      value={cascadeStreetCode}
                      onValueChange={(item) => {
                        if (!item) {
                          setCascadeStreetCode(null);
                          setCascadeStreetName(null);
                          setCascadeHouseNumber(null);
                          setHasSmartMeter(null);
                          return;
                        }
                        handleCascadeStreetChange(
                          item.value as number,
                          item.label,
                        );
                      }}
                      placeholder={tw("meter_lookup_street_placeholder")}
                      emptyText={tw("meter_lookup_no_results")}
                      loading={streets === undefined}
                    />
                  </div>
                )}

                {/* House number */}
                {cascadeStreetCode !== null && (
                  <div className="mb-3">
                    <label className="block text-xs font-medium mb-1">
                      {tw("meter_lookup_house")}
                    </label>
                    <AddressCombobox
                      items={(houseNumbers ?? []).map((h) => ({
                        value: h,
                        label: h,
                      }))}
                      value={cascadeHouseNumber}
                      onValueChange={(item) => {
                        if (!item) {
                          setCascadeHouseNumber(null);
                          setHasSmartMeter(null);
                          return;
                        }
                        handleCascadeHouseChange(item.value as string);
                      }}
                      placeholder={tw("meter_lookup_house_placeholder")}
                      emptyText={tw("meter_lookup_no_results")}
                      loading={houseNumbers === undefined}
                    />
                  </div>
                )}

                {/* Lookup result */}
                {cascadeHouseNumber && addressFound === undefined && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {tw("meter_lookup_checking")}
                  </p>
                )}
                {cascadeHouseNumber && addressFound === true && (
                  <p className="text-sm text-primary mt-2">
                    {tw("meter_lookup_found")}
                  </p>
                )}
                {cascadeHouseNumber && addressFound === false && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {tw("meter_lookup_not_found")}
                  </p>
                )}
              </div>
            )}
          </WizardStep>
        );

      // ── Step 1: Upload (smart meter users only) ──────────────────────────
      case 1:
        return (
          <WizardStep
            title={tw("upload_title")}
            description={tw("upload_description")}
          >
            <div className="mb-5 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
              <span className="font-semibold text-primary">
                {tw("upload_recommended_label")}
              </span>{" "}
              {tw("upload_recommended")}
            </div>

            <CsvDropzone
              onValidFile={(file) => void handleFileUpload(file)}
              onError={setUploadError}
              loading={uploadLoading}
              success={!!billImportId}
              error={uploadError}
            />
          </WizardStep>
        );

      // ── Step 2: Your Home ────────────────────────────────────────────────
      case 2:
        return (
          <WizardStep title={tw("home_title")}>
            {/* City — hidden when pre-filled from registry lookup */}
            {cascadeCityCode === null && (
              <div className="mb-5">
                <label className="block text-sm font-medium mb-1.5">
                  {tw("city_title")}
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="border border-input rounded-md px-3 py-2 w-full bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring"
                  placeholder={tw("city_placeholder")}
                />
              </div>
            )}

            {/* Current supplier */}
            <div className="mb-5">
              <label className="block text-sm font-medium mb-1.5">
                {tw("supplier_title")}
              </label>
              <select
                value={supplierSelectValue}
                onChange={(e) => {
                  setSupplierSelectValue(e.target.value);
                  setCurrentSupplierId(
                    e.target.value && e.target.value !== "iec"
                      ? (e.target.value as Id<"suppliers">)
                      : null,
                  );
                }}
                className="border border-input rounded-md px-3 py-2 w-full bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring"
              >
                <option value="iec">{tw("supplier_iec")}</option>
                {(suppliers ?? []).map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
                <option value="">{tw("supplier_unknown")}</option>
              </select>
            </div>

            {/* Bundle memberships */}
            <div>
              <p className="text-sm font-medium mb-2">
                {tw("memberships_title")}
              </p>
              <div className="space-y-2">
                {(["HOT triple", "HOT Mobile", "Cellcom"] as const).map((b) => (
                  <label
                    key={b}
                    className="flex items-center gap-2.5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={bundleMemberships.includes(b)}
                      onChange={(e) => toggleMembership(b, e.target.checked)}
                      className="accent-primary"
                    />
                    <span className="text-sm">{b}</span>
                  </label>
                ))}
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bundleMemberships.length === 0}
                    onChange={(e) => {
                      if (e.target.checked) setBundleMemberships([]);
                    }}
                    className="accent-primary"
                  />
                  <span className="text-sm">{tw("memberships_none")}</span>
                </label>
              </div>
            </div>
          </WizardStep>
        );

      // ── Step 3: Your Usage ───────────────────────────────────────────────
      case 3:
        return (
          <WizardStep title={tw("usage_title")}>
            {/* Work from home */}
            <fieldset className="mb-5">
              <legend className="text-sm font-medium mb-2">
                {tw("wfh_title")}
              </legend>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                {(
                  [
                    ["always", "wfh_always"],
                    ["sometimes", "wfh_sometimes"],
                    ["never", "wfh_never"],
                  ] as const
                ).map(([val, key]) => (
                  <label
                    key={val}
                    className="flex items-center gap-2 cursor-pointer text-sm"
                  >
                    <input
                      type="radio"
                      name="wfh"
                      checked={workFromHome === val}
                      onChange={() => setWorkFromHome(val)}
                      className="accent-primary"
                    />
                    {tw(key)}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* EV */}
            <fieldset className="mb-5">
              <legend className="text-sm font-medium mb-2">
                {tw("ev_title")}
              </legend>
              <div className="flex gap-5 mb-3">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="ev"
                    checked={hasEv}
                    onChange={() => setHasEv(true)}
                    className="accent-primary"
                  />
                  {t("yes")}
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="ev"
                    checked={!hasEv}
                    onChange={() => {
                      setHasEv(false);
                      setEvChargingTime(null);
                    }}
                    className="accent-primary"
                  />
                  {t("no")}
                </label>
              </div>
              {hasEv && (
                <div className="ms-5">
                  <p className="text-sm font-medium mb-2">
                    {tw("ev_charging_title")}
                  </p>
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                    {(
                      [
                        ["day", "time_day"],
                        ["night", "time_night"],
                        ["mixed", "time_mixed"],
                      ] as const
                    ).map(([val, key]) => (
                      <label
                        key={val}
                        className="flex items-center gap-2 cursor-pointer text-sm"
                      >
                        <input
                          type="radio"
                          name="evtime"
                          checked={evChargingTime === val}
                          onChange={() => setEvChargingTime(val)}
                          className="accent-primary"
                        />
                        {tw(key)}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </fieldset>

            {/* Washer / dryer */}
            <fieldset className="mb-5">
              <legend className="text-sm font-medium mb-2">
                {tw("washer_title")}
              </legend>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5">
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
                    className="flex items-center gap-2 cursor-pointer text-sm"
                  >
                    <input
                      type="radio"
                      name="washer"
                      checked={washerDryerTime === val}
                      onChange={() => setWasherDryerTime(val)}
                      className="accent-primary"
                    />
                    {tw(key)}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* AC usage */}
            <fieldset className="mb-5">
              <legend className="text-sm font-medium mb-2">
                {tw("ac_title")}
              </legend>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5">
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
                    className="flex items-center gap-2 cursor-pointer text-sm"
                  >
                    <input
                      type="radio"
                      name="ac"
                      checked={acUsageLevel === val}
                      onChange={() => setAcUsageLevel(val)}
                      className="accent-primary"
                    />
                    {tw(key)}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Willing to shift */}
            <fieldset>
              <legend className="text-sm font-medium mb-2">
                {tw("shift_title")}
              </legend>
              <div className="flex gap-5">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="shift"
                    checked={willingToShiftUsage}
                    onChange={() => setWillingToShiftUsage(true)}
                    className="accent-primary"
                  />
                  {t("yes")}
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="shift"
                    checked={!willingToShiftUsage}
                    onChange={() => setWillingToShiftUsage(false)}
                    className="accent-primary"
                  />
                  {t("no")}
                </label>
              </div>
            </fieldset>
          </WizardStep>
        );

      case 4:
        return renderResults();

      default:
        return null;
    }
  }

  // ── Results page ──────────────────────────────────────────────────────────

  function renderRecommendation() {
    if (resultError) {
      return <p className="text-destructive">{resultError}</p>;
    }

    if (generating || rec === undefined) {
      return (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">
            {tw("result_loading")}
          </p>
        </div>
      );
    }

    if (rec === null) {
      return <p className="text-destructive">{tw("result_not_found")}</p>;
    }

    const primary = evaluatedPlans?.find(
      (p) => p.planVersionId === rec.primaryPlanVersionId,
    );
    const noChange = evaluatedPlans?.find(
      (p) => p.planVersionId === rec.noChangePlanVersionId,
    );

    return (
      <>
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 mb-4">
          <p className="font-semibold text-lg">
            {primary?.supplier?.name} — {primary?.plan?.name}
          </p>
          <p className="text-primary font-medium mt-1">
            {tw("result_savings", {
              amount: Math.round(
                rec.primaryAnnualSavingsAgorot / 100,
              ).toLocaleString(),
            })}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {tw("result_confidence", {
              level: tw(`confidence_${rec.confidenceLevel}`),
            })}
          </p>
        </div>

        {rec.showNoChangeSeparately && noChange && (
          <div className="rounded-lg border border-border p-4 mb-4">
            <p className="text-sm text-muted-foreground mb-1">
              {tw("result_no_change_label")}
            </p>
            <p className="font-semibold">
              {noChange.supplier?.name} — {noChange.plan?.name}
            </p>
            <p className="text-primary mt-1">
              {tw("result_savings", {
                amount: Math.round(
                  rec.noChangePlanAnnualSavingsAgorot / 100,
                ).toLocaleString(),
              })}
            </p>
          </div>
        )}

        <p className="text-sm text-muted-foreground mt-4">
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

  function renderResults() {
    return (
      <WizardStep title={tw("result_title")}>
        {renderRecommendation()}

        {/* ── Editable answers ── */}
        <div className="mt-8 pt-6 border-t border-border">
          <h3 className="text-base font-semibold mb-4">
            {tw("review_answers_title")}
          </h3>

          <div className="space-y-5">
            {/* File — only shown for smart meter users */}
            {effectiveHasSmartMeter === "yes" && (
              <div>
                <p className="text-sm font-medium mb-2">{tw("upload_title")}</p>
                <CsvDropzone
                  onValidFile={(file) => void handleFileUpload(file)}
                  onError={setUploadError}
                  loading={uploadLoading}
                  success={!!billImportId}
                  error={uploadError}
                />
              </div>
            )}

            {/* City — always shown, even when pre-filled from lookup */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                {tw("city_title")}
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="border border-input rounded-md px-3 py-2 w-full bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring"
                placeholder={tw("city_placeholder")}
              />
            </div>

            {/* Current supplier */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                {tw("supplier_title")}
              </label>
              <select
                value={supplierSelectValue}
                onChange={(e) => {
                  setSupplierSelectValue(e.target.value);
                  setCurrentSupplierId(
                    e.target.value && e.target.value !== "iec"
                      ? (e.target.value as Id<"suppliers">)
                      : null,
                  );
                }}
                className="border border-input rounded-md px-3 py-2 w-full bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring"
              >
                <option value="iec">{tw("supplier_iec")}</option>
                {(suppliers ?? []).map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
                <option value="">{tw("supplier_unknown")}</option>
              </select>
            </div>

            {/* Bundle memberships */}
            <div>
              <p className="text-sm font-medium mb-2">
                {tw("memberships_title")}
              </p>
              <div className="space-y-2">
                {(["HOT triple", "HOT Mobile", "Cellcom"] as const).map((b) => (
                  <label
                    key={b}
                    className="flex items-center gap-2.5 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={bundleMemberships.includes(b)}
                      onChange={(e) => toggleMembership(b, e.target.checked)}
                      className="accent-primary"
                    />
                    {b}
                  </label>
                ))}
                <label className="flex items-center gap-2.5 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={bundleMemberships.length === 0}
                    onChange={(e) => {
                      if (e.target.checked) setBundleMemberships([]);
                    }}
                    className="accent-primary"
                  />
                  {tw("memberships_none")}
                </label>
              </div>
            </div>

            {/* Work from home */}
            <div>
              <p className="text-sm font-medium mb-2">{tw("wfh_title")}</p>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                {(
                  [
                    ["always", "wfh_always"],
                    ["sometimes", "wfh_sometimes"],
                    ["never", "wfh_never"],
                  ] as const
                ).map(([val, key]) => (
                  <label
                    key={val}
                    className="flex items-center gap-2 cursor-pointer text-sm"
                  >
                    <input
                      type="radio"
                      name="review_wfh"
                      checked={workFromHome === val}
                      onChange={() => setWorkFromHome(val)}
                      className="accent-primary"
                    />
                    {tw(key)}
                  </label>
                ))}
              </div>
            </div>

            {/* EV */}
            <div>
              <p className="text-sm font-medium mb-2">{tw("ev_title")}</p>
              <div className="flex gap-5 mb-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="review_ev"
                    checked={hasEv}
                    onChange={() => setHasEv(true)}
                    className="accent-primary"
                  />
                  {t("yes")}
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="review_ev"
                    checked={!hasEv}
                    onChange={() => {
                      setHasEv(false);
                      setEvChargingTime(null);
                    }}
                    className="accent-primary"
                  />
                  {t("no")}
                </label>
              </div>
              {hasEv && (
                <div className="ms-5">
                  <p className="text-sm font-medium mb-2">
                    {tw("ev_charging_title")}
                  </p>
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                    {(
                      [
                        ["day", "time_day"],
                        ["night", "time_night"],
                        ["mixed", "time_mixed"],
                      ] as const
                    ).map(([val, key]) => (
                      <label
                        key={val}
                        className="flex items-center gap-2 cursor-pointer text-sm"
                      >
                        <input
                          type="radio"
                          name="review_evtime"
                          checked={evChargingTime === val}
                          onChange={() => setEvChargingTime(val)}
                          className="accent-primary"
                        />
                        {tw(key)}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Washer / dryer */}
            <div>
              <p className="text-sm font-medium mb-2">{tw("washer_title")}</p>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5">
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
                    className="flex items-center gap-2 cursor-pointer text-sm"
                  >
                    <input
                      type="radio"
                      name="review_washer"
                      checked={washerDryerTime === val}
                      onChange={() => setWasherDryerTime(val)}
                      className="accent-primary"
                    />
                    {tw(key)}
                  </label>
                ))}
              </div>
            </div>

            {/* AC */}
            <div>
              <p className="text-sm font-medium mb-2">{tw("ac_title")}</p>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5">
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
                    className="flex items-center gap-2 cursor-pointer text-sm"
                  >
                    <input
                      type="radio"
                      name="review_ac"
                      checked={acUsageLevel === val}
                      onChange={() => setAcUsageLevel(val)}
                      className="accent-primary"
                    />
                    {tw(key)}
                  </label>
                ))}
              </div>
            </div>

            {/* Shift */}
            <div>
              <p className="text-sm font-medium mb-2">{tw("shift_title")}</p>
              <div className="flex gap-5">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="review_shift"
                    checked={willingToShiftUsage}
                    onChange={() => setWillingToShiftUsage(true)}
                    className="accent-primary"
                  />
                  {t("yes")}
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="review_shift"
                    checked={!willingToShiftUsage}
                    onChange={() => setWillingToShiftUsage(false)}
                    className="accent-primary"
                  />
                  {t("no")}
                </label>
              </div>
            </div>
          </div>

          <Button
            onClick={() => void handleGenerateRecommendation()}
            disabled={generating}
            className="mt-6 w-full"
          >
            {tw("recalculate")}
          </Button>
        </div>
      </WizardStep>
    );
  }

  // ── Page shell ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 px-6 py-8 max-w-lg mx-auto w-full">
        <Wizard
          step={displayStep}
          totalSteps={totalDisplaySteps}
          onPrev={goPrev}
          onNext={goNext}
          onSubmit={goToResults}
          canAdvance={canAdvance}
          prevLabel={tw("prev")}
          nextLabel={tw("next")}
          submitLabel={tw("submit")}
          stepLabels={stepLabels}
        >
          {renderStep()}
        </Wizard>
      </main>
      <Footer />
    </div>
  );
}
