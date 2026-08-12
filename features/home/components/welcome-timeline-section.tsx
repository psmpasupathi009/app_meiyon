import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
} from "lucide-react";
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
import { UnitIdBadge } from "@/shared/components/data/unit-id-badge";
import { cn } from "@/lib/utils/cn";
import type {
  DayKindFilter,
  TimelineRow,
} from "@/features/home/components/welcome-helpers";

export type WelcomeTimelineSectionProps = {
  isAdmin: boolean;
  loading: boolean;
  timelineRows: TimelineRow[];
  dayFilter: DayKindFilter;
  advocateFilter: string;
  canViewAppointments: boolean;
  canViewCases: boolean;
  canCreateAppointment: boolean;
  onDayFilterChange: (filter: DayKindFilter) => void;
  onClearAdvocate: () => void;
};

const DAY_FILTERS: { id: DayKindFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "appointments", label: "Appointments" },
  { id: "hearings", label: "Hearings" },
];

export function WelcomeTimelineSection({
  isAdmin,
  loading,
  timelineRows,
  dayFilter,
  advocateFilter,
  canViewAppointments,
  canViewCases,
  canCreateAppointment,
  onDayFilterChange,
  onClearAdvocate,
}: WelcomeTimelineSectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-navy">
            {isAdmin ? "Today’s schedule" : "My day"}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Appointments and hearings in one timeline
            {advocateFilter !== "all" ? " · filtered by advocate" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {advocateFilter !== "all" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClearAdvocate}
            >
              Clear advocate
            </Button>
          ) : null}
          {canViewAppointments ? (
            <Button asChild variant="ghost" size="sm">
              <Link href="/appointments?hearing=today">
                Appointments
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : null}
          {canViewCases ? (
            <Button asChild variant="ghost" size="sm">
              <Link href="/diary">
                Diary
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {DAY_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onDayFilterChange(f.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              dayFilter === f.id
                ? "bg-brand text-brand-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-navy"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-44 animate-pulse rounded-xl border border-border/80 bg-card" />
      ) : timelineRows.length === 0 ? (
        <div className="rounded-xl border border-border/80 bg-card px-5 py-12 text-center shadow-sm shadow-black/2">
          <CalendarClock className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium text-navy">
            Nothing scheduled today
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin
              ? "Book an appointment or check tomorrow’s cause list."
              : "No appointments or hearings assigned to you today."}
          </p>
          {canCreateAppointment ? (
            <Button asChild size="sm" className="mt-4">
              <Link href="/appointments?new=1">Book appointment</Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Time</TableHead>
              <TableHead className="hidden w-28 sm:table-cell">Type</TableHead>
              <TableHead>Title / client</TableHead>
              <TableHead className="hidden md:table-cell">Advocate</TableHead>
              <TableHead className="hidden lg:table-cell">Detail</TableHead>
              <TableHead className="hidden md:table-cell">Ref</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {timelineRows.map((row) => (
              <TableRow key={row.key}>
                <TableCell className="whitespace-nowrap font-semibold text-navy">
                  {row.timeLabel}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge
                    variant={row.kind === "hearing" ? "warning" : "muted"}
                    className="capitalize"
                  >
                    {row.kind === "hearing" ? (
                      <CalendarDays className="mr-1 size-3" />
                    ) : (
                      <CalendarClock className="mr-1 size-3" />
                    )}
                    {row.kind === "hearing" ? "Hearing" : "Appt"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link
                    href={row.href}
                    className="font-medium text-navy hover:underline"
                  >
                    {row.title}
                  </Link>
                  {row.kind === "appointment" && row.client !== row.title ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {row.client}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-xs capitalize text-muted-foreground sm:hidden">
                    {row.kind === "hearing" ? "Hearing" : "Appt"}
                    {row.advocateLabel ? ` · ${row.advocateLabel}` : ""}
                  </p>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {row.advocate}
                </TableCell>
                <TableCell className="hidden max-w-52 truncate text-muted-foreground lg:table-cell">
                  {row.detail}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <UnitIdBadge value={row.refId} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
