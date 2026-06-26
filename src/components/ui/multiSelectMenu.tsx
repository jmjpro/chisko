import { Menu } from "@base-ui/react/menu";
import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
export interface MultiSelectMenuOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

interface MultiSelectMenuProps {
  label: string;
  options: MultiSelectMenuOption[];
  selected: Set<string>;
  onSelectedChange: (next: Set<string>) => void;
}

function toggleInSet(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

export function MultiSelectMenu({
  label,
  options,
  selected,
  onSelectedChange,
}: MultiSelectMenuProps) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={label}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-input rounded-md bg-background hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        <span className="font-semibold">{label}</span>
        <span className="text-xs text-muted-foreground">({selected.size})</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4} align="start">
          <Menu.Popup className="z-50 min-w-[160px] rounded-md border border-border bg-background py-1 shadow-md outline-none">
            {options.map((option) => (
              <Menu.CheckboxItem
                key={option.value}
                checked={selected.has(option.value)}
                onCheckedChange={() =>
                  onSelectedChange(toggleInSet(selected, option.value))
                }
                className="group flex cursor-default select-none items-center gap-2 px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted"
              >
                <span className="flex size-4 shrink-0 items-center justify-center rounded border border-input group-data-[checked]:border-primary group-data-[checked]:bg-primary">
                  <Menu.CheckboxItemIndicator
                    keepMounted
                    className="text-primary-foreground"
                  >
                    <Check className="size-3" />
                  </Menu.CheckboxItemIndicator>
                </span>
                {option.icon}
                {option.label}
              </Menu.CheckboxItem>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
