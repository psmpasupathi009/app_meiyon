"use client";

import { cn } from "@/lib/utils/cn";
import { rupee } from "@/features/accounts/components/accounts-page-helpers";

export type AccountsSummary = {
  paid: number;
  pending: number;
  void: number;
  netCollected: number;
  entryCount: number;
};

export type AccountsSummaryCardsProps = {
  summary: AccountsSummary;
  status: string;
  onStatusChange: (status: string) => void;
};

export function AccountsSummaryCards({
  summary,
  status,
  onStatusChange,
}: AccountsSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:gap-3 lg:grid-cols-4">
      {(
        [
          {
            key: "paid",
            label: "Paid",
            value: summary.paid,
            hint: "Collected in filter",
          },
          {
            key: "pending",
            label: "Pending",
            value: summary.pending,
            hint: "Awaiting receipt",
          },
          {
            key: "void",
            label: "Void",
            value: summary.void,
            hint: "Kept for audit",
          },
          {
            key: "all",
            label: "Net collected",
            value: summary.netCollected,
            hint: `${summary.entryCount} entries`,
          },
        ] as const
      ).map((kpi) => {
        const active =
          kpi.key === "all" ? status === "all" : status === kpi.key;
        return (
          <button
            key={kpi.key}
            type="button"
            onClick={() => onStatusChange(kpi.key)}
            className={cn(
              "rounded-xl border bg-card p-3 text-left transition-colors sm:p-5",
              active
                ? "border-navy/40 ring-1 ring-navy/20"
                : "border-border/80 hover:border-navy/25"
            )}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {kpi.label}
            </p>
            <p className="mt-1.5 break-all text-base font-semibold tabular-nums text-navy sm:mt-2 sm:truncate sm:text-xl">
              {rupee(kpi.value)}
            </p>
            <p className="mt-1 hidden text-xs text-muted-foreground sm:block">
              {kpi.hint}
            </p>
          </button>
        );
      })}
    </div>
  );
}
