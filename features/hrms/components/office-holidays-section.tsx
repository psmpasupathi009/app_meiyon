"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { Skeleton } from "@/shared/components/feedback/skeleton";
import type { OfficeHolidaySummary } from "@/features/hrms/lib/office-holiday";
import {
  formatDayLabel,
  leaveDays,
} from "@/features/hrms/components/hrms-page-helpers";
import { istDateKey } from "@/lib/utils/ist";

export type OfficeHolidaysSectionProps = {
  loading: boolean;
  canManage: boolean;
  holidays: OfficeHolidaySummary[];
  deletingId: string | null;
  onAdd: () => void;
  onEdit: (holiday: OfficeHolidaySummary) => void;
  onDelete: (holiday: OfficeHolidaySummary) => void;
};

export function OfficeHolidaysSection({
  loading,
  canManage,
  holidays,
  deletingId,
  onAdd,
  onEdit,
  onDelete,
}: OfficeHolidaysSectionProps) {
  const today = istDateKey();
  const upcoming = holidays.filter((h) => h.toDate >= today);
  const past = holidays.filter((h) => h.toDate < today);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Office holidays</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Closed days for the whole office — check-in and appointment booking
              are blocked; court diary still lists hearings.
            </p>
          </div>
          {canManage ? (
            <Button type="button" size="sm" onClick={onAdd}>
              Add holiday
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-6 pt-0">
          {loading ? (
            <div className="space-y-2" aria-busy="true">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : holidays.length === 0 ? (
            <EmptyState
              compact
              title="No office holidays"
              description={
                canManage
                  ? "Add a festival or unexpected closure so staff are notified and the day is closed."
                  : "No office holidays have been declared yet."
              }
            />
          ) : (
            <>
              <HolidayList
                title="Upcoming"
                rows={upcoming}
                canManage={canManage}
                deletingId={deletingId}
                onEdit={onEdit}
                onDelete={onDelete}
              />
              {past.length > 0 ? (
                <HolidayList
                  title="Past"
                  rows={past}
                  canManage={canManage}
                  deletingId={deletingId}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HolidayList({
  title,
  rows,
  canManage,
  deletingId,
  onEdit,
  onDelete,
}: {
  title: string;
  rows: OfficeHolidaySummary[];
  canManage: boolean;
  deletingId: string | null;
  onEdit: (holiday: OfficeHolidaySummary) => void;
  onDelete: (holiday: OfficeHolidaySummary) => void;
}) {
  if (rows.length === 0) {
    return (
      <div>
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">None</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <ul className="mt-2 divide-y divide-border/70 rounded-lg border border-border/80">
        {rows.map((h) => {
          const range =
            h.fromDate === h.toDate
              ? formatDayLabel(h.fromDate)
              : `${formatDayLabel(h.fromDate)} → ${formatDayLabel(h.toDate)}`;
          return (
            <li
              key={h.unitId}
              className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-navy">{h.title}</p>
                  <Badge variant="muted">{leaveDays(h.fromDate, h.toDate)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{range}</p>
                {h.notes ? (
                  <p className="text-xs text-muted-foreground">{h.notes}</p>
                ) : null}
              </div>
              {canManage ? (
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onEdit(h)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={deletingId === h.unitId}
                    onClick={() => onDelete(h)}
                  >
                    {deletingId === h.unitId ? "Removing…" : "Remove"}
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
