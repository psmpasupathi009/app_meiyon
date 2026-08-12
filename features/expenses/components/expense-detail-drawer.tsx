"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { apiDownload, apiFetch, getErrorMessage } from "@/lib/api/client";
import type { ExpenseSummary } from "@/features/expenses/server/serialize";
import type { DocumentSummary } from "@/features/documents/server/serialize";
import { UnitIdBadge } from "@/shared/components/data/unit-id-badge";
import { istDisplayDate } from "@/lib/utils/ist";
import { rupee } from "@/features/expenses/components/expenses-page-helpers";

type ActivityItem = {
  action: string;
  actorUnitId: string | null;
  meta: unknown;
  createdAt: string;
};

type DetailResponse = {
  expense: ExpenseSummary;
  activity: ActivityItem[];
  bill: DocumentSummary | null;
};

const ACTION_LABEL: Record<string, string> = {
  "expense.create": "Created",
  "expense.update": "Updated",
  "expense.void": "Voided",
};

function actorLabel(
  actor: { unitId: string; name: string | null } | null | undefined
) {
  if (!actor) return "—";
  return actor.name ? `${actor.name} (${actor.unitId})` : actor.unitId;
}

export function ExpenseDetailDrawer({
  open,
  onOpenChange,
  unitId,
  canEdit,
  onEdit,
  onVoid,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unitId: string | null;
  canEdit: boolean;
  onEdit: (expense: ExpenseSummary) => void;
  onVoid: (unitId: string) => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!unitId) return;
    setLoading(true);
    const { ok, data } = await apiFetch<DetailResponse>(
      `/api/expenses/${unitId}`
    );
    setLoading(false);
    if (!ok) {
      toast.error(
        getErrorMessage(data as Record<string, unknown>, "Failed to load entry")
      );
      return;
    }
    setDetail(data as unknown as DetailResponse);
  }, [unitId]);

  useEffect(() => {
    if (!open || !unitId) {
      setDetail(null);
      return;
    }
    void load();
  }, [open, unitId, load]);

  // silence unused — reserved if we reload after bill replace from drawer later
  void onChanged;

  const expense = detail?.expense;
  const bill = detail?.bill;

  async function downloadBill() {
    if (!bill) return;
    const result = await apiDownload(
      `/api/documents/${bill.unitId}/download`,
      bill.originalName || "bill"
    );
    if (!result.ok) toast.error(result.error ?? "Download failed");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Office expense</SheetTitle>
          <SheetDescription>
            {expense ? <UnitIdBadge value={expense.unitId} /> : "Loading…"}
          </SheetDescription>
        </SheetHeader>

        {loading && !expense ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : expense ? (
          <div className="flex flex-1 flex-col gap-6 p-4 pt-2">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-2xl font-semibold tabular-nums text-navy">
                    {rupee(expense.amount)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {expense.categoryLabel} · {expense.paymentModeLabel}
                  </p>
                </div>
                {expense.voidedAt ? (
                  <Badge variant="muted">void</Badge>
                ) : null}
              </div>

              <dl className="grid gap-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Date
                  </dt>
                  <dd className="mt-0.5 font-medium">
                    {istDisplayDate(new Date(expense.expenseDate))}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Vendor
                  </dt>
                  <dd className="mt-0.5 font-medium">{expense.vendor || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Description
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-wrap">
                    {expense.description}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Entered by
                  </dt>
                  <dd className="mt-0.5">{actorLabel(expense.createdBy)}</dd>
                </div>
                {expense.voidedAt ? (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      Void reason
                    </dt>
                    <dd className="mt-0.5">
                      {expense.voidReason || "—"}
                      <span className="mt-1 block text-xs text-muted-foreground">
                        by {actorLabel(expense.voidedBy)} on{" "}
                        {istDisplayDate(new Date(expense.voidedAt))}
                      </span>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Bill
              </p>
              {bill ? (
                <div className="flex items-center gap-3 rounded-lg border border-border/80 bg-card p-3">
                  <Paperclip className="size-4 shrink-0 text-navy" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {bill.originalName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {bill.unitId} · {bill.mimeType}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => void downloadBill()}
                  >
                    <Download className="size-3.5" />
                    Download
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No bill attached</p>
              )}
            </div>

            {detail?.activity?.length ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Activity
                </p>
                <ul className="space-y-2 text-sm">
                  {detail.activity.map((a, i) => (
                    <li
                      key={`${a.createdAt}-${i}`}
                      className="flex justify-between gap-2 border-b border-border/60 pb-2 last:border-0"
                    >
                      <span>
                        {ACTION_LABEL[a.action] ?? a.action}
                        {a.actorUnitId ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {a.actorUnitId}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {istDisplayDate(new Date(a.createdAt))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {canEdit && !expense.voidedAt ? (
              <div className="mt-auto flex gap-2 border-t border-border/70 pt-4">
                <Button
                  type="button"
                  className="flex-1"
                  onClick={() => onEdit(expense)}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="flex-1"
                  onClick={() => onVoid(expense.unitId)}
                >
                  Void
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
