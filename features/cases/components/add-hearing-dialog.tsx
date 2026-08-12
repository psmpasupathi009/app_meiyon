"use client";

import { useEffect, useMemo, useState } from "react";
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
import { getHearingPurposeOptionsForCaseType } from "@meiyon/config";
import { SelectOrOther } from "@/shared/components/forms/select-or-other";
import { DatePicker } from "@/shared/components/forms/date-picker";

export function AddHearingDialog({
  open,
  onOpenChange,
  caseUnitId,
  caseType,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseUnitId: string;
  caseType?: string | null;
  onSaved: () => void;
}) {
  const purposeOptions = useMemo(
    () => getHearingPurposeOptionsForCaseType(caseType),
    [caseType]
  );
  const [hearingDate, setHearingDate] = useState("");
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setHearingDate("");
      setPurpose("");
      setNotes("");
      setError("");
      setBusy(false);
    });
  }, [open]);

  async function handleSubmit() {
    setError("");
    if (!hearingDate) {
      setError("Hearing date is required");
      return;
    }
    setBusy(true);
    const { ok, data } = await apiFetch(`/api/cases/${caseUnitId}/hearings`, {
      method: "POST",
      json: {
        hearingDate,
        purpose: purpose || undefined,
        notes: notes || undefined,
      },
    });
    setBusy(false);
    if (!ok) {
      setError(
        getErrorMessage(data as Record<string, unknown>, "Failed to add hearing")
      );
      return;
    }
    toast.success("Hearing added");
    setHearingDate("");
    setPurpose("");
    setNotes("");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Add hearing</DialogTitle>
          <DialogDescription>
            Record a hearing date for this case.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <div className="grid gap-2">
            <Label>Hearing date</Label>
            <DatePicker value={hearingDate} onChange={setHearingDate} />
          </div>
          <div className="grid gap-2">
            <Label>Purpose</Label>
            <SelectOrOther
              value={purpose}
              onChange={setPurpose}
              options={purposeOptions}
              placeholder="Select purpose"
              className="h-10"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="hr-notes">Notes</Label>
            <Textarea
              id="hr-notes"
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
            {busy ? "Saving…" : "Add hearing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
