"use client";

import { useCallback } from "react";
import { AsyncSearchSelect } from "@/shared/components/forms/async-search-select";
import { fetchPagedList } from "@/shared/lib/fetch-paged-list";
import { displayMobile } from "@/lib/auth/mobile";
import type { DefaultCourt } from "@/lib/hearings/court-key";
import { personDisplayName } from "@/shared/lib/person";

export type AdvocateSummary = {
  unitId: string;
  name: string | null;
  displayName?: string;
  mobile: string;
  designation?: string | null;
  photoUrl?: string | null;
  defaultCourts?: DefaultCourt[];
};

function advocateLabel(a: AdvocateSummary): string {
  const name =
    a.displayName ||
    personDisplayName({
      name: a.name,
      mobile: a.mobile,
      unitId: a.unitId,
    });
  return a.designation ? `${name} · ${a.designation}` : name;
}

function optionValue(a: AdvocateSummary, valueBy: "unitId" | "mobile"): string {
  return valueBy === "mobile" ? displayMobile(a.mobile) : a.unitId;
}

export function AdvocatePicker({
  value,
  selectedLabel,
  onChange,
  valueBy = "mobile",
  placeholder = "Select advocate",
  searchPlaceholder = "Search advocate by name or mobile…",
  className = "h-11",
  disabled,
  clearable = false,
  clearLabel = "Clear",
}: {
  value: string | null;
  selectedLabel?: string | null;
  onChange: (advocate: AdvocateSummary | null) => void;
  valueBy?: "unitId" | "mobile";
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  clearable?: boolean;
  clearLabel?: string;
}) {
  const fetchPage = useCallback(
    ({
      query,
      page,
      pageSize,
    }: {
      query: string;
      page: number;
      pageSize: number;
    }) =>
      fetchPagedList<AdvocateSummary>("/api/advocates", {
        query,
        page,
        pageSize,
      }),
    []
  );

  return (
    <AsyncSearchSelect<AdvocateSummary>
      value={value}
      selectedLabel={selectedLabel}
      onChange={onChange}
      fetchPage={fetchPage}
      getOptionValue={(a) => optionValue(a, valueBy)}
      getOptionLabel={advocateLabel}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      className={className}
      disabled={disabled}
      clearable={clearable}
      clearLabel={clearLabel}
      pageSize={10}
    />
  );
}
