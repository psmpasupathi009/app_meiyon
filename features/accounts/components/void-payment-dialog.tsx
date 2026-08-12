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

export function VoidPaymentDialog({
  open,
  onOpenChange,
  unitId,
  onVoided,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unitId: string;
  onVoided: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setError("");
    if (!reason.trim()) {
      setError("A reason is required");
      return;
    }
    setBusy(true);
    const { ok, data } = await apiFetch(`/api/accounts/${unitId}/void`, {
      method: "POST",
      json: { reason },
    });
    setBusy(false);
    if (!ok) {
      setError(getErrorMessage(data as Record<string, unknown>, "Failed to void entry"));
      return;
    }
    toast.success("Entry voided");
    setReason("");
    onVoided();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" overlayClassName="z-[60]">
        <DialogHeader>
          <DialogTitle>Void cash entry</DialogTitle>
          <DialogDescription>
            Voided entries stay in the ledger for audit — they’re never deleted.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-2">
          <Label htmlFor="void-reason">Reason</Label>
          <Textarea id="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={handleSubmit} disabled={busy}>
            {busy ? "Voiding…" : "Void entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
