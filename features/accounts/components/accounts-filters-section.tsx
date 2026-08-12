"use client";

import Link from "next/link";
import { Wallet, X } from "lucide-react";
import { DatePicker } from "@/shared/components/forms/date-picker";
import { FilterChipGroup } from "@/shared/components/data/filter-chip-group";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { FormError } from "@/shared/components/feedback/form-error";
import type { PeriodPreset } from "@/features/accounts/lib/period";
import {
  PERIOD_CHIPS,
  STATUS_CHIPS,
  rupee,
  type FeeSummary,
} from "@/features/accounts/components/accounts-page-helpers";

export type AccountsFiltersSectionProps = {
  period: PeriodPreset;
  status: string;
  customFrom: string;
  customTo: string;
  customRangeReady: boolean;
  customRangeInvalid: boolean;
  caseUnitId: string;
  activeClientId: string;
  clientNames: Record<string, string>;
  fee: FeeSummary | null;
  hasActiveFilters: boolean;
  onPeriodChange: (period: PeriodPreset) => void;
  onStatusChange: (status: string) => void;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
  onClearCase: () => void;
  onClearClient: () => void;
  onClearAllFilters: () => void;
};

export function AccountsFiltersSection({
  period,
  status,
  customFrom,
  customTo,
  customRangeReady,
  customRangeInvalid,
  caseUnitId,
  activeClientId,
  clientNames,
  fee,
  hasActiveFilters,
  onPeriodChange,
  onStatusChange,
  onCustomFromChange,
  onCustomToChange,
  onClearCase,
  onClearClient,
  onClearAllFilters,
}: AccountsFiltersSectionProps) {
  return (
    <>
      <div className="space-y-2">
        <FilterChipGroup
          aria-label="Period"
          options={PERIOD_CHIPS}
          value={period}
          onChange={onPeriodChange}
        />
        <FilterChipGroup
          aria-label="Status"
          options={STATUS_CHIPS}
          value={status}
          onChange={onStatusChange}
          size="sm"
        />
      </div>

      {period === "custom" ? (
        <Card>
          <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
            <div className="grid min-w-0 gap-2">
              <Label>From</Label>
              <DatePicker value={customFrom} onChange={onCustomFromChange} />
            </div>
            <div className="grid min-w-0 gap-2">
              <Label>To</Label>
              <DatePicker value={customTo} onChange={onCustomToChange} />
            </div>
            {!customRangeReady ? (
              <p className="text-sm text-muted-foreground sm:col-span-2">
                Pick both From and To dates to filter the register.
              </p>
            ) : null}
            {customRangeInvalid ? (
              <FormError className="sm:col-span-2">
                From date must be on or before To date.
              </FormError>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {(caseUnitId || activeClientId || fee) && (
        <Card>
          <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="rounded-lg bg-muted p-2.5 text-navy">
                  <Wallet className="size-4" />
                </span>
                <div className="min-w-0 space-y-1.5">
                  <p className="font-medium text-navy">
                    {caseUnitId
                      ? "Case cash register"
                      : activeClientId
                        ? "Client ledger"
                        : "Filtered register"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {caseUnitId ? (
                      <Badge variant="outline" className="gap-1.5 pr-1">
                        <Link
                          href={`/cases/${caseUnitId}`}
                          className="hover:underline"
                        >
                          {caseUnitId}
                        </Link>
                        <button
                          type="button"
                          className="rounded p-0.5 hover:bg-muted"
                          aria-label="Clear case filter"
                          onClick={onClearCase}
                        >
                          <X className="size-3.5" />
                        </button>
                      </Badge>
                    ) : null}
                    {activeClientId ? (
                      <Badge variant="outline" className="gap-1.5 pr-1">
                        {clientNames[activeClientId] ?? activeClientId}
                        <button
                          type="button"
                          className="rounded p-0.5 hover:bg-muted"
                          aria-label="Clear client filter"
                          onClick={onClearClient}
                        >
                          <X className="size-3.5" />
                        </button>
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClearAllFilters}
                >
                  Clear filters
                </Button>
              ) : null}
            </div>

            {fee && caseUnitId ? (
              <div className="grid gap-3 border-t border-border/70 pt-4 md:grid-cols-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Agreed fee
                  </p>
                  <p className="mt-1 text-lg font-semibold text-navy">
                    {fee.agreedFee != null ? rupee(fee.agreedFee) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Fee collected
                  </p>
                  <p className="mt-1 text-lg font-semibold text-navy">
                    {rupee(fee.collected)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <span className="sm:hidden">All-time (excl. actuals)</span>
                    <span className="hidden sm:inline">
                      All-time fees (excl. actuals) — not limited by period filter
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Outstanding
                  </p>
                  <p className="mt-1 text-lg font-semibold text-navy">
                    {fee.outstanding != null ? rupee(fee.outstanding) : "—"}
                  </p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </>
  );
}
