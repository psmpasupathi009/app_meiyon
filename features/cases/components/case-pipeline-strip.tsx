"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import {
  CASE_PIPELINE_STEPS,
  CASE_STATUS_LABEL,
  canTransitionStatus,
  normalizeCaseStatus,
  type CasePipelineStatus,
} from "@meiyon/config";
import { moveCaseStatus } from "@/features/cases/lib/move-case-status";
import type { CaseSummary } from "@/features/cases/server/serialize";

const SIDE_EXIT_STATUSES: CasePipelineStatus[] = ["withdrawn", "transferred"];

type Props = {
  caseItem: CaseSummary;
  canEdit: boolean;
  /** Outstanding fee from accounts rollup; soft-warn on engaged → pre_filing. */
  feeOutstanding?: number | null;
  onUpdated: (next: CaseSummary) => void;
};

export function CasePipelineStrip({
  caseItem,
  canEdit,
  feeOutstanding,
  onUpdated,
}: Props) {
  const [busy, setBusy] = useState(false);
  const current = normalizeCaseStatus(caseItem.status);
  const currentIdx = CASE_PIPELINE_STEPS.indexOf(current);
  const isSideExit = SIDE_EXIT_STATUSES.includes(current);

  async function moveTo(next: CasePipelineStatus) {
    if (!canEdit || busy || next === current) return;
    setBusy(true);
    const result = await moveCaseStatus({
      caseItem,
      nextStatus: next,
      canEdit,
      feeOutstanding,
    });
    setBusy(false);
    if (result.ok) onUpdated(result.case);
  }

  function stepButton(
    step: CasePipelineStatus,
    opts: { idx?: number; compact?: boolean }
  ) {
    const isCurrent = step === current;
    const isPast =
      opts.idx != null && currentIdx >= 0 && opts.idx < currentIdx;
    const allowed = canEdit && canTransitionStatus(current, step);
    return (
      <button
        type="button"
        disabled={!canEdit || busy || isCurrent || !allowed}
        onClick={() => void moveTo(step)}
        title={CASE_STATUS_LABEL[step]}
        className={cn(
          "h-full rounded-lg border px-2.5 py-2 text-left transition-colors",
          opts.compact ? "min-w-20" : "min-w-18 sm:min-w-21",
          isCurrent
            ? "border-brand bg-brand text-brand-foreground shadow-sm"
            : isPast
              ? "border-border/60 bg-muted/70 text-navy"
              : "border-border/80 bg-card text-muted-foreground",
          canEdit && allowed && !isCurrent
            ? "hover:border-brand/50 hover:text-navy"
            : "",
          (!canEdit || !allowed) && !isCurrent
            ? "cursor-not-allowed opacity-60"
            : ""
        )}
      >
        {opts.idx != null ? (
          <span className="block text-[10px] font-medium uppercase tracking-wide opacity-70">
            {opts.idx + 1}
          </span>
        ) : null}
        <span className="mt-0.5 block text-xs font-semibold leading-tight">
          {CASE_STATUS_LABEL[step]}
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
        <ol className="flex min-w-max items-stretch gap-1.5">
          {CASE_PIPELINE_STEPS.map((step, idx) => (
            <li key={step}>{stepButton(step, { idx })}</li>
          ))}
        </ol>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Side exits
        </span>
        {SIDE_EXIT_STATUSES.map((step) => (
          <div key={step}>{stepButton(step, { compact: true })}</div>
        ))}
        {isSideExit ? (
          <span className="text-[11px] text-muted-foreground">
            Current: {CASE_STATUS_LABEL[current]}
          </span>
        ) : null}
      </div>
    </div>
  );
}
