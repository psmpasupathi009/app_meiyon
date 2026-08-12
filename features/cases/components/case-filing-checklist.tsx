"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch, getErrorMessage } from "@/lib/api/client";
import {
  FILING_CHECKLIST_ITEMS,
  type FilingChecklistId,
  type FilingChecklistState,
} from "@meiyon/config";
import type { CaseSummary } from "@/features/cases/server/serialize";

type Props = {
  caseItem: CaseSummary;
  canEdit: boolean;
  onUpdated: (next: CaseSummary) => void;
};

export function CaseFilingChecklist({ caseItem, canEdit, onUpdated }: Props) {
  const [busy, setBusy] = useState(false);
  const checklist = caseItem.filingChecklist ?? {};
  const returned = Boolean(checklist.returned);

  async function patch(payload: {
    filingChecklist: FilingChecklistState;
    battaDue?: boolean;
    awaitingService?: boolean;
    promoteIfNumbered?: boolean;
  }) {
    if (!canEdit || busy) return;
    setBusy(true);
    const { ok, data } = await apiFetch<{ case: CaseSummary }>(
      `/api/cases/${caseItem.unitId}/checklist`,
      { method: "PATCH", json: payload }
    );
    setBusy(false);
    if (!ok) {
      toast.error(
        getErrorMessage(
          data as Record<string, unknown>,
          "Failed to update checklist"
        )
      );
      return;
    }
    onUpdated((data as unknown as { case: CaseSummary }).case);
  }

  function toggle(id: FilingChecklistId, checked: boolean) {
    const next: FilingChecklistState = { ...checklist, [id]: checked };
    void patch({
      filingChecklist: next,
      ...(id === "batta_due" ? { battaDue: checked } : {}),
      ...(id === "batta_done" && checked ? { battaDue: false } : {}),
      ...(id === "numbered" && checked ? { promoteIfNumbered: true } : {}),
    });
  }

  function saveReturnReason(value: string) {
    void patch({
      filingChecklist: { ...checklist, returnReason: value },
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div>
          <h2 className="text-base font-semibold text-navy">Filing checklist</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Track registry steps until the matter is numbered
          </p>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {FILING_CHECKLIST_ITEMS.map((item) => {
            const checked = Boolean(checklist[item.id]);
            return (
              <li key={item.id} className="flex items-start gap-2.5">
                <Checkbox
                  id={`chk-${item.id}`}
                  checked={checked}
                  disabled={!canEdit || busy}
                  onCheckedChange={(v) => toggle(item.id, v === true)}
                  className="mt-0.5"
                />
                <Label
                  htmlFor={`chk-${item.id}`}
                  className="cursor-pointer text-sm font-normal leading-snug text-navy"
                >
                  {item.label}
                </Label>
              </li>
            );
          })}
        </ul>

        {returned ? (
          <div className="space-y-1.5">
            <Label htmlFor="return-reason">Return / defect reason</Label>
            <Input
              id="return-reason"
              defaultValue={
                typeof checklist.returnReason === "string"
                  ? checklist.returnReason
                  : ""
              }
              disabled={!canEdit || busy}
              placeholder="e.g. Missing vakalat / court fee short"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (checklist.returnReason ?? "")) {
                  saveReturnReason(v);
                }
              }}
            />
          </div>
        ) : null}

        <div className="flex items-center gap-2.5 border-t border-border/60 pt-3">
          <Checkbox
            id="batta-due-flag"
            checked={caseItem.battaDue}
            disabled={!canEdit || busy}
            onCheckedChange={(v) =>
              void patch({
                filingChecklist: {
                  ...checklist,
                  batta_due: v === true,
                },
                battaDue: v === true,
              })
            }
          />
          <Label
            htmlFor="batta-due-flag"
            className="cursor-pointer text-sm font-medium text-navy"
          >
            Batta / process fee due
          </Label>
        </div>
      </CardContent>
    </Card>
  );
}
