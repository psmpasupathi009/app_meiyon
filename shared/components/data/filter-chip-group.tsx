"use client";

import { cn } from "@/lib/utils/cn";

export type FilterChipOption<T extends string = string> = {
  id: T;
  label: string;
};

type FilterChipGroupProps<T extends string = string> = {
  options: readonly FilterChipOption<T>[] | FilterChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
};

export function FilterChipGroup<T extends string = string>({
  options,
  value,
  onChange,
  size = "md",
  className,
  "aria-label": ariaLabel = "Filters",
}: FilterChipGroupProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "flex gap-2 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]",
        className
      )}
    >
      {options.map((c) => {
        const selected = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(c.id)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full font-medium transition-colors",
              size === "md" ? "px-3.5 py-2 text-sm" : "px-3.5 py-1.5 text-xs",
              selected
                ? "bg-brand text-brand-foreground"
                : size === "md"
                  ? "bg-muted text-muted-foreground hover:text-navy"
                  : "bg-muted/80 text-muted-foreground hover:text-navy"
            )}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
