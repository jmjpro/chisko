import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import Header from "../components/header";
import Footer from "../components/footer";
import CsvDropzone from "../components/CsvDropzone";
import Wizard from "../components/Wizard";
import WizardStep from "../components/WizardStep";

// 0 = Upload, 1 = Your Home, 2 = Your Usage, 3 = Results
const TOTAL_STEPS = 4;

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
  // Prevents the auto-generate effect from firing more than once on initial
  // arrival at the results step. Recalculation bypasses this via the button.
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
    sessionId && step === 3 ? { sessionId } : "skip",
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

  async function handleGenerateRecommendation() {
    if (!sessionId) return;
    setGenerating(true);
    setResultError(null);
    try {
      const hpId = await upsertHomeProfile({
        sessionId,
        hasSmartMeter: billImportId ? "yes" : "unknown",
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

  // Auto-generate on first arrival at the results step.
  useEffect(() => {
    if (step !== 3 || !sessionId || hasStartedGenerating.current) return;
    hasStartedGenerating.current = true;
    void handleGenerateRecommendation();
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Step content ──────────────────────────────────────────────────────────

  function renderStep() {
    switch (step) {
      // ── Step 0: Upload (optional, strongly recommended) ──────────────────
      case 0:
        return (
          <WizardStep
            title={tw("upload_title")}
            description={tw("upload_description")}
          >
            {/* Recommended callout */}
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

      // ── Step 1: Your Home ────────────────────────────────────────────────
      case 1:
        return (
          <WizardStep title={tw("home_title")}>
            {/* City */}
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

            {/* Current supplier */}
            <div className="mb-5">
              <label className="block text-sm font-medium mb-1.5">
                {tw("supplier_title")}
              </label>
              <select
                value={currentSupplierId ?? ""}
                onChange={(e) =>
                  setCurrentSupplierId(
                    e.target.value ? (e.target.value as Id<"suppliers">) : null,
                  )
                }
                className="border border-input rounded-md px-3 py-2 w-full bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring"
              >
                <option value="">{tw("supplier_unknown")}</option>
                {(suppliers ?? []).map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
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

      // ── Step 2: Your Usage ───────────────────────────────────────────────
      case 2:
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

      case 3:
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
            {/* File */}
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

            {/* City */}
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
                value={currentSupplierId ?? ""}
                onChange={(e) =>
                  setCurrentSupplierId(
                    e.target.value ? (e.target.value as Id<"suppliers">) : null,
                  )
                }
                className="border border-input rounded-md px-3 py-2 w-full bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring"
              >
                <option value="">{tw("supplier_unknown")}</option>
                {(suppliers ?? []).map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
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
          step={step}
          totalSteps={TOTAL_STEPS}
          onPrev={() => setStep((s) => s - 1)}
          onNext={() => setStep((s) => s + 1)}
          onSubmit={() => setStep(3)}
          canAdvance={true}
          prevLabel={tw("prev")}
          nextLabel={tw("next")}
          submitLabel={tw("submit")}
          stepLabels={[
            tw("step_upload"),
            tw("step_home"),
            tw("step_usage"),
            tw("step_results"),
          ]}
        >
          {renderStep()}
        </Wizard>
      </main>
      <Footer />
    </div>
  );
}
