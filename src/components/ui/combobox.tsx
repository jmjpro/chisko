import { Combobox } from "@base-ui/react/combobox";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: number | string;
  label: string;
}

interface AddressComboboxProps {
  items: ComboboxOption[];
  value: number | string | null;
  onValueChange: (item: ComboboxOption | null) => void;
  placeholder: string;
  emptyText: string;
  disabled?: boolean;
  loading?: boolean;
}

function ItemList() {
  const items = Combobox.useFilteredItems<ComboboxOption>();
  return items.map((item, index) => (
    <Combobox.Item
      key={String(item.value)}
      value={item}
      index={index}
      className="flex cursor-default select-none items-center rounded px-2 py-1.5 text-sm text-foreground outline-none data-[highlighted]:bg-muted data-[selected]:font-medium"
    >
      {item.label}
    </Combobox.Item>
  ));
}

export function AddressCombobox({
  items,
  value,
  onValueChange,
  placeholder,
  emptyText,
  disabled,
  loading,
}: AddressComboboxProps) {
  const selectedItem =
    value !== null ? (items.find((i) => i.value === value) ?? null) : null;

  return (
    <Combobox.Root
      items={items}
      value={selectedItem}
      onValueChange={onValueChange}
      itemToStringLabel={(item) => item?.label ?? ""}
      itemToStringValue={(item) => String(item?.value ?? "")}
      isItemEqualToValue={(a, b) => a.value === b.value}
      autoHighlight
    >
      <div className="relative w-full">
        <Combobox.Input
          disabled={disabled || loading}
          placeholder={loading ? "…" : placeholder}
          className="border border-input rounded-md ps-2 pe-7 py-1.5 w-full bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <Combobox.Clear className="absolute end-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center rounded p-0.5 text-muted-foreground hover:text-foreground">
          <svg
            viewBox="0 0 16 16"
            fill="currentColor"
            className="size-3.5"
            aria-hidden="true"
          >
            <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
          </svg>
        </Combobox.Clear>
      </div>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4}>
          <Combobox.Popup
            className={cn(
              "z-50 min-w-[var(--anchor-width)] max-h-60 overflow-y-auto",
              "rounded-md border border-border bg-background shadow-md outline-none",
            )}
          >
            <Combobox.List className="p-1">
              <ItemList />
            </Combobox.List>
            <Combobox.Empty className="px-2 py-1.5 text-sm text-muted-foreground">
              {emptyText}
            </Combobox.Empty>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
