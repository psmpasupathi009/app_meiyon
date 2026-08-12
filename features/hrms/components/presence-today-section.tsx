"use client";

import { PersonChip } from "@/shared/components/user/person-chip";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { Skeleton } from "@/shared/components/feedback/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AttendanceSummary } from "@/features/hrms/server/serialize";
import type { PresenceBoard } from "@/features/hrms/server/presence";
import { cn } from "@/lib/utils/cn";
import {
  PresenceCard,
  PRESENCE_VARIANT,
  STATUS_ROW,
  LocationLink,
  busyChip,
  formatTime,
  presenceStatusLabel,
} from "@/features/hrms/components/hrms-page-helpers";

export type PresenceTodaySectionProps = {
  loading: boolean;
  onLeaveToday: boolean;
  pendingLeaveToday: boolean;
  todayRecord: AttendanceSummary | null;
  canManageAttendance: boolean;
  presence: PresenceBoard | null;
  /** When presence board isn’t loaded (non-managers), still show closed banner. */
  officeHoliday?: { unitId: string; title: string; notes: string | null } | null;
};

export function PresenceTodaySection({
  loading,
  onLeaveToday,
  pendingLeaveToday,
  todayRecord,
  canManageAttendance,
  presence,
  officeHoliday: officeHolidayProp,
}: PresenceTodaySectionProps) {
  const officeHoliday = officeHolidayProp ?? presence?.officeHoliday ?? null;

  return (
    <div className="space-y-4">
      {officeHoliday ? (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">
            Office closed — {officeHoliday.title}
          </p>
          <p className="mt-0.5 text-xs opacity-90">
            Check-in and appointment booking are blocked today
            {officeHoliday.notes ? ` · ${officeHoliday.notes}` : ""}.
          </p>
        </div>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Your day</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-sm text-muted-foreground">
          {loading ? (
            <div className="h-12 animate-pulse rounded-lg bg-muted" />
          ) : officeHoliday ? (
            <p>
              Office is closed today for{" "}
              <span className="font-medium text-navy">{officeHoliday.title}</span>{" "}
              — no check-in needed.
            </p>
          ) : onLeaveToday ? (
            <p>
              You are on <span className="font-medium text-navy">approved leave</span> today —
              no check-in needed. Use Apply leave only for other dates.
            </p>
          ) : todayRecord?.checkInAt ? (
            <div className="space-y-1">
              <p>
                Checked in at{" "}
                <span className="font-medium text-navy">
                  {formatTime(todayRecord.checkInAt)}
                </span>
                {todayRecord.checkOutAt
                  ? ` · checked out at ${formatTime(todayRecord.checkOutAt)}`
                  : " · still present — use Check out when you leave"}
              </p>
              <LocationLink
                lat={todayRecord.checkInLat}
                lng={todayRecord.checkInLng}
                label="In"
              />
              {todayRecord.checkOutAt ? (
                <LocationLink
                  lat={todayRecord.checkOutLat}
                  lng={todayRecord.checkOutLng}
                  label="Out"
                />
              ) : null}
              {todayRecord.notes ? (
                <p className="text-xs">Note: {todayRecord.notes}</p>
              ) : null}
            </div>
          ) : (
            <p>
              Not checked in yet. Use Check in when you arrive at the office.
              {pendingLeaveToday
                ? " You have a leave request pending for today."
                : ""}
            </p>
          )}
        </CardContent>
      </Card>

      {canManageAttendance ? (
        <Card>
          <CardHeader className="flex flex-col gap-2 space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Who’s in today</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {officeHoliday
                  ? `Office closed — ${officeHoliday.title}. Everyone shows as office closed; check-in is blocked.`
                  : "Color bar: amber absent · green present · grey on leave. Busy chips (court / travel / client meet) mean booking is blocked — status can still be In. Check-in notes are board-only."}
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 px-5 pb-5" aria-busy="true">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-lg" />
                ))}
              </div>
            ) : !presence || presence.people.length === 0 ? (
              <EmptyState
                compact
                title="No active staff yet"
                description="Add people in Employees."
              />
            ) : (
              <>
                <div className="divide-y divide-border/70 md:hidden">
                  {presence.people.map((row) => (
                    <PresenceCard
                      key={row.unitId}
                      row={row}
                      officeClosed={Boolean(officeHoliday)}
                    />
                  ))}
                </div>
                <Table containerClassName="hidden rounded-none border-0 border-t shadow-none md:block">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="min-w-48">Person</TableHead>
                      <TableHead className="hidden min-w-32 xl:table-cell">
                        Designation
                      </TableHead>
                      <TableHead className="w-34">Status</TableHead>
                      <TableHead className="w-28 text-right">
                        Check in
                      </TableHead>
                      <TableHead className="w-28 text-right">
                        Check out
                      </TableHead>
                      <TableHead className="hidden min-w-40 lg:table-cell">
                        Location
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {presence.people.map((row) => (
                      <TableRow
                        key={row.unitId}
                        className={cn(STATUS_ROW[row.status])}
                      >
                        <TableCell>
                          <div className="space-y-1">
                            <PersonChip
                              name={row.displayName}
                              photoUrl={row.photoUrl}
                              mobile={row.mobile}
                              unitId={row.unitId}
                              subtitle={row.mobile ? `+91 ${row.mobile}` : row.unitId}
                            />
                            {row.notes ? (
                              <p className="pl-10.5 text-[11px] text-muted-foreground">
                                Note: {row.notes}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          {row.designation ? (
                            <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-foreground">
                              {row.designation}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1.5">
                            <Badge
                              variant={PRESENCE_VARIANT[row.status]}
                              className="normal-case"
                            >
                              {presenceStatusLabel(
                                row.status,
                                Boolean(officeHoliday)
                              )}
                            </Badge>
                            {busyChip(row) ? (
                              <p className="text-[11px] font-medium text-navy/80">
                                {busyChip(row)}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
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
                          {row.checkOutLat != null ? (
                            <LocationLink
                              lat={row.checkOutLat}
                              lng={row.checkOutLng}
                              label="Out"
                            />
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
