"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch, getErrorMessage } from "@/lib/api/client";
import { ADJOURN_OUTCOME_OPTIONS } from "@/config/company/form-options";
import { SelectOrOther } from "@/shared/components/forms/select-or-other";
import { DatePicker } from "@/shared/components/forms/date-picker";

export function AdjournHearingDialog({
  open,
  onOpenChange,
  hearingUnitId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hearingUnitId: string;
  onSaved: () => void;
}) {
  const [nextHearingDate, setNextHearingDate] = useState("");
  const [outcome, setOutcome] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setError("");
    if (!nextHearingDate) {
      setError("Next hearing date is required");
      return;
    }
    setBusy(true);
    const { ok, data } = await apiFetch(
      `/api/hearings/${hearingUnitId}/adjourn`,
      {
        method: "POST",
        json: {
          nextHearingDate,
          outcome: outcome || undefined,
          notes: notes || undefined,
        },
      }
    );
    setBusy(false);
    if (!ok) {
      setError(
        getErrorMessage(
          data as Record<string, unknown>,
          "Failed to adjourn hearing"
        )
      );
      return;
    }
    toast.success("Hearing adjourned");
    setNextHearingDate("");
    setOutcome("");
    setNotes("");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Adjourn hearing</DialogTitle>
          <DialogDescription>
            Mark this hearing adjourned and set the next date.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <div className="grid gap-2">
            <Label>Next hearing date</Label>
            <DatePicker value={nextHearingDate} onChange={setNextHearingDate} />
          </div>
          <div className="grid gap-2">
            <Label>Outcome</Label>
            <SelectOrOther
              value={outcome}
              onChange={setOutcome}
              options={ADJOURN_OUTCOME_OPTIONS}
              placeholder="Select outcome"
              className="h-10"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="adj-notes">Notes</Label>
            <Textarea
              id="adj-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={busy}>
            {busy ? "Saving…" : "Adjourn"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
