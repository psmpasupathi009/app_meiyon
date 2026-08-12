"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { PaginationBar } from "@/shared/components/data/pagination-bar";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { UnitIdBadge } from "@/shared/components/data/unit-id-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { istDisplayDate } from "@/lib/utils/ist";
import {
  STATUS_VARIANT,
  rupee,
  truncate,
  type PaymentRow,
} from "@/features/accounts/components/accounts-page-helpers";

export type PaymentsListSectionProps = {
  loading: boolean;
  rows: PaymentRow[];
  page: number;
  pageSize: number;
  total: number;
  hasActiveFilters: boolean;
  canCreate: boolean;
  canEdit: boolean;
  onPageChange: (page: number) => void;
  onClearFilters: () => void;
  onCreate: () => void;
  onOpenDetail: (unitId: string) => void;
  onEdit: (row: PaymentRow) => void;
  onVoid: (unitId: string) => void;
};

export function PaymentsListSection({
  loading,
  rows,
  page,
  pageSize,
  total,
  hasActiveFilters,
  canCreate,
  canEdit,
  onPageChange,
  onClearFilters,
  onCreate,
  onOpenDetail,
  onEdit,
  onVoid,
}: PaymentsListSectionProps) {
  if (loading && rows.length === 0) {
    return (
      <div className="space-y-2">
        <div className="h-12 animate-pulse rounded-lg bg-muted" />
        <div className="h-12 animate-pulse rounded-lg bg-muted" />
        <div className="h-12 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (!loading && rows.length === 0) {
    return (
      <EmptyState
        title={hasActiveFilters ? "No matching entries" : "No cash entries yet"}
        description={
          hasActiveFilters
            ? "Try another period, status, or clear filters."
            : "Record an advance, stage payment, or actuals against a client."
        }
        action={
          hasActiveFilters ? (
            <Button type="button" variant="outline" onClick={onClearFilters}>
              Clear filters
            </Button>
          ) : canCreate ? (
            <Button type="button" onClick={onCreate}>
              Record first entry
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
      <div className="space-y-2 md:hidden">
        {rows.map((p) => (
          <div
            key={p.unitId}
            role="button"
            tabIndex={0}
            onClick={() => onOpenDetail(p.unitId)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenDetail(p.unitId);
              }
            }}
            className="flex w-full flex-col gap-2 rounded-xl border border-border/80 bg-card p-3.5 text-left transition-colors active:bg-muted/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <p className="truncate font-medium text-navy">
                  {p.clientName ?? p.clientUnitId}
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.unitId}
                  {p.caseUnitId ? ` · ${p.caseUnitId}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold text-navy">{rupee(p.amount)}</p>
                <Badge
                  variant={STATUS_VARIANT[p.status] ?? "outline"}
                  className="mt-1"
                >
                  {p.status}
                </Badge>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{p.typeLabel}</span>
              {p.paidOn ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{istDisplayDate(new Date(p.paidOn))}</span>
                </>
              ) : null}
            </div>
            {p.status === "void" && p.voidReason ? (
              <p className="line-clamp-2 text-xs text-muted-foreground">
                Void: {p.voidReason}
              </p>
            ) : p.notes ? (
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {p.notes}
              </p>
            ) : null}
            <div
              className="flex justify-end gap-1 pt-0.5"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => onOpenDetail(p.unitId)}
              >
                View
              </Button>
              {canEdit && p.status !== "void" ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-8"
                  onClick={() => onVoid(p.unitId)}
                >
                  Void
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hidden lg:table-cell">ID</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Case</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Paid on</TableHead>
              <TableHead className="hidden xl:table-cell">Notes</TableHead>
              <TableHead className="w-12 text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow
                key={p.unitId}
                className="cursor-pointer"
                onClick={() => onOpenDetail(p.unitId)}
              >
                <TableCell className="hidden lg:table-cell">
                  <UnitIdBadge value={p.unitId} />
                </TableCell>
                <TableCell>
                  <div className="space-y-0.5">
                    <span className="font-medium text-navy">
                      {p.clientName ?? p.clientUnitId}
                    </span>
                    {p.status === "void" && p.voidReason ? (
                      <p className="text-xs text-muted-foreground">
                        Void: {truncate(p.voidReason, 48)}
                      </p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  {p.caseUnitId ? (
                    <Link
                      href={`/cases/${p.caseUnitId}`}
                      className="text-navy underline-offset-2 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {p.caseUnitId}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>{p.typeLabel}</TableCell>
                <TableCell className="text-right font-medium text-navy">
                  {rupee(p.amount)}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[p.status] ?? "outline"}>
                    {p.status}
                  </Badge>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {p.paidOn ? istDisplayDate(new Date(p.paidOn)) : "—"}
                </TableCell>
                <TableCell className="hidden max-w-48 truncate xl:table-cell">
                  {truncate(p.notes)}
                </TableCell>
                <TableCell
                  className="text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="size-8 p-0"
                        aria-label="Row actions"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem
                        onSelect={() => onOpenDetail(p.unitId)}
                      >
                        View detail
                      </DropdownMenuItem>
                      {canEdit && p.status !== "void" ? (
                        <>
                          <DropdownMenuItem onSelect={() => onEdit(p)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => onVoid(p.unitId)}
                          >
                            Void
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PaginationBar
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={onPageChange}
      />
    </>
  );
}
