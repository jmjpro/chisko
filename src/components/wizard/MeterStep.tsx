import { useTranslation } from "react-i18next";
import { AddressCombobox } from "@/components/ui/combobox";
import WizardStep from "@/components/WizardStep";

interface CityItem {
  cityCode: number;
  cityName: string;
}
interface StreetItem {
  streetCode: number;
  streetName: string;
}

export interface MeterStepProps {
  hasSmartMeter: "yes" | "no" | null;
  meterNotSure: boolean;
  onMeterChoice: (choice: "yes" | "no") => void;
  onMeterNotSure: () => void;
  cascadeCityCode: number | null;
  cascadeStreetCode: number | null;
  cascadeHouseNumber: string | null;
  cities: CityItem[] | undefined;
  streets: StreetItem[] | undefined;
  houseNumbers: string[] | undefined;
  addressFound: boolean | null | undefined;
  onCityChange: (cityCode: number, cityName: string) => void;
  onStreetChange: (streetCode: number, streetName: string) => void;
  onHouseChange: (houseNumber: string) => void;
  onResetCascade: () => void;
  onResetStreet: () => void;
  onResetHouse: () => void;
}

export default function MeterStep({
  hasSmartMeter,
  meterNotSure,
  onMeterChoice,
  onMeterNotSure,
  cascadeCityCode,
  cascadeStreetCode,
  cascadeHouseNumber,
  cities,
  streets,
  houseNumbers,
  addressFound,
  onCityChange,
  onStreetChange,
  onHouseChange,
  onResetCascade,
  onResetStreet,
  onResetHouse,
}: MeterStepProps) {
  const { t: tw, i18n } = useTranslation("wizard");

  return (
    <WizardStep title={tw("meter_title")}>
      <div className="space-y-3 mb-6">
        <label className="flex items-center gap-4 cursor-pointer rounded-lg border border-input p-3 hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
          <input
            type="radio"
            name="meterType"
            checked={hasSmartMeter === "yes" && !meterNotSure}
            onChange={() => onMeterChoice("yes")}
            className="accent-primary shrink-0"
          />
          <img src="/meterSmart.webp" alt="" className="h-16 w-auto rounded" />
          <span className="text-sm font-medium">{tw("meter_smart_label")}</span>
        </label>

        <label className="flex items-center gap-4 cursor-pointer rounded-lg border border-input p-3 hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
          <input
            type="radio"
            name="meterType"
            checked={hasSmartMeter === "no" && !meterNotSure}
            onChange={() => onMeterChoice("no")}
            className="accent-primary shrink-0"
          />
          <img src="/meterManual.webp" alt="" className="h-16 w-auto rounded" />
          <span className="text-sm font-medium">
            {tw("meter_manual_label")}
          </span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-input p-3 hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
          <input
            type="radio"
            name="meterType"
            checked={meterNotSure}
            onChange={onMeterNotSure}
            className="accent-primary shrink-0"
          />
          <span className="text-sm font-medium">
            {tw("meter_not_sure_label")}
          </span>
        </label>
      </div>

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
                  onResetCascade();
                  return;
                }
                onCityChange(item.value as number, item.label);
              }}
              placeholder={tw("meter_lookup_city_placeholder")}
              emptyText={tw("meter_lookup_no_results")}
              loading={cities === undefined}
            />
          </div>

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
                    onResetStreet();
                    return;
                  }
                  onStreetChange(item.value as number, item.label);
                }}
                placeholder={tw("meter_lookup_street_placeholder")}
                emptyText={tw("meter_lookup_no_results")}
                loading={streets === undefined}
              />
            </div>
          )}

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
                    onResetHouse();
                    return;
                  }
                  onHouseChange(item.value as string);
                }}
                placeholder={tw("meter_lookup_house_placeholder")}
                emptyText={tw("meter_lookup_no_results")}
                loading={houseNumbers === undefined}
              />
            </div>
          )}

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
}
