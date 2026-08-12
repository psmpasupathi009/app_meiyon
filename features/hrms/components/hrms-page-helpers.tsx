"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PersonChip } from "@/shared/components/user/person-chip";
import type {
  AttendanceSummary,
  LeaveSummary,
} from "@/features/hrms/server/serialize";
import type {
  PresencePerson,
  PresenceStatus,
} from "@/features/hrms/server/presence";
import { summarizeBusyToday } from "@/features/availability/lib/busy-labels";
import {
  formatCoords,
  openStreetMapUrl,
} from "@/features/hrms/lib/get-attendance-location";
import { formatIstTime, istDateKey } from "@/lib/utils/ist";
import { cn } from "@/lib/utils/cn";
import { personDisplayName } from "@/shared/lib/person";

export type AttendanceList = {
  data: AttendanceSummary[];
  meta: { total: number };
};
export type LeaveList = { data: LeaveSummary[]; meta: { total: number } };
export type DeskSection = "today" | "history" | "leave" | "holidays";

export const LEAVE_VARIANT: Record<
  string,
  "warning" | "success" | "destructive" | "outline" | "muted"
> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  cancelled: "outline",
};

export const PRESENCE_VARIANT: Record<
  PresenceStatus,
  "warning" | "success" | "muted" | "outline"
> = {
  absent: "warning",
  on_leave: "muted",
  in: "success",
  out: "outline",
};

export const PRESENCE_LABEL: Record<PresenceStatus, string> = {
  absent: "Absent",
  on_leave: "On leave",
  in: "Present",
  out: "Checked out",
};

/** Status label; when office is closed, on_leave rows read as office closed. */
export function presenceStatusLabel(
  status: PresenceStatus,
  officeClosed?: boolean
) {
  if (officeClosed && status === "on_leave") return "Office closed";
  return PRESENCE_LABEL[status];
}

export const STATUS_ROW: Record<PresenceStatus, string> = {
  absent: "border-l-[3px] border-l-amber-400/90",
  on_leave: "border-l-[3px] border-l-muted-foreground/40",
  in: "border-l-[3px] border-l-emerald-500/80",
  out: "border-l-[3px] border-l-border",
};

export function personLabel(
  unitId: string,
  name: string | null | undefined,
  mobile?: string | null
) {
  return personDisplayName({ name, mobile, unitId });
}

export function formatTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return formatIstTime(new Date(iso));
}

export function LocationLink({
  lat,
  lng,
  label,
  className,
}: {
  lat: number | null | undefined;
  lng: number | null | undefined;
  label?: string;
  className?: string;
}) {
  if (lat == null || lng == null) return null;
  return (
    <a
      href={openStreetMapUrl(lat, lng)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "text-[11px] font-medium text-brand underline-offset-2 hover:underline",
        className
      )}
    >
      {label ? `${label} · ` : "Map · "}
      {formatCoords(lat, lng)}
    </a>
  );
}

export function formatDayLabel(dateKey: string) {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(`${dateKey}T12:00:00+05:30`));
  } catch {
    return dateKey;
  }
}

export function formatDayShort(dateKey: string) {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
    }).format(new Date(`${dateKey}T12:00:00+05:30`));
  } catch {
    return dateKey;
  }
}

export function leaveDays(fromDate: string, toDate: string) {
  const start = new Date(`${fromDate}T12:00:00+05:30`).getTime();
  const end = new Date(`${toDate}T12:00:00+05:30`).getTime();
  const days = Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1;
  return days <= 1 ? "1 day" : `${days} days`;
}

export function SelfStatusBadge({
  onLeave,
  record,
}: {
  onLeave: boolean;
  record: AttendanceSummary | null;
}) {
  if (onLeave) {
    return <Badge variant="muted" className="normal-case">On leave</Badge>;
  }
  if (record?.checkOutAt) {
    return <Badge variant="outline" className="normal-case">Checked out</Badge>;
  }
  if (record?.checkInAt) {
    return <Badge variant="success" className="normal-case">Present</Badge>;
  }
  return <Badge variant="warning" className="normal-case">Not in</Badge>;
}

export function busyChip(row: PresencePerson): string | null {
  if (row.status === "on_leave") return null;
  return summarizeBusyToday(row.busyToday ?? []);
}

export function PresenceCard({
  row,
  officeClosed,
}: {
  row: PresencePerson;
  officeClosed?: boolean;
}) {
  const busy = busyChip(row);
  return (
    <div className={cn("flex items-start gap-3 px-4 py-3", STATUS_ROW[row.status])}>
      <div className="min-w-0 flex-1">
        <PersonChip
          name={row.displayName}
          photoUrl={row.photoUrl}
          mobile={row.mobile}
          unitId={row.unitId}
          subtitle={row.designation || (row.mobile ? `+91 ${row.mobile}` : undefined)}
        />
        {row.status === "in" || row.status === "out" ? (
          <div className="mt-1.5 space-y-0.5 pl-10.5">
            <p className="text-xs tabular-nums text-muted-foreground">
              {formatTime(row.checkInAt)}
              <span className="mx-1.5 text-border">→</span>
              {formatTime(row.checkOutAt)}
            </p>
            <LocationLink
              lat={row.checkInLat}
              lng={row.checkInLng}
              label="In"
            />
            {row.status === "out" ? (
              <LocationLink
                lat={row.checkOutLat}
                lng={row.checkOutLng}
                label="Out"
              />
            ) : null}
          </div>
        ) : null}
        {busy ? (
          <p className="mt-1 pl-10.5 text-[11px] font-medium text-navy/80">
            {busy}
          </p>
        ) : null}
        {row.notes ? (
          <p className="mt-1 pl-10.5 text-[11px] text-muted-foreground">
            Note: {row.notes}
          </p>
        ) : null}
      </div>
      <Badge
        variant={PRESENCE_VARIANT[row.status]}
        className="shrink-0 normal-case"
      >
        {presenceStatusLabel(row.status, officeClosed)}
      </Badge>
    </div>
  );
}

export function LeaveTable({
  rows,
  mode,
  currentUserUnitId,
  deciding,
  cancelBusyId,
  todayKey = istDateKey(),
  onApprove,
  onReject,
  onCancel,
}: {
  rows: LeaveSummary[];
  mode: "mine" | "approve" | "readonly";
  currentUserUnitId?: string;
  deciding?: boolean;
  cancelBusyId?: string | null;
  /** IST YYYY-MM-DD — approved leave cancellable while toDate >= today */
  todayKey?: string;
  onApprove?: (unitId: string) => void;
  onReject?: (row: LeaveSummary) => void;
  onCancel?: (row: LeaveSummary) => void;
}) {
  function canCancel(l: LeaveSummary) {
    if (l.status === "pending") return true;
    if (l.status === "approved" && l.toDate >= todayKey) return true;
    return false;
  }

  return (
    <>
      <div className="divide-y divide-border/70 md:hidden">
        {rows.map((l) => (
          <div key={l.unitId} className="space-y-2.5 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {mode !== "mine" ? (
                  <p className="truncate text-sm font-medium text-navy">
                    {personLabel(l.userUnitId, l.userName)}
                  </p>
                ) : null}
                <p
                  className={cn(
                    "text-sm font-medium text-navy",
                    mode !== "mine" && "mt-0.5 text-xs font-normal text-muted-foreground"
                  )}
                >
                  {formatDayShort(l.fromDate)}
                  {l.fromDate !== l.toDate ? ` → ${formatDayShort(l.toDate)}` : ""}
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    · {leaveDays(l.fromDate, l.toDate)}
                  </span>
                </p>
                {l.reason ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {l.reason}
                  </p>
                ) : null}
                {l.status === "rejected" && l.rejectReason ? (
                  <p className="mt-1 text-xs text-destructive">{l.rejectReason}</p>
                ) : null}
              </div>
              <Badge
                variant={LEAVE_VARIANT[l.status] ?? "outline"}
                className="shrink-0 normal-case"
              >
                {l.status}
              </Badge>
            </div>
            {mode === "approve" ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="flex-1"
                  disabled={deciding || l.userUnitId === currentUserUnitId}
                  onClick={() => onApprove?.(l.unitId)}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  disabled={deciding || l.userUnitId === currentUserUnitId}
                  onClick={() => onReject?.(l)}
                >
                  Reject
                </Button>
              </div>
            ) : null}
            {mode === "mine" && canCancel(l) ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={cancelBusyId === l.unitId}
                onClick={() => onCancel?.(l)}
              >
                {cancelBusyId === l.unitId
                  ? "Cancelling…"
                  : l.status === "approved"
                    ? "Cancel leave"
                    : "Cancel request"}
              </Button>
            ) : null}
          </div>
        ))}
      </div>

      <Table containerClassName="hidden rounded-none border-0 border-t shadow-none md:block">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {mode !== "mine" ? (
              <TableHead className="min-w-44">Employee</TableHead>
            ) : null}
            <TableHead className="min-w-48">Dates</TableHead>
            <TableHead className="hidden lg:table-cell">Reason</TableHead>
            <TableHead className="w-28">Status</TableHead>
            {mode !== "readonly" ? (
              <TableHead className="w-44 text-right">Actions</TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((l) => (
            <TableRow key={l.unitId}>
              {mode !== "mine" ? (
                <TableCell>
                  <PersonChip
                    name={personLabel(l.userUnitId, l.userName)}
                    unitId={l.userUnitId}
                    subtitle={l.userUnitId}
                  />
                </TableCell>
              ) : null}
              <TableCell>
                <p className="font-medium text-navy">
                  {formatDayShort(l.fromDate)}
                  {l.fromDate !== l.toDate ? (
                    <>
                      <span className="mx-1 text-muted-foreground">→</span>
                      {formatDayShort(l.toDate)}
                    </>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {leaveDays(l.fromDate, l.toDate)}
                </p>
              </TableCell>
              <TableCell className="hidden max-w-xs lg:table-cell">
                <p className="truncate text-muted-foreground">
                  {l.reason ?? "—"}
                </p>
                {l.status === "rejected" && l.rejectReason ? (
                  <p className="mt-0.5 truncate text-xs text-destructive">
                    {l.rejectReason}
                  </p>
                ) : null}
              </TableCell>
              <TableCell>
                <Badge
                  variant={LEAVE_VARIANT[l.status] ?? "outline"}
                  className="normal-case"
                >
                  {l.status}
                </Badge>
              </TableCell>
              {mode === "approve" ? (
                <TableCell className="text-right">
                  <div className="inline-flex gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      disabled={deciding || l.userUnitId === currentUserUnitId}
                      onClick={() => onApprove?.(l.unitId)}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={deciding || l.userUnitId === currentUserUnitId}
                      onClick={() => onReject?.(l)}
                    >
                      Reject
                    </Button>
                  </div>
                </TableCell>
              ) : null}
              {mode === "mine" ? (
                <TableCell className="text-right">
                  {canCancel(l) ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={cancelBusyId === l.unitId}
                      onClick={() => onCancel?.(l)}
                    >
                      {cancelBusyId === l.unitId
                        ? "Cancelling…"
                        : l.status === "approved"
                          ? "Cancel leave"
                          : "Cancel"}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
