"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { Skeleton } from "@/shared/components/feedback/skeleton";
import type { LeaveSummary } from "@/features/hrms/server/serialize";
import { cn } from "@/lib/utils/cn";
import { LeaveTable } from "@/features/hrms/components/hrms-page-helpers";

export type LeaveSectionProps = {
  loading: boolean;
  canApproveLeave: boolean;
  canOwnLeave: boolean;
  currentUserUnitId: string;
  leaveInboxTab: "pending" | "decided";
  pendingLeave: LeaveSummary[];
  pendingLeaveTotal: number;
  decidedLeave: LeaveSummary[];
  decidedLeaveTotal: number;
  myLeave: LeaveSummary[];
  deciding: boolean;
  cancelBusyId: string | null;
  onLeaveInboxTabChange: (tab: "pending" | "decided") => void;
  onApplyLeave: () => void;
  onApprove: (unitId: string) => void;
  onReject: (leave: LeaveSummary) => void;
  onCancel: (leave: LeaveSummary) => void;
};

export function LeaveSection({
  loading,
  canApproveLeave,
  canOwnLeave,
  currentUserUnitId,
  leaveInboxTab,
  pendingLeave,
  pendingLeaveTotal,
  decidedLeave,
  decidedLeaveTotal,
  myLeave,
  deciding,
  cancelBusyId,
  onLeaveInboxTabChange,
  onApplyLeave,
  onApprove,
  onReject,
  onCancel,
}: LeaveSectionProps) {
  return (
    <div className="space-y-4">
      {canApproveLeave ? (
        <Card>
          <CardHeader className="flex flex-col gap-3 space-y-0">
            <CardTitle>Leave inbox</CardTitle>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  {
                    id: "pending" as const,
                    label: `Pending (${pendingLeaveTotal})`,
                  },
                  {
                    id: "decided" as const,
                    label:
                      decidedLeaveTotal > 0
                        ? `Decided (${decidedLeaveTotal})`
                        : "Decided",
                  },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onLeaveInboxTabChange(t.id)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    leaveInboxTab === t.id
                      ? "bg-brand text-brand-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-navy"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {leaveInboxTab === "pending" ? (
              pendingLeave.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No pending requests — you’re all caught up.
                </p>
              ) : (
                <LeaveTable
                  rows={pendingLeave}
                  mode="approve"
                  currentUserUnitId={currentUserUnitId}
                  deciding={deciding}
                  onApprove={onApprove}
                  onReject={onReject}
                />
              )
            ) : decidedLeave.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                Approved and rejected leave will show here.
              </p>
            ) : (
              <LeaveTable rows={decidedLeave} mode="readonly" />
            )}
          </CardContent>
        </Card>
      ) : null}

      {canOwnLeave ? (
        <Card>
          <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>My leave</CardTitle>
            <Button type="button" size="sm" onClick={onApplyLeave}>
              Apply leave
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 px-5 pb-5" aria-busy="true">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-lg" />
                ))}
              </div>
            ) : myLeave.length === 0 ? (
              <EmptyState
                compact
                title="No leave requests yet"
                description="Apply when you need time off."
              />
            ) : (
              <LeaveTable
                rows={myLeave}
                mode="mine"
                cancelBusyId={cancelBusyId}
                onCancel={onCancel}
              />
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
