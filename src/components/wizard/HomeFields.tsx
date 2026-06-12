import { useTranslation } from "react-i18next";

export interface HomeFieldsProps {
  city: string;
  setCity: (v: string) => void;
  cascadeCityCode: number | null;
  supplierSelectValue: string;
  onSupplierChange: (rawValue: string) => void;
  suppliers: { _id: string; name: string }[] | undefined;
  bundleMemberships: string[];
  toggleMembership: (name: string, checked: boolean) => void;
  clearMemberships: () => void;
}

export default function HomeFields({
  city,
  setCity,
  cascadeCityCode,
  supplierSelectValue,
  onSupplierChange,
  suppliers,
  bundleMemberships,
  toggleMembership,
  clearMemberships,
}: HomeFieldsProps) {
  const { t: tw } = useTranslation("wizard");

  return (
    <>
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
