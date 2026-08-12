"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, MoreHorizontal, Plus, X } from "lucide-react";
import { PageHeader } from "@/shared/components/data/page-header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch, apiDownload, getErrorMessage } from "@/lib/api/client";
import type { PublicUser } from "@/lib/auth/session";
import { ExpenseFormDialog } from "@/features/expenses/components/expense-form-dialog";
import { VoidExpenseDialog } from "@/features/expenses/components/void-expense-dialog";
import { ExpenseDetailDrawer } from "@/features/expenses/components/expense-detail-drawer";
import { ExpensesFiltersSection } from "@/features/expenses/components/expenses-filters-section";
import { ExpensesSummaryCards } from "@/features/expenses/components/expenses-summary-cards";
import { ExpensesToolbarSection } from "@/features/expenses/components/expenses-toolbar-section";
import { ExpensesListSection } from "@/features/expenses/components/expenses-list-section";
import {
  type ExpenseRow,
  type ListResponse,
} from "@/features/expenses/components/expenses-page-helpers";
import {
  dayKeyToFromIso,
  dayKeyToToIso,
  thisMonthBounds,
  thisWeekBounds,
  todayBounds,
  type ExpensePeriodPreset,
} from "@/features/expenses/lib/period";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";

export function ExpensesPage({ user }: { user: PublicUser }) {
  const can = (action: string) =>
    user.permissions.includes(`expenses.${action}`);
  const canExport = can("view") && user.permissions.includes("reports.view");

  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ totalAmount: 0, entryCount: 0 });
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [status, setStatus] = useState("active");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [period, setPeriod] = useState<ExpensePeriodPreset>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [voiding, setVoiding] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const customRangeReady =
    period !== "custom" || (Boolean(customFrom) && Boolean(customTo));
  const customRangeInvalid =
    period === "custom" &&
    Boolean(customFrom) &&
    Boolean(customTo) &&
    customFrom > customTo;

  const dateRange = useMemo(() => {
    if (period === "today") return todayBounds();
    if (period === "week") return thisWeekBounds();
    if (period === "month") return thisMonthBounds();
    if (period === "custom") {
      if (!customFrom || !customTo || customFrom > customTo) {
        return { from: undefined, to: undefined };
      }
      return {
        from: dayKeyToFromIso(customFrom),
        to: dayKeyToToIso(customTo),
      };
    }
    return { from: undefined, to: undefined };
  }, [period, customFrom, customTo]);

  const filterParams = useCallback(() => {
    const params = new URLSearchParams();
    if (status !== "active") params.set("status", status);
    if (category !== "all") params.set("category", category);
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (dateRange.from) params.set("from", dateRange.from);
    if (dateRange.to) params.set("to", dateRange.to);
    return params;
  }, [status, category, debouncedSearch, dateRange.from, dateRange.to]);

  const load = useCallback(async () => {
    if (
      period === "custom" &&
      (!customFrom || !customTo || customFrom > customTo)
    ) {
      setLoading(false);
      setRows([]);
      setTotal(0);
      setSummary({ totalAmount: 0, entryCount: 0 });
      return;
    }
    setLoading(true);
    const params = filterParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    const { ok, data } = await apiFetch<ListResponse>(
      `/api/expenses?${params.toString()}`
    );
    setLoading(false);
    if (!ok) {
      toast.error(
        getErrorMessage(
          data as Record<string, unknown>,
          "Failed to load expenses"
        )
      );
      return;
    }
    const res = data as unknown as ListResponse;
    setRows(res.data ?? []);
    setTotal(res.meta?.total ?? 0);
    setSummary(res.summary ?? { totalAmount: 0, entryCount: 0 });
  }, [page, filterParams, period, customFrom, customTo]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  function clearAllFilters() {
    setStatus("active");
    setCategory("all");
    setSearch("");
    setPeriod("month");
    setCustomFrom("");
    setCustomTo("");
    setPage(1);
  }

  const hasActiveFilters =
    status !== "active" ||
    category !== "all" ||
    Boolean(search.trim()) ||
    period !== "month";

  async function exportPack() {
    setExporting(true);
    const params = filterParams();
    params.set("type", "expenses");
    const result = await apiDownload(
      `/api/exports?${params.toString()}`,
      "office-expenses.xlsx"
    );
    setExporting(false);
    if (!result.ok) toast.error(result.error ?? "Export failed");
    else toast.success("Export downloaded");
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  return (
    <section className="space-y-4">
      <PageHeader
        title="Office expenses"
        description="Record office purchases with bill attachments. Totals update by day, week, or month."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="gap-2">
                  <MoreHorizontal className="size-4" />
                  <span className="sm:inline">Tools</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {canExport ? (
                  <DropdownMenuItem
                    disabled={exporting}
                    onSelect={() => {
                      void exportPack();
                    }}
                  >
                    <Download className="size-4" />
                    {exporting ? "Exporting…" : "Export Excel"}
                  </DropdownMenuItem>
                ) : null}
                {hasActiveFilters ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={clearAllFilters}>
                      <X className="size-4" />
                      Clear all filters
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
            {can("create") ? (
              <Button type="button" className="gap-2" onClick={openCreate}>
                <Plus className="size-4" />
                <span className="sm:hidden">Add</span>
                <span className="hidden sm:inline">Add expense</span>
              </Button>
            ) : null}
          </>
        }
      />

      <ExpensesFiltersSection
        period={period}
        status={status}
        customFrom={customFrom}
        customTo={customTo}
        customRangeReady={customRangeReady}
        customRangeInvalid={customRangeInvalid}
        onPeriodChange={(p) => {
          setPage(1);
          setPeriod(p);
        }}
        onStatusChange={(s) => {
          setPage(1);
          setStatus(s);
        }}
        onCustomFromChange={(v) => {
          setPage(1);
          setCustomFrom(v);
        }}
        onCustomToChange={(v) => {
          setPage(1);
          setCustomTo(v);
        }}
      />

      <ExpensesSummaryCards summary={summary} />

      <ExpensesToolbarSection
        category={category}
        search={search}
        canExport={canExport}
        exporting={exporting}
        onCategoryChange={(v) => {
          setPage(1);
          setCategory(v);
        }}
        onSearchChange={(v) => {
          setPage(1);
          setSearch(v);
        }}
        onExport={() => void exportPack()}
      />

      <ExpensesListSection
        loading={loading}
        rows={rows}
        page={page}
        pageSize={pageSize}
        total={total}
        hasActiveFilters={hasActiveFilters}
        canCreate={can("create")}
        canEdit={can("edit")}
        onPageChange={setPage}
        onClearFilters={clearAllFilters}
        onCreate={openCreate}
        onOpenDetail={setDetailId}
        onEdit={(e) => {
          setEditing(e);
          setFormOpen(true);
        }}
        onVoid={setVoiding}
      />

      <ExpenseFormDialog
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setEditing(null);
        }}
        expense={editing}
        onSaved={load}
      />

      <ExpenseDetailDrawer
        open={Boolean(detailId)}
        onOpenChange={(v) => !v && setDetailId(null)}
        unitId={detailId}
        canEdit={can("edit")}
        onEdit={(e) => {
          setDetailId(null);
          setEditing(e as ExpenseRow);
          setFormOpen(true);
        }}
        onVoid={(id) => {
          setDetailId(null);
          setVoiding(id);
        }}
        onChanged={load}
      />

      {voiding ? (
        <VoidExpenseDialog
          open={Boolean(voiding)}
          onOpenChange={(v) => !v && setVoiding(null)}
          unitId={voiding}
          onVoided={() => {
            void load();
            if (detailId === voiding) setDetailId(null);
          }}
        />
      ) : null}
    </section>
  );
}
