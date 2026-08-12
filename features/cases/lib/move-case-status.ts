"use client";

import { toast } from "sonner";
import { apiFetch, getErrorMessage } from "@/lib/api/client";
import {
  CASE_STATUS_LABEL,
  canTransitionStatus,
  normalizeCaseStatus,
  type CasePipelineStatus,
} from "@meiyon/config";
import type { CaseSummary } from "@/features/cases/server/serialize";

export type MoveCaseStatusInput = {
  caseItem: CaseSummary;
  nextStatus: CasePipelineStatus;
  canEdit: boolean;
  /** Outstanding fee from accounts rollup; soft-warn on engaged → pre_filing. */
  feeOutstanding?: number | null;
  /** Skip window.confirm (caller already confirmed). Default false. */
  skipConfirm?: boolean;
};

export type MoveCaseStatusResult =
  | { ok: true; case: CaseSummary }
  | { ok: false; cancelled?: boolean; error?: string };

/**
 * Shared status transition for pipeline strip + Kanban board.
 * Confirms with the user, PATCHes status, toasts success/error.
 */
export async function moveCaseStatus(
  input: MoveCaseStatusInput
): Promise<MoveCaseStatusResult> {
  const { caseItem, nextStatus, canEdit, feeOutstanding, skipConfirm } = input;
  if (!canEdit) {
    return { ok: false, error: "Not allowed" };
  }

  const current = normalizeCaseStatus(caseItem.status);
  if (nextStatus === current) {
    return { ok: false, cancelled: true };
  }

  if (!canTransitionStatus(current, nextStatus)) {
    const msg = `Cannot move from ${CASE_STATUS_LABEL[current]} to ${CASE_STATUS_LABEL[nextStatus]}`;
    toast.error(msg);
    return { ok: false, error: msg };
  }

  if (!skipConfirm) {
    const needsFeeSoftWarn =
      current === "engaged" &&
      nextStatus === "pre_filing" &&
      caseItem.agreedFee != null &&
      caseItem.agreedFee > 0 &&
      (feeOutstanding == null || feeOutstanding > 0);

    if (needsFeeSoftWarn && feeOutstanding != null && feeOutstanding > 0) {
      if (!window.confirm("Fee not fully collected — continue anyway?")) {
        return { ok: false, cancelled: true };
      }
    } else if (needsFeeSoftWarn && feeOutstanding == null) {
      // Board: no accounts rollup — soft warn when agreed fee exists
      if (
        !window.confirm(
          "Fee may be outstanding — continue anyway?"
        )
      ) {
        return { ok: false, cancelled: true };
      }
    } else if (
      !window.confirm(
        `Change pipeline to “${CASE_STATUS_LABEL[nextStatus]}”?`
      )
    ) {
      return { ok: false, cancelled: true };
    }
  }

  const { ok, data } = await apiFetch<{ case: CaseSummary }>(
    `/api/cases/${caseItem.unitId}/status`,
    { method: "PATCH", json: { status: nextStatus } }
  );

  if (!ok) {
    const error = getErrorMessage(
      data as Record<string, unknown>,
      "Failed to update status"
    );
    toast.error(error);
    return { ok: false, error };
  }

  const body = data as unknown as { case: CaseSummary };
  toast.success(`Pipeline → ${CASE_STATUS_LABEL[nextStatus]}`);
  return { ok: true, case: body.case };
}
