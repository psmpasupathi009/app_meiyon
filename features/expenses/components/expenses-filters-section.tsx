"use client";

import { DatePicker } from "@/shared/components/forms/date-picker";
import { FilterChipGroup } from "@/shared/components/data/filter-chip-group";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { FormError } from "@/shared/components/feedback/form-error";
import type { ExpensePeriodPreset } from "@/features/expenses/lib/period";
import {
  PERIOD_CHIPS,
  STATUS_CHIPS,
} from "@/features/expenses/components/expenses-page-helpers";

export type ExpensesFiltersSectionProps = {
  period: ExpensePeriodPreset;
  status: string;
  customFrom: string;
  customTo: string;
  customRangeReady: boolean;
  customRangeInvalid: boolean;
  onPeriodChange: (period: ExpensePeriodPreset) => void;
  onStatusChange: (status: string) => void;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
};

export function ExpensesFiltersSection({
  period,
  status,
  customFrom,
  customTo,
  customRangeReady,
  customRangeInvalid,
  onPeriodChange,
  onStatusChange,
  onCustomFromChange,
  onCustomToChange,
}: ExpensesFiltersSectionProps) {
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
                Pick both From and To dates to filter expenses.
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
    </>
  );
}
