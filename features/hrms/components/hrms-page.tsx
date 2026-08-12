"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/shared/components/data/page-header";
import { Badge } from "@/components/ui/badge";
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
import type { PublicUser } from "@/lib/auth/session";
import type {
  AttendanceSummary,
  LeaveSummary,
} from "@/features/hrms/server/serialize";
import type { PresenceBoard } from "@/features/hrms/server/presence";
import { LeaveApplyDialog } from "@/features/hrms/components/leave-apply-dialog";
import { PresenceTodaySection } from "@/features/hrms/components/presence-today-section";
import { AttendanceHistorySection } from "@/features/hrms/components/attendance-history-section";
import type { AttendanceExportScope } from "@/features/hrms/components/attendance-history-section";
import { LeaveSection } from "@/features/hrms/components/leave-section";
import { OfficeHolidayDialog } from "@/features/hrms/components/office-holiday-dialog";
import { OfficeHolidaysSection } from "@/features/hrms/components/office-holidays-section";
import { useHrmsSectionFromUrl } from "@/features/hrms/components/use-hrms-section-from-url";
import type { OfficeHolidaySummary } from "@/features/hrms/lib/office-holiday";
import {
  type AttendanceList,
  type DeskSection,
  type LeaveList,
  SelfStatusBadge,
  formatTime,
  personLabel,
} from "@/features/hrms/components/hrms-page-helpers";
import { applyAttendanceScopeParams } from "@/features/hrms/lib/attendance-scope";
import {
  last30DateKeys,
  thisMonthDateKeys,
  type HistoryPeriod,
} from "@/features/hrms/lib/period";
import { leaveCoversDate } from "@/features/hrms/lib/status";
import { dateIsOfficeHoliday } from "@/features/hrms/lib/office-holiday";
import { getAttendanceLocation } from "@/features/hrms/lib/get-attendance-location";
import { istAddCalendarDays, istDateKey } from "@/lib/utils/ist";
import { cn } from "@/lib/utils/cn";

type HolidayList = {
  data: OfficeHolidaySummary[];
  meta: { total: number };
};
export function HrmsPage({ user }: { user: PublicUser }) {
  const canManageAttendance = user.permissions.includes("hrms.manage_attendance");
  const canApproveLeave = user.permissions.includes("hrms.approve_leave");
  const canOwnAttendance = user.permissions.includes("hrms.own_attendance");
  const canOwnLeave = user.permissions.includes("hrms.own_leave");
  const canViewHolidays =
    canManageAttendance ||
    user.permissions.includes("hrms.view") ||
    canOwnAttendance;

  const { section, setSection, applyOpen, setApplyOpen } =
    useHrmsSectionFromUrl(canOwnLeave);

  const [todayRecord, setTodayRecord] = useState<AttendanceSummary | null>(null);
  const [history, setHistory] = useState<AttendanceSummary[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [presence, setPresence] = useState<PresenceBoard | null>(null);
  const [holidays, setHolidays] = useState<OfficeHolidaySummary[]>([]);
  const [holidayDialogOpen, setHolidayDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] =
    useState<OfficeHolidaySummary | null>(null);
  const [deletingHolidayId, setDeletingHolidayId] = useState<string | null>(null);
  const [myLeave, setMyLeave] = useState<LeaveSummary[]>([]);
  const [pendingLeave, setPendingLeave] = useState<LeaveSummary[]>([]);
  const [pendingLeaveTotal, setPendingLeaveTotal] = useState(0);
  const [decidedLeave, setDecidedLeave] = useState<LeaveSummary[]>([]);
  const [decidedLeaveTotal, setDecidedLeaveTotal] = useState(0);
  const [leaveInboxTab, setLeaveInboxTab] = useState<"pending" | "decided">(
    "pending"
  );
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInNotes, setCheckInNotes] = useState("");
  const [checkBusy, setCheckBusy] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<LeaveSummary | null>(null);
  const [rejectTarget, setRejectTarget] = useState<LeaveSummary | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [deciding, setDeciding] = useState(false);
  const [cancelBusyId, setCancelBusyId] = useState<string | null>(null);

  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [exportScope, setExportScope] =
    useState<AttendanceExportScope>("all");
  const [selectedEmployeeUnitIds, setSelectedEmployeeUnitIds] = useState<
    string[]
  >([]);

  const today = istDateKey();

  const attendanceEmployees = useMemo(() => {
    const people = presence?.people ?? [];
    return people
      .map((p) => ({
        unitId: p.unitId,
        label: p.displayName || p.name || p.unitId,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [presence?.people]);
  const officeHolidayToday = useMemo(() => {
    if (presence?.officeHoliday) return presence.officeHoliday;
    const hit = holidays.find((h) =>
      dateIsOfficeHoliday(today, [{ fromDate: h.fromDate, toDate: h.toDate }])
    );
    return hit
      ? { unitId: hit.unitId, title: hit.title, notes: hit.notes }
      : null;
  }, [presence?.officeHoliday, holidays, today]);

  const onLeaveToday = useMemo(
    () =>
      myLeave.some(
        (l) =>
          l.status === "approved" &&
          leaveCoversDate(l.fromDate, l.toDate, today)
      ),
    [myLeave, today]
  );

  const pendingLeaveToday = useMemo(
    () =>
      myLeave.some(
        (l) =>
          l.status === "pending" &&
          leaveCoversDate(l.fromDate, l.toDate, today)
      ),
    [myLeave, today]
  );

  const historyRange = useMemo(() => {
    if (historyPeriod === "month") return thisMonthDateKeys();
    if (historyPeriod === "30d") return last30DateKeys();
    if (customFrom && customTo && customFrom <= customTo) {
      return { from: customFrom, to: customTo };
    }
    return null;
  }, [historyPeriod, customFrom, customTo]);

  const loadCore = useCallback(async () => {
    setLoading(true);
    try {
      const tasks: Promise<void>[] = [];

      if (canOwnAttendance) {
        tasks.push(
          (async () => {
            const attRes = await apiFetch<AttendanceList>(
              `/api/hrms/attendance?mine=1&from=${today}&to=${today}&pageSize=1`
            );
            if (attRes.ok) {
              const rows =
                (attRes.data as unknown as AttendanceList).data ?? [];
              setTodayRecord(rows[0] ?? null);
            } else {
              toast.error(
                getErrorMessage(
                  attRes.data as Record<string, unknown>,
                  "Failed to load attendance"
                )
              );
            }
          })()
        );
      }

      if (canOwnLeave) {
        tasks.push(
          (async () => {
            const leaveRes = await apiFetch<LeaveList>(
              "/api/hrms/leave?mine=1&pageSize=50"
            );
            if (leaveRes.ok) {
              setMyLeave((leaveRes.data as unknown as LeaveList).data ?? []);
            } else {
              toast.error(
                getErrorMessage(
                  leaveRes.data as Record<string, unknown>,
                  "Failed to load leave"
                )
              );
            }
          })()
        );
      }

      if (canManageAttendance) {
        tasks.push(
          (async () => {
            const res = await apiFetch<PresenceBoard>(
              `/api/hrms/presence?date=${today}`
            );
            if (res.ok) {
              setPresence(res.data as unknown as PresenceBoard);
            } else {
              toast.error(
                getErrorMessage(
                  res.data as Record<string, unknown>,
                  "Failed to load who’s in"
                )
              );
            }
          })()
        );
      }

      if (canViewHolidays) {
        tasks.push(
          (async () => {
            const from = istAddCalendarDays(today, -90);
            const to = istAddCalendarDays(today, 365);
            const res = await apiFetch<HolidayList>(
              `/api/hrms/holidays?from=${from}&to=${to}&pageSize=50`
            );
            if (res.ok) {
              setHolidays((res.data as unknown as HolidayList).data ?? []);
            }
          })()
        );
      }

      if (canApproveLeave) {
        tasks.push(
          (async () => {
            const [pendingRes, decidedRes] = await Promise.all([
              apiFetch<LeaveList>(
                "/api/hrms/leave?status=pending&pageSize=50"
              ),
              apiFetch<LeaveList>(
                "/api/hrms/leave?status=decided&pageSize=50"
              ),
            ]);
            if (pendingRes.ok) {
              const body = pendingRes.data as unknown as LeaveList;
              setPendingLeave(body.data ?? []);
              setPendingLeaveTotal(body.meta?.total ?? body.data?.length ?? 0);
            }
            if (decidedRes.ok) {
              const body = decidedRes.data as unknown as LeaveList;
              setDecidedLeave(body.data ?? []);
              setDecidedLeaveTotal(body.meta?.total ?? body.data?.length ?? 0);
            }
          })()
        );
      }

      await Promise.all(tasks);
    } finally {
      setLoading(false);
    }
  }, [
    canOwnAttendance,
    canOwnLeave,
    canManageAttendance,
    canApproveLeave,
    canViewHolidays,
    today,
  ]);

  const loadHistory = useCallback(async () => {
    if (!(canOwnAttendance || canManageAttendance) || !historyRange) return;
    if (
      canManageAttendance &&
      exportScope === "selected" &&
      selectedEmployeeUnitIds.length === 0
    ) {
      setHistory([]);
      setHistoryTotal(0);
      return;
    }
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        from: historyRange.from,
        to: historyRange.to,
        pageSize: "50",
      });
      applyAttendanceScopeParams(params, {
        canManage: canManageAttendance,
        scope: canManageAttendance ? exportScope : "mine",
        unitIds: selectedEmployeeUnitIds,
      });
      const res = await apiFetch<AttendanceList>(
        `/api/hrms/attendance?${params.toString()}`
      );
      if (!res.ok) {
        toast.error(
          getErrorMessage(
            res.data as Record<string, unknown>,
            "Failed to load history"
          )
        );
        return;
      }
      const body = res.data as unknown as AttendanceList;
      setHistory(body.data ?? []);
      setHistoryTotal(body.meta?.total ?? 0);
    } finally {
      setHistoryLoading(false);
    }
  }, [
    canOwnAttendance,
    canManageAttendance,
    historyRange,
    exportScope,
    selectedEmployeeUnitIds,
  ]);

  useEffect(() => {
    void (async () => {
      await Promise.resolve();
      await loadCore();
    })();
  }, [loadCore]);

  useEffect(() => {
    if (section !== "history") return;
    void (async () => {
      await Promise.resolve();
      await loadHistory();
    })();
  }, [section, loadHistory]);

  function openApplyLeave() {
    setSection("leave");
    setApplyOpen(true);
  }

  function handleLeaveSaved() {
    setSection("leave");
    void loadCore();
  }

  function handleHolidaySaved() {
    setSection("holidays");
    void loadCore();
  }

  async function handleDeleteHoliday(holiday: OfficeHolidaySummary) {
    if (
      !window.confirm(
        `Remove office holiday “${holiday.title}”? Staff will no longer see this day as closed.`
      )
    ) {
      return;
    }
    setDeletingHolidayId(holiday.unitId);
    const { ok, data } = await apiFetch(
      `/api/hrms/holidays/${holiday.unitId}`,
      { method: "DELETE" }
    );
    setDeletingHolidayId(null);
    if (!ok) {
      toast.error(
        getErrorMessage(
          data as Record<string, unknown>,
          "Failed to remove holiday"
        )
      );
      return;
    }
    toast.success("Holiday removed");
    void loadCore();
  }

  async function submitCheckIn() {
    setCheckBusy(true);
    try {
      const loc = await getAttendanceLocation();
      const { ok, data } = await apiFetch("/api/hrms/attendance/check-in", {
        method: "POST",
        json: {
          notes: checkInNotes.trim() || undefined,
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracy: loc.accuracy,
        },
      });
      if (!ok) {
        toast.error(
          getErrorMessage(data as Record<string, unknown>, "Failed to check in")
        );
        return;
      }
      toast.success("Checked in");
      setCheckInOpen(false);
      setCheckInNotes("");
      void loadCore();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not get your location"
      );
    } finally {
      setCheckBusy(false);
    }
  }

  async function handleCheckOut() {
    setCheckBusy(true);
    try {
      const loc = await getAttendanceLocation();
      const { ok, data } = await apiFetch("/api/hrms/attendance/check-out", {
        method: "POST",
        json: {
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracy: loc.accuracy,
        },
      });
      if (!ok) {
        toast.error(
          getErrorMessage(
            data as Record<string, unknown>,
            "Failed to check out"
          )
        );
        return;
      }
      toast.success("Checked out");
      void loadCore();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not get your location"
      );
    } finally {
      setCheckBusy(false);
    }
  }

  async function handleCancelLeave() {
    if (!cancelTarget) return;
    setCancelBusyId(cancelTarget.unitId);
    const { ok, data } = await apiFetch(
      `/api/hrms/leave/${cancelTarget.unitId}/cancel`,
      { method: "POST" }
    );
    setCancelBusyId(null);
    if (!ok) {
      toast.error(
        getErrorMessage(data as Record<string, unknown>, "Failed to cancel leave")
      );
      return;
    }
    toast.success(
      cancelTarget.status === "approved"
        ? "Approved leave cancelled"
        : "Leave request cancelled"
    );
    setCancelTarget(null);
    void loadCore();
  }

  async function handleApprove(unitId: string) {
    setDeciding(true);
    const { ok, data } = await apiFetch(`/api/hrms/leave/${unitId}/decide`, {
      method: "POST",
      json: { decision: "approved" },
    });
    setDeciding(false);
    if (!ok) {
      toast.error(
        getErrorMessage(data as Record<string, unknown>, "Failed to approve leave")
      );
      return;
    }
    toast.success("Leave approved");
    void loadCore();
  }

  async function handleRejectSubmit() {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (reason.length < 3) {
      toast.error("Enter a brief reject reason");
      return;
    }
    setDeciding(true);
    const { ok, data } = await apiFetch(
      `/api/hrms/leave/${rejectTarget.unitId}/decide`,
      {
        method: "POST",
        json: { decision: "rejected", rejectReason: reason },
      }
    );
    setDeciding(false);
    if (!ok) {
      toast.error(
        getErrorMessage(data as Record<string, unknown>, "Failed to reject leave")
      );
      return;
    }
    toast.success("Leave rejected");
    setRejectTarget(null);
    setRejectReason("");
    void loadCore();
  }

  const counts = presence?.counts;
  const sections: { id: DeskSection; label: string }[] = [
    { id: "today", label: "Today" },
    ...(canOwnAttendance || canManageAttendance
      ? [
          {
            id: "history" as const,
            label: canManageAttendance ? "History" : "My history",
          },
        ]
      : []),
    ...(canOwnLeave || canApproveLeave
      ? [{ id: "leave" as const, label: "Leave" }]
      : []),
    ...(canViewHolidays
      ? [{ id: "holidays" as const, label: "Office holidays" }]
      : []),
  ];

  return (
    <section className="space-y-5">
      <PageHeader
        title="HRMS"
        description="Attendance and leave for the office — check in when you arrive, check out when you leave; apply leave for days away."
        actions={
          <>
            {canOwnAttendance ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    Boolean(officeHolidayToday) ||
                    onLeaveToday ||
                    Boolean(todayRecord?.checkInAt) ||
                    checkBusy
                  }
                  onClick={() => {
                    setCheckInNotes("");
                    setCheckInOpen(true);
                  }}
                >
                  Check in
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    !todayRecord?.checkInAt ||
                    Boolean(todayRecord?.checkOutAt) ||
                    checkBusy
                  }
                  onClick={handleCheckOut}
                >
                  Check out
                </Button>
              </>
            ) : null}
            {canOwnLeave ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={openApplyLeave}
              >
                Apply leave
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm shadow-black/5 dark:shadow-md dark:shadow-black/40">
          <p className="text-xs font-medium text-muted-foreground">Your status</p>
          <div className="mt-2 flex items-center gap-2">
            {officeHolidayToday ? (
              <Badge variant="muted">Office closed</Badge>
            ) : (
              <SelfStatusBadge onLeave={onLeaveToday} record={todayRecord} />
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {officeHolidayToday
              ? `Closed — ${officeHolidayToday.title}`
              : onLeaveToday
                ? "Approved leave covers today"
                : todayRecord?.checkInAt
                  ? `In ${formatTime(todayRecord.checkInAt)}`
                  : "Not checked in"}
            {!officeHolidayToday && !onLeaveToday && todayRecord?.checkOutAt
              ? ` · Out ${formatTime(todayRecord.checkOutAt)}`
              : ""}
            {pendingLeaveToday && !onLeaveToday && !officeHolidayToday
              ? " · Leave pending approval"
              : ""}
          </p>
        </div>
        {canManageAttendance && counts ? (
          (
            [
              { label: "Present", value: counts.present },
              { label: "Checked out", value: counts.out },
              {
                label: officeHolidayToday ? "Office closed" : "On leave",
                value: counts.onLeave,
              },
              { label: "Absent", value: counts.absent },
            ] as const
          ).map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-border/80 bg-card p-4 shadow-sm shadow-black/5 dark:shadow-md dark:shadow-black/40"
            >
              <p className="text-xs font-medium text-muted-foreground">
                {kpi.label}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-navy">
                {loading ? "—" : kpi.value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Today · office</p>
            </div>
          ))
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              section === s.id
                ? "bg-brand text-brand-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-navy"
            )}
          >
            {s.label}
            {s.id === "leave" && canApproveLeave && pendingLeaveTotal > 0
              ? ` (${pendingLeaveTotal})`
              : ""}
          </button>
        ))}
      </div>

      {section === "today" ? (
        <PresenceTodaySection
          loading={loading}
          onLeaveToday={onLeaveToday}
          pendingLeaveToday={pendingLeaveToday}
          todayRecord={todayRecord}
          canManageAttendance={canManageAttendance}
          presence={presence}
          officeHoliday={officeHolidayToday}
        />
      ) : null}

      {section === "history" ? (
        <AttendanceHistorySection
          history={history}
          historyTotal={historyTotal}
          historyLoading={historyLoading}
          historyPeriod={historyPeriod}
          customFrom={customFrom}
          customTo={customTo}
          historyRange={historyRange}
          canManageExport={canManageAttendance}
          exportScope={exportScope}
          selectedEmployeeUnitIds={selectedEmployeeUnitIds}
          employees={attendanceEmployees}
          onPeriodChange={setHistoryPeriod}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
          onExportScopeChange={setExportScope}
          onSelectedEmployeesChange={setSelectedEmployeeUnitIds}
        />
      ) : null}

      {section === "leave" ? (
        <LeaveSection
          loading={loading}
          canApproveLeave={canApproveLeave}
          canOwnLeave={canOwnLeave}
          currentUserUnitId={user.unitId}
          leaveInboxTab={leaveInboxTab}
          pendingLeave={pendingLeave}
          pendingLeaveTotal={pendingLeaveTotal}
          decidedLeave={decidedLeave}
          decidedLeaveTotal={decidedLeaveTotal}
          myLeave={myLeave}
          deciding={deciding}
          cancelBusyId={cancelBusyId}
          onLeaveInboxTabChange={setLeaveInboxTab}
          onApplyLeave={openApplyLeave}
          onApprove={handleApprove}
          onReject={(l) => {
            setRejectReason("");
            setRejectTarget(l);
          }}
          onCancel={(l) => setCancelTarget(l)}
        />
      ) : null}

      {section === "holidays" ? (
        <OfficeHolidaysSection
          loading={loading}
          canManage={canManageAttendance}
          holidays={holidays}
          deletingId={deletingHolidayId}
          onAdd={() => {
            setEditingHoliday(null);
            setHolidayDialogOpen(true);
          }}
          onEdit={(h) => {
            setEditingHoliday(h);
            setHolidayDialogOpen(true);
          }}
          onDelete={handleDeleteHoliday}
        />
      ) : null}

      <LeaveApplyDialog
        open={applyOpen}
        onOpenChangeAction={setApplyOpen}
        onSavedAction={handleLeaveSaved}
      />

      <OfficeHolidayDialog
        open={holidayDialogOpen}
        editing={editingHoliday}
        onOpenChangeAction={(open) => {
          setHolidayDialogOpen(open);
          if (!open) setEditingHoliday(null);
        }}
        onSavedAction={handleHolidaySaved}
      />

      <Dialog open={checkInOpen} onOpenChange={setCheckInOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Check in</DialogTitle>
            <DialogDescription>
              Your device location is required and saved with this check-in so
              managers can see where you punched. Notes are for the team board
              only — they do not close booking slots.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="checkin-notes">Note (optional)</Label>
              <Textarea
                id="checkin-notes"
                value={checkInNotes}
                onChange={(e) => setCheckInNotes(e.target.value)}
                placeholder="e.g. At Gobichettipalayam court"
                rows={3}
              />
            </div>
            <p className="rounded-xl border border-border/80 bg-muted/25 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
              Going to court or a client site for part of the day?{" "}
              <Link
                href="/availability"
                className="font-medium text-navy underline-offset-2 hover:underline"
                onClick={() => setCheckInOpen(false)}
              >
                Block booking hours on Availability
              </Link>{" "}
              so clients cannot book that window.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCheckInOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={checkBusy}
              onClick={submitCheckIn}
            >
              {checkBusy ? "Checking in…" : "Check in"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>
              {cancelTarget?.status === "approved"
                ? "Cancel approved leave?"
                : "Cancel leave request?"}
            </DialogTitle>
            <DialogDescription>
              {cancelTarget
                ? cancelTarget.status === "approved"
                  ? `${cancelTarget.fromDate} → ${cancelTarget.toDate}.`
                  : `${cancelTarget.fromDate} → ${cancelTarget.toDate}. You can apply again later.`
                : "Withdraw this request."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelTarget(null)}
            >
              Keep
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={Boolean(cancelBusyId)}
              onClick={handleCancelLeave}
            >
              {cancelBusyId ? "Cancelling…" : "Cancel request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(rejectTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Reject leave</DialogTitle>
            <DialogDescription>
              {rejectTarget
                ? `Reject leave for ${personLabel(rejectTarget.userUnitId, rejectTarget.userName)} (${rejectTarget.fromDate} → ${rejectTarget.toDate}).`
                : "Provide a reason for rejection."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-2">
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Why is this leave being rejected?"
              rows={3}
            />
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRejectTarget(null);
                setRejectReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deciding}
              onClick={handleRejectSubmit}
            >
              {deciding ? "Rejecting…" : "Reject leave"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
