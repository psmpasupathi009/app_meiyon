"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { DatePicker } from "@/shared/components/forms/date-picker";
import { FormError } from "@/shared/components/feedback/form-error";
import type { OfficeHolidaySummary } from "@/features/hrms/lib/office-holiday";

type OfficeHolidayDialogProps = {
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  onSavedAction: () => void;
  /** When set, dialog edits this holiday instead of creating. */
  editing?: OfficeHolidaySummary | null;
};

export function OfficeHolidayDialog({
  open,
  onOpenChangeAction,
  onSavedAction,
  editing = null,
}: OfficeHolidayDialogProps) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setFromDate(editing.fromDate);
      setToDate(editing.toDate);
      setTitle(editing.title);
      setNotes(editing.notes ?? "");
      setError("");
      return;
    }
    setFromDate("");
    setToDate("");
    setTitle("");
    setNotes("");
    setError("");
  }, [open, editing]);

  function handleOpenChange(next: boolean) {
    if (!next) setError("");
    onOpenChangeAction(next);
  }

  function handleFromChange(next: string) {
    setFromDate(next);
    if (!toDate || toDate < next) setToDate(next);
  }

  async function handleSubmit() {
    setError("");
    if (!title.trim()) {
      setError("Enter a title");
      return;
    }
    if (title.trim().length < 2) {
      setError("Title must be at least 2 characters");
      return;
    }
    if (!fromDate || !toDate) {
      setError("Select both dates");
      return;
    }
    if (fromDate > toDate) {
      setError("From date must be on or before to date");
      return;
    }
    setBusy(true);
    const payload = {
      fromDate,
      toDate,
      title: title.trim(),
      notes: notes.trim() || undefined,
    };
    const { ok, data } = editing
      ? await apiFetch(`/api/hrms/holidays/${editing.unitId}`, {
          method: "PATCH",
          json: payload,
        })
      : await apiFetch("/api/hrms/holidays", {
          method: "POST",
          json: payload,
        });
    setBusy(false);
    if (!ok) {
      setError(
        getErrorMessage(
          data as Record<string, unknown>,
          editing ? "Failed to update holiday" : "Failed to create holiday"
        )
      );
      return;
    }
    toast.success(
      editing
        ? "Office holiday updated"
        : "Office holiday saved — all staff notified"
    );
    onSavedAction();
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit office holiday" : "Add office holiday"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Changing dates notifies all staff again. Closed days block check-in and booking; court diary stays."
              : "All staff will be notified and this day will be closed for check-in and booking. Court diary is unchanged."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="holiday-title">Title</Label>
            <Input
              id="holiday-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Diwali, Office closed"
            />
          </div>
          <div className="grid gap-2">
            <Label>From</Label>
            <DatePicker value={fromDate} onChange={handleFromChange} />
          </div>
          <div className="grid gap-2">
            <Label>To</Label>
            <DatePicker value={toDate} onChange={setToDate} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="holiday-notes">Notes (optional)</Label>
            <Textarea
              id="holiday-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional detail for staff"
            />
          </div>
          <FormError>{error}</FormError>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={busy}>
            {busy
              ? "Saving…"
              : editing
                ? "Save changes"
                : "Save holiday"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
