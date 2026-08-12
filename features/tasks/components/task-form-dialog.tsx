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
import {
  AdvocatePicker,
  type AdvocateSummary,
} from "@/features/employees/components/advocate-picker";
import { apiFetch, getErrorMessage } from "@/lib/api/client";
import type { OfficeTaskSummary } from "@/features/tasks/server/serialize";
import { OFFICE_TASK_KIND_OPTIONS } from "@/lib/validations/tasks.schema";
import { istDateKey } from "@/lib/utils/ist";

type TaskKind = (typeof OFFICE_TASK_KIND_OPTIONS)[number]["value"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: OfficeTaskSummary | null;
  defaultWorkDate?: string;
  defaultKind?: TaskKind;
  onSaved: () => void;
};

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  defaultWorkDate,
  defaultKind = "allotment",
  onSaved,
}: Props) {
  const isEdit = Boolean(task);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<TaskKind>(defaultKind);
  const [workDate, setWorkDate] = useState(defaultWorkDate || istDateKey());
  const [dueDate, setDueDate] = useState("");
  const [assigneeUnitId, setAssigneeUnitId] = useState<string | null>(null);
  const [assigneeLabel, setAssigneeLabel] = useState<string | null>(null);
  const [caseLink, setCaseLink] = useState<{
    unitId: string;
    label: string;
  } | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setKind((task.kind as TaskKind) || "general");
      setWorkDate(task.workDateKey || istDateKey());
      setDueDate(task.dueDateKey || "");
      setAssigneeUnitId(task.assigneeUnitId);
      setAssigneeLabel(
        task.assigneeName
          ? `${task.assigneeName} (${task.assigneeUnitId})`
          : task.assigneeUnitId
      );
      setCaseLink(
        task.caseUnitId
          ? {
              unitId: task.caseUnitId,
              label: task.caseNumber
                ? `${task.caseNumber} (${task.caseUnitId})`
                : task.caseUnitId,
            }
          : null
      );
      setNotes(task.notes ?? "");
    } else {
      setTitle("");
      setKind(defaultKind);
      setWorkDate(defaultWorkDate || istDateKey());
      setDueDate("");
      setAssigneeUnitId(null);
      setAssigneeLabel(null);
      setCaseLink(null);
      setNotes("");
    }
    setError("");
  }, [open, task, defaultKind, defaultWorkDate]);

  async function handleSubmit() {
    setError("");
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setBusy(true);
    const body = {
      title: title.trim(),
      kind,
      workDate: workDate || "",
      dueDate: dueDate || "",
      assigneeUnitId: assigneeUnitId ?? "",
      caseUnitId: caseLink?.unitId ?? "",
      notes: notes.trim() || "",
    };

    const res = isEdit
      ? await apiFetch(`/api/tasks/${task!.unitId}`, {
          method: "PATCH",
          json: body,
        })
      : await apiFetch("/api/tasks", {
          method: "POST",
          json: { ...body, status: "open" },
        });

    setBusy(false);
    if (!res.ok) {
      setError(
        getErrorMessage(
          res.data as Record<string, unknown>,
          isEdit ? "Failed to update task" : "Failed to create task"
        )
      );
      return;
    }

    toast.success(isEdit ? "Task updated" : "Task allotted");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit task" : "Allot work"}</DialogTitle>
          <DialogDescription>
            Morning allotment and office tasks for the selected work day.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <div className="grid gap-2">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs doing?"
              className="h-11"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Kind</Label>
              <Select
                value={kind}
                onValueChange={(v) => setKind(v as TaskKind)}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OFFICE_TASK_KIND_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Work date</Label>
              <DatePicker value={workDate} onChange={setWorkDate} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Assignee (advocate / employee)</Label>
            <AdvocatePicker
              value={assigneeUnitId}
              selectedLabel={assigneeLabel}
              valueBy="unitId"
              onChange={(a: AdvocateSummary | null) => {
                if (!a) {
                  setAssigneeUnitId(null);
                  setAssigneeLabel(null);
                  return;
                }
                setAssigneeUnitId(a.unitId);
                setAssigneeLabel(a.displayName || a.name || a.unitId);
              }}
              placeholder="Select assignee"
              clearable
              clearLabel="Unassigned"
            />
            <p className="text-xs text-muted-foreground">
              Or enter employee unit ID below if not an advocate.
            </p>
            <Input
              value={assigneeUnitId ?? ""}
              onChange={(e) => {
                const v = e.target.value.trim();
                setAssigneeUnitId(v || null);
                if (!v) setAssigneeLabel(null);
              }}
              placeholder="EMP-00001"
              className="h-11"
            />
          </div>

          <div className="grid gap-2">
            <Label>Due date (optional)</Label>
            <DatePicker value={dueDate} onChange={setDueDate} />
            {dueDate ? (
              <Button
                type="button"
                variant="ghost"
                className="h-8 w-fit px-2 text-xs"
                onClick={() => setDueDate("")}
              >
                Clear due date
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                Leave empty to use the work date ({workDate}).
              </p>
            )}
          </div>

          <CasePicker value={caseLink} onChange={setCaseLink} />

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
            {busy ? "Saving…" : isEdit ? "Save changes" : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
