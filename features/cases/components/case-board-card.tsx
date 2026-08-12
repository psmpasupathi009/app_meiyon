"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UnitIdBadge } from "@/shared/components/data/unit-id-badge";
import { cn } from "@/lib/utils/cn";
import { normalizeCaseStatus } from "@meiyon/config";
import type { BoardCaseRow } from "@/features/cases/lib/board-columns";

type Props = {
  caseItem: BoardCaseRow;
  canEdit: boolean;
  isDraggingOverlay?: boolean;
};

function CardBody({
  caseItem,
  canEdit,
  showHandle,
  handleProps,
}: {
  caseItem: BoardCaseRow;
  canEdit: boolean;
  showHandle: boolean;
  handleProps?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const parties =
    caseItem.ourSide || caseItem.opposingParty
      ? [caseItem.ourSide, caseItem.opposingParty].filter(Boolean).join(" v ")
      : (caseItem.clientName ?? caseItem.clientUnitId);

  const st = normalizeCaseStatus(caseItem.status);

  return (
    <div className="flex items-start gap-1.5">
      {showHandle && canEdit ? (
        <button
          type="button"
          className="mt-0.5 shrink-0 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-navy active:cursor-grabbing"
          aria-label={`Drag ${caseItem.unitId}`}
          {...handleProps}
        >
          <GripVertical className="size-3.5" />
        </button>
      ) : null}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <UnitIdBadge value={caseItem.unitId} />
          {caseItem.caseType ? (
            <Badge variant="outline" className="text-[10px] font-medium">
              {caseItem.caseType}
            </Badge>
          ) : null}
        </div>
        <p className="text-sm font-semibold leading-snug text-navy">
          {caseItem.stage?.trim() ? (
            caseItem.stage
          ) : (
            <span className="font-normal text-muted-foreground">
              No status set
            </span>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">{parties}</p>
        <p className="text-[11px] text-muted-foreground">
          {caseItem.caseNumber ?? "Pending no."}
          {caseItem.nextHearingAt
            ? ` · ${new Date(caseItem.nextHearingAt).toLocaleDateString("en-IN")}`
            : ""}
        </p>
        <div className="flex flex-wrap gap-1">
          {caseItem.battaDue ? (
            <Badge variant="warning" className="text-[10px]">
              Batta due
            </Badge>
          ) : null}
          {st === "filing_defect" ? (
            <Badge variant="destructive" className="text-[10px]">
              Defect
            </Badge>
          ) : null}
        </div>
        {!showHandle ? null : (
          <Link
            href={`/cases/${caseItem.unitId}`}
            className="inline-block text-[11px] font-medium text-brand hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Open
          </Link>
        )}
      </div>
    </div>
  );
}

export function CaseBoardCard({
  caseItem,
  canEdit,
  isDraggingOverlay,
}: Props) {
  if (isDraggingOverlay) {
    return (
      <div className="w-58 rounded-lg border border-border/80 bg-card p-2.5 shadow-md ring-1 ring-brand/40">
        <CardBody caseItem={caseItem} canEdit={canEdit} showHandle={false} />
      </div>
    );
  }

  return <DraggableCaseBoardCard caseItem={caseItem} canEdit={canEdit} />;
}

function DraggableCaseBoardCard({
  caseItem,
  canEdit,
}: {
  caseItem: BoardCaseRow;
  canEdit: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: caseItem.unitId,
      data: { caseItem },
      disabled: !canEdit,
    });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border border-border/80 bg-card p-2.5 shadow-sm",
        isDragging ? "opacity-40" : ""
      )}
    >
      <CardBody
        caseItem={caseItem}
        canEdit={canEdit}
        showHandle
        handleProps={canEdit ? { ...listeners, ...attributes } : undefined}
      />
    </div>
  );
}
