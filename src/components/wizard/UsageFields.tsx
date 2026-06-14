import { useTranslation } from "react-i18next";

export interface UsageFieldsProps {
  workFromHome: "always" | "sometimes" | "never";
  setWorkFromHome: (v: "always" | "sometimes" | "never") => void;
  hasEv: boolean;
  setHasEv: (v: boolean) => void;
  evChargingTime: "day" | "night" | "mixed" | null;
  setEvChargingTime: (v: "day" | "night" | "mixed" | null) => void;
  washerDryerTime: "day" | "night" | "flexible" | null;
  setWasherDryerTime: (v: "day" | "night" | "flexible" | null) => void;
  acUsageLevel: "heavy" | "moderate" | "light" | "none";
  setAcUsageLevel: (v: "heavy" | "moderate" | "light" | "none") => void;
  willingToShiftUsage: boolean;
  setWillingToShiftUsage: (v: boolean) => void;
  willingToAcceptOffBillBenefits: boolean;
  setWillingToAcceptOffBillBenefits: (v: boolean) => void;
  namePrefix?: string;
}

export default function UsageFields({
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
  namePrefix = "",
}: UsageFieldsProps) {
  const { t } = useTranslation();
  const { t: tw } = useTranslation("wizard");

  return (
    <>
      <fieldset className="mb-5">
        <legend className="text-sm font-medium mb-2">{tw("wfh_title")}</legend>
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
                name={`${namePrefix}wfh`}
                checked={workFromHome === val}
                onChange={() => setWorkFromHome(val)}
                className="accent-primary"
              />
              {tw(key)}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mb-5">
        <legend className="text-sm font-medium mb-2">{tw("ev_title")}</legend>
        <div className="flex gap-5 mb-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="radio"
              name={`${namePrefix}ev`}
              checked={hasEv}
              onChange={() => setHasEv(true)}
              className="accent-primary"
            />
            {t("yes")}
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="radio"
              name={`${namePrefix}ev`}
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
                    name={`${namePrefix}evtime`}
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
                name={`${namePrefix}washer`}
                checked={washerDryerTime === val}
                onChange={() => setWasherDryerTime(val)}
                className="accent-primary"
              />
              {tw(key)}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mb-5">
        <legend className="text-sm font-medium mb-2">{tw("ac_title")}</legend>
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
                name={`${namePrefix}ac`}
                checked={acUsageLevel === val}
                onChange={() => setAcUsageLevel(val)}
                className="accent-primary"
              />
              {tw(key)}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mb-5">
        <legend className="text-sm font-medium mb-2">
          {tw("shift_title")}
        </legend>
        <div className="flex gap-5">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="radio"
              name={`${namePrefix}shift`}
              checked={willingToShiftUsage}
              onChange={() => setWillingToShiftUsage(true)}
              className="accent-primary"
            />
            {t("yes")}
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="radio"
              name={`${namePrefix}shift`}
              checked={!willingToShiftUsage}
              onChange={() => setWillingToShiftUsage(false)}
              className="accent-primary"
            />
            {t("no")}
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium mb-2">
          {tw("off_bill_title")}
        </legend>
        <p className="text-xs text-muted-foreground mb-2">
          {tw("off_bill_description")}
        </p>
        <div className="flex gap-5">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="radio"
              name={`${namePrefix}offbill`}
              checked={willingToAcceptOffBillBenefits}
              onChange={() => setWillingToAcceptOffBillBenefits(true)}
              className="accent-primary"
            />
            {t("yes")}
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="radio"
              name={`${namePrefix}offbill`}
              checked={!willingToAcceptOffBillBenefits}
              onChange={() => setWillingToAcceptOffBillBenefits(false)}
              className="accent-primary"
            />
            {t("no")}
          </label>
        </div>
      </fieldset>
    </>
  );
}
