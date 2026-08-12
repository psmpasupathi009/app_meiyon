"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DatePicker } from "@/shared/components/forms/date-picker";
import { apiDownload } from "@/lib/api/client";
import type { AttendanceSummary } from "@/features/hrms/server/serialize";
import type { HistoryPeriod } from "@/features/hrms/lib/period";
import {
  ATTENDANCE_SCOPE_MAX_IDS,
  applyAttendanceScopeParams,
} from "@/features/hrms/lib/attendance-scope";
import { cn } from "@/lib/utils/cn";
import {
  formatDayLabel,
  formatTime,
  LocationLink,
} from "@/features/hrms/components/hrms-page-helpers";

export type AttendanceExportScope = "all" | "selected";

export type AttendanceEmployeeOption = {
  unitId: string;
  label: string;
};

export type AttendanceHistorySectionProps = {
  history: AttendanceSummary[];
  historyTotal: number;
  historyLoading: boolean;
  historyPeriod: HistoryPeriod;
  customFrom: string;
  customTo: string;
  historyRange: { from: string; to: string } | null;
  /** Managers can export everyone or a multi-select of staff. */
  canManageExport?: boolean;
  exportScope?: AttendanceExportScope;
  selectedEmployeeUnitIds?: string[];
  employees?: AttendanceEmployeeOption[];
  onPeriodChange: (period: HistoryPeriod) => void;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
  onExportScopeChange?: (scope: AttendanceExportScope) => void;
  onSelectedEmployeesChange?: (unitIds: string[]) => void;
};

function toggleId(ids: string[], unitId: string, checked: boolean): string[] {
  const set = new Set(ids);
  if (checked) set.add(unitId);
  else set.delete(unitId);
  return [...set].slice(0, ATTENDANCE_SCOPE_MAX_IDS);
}

export function AttendanceHistorySection({
  history,
  historyTotal,
  historyLoading,
  historyPeriod,
  customFrom,
  customTo,
  historyRange,
  canManageExport = false,
  exportScope = "all",
  selectedEmployeeUnitIds = [],
  employees = [],
  onPeriodChange,
  onCustomFromChange,
  onCustomToChange,
  onExportScopeChange,
  onSelectedEmployeesChange,
}: AttendanceHistorySectionProps) {
  const [exporting, setExporting] = useState(false);
  const [employeeQuery, setEmployeeQuery] = useState("");

  const selectedSet = useMemo(
    () => new Set(selectedEmployeeUnitIds),
    [selectedEmployeeUnitIds]
  );

  const showEmployeeColumn =
    canManageExport &&
    (exportScope === "all" || selectedEmployeeUnitIds.length !== 1);

  const filteredEmployees = useMemo(() => {
    const q = employeeQuery.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        e.unitId.toLowerCase().includes(q)
    );
  }, [employees, employeeQuery]);

  function selectFiltered() {
    const ids = new Set(selectedEmployeeUnitIds);
    for (const e of filteredEmployees) ids.add(e.unitId);
    onSelectedEmployeesChange?.(
      [...ids].slice(0, ATTENDANCE_SCOPE_MAX_IDS)
    );
  }

  async function exportExcel() {
    if (!historyRange) {
      toast.error("Pick a valid from / to range first.");
      return;
    }
    if (
      canManageExport &&
      exportScope === "selected" &&
      selectedEmployeeUnitIds.length === 0
    ) {
      toast.error("Select at least one employee to export.");
      return;
    }

    const params = new URLSearchParams({
      type: "attendance",
      from: historyRange.from,
      to: historyRange.to,
    });
    applyAttendanceScopeParams(params, {
      canManage: canManageExport,
      scope: canManageExport ? exportScope : "mine",
      unitIds: selectedEmployeeUnitIds,
    });

    const who =
      canManageExport && exportScope === "selected"
        ? `${selectedEmployeeUnitIds.length}-staff`
        : canManageExport
          ? "all"
          : "mine";

    setExporting(true);
    try {
      const result = await apiDownload(
        `/api/exports?${params.toString()}`,
        `attendance-${who}-${historyRange.from}-to-${historyRange.to}.xlsx`
      );
      if (!result.ok) {
        toast.error(result.error ?? "Download failed");
        return;
      }
      toast.success("Download started");
    } finally {
      setExporting(false);
    }
  }

  const needsSelection =
    canManageExport &&
    exportScope === "selected" &&
    selectedEmployeeUnitIds.length === 0;

  const exportDisabled = exporting || !historyRange || needsSelection;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>
            {canManageExport ? "Attendance history" : "My attendance history"}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {historyTotal
                ? historyTotal > history.length
                  ? `Showing ${history.length} of ${historyTotal} day(s)`
                  : `${historyTotal} day(s)`
                : ""}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={exportDisabled}
              onClick={() => void exportExcel()}
            >
              <Download className="size-3.5" />
              {exporting ? "Preparing…" : "Export Excel"}
            </Button>
          </div>
        </div>

        {canManageExport ? (
          <div className="grid gap-3 sm:max-w-xl">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: "all" as const, label: "All staff" },
                  { id: "selected" as const, label: "Selected staff" },
                ] as const
              ).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onExportScopeChange?.(s.id)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    exportScope === s.id
                      ? "bg-brand text-brand-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-navy"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {exportScope === "selected" ? (
              <div className="grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>
                    Employees
                    {selectedEmployeeUnitIds.length
                      ? ` (${selectedEmployeeUnitIds.length} selected)`
                      : ""}
                  </Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-xs font-medium text-navy hover:underline disabled:opacity-50"
                      disabled={filteredEmployees.length === 0}
                      onClick={selectFiltered}
                    >
                      Select shown
                    </button>
                    <button
                      type="button"
                      className="text-xs font-medium text-muted-foreground hover:underline disabled:opacity-50"
                      disabled={selectedEmployeeUnitIds.length === 0}
                      onClick={() => onSelectedEmployeesChange?.([])}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <Input
                  value={employeeQuery}
                  onChange={(e) => setEmployeeQuery(e.target.value)}
                  placeholder="Search name or id…"
                  className="h-9"
                />
                <div className="max-h-48 overflow-y-auto rounded-md border border-border/80">
                  {employees.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-muted-foreground">
                      Staff list not loaded yet. Open Today or refresh the page.
                    </p>
                  ) : filteredEmployees.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-muted-foreground">
                      No employees match.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border/70">
                      {filteredEmployees.map((e) => {
                        const checked = selectedSet.has(e.unitId);
                        return (
                          <li key={e.unitId}>
                            <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) =>
                                  onSelectedEmployeesChange?.(
                                    toggleId(
                                      selectedEmployeeUnitIds,
                                      e.unitId,
                                      v === true
                                    )
                                  )
                                }
                              />
                              <span className="min-w-0 flex-1 truncate text-navy">
                                {e.label}
                              </span>
                              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                {e.unitId}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Export matches this filter for the date range below.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: "month" as const, label: "This month" },
              { id: "30d" as const, label: "Last 30 days" },
              { id: "custom" as const, label: "Custom" },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPeriodChange(p.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                historyPeriod === p.id
                  ? "bg-brand text-brand-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-navy"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {historyPeriod === "custom" ? (
          <div className="grid gap-3 sm:grid-cols-2 sm:max-w-md">
            <div className="grid gap-1.5">
              <Label>From</Label>
              <DatePicker value={customFrom} onChange={onCustomFromChange} />
            </div>
            <div className="grid gap-1.5">
              <Label>To</Label>
              <DatePicker value={customTo} onChange={onCustomToChange} />
            </div>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        {historyPeriod === "custom" && !historyRange ? (
          <p className="px-5 pb-5 text-sm text-muted-foreground">
            Pick a valid from / to range.
          </p>
        ) : needsSelection ? (
          <p className="px-5 pb-5 text-sm text-muted-foreground">
            Select one or more employees to view and export their attendance.
          </p>
        ) : historyLoading ? (
          <div className="space-y-2 px-5 pb-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-lg bg-muted"
              />
            ))}
          </div>
        ) : history.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            No attendance in this range yet.
          </p>
        ) : (
          <>
            <div className="divide-y divide-border/70 md:hidden">
              {history.map((row) => (
                <div key={row.unitId} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-navy">
                        {formatDayLabel(row.date)}
                        {showEmployeeColumn && (row.userName || row.userUnitId)
                          ? ` · ${row.userName || row.userUnitId}`
                          : ""}
                      </p>
                      <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                        {formatTime(row.checkInAt)}
                        <span className="mx-1.5 text-border">→</span>
                        {formatTime(row.checkOutAt)}
                      </p>
                      <div className="mt-1 space-y-0.5">
                        <LocationLink
                          lat={row.checkInLat}
                          lng={row.checkInLng}
                          label="In"
                        />
                        {row.checkOutAt ? (
                          <LocationLink
                            lat={row.checkOutLat}
                            lng={row.checkOutLng}
                            label="Out"
                          />
                        ) : null}
                      </div>
                      {row.notes ? (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {row.notes}
                        </p>
                      ) : null}
                    </div>
                    <Badge
                      variant={
                        row.checkOutAt
                          ? "outline"
                          : row.checkInAt
                            ? "success"
                            : "warning"
                      }
                      className="shrink-0 normal-case"
                    >
                      {row.checkOutAt
                        ? "Checked out"
                        : row.checkInAt
                          ? "Present"
                          : "—"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            <Table containerClassName="hidden rounded-none border-0 border-t shadow-none md:block">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="min-w-44">Date</TableHead>
                  {showEmployeeColumn ? (
                    <TableHead className="min-w-36">Employee</TableHead>
                  ) : null}
                  <TableHead className="w-28 text-right">Check in</TableHead>
                  <TableHead className="w-28 text-right">Check out</TableHead>
                  <TableHead className="hidden min-w-36 lg:table-cell">
                    Location
                  </TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((row) => (
                  <TableRow key={row.unitId}>
                    <TableCell>
                      <p className="font-medium text-navy">
                        {formatDayLabel(row.date)}
                      </p>
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {row.date}
                      </p>
                    </TableCell>
                    {showEmployeeColumn ? (
                      <TableCell className="text-sm text-navy">
                        {row.userName || row.userUnitId}
                      </TableCell>
                    ) : null}
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatTime(row.checkInAt)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatTime(row.checkOutAt)}
                    </TableCell>
                    <TableCell className="hidden space-y-0.5 lg:table-cell">
                      <LocationLink
                        lat={row.checkInLat}
                        lng={row.checkInLng}
                        label="In"
                      />
                      {row.checkOutAt ? (
                        <LocationLink
                          lat={row.checkOutLat}
                          lng={row.checkOutLng}
                          label="Out"
                        />
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-sm truncate text-muted-foreground">
                      {row.notes || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
