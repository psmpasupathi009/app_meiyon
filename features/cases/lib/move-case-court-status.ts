"use client";

import { toast } from "sonner";
import { apiFetch, getErrorMessage } from "@/lib/api/client";
import type { CaseSummary } from "@/features/cases/server/serialize";

export type MoveCaseCourtStatusResult =
  | { ok: true; case: CaseSummary }
  | { ok: false; cancelled?: boolean; error?: string };

/**
 * Update court status (Case.stage) — the single clerk-facing status.
 */
export async function moveCaseCourtStatus(input: {
  caseItem: CaseSummary;
  nextStatus: string;
  canEdit: boolean;
  skipConfirm?: boolean;
}): Promise<MoveCaseCourtStatusResult> {
  const { caseItem, nextStatus, canEdit, skipConfirm } = input;
  if (!canEdit) return { ok: false, error: "Not allowed" };

  const current = (caseItem.stage ?? "").trim();
  const next = nextStatus.trim();
  if (!next || next === current) return { ok: false, cancelled: true };

  if (!skipConfirm) {
    if (!window.confirm(`Change status to “${next}”?`)) {
      return { ok: false, cancelled: true };
    }
  }

  const { ok, data } = await apiFetch<{ case: CaseSummary }>(
    `/api/cases/${caseItem.unitId}`,
    { method: "PATCH", json: { stage: next } }
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
  toast.success(`Status → ${next}`);
  return { ok: true, case: body.case };
}
