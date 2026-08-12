"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarClock, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/shared/components/data/page-header";
import { Button } from "@/components/ui/button";
import { apiFetch, getErrorMessage } from "@/lib/api/client";
import type { PublicUser } from "@/lib/auth/session";
import { canBookForAnyAdvocate } from "@/lib/appointments/booking-rules";
import { personDisplayName } from "@/shared/lib/person";
import {
  bookingDefaults,
  rangesFromWorkAndBreak,
} from "@/config/company/booking";
import { BLOCK_KIND_OPTIONS } from "@/lib/validations/availability.schema";
import { formatIstTime, istDateKey } from "@/lib/utils/ist";
import { AdvocatePicker } from "@/features/employees/components/advocate-picker";
import {
  WeeklyHoursCard,
  WEEKDAYS,
} from "@/features/availability/components/weekly-hours-card";
import {
  TimeAwaySection,
  type TimeAwayBlock,
} from "@/features/availability/components/time-away-section";
import {
  TimeAwayDialog,
  emptyTimeAwayForm,
  type TimeAwayForm,
} from "@/features/availability/components/time-away-dialog";
import {
  inferSchedule,
  normalizeHm,
  type HoursDay,
} from "@/features/availability/lib/infer-schedule";
import { cn } from "@/lib/utils/cn";

type ScheduleSnapshot = {
  openDays: number[];
  workStart: string;
  workEnd: string;
  hasBreak: boolean;
  breakStart: string;
  breakEnd: string;
};

function toSnapshot(
  openDays: Set<number>,
  workStart: string,
  workEnd: string,
  hasBreak: boolean,
  breakStart: string,
  breakEnd: string
): ScheduleSnapshot {
  return {
    openDays: [...openDays].sort((a, b) => a - b),
    workStart: normalizeHm(workStart),
    workEnd: normalizeHm(workEnd),
    hasBreak,
    breakStart: normalizeHm(breakStart),
    breakEnd: normalizeHm(breakEnd),
  };
}

function snapshotsEqual(a: ScheduleSnapshot, b: ScheduleSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** HH:mm in IST from a Date (normalize en-GB "24"). */
function formatHm(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  const h = hour === "24" ? "00" : hour;
  return `${h.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

function kindToastLabel(kind: string): string {
  return (
    BLOCK_KIND_OPTIONS.find((k) => k.value === kind)?.label ?? "Time away"
  );
}

export function AvailabilityPage({ user }: { user: PublicUser }) {
  const canEdit = user.permissions.includes("appointments.edit");
  const bookAny = canBookForAnyAdvocate(user.roles);
  const loadSeq = useRef(0);

  const [targetUnitId, setTargetUnitId] = useState(user.unitId);
  const [targetLabel, setTargetLabel] = useState(
    personDisplayName({
      name: user.name,
      mobile: user.mobile,
      unitId: user.unitId,
      fallback: "Your schedule",
    })
  );
  const [usingDefaults, setUsingDefaults] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savingHours, setSavingHours] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<ScheduleSnapshot>(() =>
    toSnapshot(
      new Set(bookingDefaults.defaultOpenWeekdays),
      bookingDefaults.workStart,
      bookingDefaults.workEnd,
      true,
      bookingDefaults.breakStart,
      bookingDefaults.breakEnd
    )
  );

  const [openDays, setOpenDays] = useState<Set<number>>(
    () => new Set(bookingDefaults.defaultOpenWeekdays)
  );
  const [workStart, setWorkStart] = useState(bookingDefaults.workStart);
  const [workEnd, setWorkEnd] = useState(bookingDefaults.workEnd);
  const [hasBreak, setHasBreak] = useState(true);
  const [breakStart, setBreakStart] = useState(bookingDefaults.breakStart);
  const [breakEnd, setBreakEnd] = useState(bookingDefaults.breakEnd);

  const [blocks, setBlocks] = useState<TimeAwayBlock[]>([]);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<TimeAwayBlock | null>(null);
  const [blockForm, setBlockForm] = useState<TimeAwayForm>(emptyTimeAwayForm);
  const [blockBusy, setBlockBusy] = useState(false);

  const dirty = useMemo(() => {
    const current = toSnapshot(
      openDays,
      workStart,
      workEnd,
      hasBreak,
      breakStart,
      breakEnd
    );
    return !snapshotsEqual(current, savedSnapshot);
  }, [
    openDays,
    workStart,
    workEnd,
    hasBreak,
    breakStart,
    breakEnd,
    savedSnapshot,
  ]);

  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const applyInferred = useCallback(
    (inferred: ReturnType<typeof inferSchedule>) => {
      setOpenDays(inferred.openDays);
      setWorkStart(inferred.workStart);
      setWorkEnd(inferred.workEnd);
      setHasBreak(inferred.hasBreak);
      setBreakStart(inferred.breakStart);
      setBreakEnd(inferred.breakEnd);
      setSavedSnapshot(
        toSnapshot(
          inferred.openDays,
          inferred.workStart,
          inferred.workEnd,
          inferred.hasBreak,
          inferred.breakStart,
          inferred.breakEnd
        )
      );
    },
    []
  );

  const loadHours = useCallback(
    async (unitId: string, seq: number) => {
      const q =
        unitId !== user.unitId
          ? `?userUnitId=${encodeURIComponent(unitId)}`
          : "";
      const { ok, data } = await apiFetch<{
        usingDefaults: boolean;
        days: HoursDay[];
      }>(`/api/advocates/availability/hours${q}`);
      if (seq !== loadSeq.current) return;
      if (!ok || !data || typeof data !== "object") {
        toast.error("Could not load working hours");
        return;
      }
      const body = data as { usingDefaults: boolean; days: HoursDay[] };
      const defaults = Boolean(body.usingDefaults);
      setUsingDefaults(defaults);
      applyInferred(inferSchedule(body.days ?? [], defaults));
    },
    [applyInferred, user.unitId]
  );

  const loadBlocks = useCallback(
    async (unitId: string, seq: number) => {
      const params = new URLSearchParams({ pageSize: "50" });
      if (unitId !== user.unitId) params.set("userUnitId", unitId);
      const { ok, data } = await apiFetch<{ data: TimeAwayBlock[] }>(
        `/api/advocates/availability/blocks?${params.toString()}`
      );
      if (seq !== loadSeq.current) return;
      if (!ok || !data || typeof data !== "object") {
        setBlocks([]);
        return;
      }
      setBlocks(
        Array.isArray((data as { data: TimeAwayBlock[] }).data)
          ? (data as { data: TimeAwayBlock[] }).data
          : []
      );
    },
    [user.unitId]
  );

  const refresh = useCallback(
    async (unitId: string) => {
      const seq = ++loadSeq.current;
      setLoading(true);
      await Promise.all([loadHours(unitId, seq), loadBlocks(unitId, seq)]);
      if (seq === loadSeq.current) setLoading(false);
    },
    [loadBlocks, loadHours]
  );

  useEffect(() => {
    void (async () => {
      await Promise.resolve();
      await refresh(targetUnitId);
    })();
  }, [refresh, targetUnitId]);

  function selectAdvocate(
    nextUnitId: string,
    nextLabel: string
  ) {
    if (nextUnitId === targetUnitId) return;
    if (dirtyRef.current) {
      const ok = window.confirm(
        "You have unsaved schedule changes. Switch advocate and discard them?"
      );
      if (!ok) return;
    }
    setTargetUnitId(nextUnitId);
    setTargetLabel(nextLabel);
  }

  function toggleDay(weekday: number) {
    if (!canEdit) return;
    setOpenDays((prev) => {
      const next = new Set(prev);
      if (next.has(weekday)) next.delete(weekday);
      else next.add(weekday);
      return next;
    });
  }

  async function saveHours() {
    if (!canEdit) return;

    const ws = normalizeHm(workStart);
    const we = normalizeHm(workEnd);
    const bs = normalizeHm(breakStart);
    const be = normalizeHm(breakEnd);

    if (ws >= we) {
      toast.error("Work end must be after work start");
      return;
    }
    if (hasBreak) {
      if (bs >= be) {
        toast.error("Break end must be after break start");
        return;
      }
      if (bs <= ws || be >= we) {
        toast.error("Break must fall inside working hours");
        return;
      }
    }

    if (openDays.size === 0) {
      const ok = window.confirm(
        "Close every day? Clients will have no free slots to book until you reopen days."
      );
      if (!ok) return;
    }

    const ranges = rangesFromWorkAndBreak({
      workStart: ws,
      workEnd: we,
      breakStart: hasBreak ? bs : undefined,
      breakEnd: hasBreak ? be : undefined,
    });

    const days = WEEKDAYS.map(({ value }) => ({
      weekday: value,
      ranges: openDays.has(value) ? ranges : [],
    }));

    setSavingHours(true);
    const { ok, data } = await apiFetch("/api/advocates/availability/hours", {
      method: "PUT",
      json: {
        userUnitId: targetUnitId === user.unitId ? undefined : targetUnitId,
        days,
      },
    });
    setSavingHours(false);
    if (!ok) {
      toast.error(
        getErrorMessage(data as Record<string, unknown>, "Failed to save hours")
      );
      return;
    }
    toast.success("Schedule saved — booking will use these hours");
    setUsingDefaults(false);
    setWorkStart(ws);
    setWorkEnd(we);
    setBreakStart(bs);
    setBreakEnd(be);
    setSavedSnapshot(toSnapshot(openDays, ws, we, hasBreak, bs, be));
    await loadHours(targetUnitId, loadSeq.current);
  }

  function openAddBlock() {
    setEditingBlock(null);
    setBlockForm(emptyTimeAwayForm());
    setBlockDialogOpen(true);
  }

  function openEditBlock(block: TimeAwayBlock) {
    const start = new Date(block.startsAt);
    const end = new Date(block.endsAt);
    setEditingBlock(block);
    setBlockForm({
      date: istDateKey(start),
      startTime: formatHm(start),
      endTime: formatHm(end),
      kind: block.kind || "break",
      reason: block.reason ?? "",
    });
    setBlockDialogOpen(true);
  }

  async function saveBlock() {
    if (!canEdit) return;
    const startTime = normalizeHm(blockForm.startTime);
    const endTime = normalizeHm(blockForm.endTime);
    if (!blockForm.date || !startTime || !endTime) {
      toast.error("Date and times are required");
      return;
    }
    if (startTime >= endTime) {
      toast.error("End time must be after start");
      return;
    }

    const startsAt = `${blockForm.date}T${startTime}:00+05:30`;
    const endsAt = `${blockForm.date}T${endTime}:00+05:30`;
    const label = kindToastLabel(blockForm.kind);

    setBlockBusy(true);
    if (editingBlock) {
      const { ok, data } = await apiFetch(
        `/api/advocates/availability/blocks/${editingBlock.unitId}`,
        {
          method: "PATCH",
          json: {
            startsAt,
            endsAt,
            kind: blockForm.kind,
            reason: blockForm.reason || null,
          },
        }
      );
      setBlockBusy(false);
      if (!ok) {
        toast.error(
          getErrorMessage(
            data as Record<string, unknown>,
            "Failed to update time away"
          )
        );
        return;
      }
      toast.success(`${label} updated`);
    } else {
      const { ok, data } = await apiFetch(
        "/api/advocates/availability/blocks",
        {
          method: "POST",
          json: {
            userUnitId:
              targetUnitId === user.unitId ? undefined : targetUnitId,
            startsAt,
            endsAt,
            kind: blockForm.kind,
            reason: blockForm.reason || undefined,
          },
        }
      );
      setBlockBusy(false);
      if (!ok) {
        toast.error(
          getErrorMessage(
            data as Record<string, unknown>,
            "Failed to add time away"
          )
        );
        return;
      }
      toast.success(`${label} added`);
    }
    setBlockDialogOpen(false);
    await loadBlocks(targetUnitId, loadSeq.current);
  }

  async function deleteBlock(unitId: string) {
    if (!canEdit) return;
    const block = blocks.find((b) => b.unitId === unitId);
    const label = block ? kindToastLabel(block.kind) : "Time away";
    const when = block
      ? `${formatIstTime(new Date(block.startsAt))} – ${formatIstTime(new Date(block.endsAt))}`
      : "this block";
    const okConfirm = window.confirm(
      `Remove ${label.toLowerCase()} (${when})? Booking will open that slot again.`
    );
    if (!okConfirm) return;

    const { ok, data } = await apiFetch(
      `/api/advocates/availability/blocks/${unitId}`,
      { method: "DELETE" }
    );
    if (!ok) {
      toast.error(
        getErrorMessage(
          data as Record<string, unknown>,
          "Failed to remove time away"
        )
      );
      return;
    }
    toast.success(`${label} removed`);
    await loadBlocks(targetUnitId, loadSeq.current);
  }

  const scheduleHeader = (
    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:flex-1">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground shadow-sm">
          <CalendarClock className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold tracking-tight text-navy">
            Weekly schedule
          </h2>
          <p className="truncate text-sm text-muted-foreground">{targetLabel}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex rounded-lg px-2 py-0.5 text-[11px] font-medium",
                usingDefaults
                  ? "bg-muted text-muted-foreground"
                  : "bg-brand/10 text-navy"
              )}
            >
              {usingDefaults ? "Office defaults" : "Custom schedule"}
            </span>
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              IST
            </span>
            {dirty ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-gold/15 px-2 py-0.5 text-[11px] font-medium text-navy">
                <span className="size-1.5 animate-pulse rounded-full bg-gold" />
                Unsaved
              </span>
            ) : null}
          </div>
        </div>
      </div>
      {bookAny ? (
        <div className="w-full sm:max-w-xs lg:w-56">
          <AdvocatePicker
            className="h-11"
            value={targetUnitId}
            selectedLabel={targetLabel}
            valueBy="unitId"
            onChange={(a) => {
              if (!a) {
                selectAdvocate(
                  user.unitId,
                  personDisplayName({
                    name: user.name,
                    mobile: user.mobile,
                    unitId: user.unitId,
                    fallback: "Your schedule",
                  })
                );
                return;
              }
              selectAdvocate(
                a.unitId,
                a.displayName ||
                  personDisplayName({
                    name: a.name,
                    mobile: a.mobile,
                    unitId: a.unitId,
                  })
              );
            }}
            placeholder="Select advocate"
            clearable
            clearLabel={`Yourself (${personDisplayName({
              name: user.name,
              mobile: user.mobile,
              unitId: user.unitId,
            })})`}
          />
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-6 pb-4">
      <PageHeader
        title="Availability"
        description="When clients can book you. Stay checked in on HRMS if you are in the office; use time away for court or travel, appointments for client meets, and leave only for full days off."
        actions={
          <Button asChild variant="outline" className="h-11 gap-2 px-4">
            <Link href="/hrms">
              Leave (HRMS)
              <ExternalLink className="size-3.5 opacity-70" />
            </Link>
          </Button>
        }
      />

      <WeeklyHoursCard
        header={scheduleHeader}
        canEdit={canEdit}
        loading={loading}
        savingHours={savingHours}
        dirty={dirty}
        openDays={openDays}
        workStart={workStart}
        workEnd={workEnd}
        hasBreak={hasBreak}
        breakStart={breakStart}
        breakEnd={breakEnd}
        onToggleDay={toggleDay}
        onWorkStartChange={setWorkStart}
        onWorkEndChange={setWorkEnd}
        onHasBreakChange={setHasBreak}
        onBreakStartChange={setBreakStart}
        onBreakEndChange={setBreakEnd}
        onSave={() => void saveHours()}
      />

      <TimeAwaySection
        canEdit={canEdit}
        loading={loading}
        blocks={blocks}
        onAdd={openAddBlock}
        onEdit={openEditBlock}
        onDelete={(unitId) => void deleteBlock(unitId)}
      />

      <TimeAwayDialog
        open={blockDialogOpen}
        onOpenChange={setBlockDialogOpen}
        editing={Boolean(editingBlock)}
        form={blockForm}
        onFormChange={setBlockForm}
        busy={blockBusy}
        onSave={() => void saveBlock()}
      />
    </div>
  );
}
