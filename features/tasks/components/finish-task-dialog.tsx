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
import { FormError } from "@/shared/components/feedback/form-error";
import { apiFetch, getErrorMessage } from "@/lib/api/client";
import type { OfficeTaskSummary } from "@/features/tasks/server/serialize";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: OfficeTaskSummary | null;
  onSaved: () => void;
};

export function FinishTaskDialog({
  open,
  onOpenChange,
  task,
  onSaved,
}: Props) {
  const [finishNote, setFinishNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function handleOpenChange(next: boolean) {
    if (!next) {
      setFinishNote("");
      setError("");
    }
    onOpenChange(next);
  }

  async function handleSubmit() {
    if (!task) return;
    setError("");
    setBusy(true);
    const res = await apiFetch(`/api/tasks/${task.unitId}`, {
      method: "PATCH",
      json: {
        status: "done",
        finishNote: finishNote.trim() || "",
      },
    });
    setBusy(false);
    if (!res.ok) {
      setError(
        getErrorMessage(
          res.data as Record<string, unknown>,
          "Failed to mark task done"
        )
      );
      return;
    }
    toast.success("Marked done — added to finishing report");
    onSaved();
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Evening finishing</DialogTitle>
          <DialogDescription>
            Mark “{task?.title}” done and add a short finishing note for the
            report.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <div className="grid gap-2">
            <Label>Finishing note</Label>
            <Textarea
              value={finishNote}
              onChange={(e) => setFinishNote(e.target.value)}
              rows={4}
              placeholder="What was completed / handed over?"
              autoFocus
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
          <Button type="button" onClick={() => void handleSubmit()} disabled={busy}>
            {busy ? "Saving…" : "Mark done"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
