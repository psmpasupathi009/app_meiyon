"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils/cn";
import {
  useInfiniteOptions,
  type FetchPageFn,
} from "@/shared/hooks/use-infinite-options";

type Props<T> = {
  value: string | null;
  /** Display label for the current value when it may not be in the loaded page. */
  selectedLabel?: string | null;
  onChange: (item: T | null) => void;
  fetchPage: FetchPageFn<T>;
  getOptionValue: (item: T) => string;
  getOptionLabel: (item: T) => string;
  renderOption?: (item: T) => ReactNode;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  pageSize?: number;
  /** Shown below the list (e.g. “Add new client”). */
  footer?: ReactNode;
  clearable?: boolean;
  clearLabel?: string;
};

/**
 * Server-backed combobox: debounce search, pageSize 10, load more on scroll.
 */
export function AsyncSearchSelect<T>({
  value,
  selectedLabel,
  onChange,
  fetchPage,
  getOptionValue,
  getOptionLabel,
  renderOption,
  placeholder = "Select",
  searchPlaceholder = "Search…",
  emptyText = "No results.",
  className = "h-11",
  disabled,
  pageSize = 10,
  footer,
  clearable = false,
  clearLabel = "Clear",
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const {
    query,
    setQuery,
    debouncedQuery,
    items,
    loading,
    loadingMore,
    error,
    hasFetched,
    hasMore,
    loadMore,
  } = useInfiniteOptions(fetchPage, {
    pageSize,
    enabled: open,
  });

  const searching = open && (loading || query !== debouncedQuery || !hasFetched);

  const matched = value
    ? items.find((i) => getOptionValue(i) === value)
    : undefined;
  const display =
    selectedLabel || (matched ? getOptionLabel(matched) : value) || null;

  const onListScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || !hasMore || loadingMore || loading) return;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 48;
    if (nearBottom) loadMore();
  }, [hasMore, loadMore, loading, loadingMore]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, setQuery]);

  const showEmpty = hasFetched && !searching && items.length === 0;

  return (
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
            !display && "text-muted-foreground"
          )}
        >
          <span
            className="min-w-0 flex-1 truncate text-left"
            title={display ?? undefined}
          >
            {display ?? placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Command shouldFilter={false} className="overflow-hidden">
          <div className="relative">
            <CommandInput
              ref={inputRef}
              placeholder={searchPlaceholder}
              value={query}
              onValueChange={setQuery}
            />
            {searching ? (
              <Loader2 className="pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : null}
          </div>
          <CommandList
            ref={listRef}
            onScroll={onListScroll}
            className="max-h-[min(15rem,40dvh)]"
          >
            {showEmpty ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                {error
                  ? error
                  : query.trim()
                    ? `No matches for “${query.trim()}”`
                    : emptyText}
              </div>
            ) : items.length > 0 ? (
              <CommandGroup>
                {clearable && value ? (
                  <CommandItem
                    value="__clear__"
                    onSelect={() => {
                      onChange(null);
                      setOpen(false);
                    }}
                  >
                    <span className="text-muted-foreground">{clearLabel}</span>
                  </CommandItem>
                ) : null}
                {items.map((item) => {
                  const id = getOptionValue(item);
                  const label = getOptionLabel(item);
                  return (
                    <CommandItem
                      key={id}
                      value={`${label} ${id}`}
                      onSelect={() => {
                        onChange(item);
                        setOpen(false);
                      }}
                      className="min-w-0"
                    >
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          value === id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate" title={label}>
                        {renderOption ? renderOption(item) : label}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : searching ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching…
              </div>
            ) : null}
            {loadingMore ? (
              <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading more…
              </div>
            ) : null}
          </CommandList>
          {footer ? (
            <div
              className="border-t border-border"
              onClick={() => setOpen(false)}
            >
              {footer}
            </div>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
