import { useTranslation } from "react-i18next";
import { AddressCombobox } from "@/components/ui/combobox";

// Government data is stored ALL CAPS; display as title case without transforming stored values.
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s-])(\S)/g, (_, sep, ch: string) => sep + ch.toUpperCase());
}

interface PlaceOfResidence {
  he: string;
  en?: string;
  ar?: string;
  ru?: string;
}

interface PlaceItem {
  he: string;
  en?: string;
  ar?: string;
  ru?: string;
}

export interface HomeFieldsProps {
  placeOfResidence: PlaceOfResidence | null;
  setPlaceOfResidence: (v: PlaceOfResidence | null) => void;
  cascadeCityCode: number | null;
  supplierSelectValue: string;
  onSupplierChange: (rawValue: string) => void;
  suppliers: { _id: string; name: string }[] | undefined;
  bundleMemberships: string[];
  toggleMembership: (name: string, checked: boolean) => void;
  clearMemberships: () => void;
  israelPlaces: PlaceItem[] | undefined;
}

export default function HomeFields({
  placeOfResidence,
  setPlaceOfResidence,
  cascadeCityCode,
  supplierSelectValue,
  onSupplierChange,
  suppliers,
  bundleMemberships,
  toggleMembership,
  clearMemberships,
  israelPlaces,
}: HomeFieldsProps) {
  const { t: tw, i18n } = useTranslation("wizard");

  return (
    <>
      {cascadeCityCode === null && (
        <div className="mb-5">
          <label className="block text-sm font-medium mb-1.5">
            {tw("place_of_residence_title")}
          </label>
          {i18n.language === "ru" && (
            <p className="text-xs text-muted-foreground mb-2">
              {tw("place_of_residence_russian_note")}
            </p>
          )}
          <AddressCombobox
            items={(israelPlaces ?? []).map((p) => {
              const raw = p[i18n.language as keyof PlaceItem] ?? p.he;
              return {
                value: p.he,
                label: i18n.language === "en" && p.en ? titleCase(raw) : raw,
              };
            })}
            value={placeOfResidence?.he ?? null}
            onValueChange={(item) => {
              if (!item) {
                setPlaceOfResidence(null);
                return;
              }
              const match = (israelPlaces ?? []).find(
                (p) => p.he === item.value,
              );
              setPlaceOfResidence(
                match
                  ? { he: match.he, en: match.en, ar: match.ar, ru: match.ru }
                  : { he: String(item.value) },
              );
            }}
            placeholder={tw("place_of_residence_placeholder")}
            emptyText={tw("meter_lookup_no_results")}
            loading={israelPlaces === undefined}
          />
        </div>
      )}

      <div className="mb-5">
        <label className="block text-sm font-medium mb-1.5">
          {tw("supplier_title")}
        </label>
        <select
          value={supplierSelectValue}
          onChange={(e) => onSupplierChange(e.target.value)}
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

      <div>
        <p className="text-sm font-medium mb-2">{tw("memberships_title")}</p>
        <div className="space-y-2">
          {(["HOT triple", "HOT Mobile", "Cellcom"] as const).map((b) => (
            <label key={b} className="flex items-center gap-2.5 cursor-pointer">
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
                if (e.target.checked) clearMemberships();
              }}
              className="accent-primary"
            />
            <span className="text-sm">{tw("memberships_none")}</span>
          </label>
        </div>
      </div>
    </>
  );
}
