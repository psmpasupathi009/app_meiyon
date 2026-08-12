import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DashboardSummary } from "@/features/home/components/welcome-helpers";

export type WelcomePersonalAttendanceProps = {
  hrms: NonNullable<DashboardSummary["hrms"]>;
};

export function WelcomePersonalAttendance({
  hrms,
}: WelcomePersonalAttendanceProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-card px-4 py-3.5 shadow-sm shadow-black/2 sm:px-5">
      <div className="flex items-center gap-3">
        <ClipboardCheck className="size-5 text-navy" />
        <div>
          <p className="text-sm font-semibold text-navy">Your attendance</p>
          <p className="text-xs text-muted-foreground">
            {hrms.officeHolidayToday
              ? `Office closed — ${hrms.officeHolidayToday.title}`
              : hrms.onApprovedLeaveToday
                ? "On approved leave today"
                : hrms.checkedOutToday
                  ? "Checked out"
                  : hrms.checkedInToday
                    ? "Checked in"
                    : "Not checked in"}
          </p>
        </div>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link
          href={
            hrms.officeHolidayToday ? "/hrms?section=holidays" : "/hrms"
          }
        >
          Open HRMS
        </Link>
      </Button>
    </div>
  );
}
