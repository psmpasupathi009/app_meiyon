"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/shared/components/forms/date-picker";
import { FormError } from "@/shared/components/feedback/form-error";
import { CasePicker } from "@/features/cases/components/case-picker";
import { ClientPicker } from "@/features/clients/components/client-picker";
import { apiFetch, getErrorMessage } from "@/lib/api/client";
import type { DakSummary } from "@/features/dak/server/serialize";
import {
  DAK_DIRECTION_OPTIONS,
  DAK_MODE_OPTIONS,
} from "@/lib/validations/dak.schema";
import { istDateKey } from "@/lib/utils/ist";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: DakSummary | null;
  onSaved: () => void;
};

export function DakFormDialog({ open, onOpenChange, entry, onSaved }: Props) {
  const isEdit = Boolean(entry);
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [entryDate, setEntryDate] = useState(istDateKey());
  const [subject, setSubject] = useState("");
  const [fromTo, setFromTo] = useState("");
  const [mode, setMode] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [caseLink, setCaseLink] = useState<{
    unitId: string;
    label: string;
  } | null>(null);
  const [clientLink, setClientLink] = useState<{
    unitId: string;
    name: string;
  } | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (entry) {
      setDirection(entry.direction === "out" ? "out" : "in");
      setEntryDate(entry.entryDateKey);
      setSubject(entry.subject);
      setFromTo(entry.fromTo ?? "");
      setMode(entry.mode ?? "");
      setTrackingNo(entry.trackingNo ?? "");
      setCaseLink(
        entry.caseUnitId
          ? {
              unitId: entry.caseUnitId,
              label: entry.caseNumber
                ? `${entry.caseNumber} (${entry.caseUnitId})`
                : entry.caseUnitId,
            }
          : null
      );
      setClientLink(
        entry.clientUnitId
          ? {
              unitId: entry.clientUnitId,
              name: entry.clientName || entry.clientUnitId,
            }
          : null
      );
      setNotes(entry.notes ?? "");
    } else {
      setDirection("in");
      setEntryDate(istDateKey());
      setSubject("");
      setFromTo("");
      setMode("");
      setTrackingNo("");
      setCaseLink(null);
      setClientLink(null);
      setNotes("");
    }
    setError("");
  }, [open, entry]);

  async function handleSubmit() {
    setError("");
    if (!subject.trim()) {
      setError("Subject is required");
      return;
    }
    if (!entryDate) {
      setError("Select entry date");
      return;
    }

    setBusy(true);
    const body = {
      direction,
      entryDate,
      subject: subject.trim(),
      fromTo: fromTo.trim() || "",
      mode: mode || "",
      trackingNo: trackingNo.trim() || "",
      caseUnitId: caseLink?.unitId ?? "",
      clientUnitId: clientLink?.unitId ?? "",
      notes: notes.trim() || "",
    };

    const res = isEdit
      ? await apiFetch(`/api/dak/${entry!.unitId}`, {
          method: "PATCH",
          json: body,
        })
      : await apiFetch("/api/dak", { method: "POST", json: body });

    setBusy(false);
    if (!res.ok) {
      setError(
        getErrorMessage(
          res.data as Record<string, unknown>,
          isEdit ? "Failed to update dak entry" : "Failed to add dak entry"
        )
      );
      return;
    }

    toast.success(isEdit ? "Dak entry updated" : "Dak entry added");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit dak entry" : "Add dak entry"}</DialogTitle>
          <DialogDescription>
            Register incoming or outgoing dak for the office postal book.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Direction</Label>
              <Select
                value={direction}
                onValueChange={(v) => setDirection(v as "in" | "out")}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAK_DIRECTION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Entry date</Label>
              <DatePicker value={entryDate} onChange={setEntryDate} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What is this dak about?"
              className="h-11"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>{direction === "in" ? "From" : "To"}</Label>
              <Input
                value={fromTo}
                onChange={(e) => setFromTo(e.target.value)}
                placeholder="Name / office"
                className="h-11"
              />
            </div>
            <div className="grid gap-2">
              <Label>Mode</Label>
              <Select
                value={mode || "__none"}
                onValueChange={(v) => setMode(v === "__none" ? "" : v)}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {DAK_MODE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Tracking no.</Label>
            <Input
              value={trackingNo}
              onChange={(e) => setTrackingNo(e.target.value)}
              placeholder="Optional"
              className="h-11"
            />
          </div>

          <CasePicker value={caseLink} onChange={setCaseLink} />

          <ClientPicker
            value={clientLink}
            onChange={setClientLink}
            label="Client (optional)"
            placeholder="Link a client…"
          />

          <div className="grid gap-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional notes"
            />
          </div>

          <FormError>{error}</FormError>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={busy}>
            {busy ? "Saving…" : isEdit ? "Save changes" : "Add entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
