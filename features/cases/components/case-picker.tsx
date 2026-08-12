"use client";

import { useCallback } from "react";
import { Label } from "@/components/ui/label";
import { AsyncSearchSelect } from "@/shared/components/forms/async-search-select";
import { fetchPagedList } from "@/shared/lib/fetch-paged-list";
import type { CaseSummary } from "@/features/cases/server/serialize";

type CaseOption = CaseSummary & { clientName?: string | null };

export function CasePicker({
  value,
  onChange,
  label = "Linked case (optional)",
  clientUnitId,
}: {
  value: { unitId: string; label: string } | null;
  onChange: (c: { unitId: string; label: string } | null) => void;
  label?: string;
  /** When set, search is scoped to this client’s matters. */
  clientUnitId?: string | null;
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
      fetchPagedList<CaseOption>("/api/cases", {
        query,
        page,
        pageSize,
        extraParams: clientUnitId
          ? { clientUnitId }
          : undefined,
      }),
    [clientUnitId]
  );

  return (
    <div className="grid min-w-0 gap-2">
      {label ? <Label>{label}</Label> : null}
      <AsyncSearchSelect<CaseOption>
        value={value?.unitId ?? null}
        selectedLabel={value?.label ?? null}
        onChange={(c) => {
          if (!c) {
            onChange(null);
            return;
          }
          const name =
            c.caseNumber ||
            c.clientName ||
            c.unitId;
          onChange({
            unitId: c.unitId,
            label: `${name} (${c.unitId})`,
          });
        }}
        fetchPage={fetchPage}
        getOptionValue={(c) => c.unitId}
        getOptionLabel={(c) => {
          const name = c.caseNumber || c.clientName || c.unitId;
          return `${name} (${c.unitId})`;
        }}
        renderOption={(c) => (
          <span className="block min-w-0 truncate">
            <span className="font-medium text-navy">
              {c.caseNumber || c.unitId}
            </span>{" "}
            <span className="text-muted-foreground">
              · {c.clientName ?? c.clientUnitId}
              {c.status ? ` · ${c.status}` : ""}
            </span>
          </span>
        )}
        placeholder="Link a case…"
        searchPlaceholder="Search case no. or unit ID…"
        clearable={Boolean(value)}
        clearLabel="Clear case"
      />
    </div>
  );
}
