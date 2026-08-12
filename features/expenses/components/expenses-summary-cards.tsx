"use client";

import { cn } from "@/lib/utils/cn";
import { rupee } from "@/features/expenses/components/expenses-page-helpers";

export type ExpensesSummary = {
  totalAmount: number;
  entryCount: number;
};

export function ExpensesSummaryCards({ summary }: { summary: ExpensesSummary }) {
  return (
    <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:gap-3">
      <div
        className={cn(
          "rounded-xl border border-navy/40 bg-card p-3 ring-1 ring-navy/20 sm:p-5"
        )}
      >
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Total amount
        </p>
        <p className="mt-1.5 break-all text-base font-semibold tabular-nums text-navy sm:mt-2 sm:truncate sm:text-xl">
          {rupee(summary.totalAmount)}
        </p>
        <p className="mt-1 hidden text-xs text-muted-foreground sm:block">
          Active expenses in filter
        </p>
      </div>
      <div className="rounded-xl border border-border/80 bg-card p-3 sm:p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Entries
        </p>
        <p className="mt-1.5 text-base font-semibold tabular-nums text-navy sm:mt-2 sm:text-xl">
          {summary.entryCount.toLocaleString("en-IN")}
        </p>
        <p className="mt-1 hidden text-xs text-muted-foreground sm:block">
          Non-voided in period
        </p>
      </div>
    </div>
  );
}
