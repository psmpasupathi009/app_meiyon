"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { getStageOptionsForCaseType } from "@meiyon/config";
import { moveCaseCourtStatus } from "@/features/cases/lib/move-case-court-status";
import type { CaseSummary } from "@/features/cases/server/serialize";

type Props = {
  caseItem: CaseSummary;
  canEdit: boolean;
  onUpdated: (next: CaseSummary) => void;
};

/** Type-specific court status strip (clerk-facing “Status”). */
export function CaseCourtStatusStrip({
  caseItem,
  canEdit,
  onUpdated,
}: Props) {
  const [busy, setBusy] = useState(false);
  const options = getStageOptionsForCaseType(caseItem.caseType);
  const current = (caseItem.stage ?? "").trim();

  async function select(next: string) {
    if (!canEdit || busy || next === current) return;
    setBusy(true);
    const result = await moveCaseCourtStatus({
      caseItem,
      nextStatus: next,
      canEdit,
    });
    setBusy(false);
    if (result.ok) onUpdated(result.case);
  }

  if (!caseItem.caseType) {
    return (
      <p className="text-sm text-muted-foreground">
        Set a case type to choose status.
      </p>
    );
  }

  if (options.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Status
      </p>
      <div className="overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
        <ol className="flex min-w-max items-stretch gap-1.5">
          {options.map((opt, idx) => {
            const isCurrent = opt.value === current;
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  disabled={!canEdit || busy || isCurrent}
                  onClick={() => void select(opt.value)}
                  title={opt.label}
                  className={cn(
                    "h-full max-w-36 rounded-lg border px-2.5 py-2 text-left transition-colors",
                    isCurrent
                      ? "border-brand bg-brand text-brand-foreground shadow-sm"
                      : "border-border/80 bg-card text-muted-foreground hover:border-brand/50 hover:text-navy",
                    (!canEdit || busy) && !isCurrent
                      ? "cursor-not-allowed opacity-60"
                      : ""
                  )}
                >
                  <span className="block text-[10px] font-medium uppercase tracking-wide opacity-70">
                    {idx + 1}
                  </span>
                  <span className="mt-0.5 block line-clamp-2 text-xs font-semibold leading-tight">
                    {opt.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      {current && !options.some((o) => o.value === current) ? (
        <p className="text-xs text-muted-foreground">
          Current (custom): {current}
        </p>
      ) : null}
    </div>
  );
}
