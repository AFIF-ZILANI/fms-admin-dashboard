import { useMemo } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { cn, humanizeEnum } from "@/lib/utils";
import type { Item } from "@/pages/inventory/types";

type ItemComboboxProps = {
  items: Item[];
  value: string;
  onChange: (id: string) => void;
  invalid?: boolean;
};

/** Type-to-search item picker, grouped by category and sorted by name. Full names wrap in the
 * list rather than truncating, so similar names ("Vitamin A 100ml" / "Vitamin A 500ml") stay apart. */
export function ItemCombobox({ items, value, onChange, invalid }: ItemComboboxProps) {
  const groups = useMemo(() => {
    const byCategory = new Map<string, Item[]>();
    for (const item of [...items].sort((a, b) => a.name.localeCompare(b.name))) {
      byCategory.set(item.category, [...(byCategory.get(item.category) ?? []), item]);
    }
    return [...byCategory.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, list]) => ({ value: humanizeEnum(category), items: list }));
  }, [items]);
  const selected = items.find((i) => i.id === value) ?? null;

  return (
    <Combobox.Root
      items={groups}
      value={selected}
      onValueChange={(item: Item | null) => onChange(item?.id ?? "")}
      itemToStringLabel={(item: Item) => item.name}
      isItemEqualToValue={(a: Item, b: Item) => a.id === b.id}
    >
      <div className="relative">
        <Combobox.Input
          placeholder="Search item"
          aria-invalid={invalid}
          className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent py-1 pr-8 pl-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30"
        />
        <Combobox.Trigger
          aria-label="Show items"
          className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-muted-foreground"
        >
          <ChevronDownIcon className="size-4" />
        </Combobox.Trigger>
      </div>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} align="start" className="isolate z-50">
          <Combobox.Popup className="max-h-80 w-(--anchor-width) min-w-72 overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
            <Combobox.Empty className="px-2 py-1.5 text-sm text-muted-foreground empty:hidden">
              No item matches.
            </Combobox.Empty>
            <Combobox.List>
              {(group: (typeof groups)[number]) => (
                <Combobox.Group key={group.value} items={group.items} className="pb-1">
                  <Combobox.GroupLabel className="sticky top-0 bg-popover px-2 py-1 text-xs font-medium text-muted-foreground">
                    {group.value}
                  </Combobox.GroupLabel>
                  <Combobox.Collection>
                    {(item: Item) => (
                      <Combobox.Item
                        key={item.id}
                        value={item}
                        className={cn(
                          "relative flex cursor-default items-start gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm outline-none select-none",
                          "data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                        )}
                      >
                        <span className="break-words">{item.name}</span>
                        <Combobox.ItemIndicator className="absolute top-2 right-2">
                          <CheckIcon className="size-4" />
                        </Combobox.ItemIndicator>
                      </Combobox.Item>
                    )}
                  </Combobox.Collection>
                </Combobox.Group>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
