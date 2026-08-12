"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import { CaseBoardCard } from "@/features/cases/components/case-board-card";
import {
  boardCourtStatusColumns,
  groupCasesByCourtStatus,
  UNSET_COURT_STATUS,
} from "@/features/cases/lib/board-columns";
import { moveCaseCourtStatus } from "@/features/cases/lib/move-case-court-status";
import type { CaseSummary } from "@/features/cases/server/serialize";

export type CasesBoardRow = CaseSummary & { clientName: string | null };

type Props = {
  rows: CasesBoardRow[];
  total: number;
  canEdit: boolean;
  /** Required for court-status columns. */
  caseType: string;
  onCaseUpdated: (next: CaseSummary) => void;
  loading?: boolean;
};

function BoardColumn({
  columnId,
  label,
  cases,
  canEdit,
  dragging,
  busy,
}: {
  columnId: string;
  label: string;
  cases: CasesBoardRow[];
  canEdit: boolean;
  dragging: boolean;
  busy: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });
  const highlight = isOver && dragging && columnId !== UNSET_COURT_STATUS;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-62 shrink-0 flex-col rounded-xl border bg-muted/30",
        highlight
          ? "border-brand bg-brand/5 ring-1 ring-brand/30"
          : "border-border/70"
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <h3 className="line-clamp-2 text-xs font-semibold leading-snug text-navy">
          {label}
        </h3>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {cases.length}
        </span>
      </div>
      <ul className="flex max-h-[min(70vh,36rem)] flex-col gap-2 overflow-y-auto p-2">
        {cases.length === 0 ? (
          <li className="px-1 py-6 text-center text-[11px] text-muted-foreground">
            No cases
          </li>
        ) : (
          cases.map((c) => (
            <li key={c.unitId}>
              <CaseBoardCard caseItem={c} canEdit={canEdit && !busy} />
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export function CasesBoard({
  rows,
  total,
  canEdit,
  caseType,
  onCaseUpdated,
  loading,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    })
  );

  const columns = useMemo(
    () => boardCourtStatusColumns(caseType),
    [caseType]
  );
  const groups = useMemo(
    () => groupCasesByCourtStatus(rows, columns),
    [rows, columns]
  );

  const activeCase = activeId
    ? rows.find((r) => r.unitId === activeId) ?? null
    : null;

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || !canEdit || busy) return;

    const unitId = String(active.id);
    const toStatus = String(over.id);
    if (toStatus === UNSET_COURT_STATUS) {
      toast.error("Drop onto a status column");
      return;
    }

    const caseItem = rows.find((r) => r.unitId === unitId);
    if (!caseItem) return;

    const from = (caseItem.stage ?? "").trim();
    if (from === toStatus) return;

    setBusy(true);
    const result = await moveCaseCourtStatus({
      caseItem,
      nextStatus: toStatus,
      canEdit,
    });
    setBusy(false);

    if (result.ok) onCaseUpdated(result.case);
  }

  function onDragCancel() {
    setActiveId(null);
  }

  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-64 w-62 shrink-0 animate-pulse rounded-xl bg-muted"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {total > rows.length ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          Showing first {rows.length} of {total} — refine filters to see the rest.
        </p>
      ) : null}

      {!canEdit ? (
        <p className="text-xs text-muted-foreground">
          View only — ask admin for edit access to move cases.
        </p>
      ) : null}

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={(e) => void onDragEnd(e)}
        onDragCancel={onDragCancel}
      >
        <div className="flex max-w-full gap-3 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]">
          <BoardColumn
            columnId={UNSET_COURT_STATUS}
            label="No status"
            cases={groups[UNSET_COURT_STATUS] ?? []}
            canEdit={canEdit}
            dragging={activeId != null}
            busy={busy}
          />
          {columns.map((col) => (
            <BoardColumn
              key={col}
              columnId={col}
              label={col}
              cases={groups[col] ?? []}
              canEdit={canEdit}
              dragging={activeId != null}
              busy={busy}
            />
          ))}
        </div>

        <DragOverlay>
          {activeCase ? (
            <CaseBoardCard
              caseItem={activeCase}
              canEdit={canEdit}
              isDraggingOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
