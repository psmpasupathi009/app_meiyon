import type { OfficeTask } from "@prisma/client";
import { istDateKey } from "@/lib/utils/ist";

export type OfficeTaskSummary = {
  unitId: string;
  title: string;
  kind: string;
  status: string;
  dueDate: string | null;
  dueDateKey: string | null;
  workDate: string | null;
  workDateKey: string | null;
  assigneeUnitId: string | null;
  assigneeName: string | null;
  caseUnitId: string | null;
  caseNumber: string | null;
  notes: string | null;
  finishNote: string | null;
  completedAt: string | null;
  createdAt: string;
};

export function toOfficeTaskSummary(
  item: OfficeTask,
  extras?: {
    assigneeName?: string | null;
    caseNumber?: string | null;
  }
): OfficeTaskSummary {
  return {
    unitId: item.unitId,
    title: item.title,
    kind: item.kind,
    status: item.status,
    dueDate: item.dueDate ? item.dueDate.toISOString() : null,
    dueDateKey: item.dueDate ? istDateKey(item.dueDate) : null,
    workDate: item.workDate ? item.workDate.toISOString() : null,
    workDateKey: item.workDate ? istDateKey(item.workDate) : null,
    assigneeUnitId: item.assigneeUnitId,
    assigneeName: extras?.assigneeName ?? null,
    caseUnitId: item.caseUnitId,
    caseNumber: extras?.caseNumber ?? null,
    notes: item.notes,
    finishNote: item.finishNote,
    completedAt: item.completedAt ? item.completedAt.toISOString() : null,
    createdAt: item.createdAt.toISOString(),
  };
}
