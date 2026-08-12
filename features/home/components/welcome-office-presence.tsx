import Link from "next/link";
import { ArrowRight, UserCheck, UserX } from "lucide-react";
import type { OfficePresenceData } from "@/features/home/components/welcome-helpers";

export type WelcomeOfficePresenceProps = {
  officePresence: OfficePresenceData;
  officeHoliday?: { title: string; notes: string | null } | null;
};

export function WelcomeOfficePresence({
  officePresence,
  officeHoliday,
}: WelcomeOfficePresenceProps) {
  if (!officePresence.rows.some((a) => a.showAttendance)) return null;

  return (
    <div className="rounded-xl border border-border/80 bg-card px-4 py-3 shadow-sm shadow-black/2 sm:px-5">
      <Link
        href="/hrms"
        className="flex flex-wrap items-center justify-between gap-3 transition-colors hover:opacity-90"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-navy">Who’s in today</p>
            <p className="text-xs text-muted-foreground">
              {officeHoliday
                ? `Office closed — ${officeHoliday.title}`
                : "Full office · open HRMS for the list"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {officeHoliday ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
                Office closed
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
              <UserX className="size-3.5" />
              {officePresence.presenceStats.absent} absent
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
              <UserCheck className="size-3.5" />
              {officePresence.presenceStats.present} present
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {officePresence.presenceStats.out} checked out
            </span>
            {officePresence.presenceStats.onLeave > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {officePresence.presenceStats.onLeave} on leave
              </span>
            ) : null}
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-navy">
          HRMS
          <ArrowRight className="size-3.5" />
        </span>
      </Link>
      {officePresence.busyPeople.length > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
          {officePresence.busyPeople.slice(0, 6).map((person) => (
            <li
              key={person.key}
              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs"
            >
              <span className="font-medium text-foreground">{person.name}</span>
              <span className="font-medium text-navy/80">{person.busyLabel}</span>
            </li>
          ))}
          {officePresence.busyPeople.length > 6 ? (
            <li className="text-[11px] text-muted-foreground">
              +{officePresence.busyPeople.length - 6} more in HRMS
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
