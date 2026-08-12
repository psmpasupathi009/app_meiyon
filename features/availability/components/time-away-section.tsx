"use client";

import {
  CalendarOff,
  Gavel,
  Coffee,
  UserRound,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BLOCK_KIND_OPTIONS } from "@/lib/validations/availability.schema";
import { formatIstTime } from "@/lib/utils/ist";
import { cn } from "@/lib/utils/cn";

export type TimeAwayBlock = {
  unitId: string;
  userUnitId: string;
  startsAt: string;
  endsAt: string;
  kind: string;
  reason: string | null;
};

export type TimeAwaySectionProps = {
  canEdit: boolean;
  loading: boolean;
  blocks: TimeAwayBlock[];
  onAdd: () => void;
  onEdit: (block: TimeAwayBlock) => void;
  onDelete: (unitId: string) => void;
};

const KIND_META: Record<
  string,
  {
    label: string;
    icon: typeof Coffee;
    accent: string;
    chip: string;
  }
> = {
  break: {
    label: "Break / lunch",
    icon: Coffee,
    accent: "border-l-gold",
    chip: "bg-gold/15 text-navy",
  },
  court: {
    label: "Court",
    icon: Gavel,
    accent: "border-l-brand",
    chip: "bg-brand/10 text-navy",
  },
  personal: {
    label: "Personal",
    icon: UserRound,
    accent: "border-l-navy/50",
    chip: "bg-navy/10 text-navy",
  },
  other: {
    label: "Travel / site",
    icon: MoreHorizontal,
    accent: "border-l-border",
    chip: "bg-muted text-muted-foreground",
  },
};

function kindMeta(kind: string) {
  return (
    KIND_META[kind] ?? {
      label: BLOCK_KIND_OPTIONS.find((k) => k.value === kind)?.label ?? kind,
      icon: CalendarOff,
      accent: "border-l-border",
      chip: "bg-muted text-muted-foreground",
    }
  );
}

function formatDatePill(iso: string): {
  weekday: string;
  day: string;
  month: string;
} {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).formatToParts(date);
  return {
    weekday: parts.find((p) => p.type === "weekday")?.value ?? "",
    day: parts.find((p) => p.type === "day")?.value ?? "",
    month: parts.find((p) => p.type === "month")?.value ?? "",
  };
}

export function TimeAwaySection({
  canEdit,
  loading,
  blocks,
  onAdd,
  onEdit,
  onDelete,
}: TimeAwaySectionProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 items-center justify-center rounded-xl bg-navy/10 text-navy">
            <CalendarOff className="size-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-navy">
              Time away
            </h2>
            <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
              In office but court or travel? Add a block here. Client
              consultation? Book an appointment. Full day off? Leave (HRMS).
            </p>
          </div>
        </div>
        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 gap-2 px-4"
            onClick={onAdd}
            disabled={loading}
          >
            <Plus className="size-4" />
            Add
          </Button>
        ) : null}
      </div>

      <div className="p-4 sm:p-5">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-2xl border border-border/60 bg-muted/40"
              />
            ))}
          </div>
        ) : blocks.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border/80 bg-muted/15 px-6 py-12 text-center">
            <div className="mb-3 h-1 w-10 rounded-full bg-gold/80" aria-hidden />
            <p className="text-base font-semibold text-navy">Diary is clear</p>
            <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Your weekly break covers lunch. Block court or travel here so
              booking closes those hours — client meets go on Appointments.
            </p>
            {canEdit ? (
              <Button
                type="button"
                className="mt-5 h-11 gap-2 px-4"
                onClick={onAdd}
              >
                <Plus className="size-4" />
                Add time away
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className="space-y-3">
            {blocks.map((b) => {
              const start = new Date(b.startsAt);
              const end = new Date(b.endsAt);
              const pill = formatDatePill(b.startsAt);
              const meta = kindMeta(b.kind);
              const Icon = meta.icon;
              return (
                <li
                  key={b.unitId}
                  className={cn(
                    "rounded-2xl border border-border/80 border-l-4 bg-card p-4 transition-shadow hover:shadow-md sm:p-5",
                    meta.accent
                  )}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:justify-between">
                    <div className="flex min-w-0 flex-1 gap-3 sm:gap-4">
                      <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-navy/5 px-2 py-3 text-center sm:w-20">
                        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {pill.weekday}
                        </span>
                        <span className="mt-0.5 text-lg font-semibold tabular-nums text-navy sm:text-xl">
                          {pill.day}
                        </span>
                        <span className="mt-1 text-[11px] text-muted-foreground">
                          {pill.month}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="text-base font-semibold tabular-nums tracking-tight text-navy">
                          {formatIstTime(start)} – {formatIstTime(end)}
                        </p>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium",
                            meta.chip
                          )}
                        >
                          <Icon className="size-3.5" />
                          {meta.label}
                        </span>
                        {b.reason ? (
                          <p className="truncate text-sm text-muted-foreground">
                            {b.reason}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {canEdit ? (
                      <div className="flex shrink-0 items-center gap-1 self-end sm:self-center">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-11 gap-1.5 px-3"
                          onClick={() => onEdit(b)}
                        >
                          <Pencil className="size-3.5" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-11 gap-1.5 px-3 text-destructive hover:text-destructive"
                          onClick={() => onDelete(b.unitId)}
                        >
                          <Trash2 className="size-3.5" />
                          Remove
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
