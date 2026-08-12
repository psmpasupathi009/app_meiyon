"use client";

import {
  Coffee,
  Gavel,
  UserRound,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { istDateKey } from "@/lib/utils/ist";
import { cn } from "@/lib/utils/cn";

export type TimeAwayForm = {
  date: string;
  startTime: string;
  endTime: string;
  kind: string;
  reason: string;
};

/** Default Add form — court morning is the common advocate half-day block. */
export function emptyTimeAwayForm(): TimeAwayForm {
  return {
    date: istDateKey(),
    startTime: "10:30",
    endTime: "13:00",
    kind: "court",
    reason: "",
  };
}

const KIND_CHIPS = [
  {
    value: "court",
    label: "Court",
    icon: Gavel,
    hint: "Hearing / chamber",
  },
  {
    value: "other",
    label: "Travel / site",
    icon: MoreHorizontal,
    hint: "Client site · errand",
  },
  {
    value: "personal",
    label: "Personal",
    icon: UserRound,
    hint: "Private time",
  },
  {
    value: "break",
    label: "Break",
    icon: Coffee,
    hint: "Extra lunch gap",
  },
] as const;

export type TimeAwayDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  form: TimeAwayForm;
  onFormChange: (next: TimeAwayForm) => void;
  busy: boolean;
  onSave: () => void;
};

export function TimeAwayDialog({
  open,
  onOpenChange,
  editing,
  form,
  onFormChange,
  busy,
  onSave,
}: TimeAwayDialogProps) {
  const notePlaceholder =
    form.kind === "court"
      ? "e.g. Gobichettipalayam court"
      : form.kind === "other"
        ? "e.g. Client site — Nambiyur"
        : form.kind === "personal"
          ? "e.g. Personal appointment"
          : "e.g. Extra lunch";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit time away" : "Add time away"}
          </DialogTitle>
          <DialogDescription>
            Blocks booking for this window. Stay checked in on HRMS if you are
            still in for the office day — leave is only for full days off.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-5">
          <div className="space-y-2">
            <Label>Why are you away?</Label>
            <div className="grid grid-cols-2 gap-2">
              {KIND_CHIPS.map((k) => {
                const Icon = k.icon;
                const selected = form.kind === k.value;
                return (
                  <button
                    key={k.value}
                    type="button"
                    onClick={() => onFormChange({ ...form, kind: k.value })}
                    className={cn(
                      "flex items-start gap-2.5 rounded-xl border px-3 py-3 text-left transition-all",
                      selected
                        ? "border-brand bg-brand text-brand-foreground shadow-sm"
                        : "border-border/80 bg-card text-muted-foreground hover:border-navy/30 hover:text-navy"
                    )}
                  >
                    <Icon className="mt-0.5 size-4 shrink-0" />
                    <span>
                      <span className="block text-sm font-semibold">
                        {k.label}
                      </span>
                      <span
                        className={cn(
                          "block text-[11px]",
                          selected ? "text-white/70" : "text-muted-foreground"
                        )}
                      >
                        {k.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Date</Label>
            <DatePicker
              value={form.date}
              onChange={(date) => onFormChange({ ...form, date })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="blockStart">Start</Label>
              <Input
                id="blockStart"
                type="time"
                value={form.startTime}
                onChange={(e) =>
                  onFormChange({ ...form, startTime: e.target.value })
                }
                className="h-11 tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="blockEnd">End</Label>
              <Input
                id="blockEnd"
                type="time"
                value={form.endTime}
                onChange={(e) =>
                  onFormChange({ ...form, endTime: e.target.value })
                }
                className="h-11 tabular-nums"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="blockReason">Note (optional)</Label>
            <Input
              id="blockReason"
              value={form.reason}
              onChange={(e) =>
                onFormChange({ ...form, reason: e.target.value })
              }
              placeholder={notePlaceholder}
              className="h-11"
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-11"
            disabled={busy}
            onClick={onSave}
          >
            {busy ? "Saving…" : editing ? "Update" : "Block time"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
