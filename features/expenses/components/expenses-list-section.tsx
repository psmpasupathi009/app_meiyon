"use client";

import { MoreHorizontal, Paperclip } from "lucide-react";
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
  rupee,
  truncate,
  type ExpenseRow,
} from "@/features/expenses/components/expenses-page-helpers";

export type ExpensesListSectionProps = {
  loading: boolean;
  rows: ExpenseRow[];
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
  onEdit: (row: ExpenseRow) => void;
  onVoid: (unitId: string) => void;
};

export function ExpensesListSection({
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
}: ExpensesListSectionProps) {
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
        title={hasActiveFilters ? "No matching expenses" : "No office expenses yet"}
        description={
          hasActiveFilters
            ? "Try another period, category, or clear filters."
            : "Record an office purchase and attach the bill."
        }
        action={
          hasActiveFilters ? (
            <Button type="button" variant="outline" onClick={onClearFilters}>
              Clear filters
            </Button>
          ) : canCreate ? (
            <Button type="button" onClick={onCreate}>
              Add first expense
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
      <div className="space-y-2 md:hidden">
        {rows.map((e) => (
          <div
            key={e.unitId}
            role="button"
            tabIndex={0}
            onClick={() => onOpenDetail(e.unitId)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                onOpenDetail(e.unitId);
              }
            }}
            className="flex w-full flex-col gap-2 rounded-xl border border-border/80 bg-card p-3.5 text-left transition-colors active:bg-muted/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <p className="truncate font-medium text-navy">
                  {e.vendor || e.categoryLabel}
                </p>
                <p className="text-xs text-muted-foreground">
                  {e.unitId} · {e.categoryLabel}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold text-navy">{rupee(e.amount)}</p>
                {e.voidedAt ? (
                  <Badge variant="muted" className="mt-1">
                    void
                  </Badge>
                ) : e.billDocumentUnitId ? (
                  <Badge variant="success" className="mt-1 gap-1">
                    <Paperclip className="size-3" />
                    Bill
                  </Badge>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{istDisplayDate(new Date(e.expenseDate))}</span>
              <span aria-hidden>·</span>
              <span>{e.paymentModeLabel}</span>
            </div>
            {e.voidedAt && e.voidReason ? (
              <p className="line-clamp-2 text-xs text-muted-foreground">
                Void: {e.voidReason}
              </p>
            ) : (
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {e.description}
              </p>
            )}
            <div
              className="flex justify-end gap-1 pt-0.5"
              onClick={(ev) => ev.stopPropagation()}
              onKeyDown={(ev) => ev.stopPropagation()}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => onOpenDetail(e.unitId)}
              >
                View
              </Button>
              {canEdit && !e.voidedAt ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-8"
                  onClick={() => onVoid(e.unitId)}
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
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="hidden lg:table-cell">Mode</TableHead>
              <TableHead>Bill</TableHead>
              <TableHead className="hidden xl:table-cell">Description</TableHead>
              <TableHead className="w-12 text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((e) => (
              <TableRow
                key={e.unitId}
                className="cursor-pointer"
                onClick={() => onOpenDetail(e.unitId)}
              >
                <TableCell className="hidden lg:table-cell">
                  <UnitIdBadge value={e.unitId} />
                </TableCell>
                <TableCell>
                  <div className="space-y-0.5">
                    <span>{istDisplayDate(new Date(e.expenseDate))}</span>
                    {e.voidedAt ? (
                      <Badge variant="muted" className="ml-2">
                        void
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>{e.categoryLabel}</TableCell>
                <TableCell className="font-medium text-navy">
                  {e.vendor || "—"}
                </TableCell>
                <TableCell className="text-right font-medium text-navy">
                  {rupee(e.amount)}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {e.paymentModeLabel}
                </TableCell>
                <TableCell>
                  {e.billDocumentUnitId ? (
                    <Badge variant="success" className="gap-1">
                      <Paperclip className="size-3" />
                      Attached
                    </Badge>
                  ) : (
                    <Badge variant="warning">Missing</Badge>
                  )}
                </TableCell>
                <TableCell className="hidden max-w-48 truncate xl:table-cell">
                  {e.voidedAt && e.voidReason
                    ? truncate(`Void: ${e.voidReason}`)
                    : truncate(e.description)}
                </TableCell>
                <TableCell
                  className="text-right"
                  onClick={(ev) => ev.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="size-8 p-0"
                      >
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onOpenDetail(e.unitId)}>
                        View
                      </DropdownMenuItem>
                      {canEdit && !e.voidedAt ? (
                        <>
                          <DropdownMenuItem onSelect={() => onEdit(e)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => onVoid(e.unitId)}
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
