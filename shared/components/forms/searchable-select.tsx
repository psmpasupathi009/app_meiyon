"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils/cn";
import type { FormOption } from "@/config/company/form-options";

export type SearchableSelectOption = FormOption & {
  group?: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  allowOther?: boolean;
  otherPlaceholder?: string;
  disabled?: boolean;
  /** When set, shows group headings (cmdk groups). */
  grouped?: boolean;
};

/**
 * Local-filter combobox for static / short option lists.
 * Optional “Other” free-text when the value is not in the list.
 */
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select",
  searchPlaceholder = "Search…",
  emptyText = "No results.",
  className = "h-11",
  allowOther = false,
  otherPlaceholder = "Type custom value",
  disabled,
  grouped = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [choseOther, setChoseOther] = useState(false);

  const listed = options.some((o) => o.value === value);
  const selected = options.find((o) => o.value === value);
  // Prefer listed match over a stuck “Other” flag when the value is in options.
  const custom = Boolean(allowOther && !listed && (choseOther || value));

  const groups = useMemo(() => {
    if (!grouped) return null;
    const map = new Map<string, SearchableSelectOption[]>();
    for (const opt of options) {
      const key = opt.group ?? "Options";
      const list = map.get(key) ?? [];
      list.push(opt);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [grouped, options]);

  const displayLabel = custom
    ? value || "Other — type value"
    : selected?.label ?? placeholder;

  const trigger = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
          className={cn(
            "flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2 text-base text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className,
            !selected && !custom && "text-muted-foreground"
          )}
        >
          <span
            className="min-w-0 flex-1 truncate text-left"
            title={displayLabel}
          >
            {displayLabel}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-[min(15rem,40dvh)]">
            <CommandEmpty>{emptyText}</CommandEmpty>
            {groups
              ? groups.map(([heading, opts]) => (
                  <CommandGroup key={heading} heading={heading}>
                    {opts.map((o) => (
                      <CommandItem
                        key={o.value}
                        value={`${o.label} ${o.value}`}
                        onSelect={() => {
                          setChoseOther(false);
                          onChange(o.value);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "h-4 w-4 shrink-0",
                            value === o.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="min-w-0 truncate" title={o.label}>
                          {o.label}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))
              : (
                  <CommandGroup>
                    {options.map((o) => (
                      <CommandItem
                        key={o.value}
                        value={`${o.label} ${o.value}`}
                        onSelect={() => {
                          setChoseOther(false);
                          onChange(o.value);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "h-4 w-4 shrink-0",
                            value === o.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="min-w-0 truncate" title={o.label}>
                          {o.label}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
            {allowOther ? (
              <CommandGroup>
                <CommandItem
                  value="Other type custom value"
                  onSelect={() => {
                    setChoseOther(true);
                    onChange("");
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      custom ? "opacity-100" : "opacity-0"
                    )}
                  />
                  Other — type value
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  if (!custom) return trigger;

  return (
    <div className="grid min-w-0 gap-2">
      {trigger}
      <Input
        className={className}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={otherPlaceholder}
      />
    </div>
  );
}
