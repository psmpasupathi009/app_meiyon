"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Download,
  FileSpreadsheet,
  MoreHorizontal,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { PageHeader } from "@/shared/components/data/page-header";
import { ImportDialog } from "@/shared/components/data/import-dialog";
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
import { PaymentFormDialog } from "@/features/accounts/components/payment-form-dialog";
import { VoidPaymentDialog } from "@/features/accounts/components/void-payment-dialog";
import { PaymentDetailDrawer } from "@/features/accounts/components/payment-detail-drawer";
import { AccountsFiltersSection } from "@/features/accounts/components/accounts-filters-section";
import { AccountsSummaryCards } from "@/features/accounts/components/accounts-summary-cards";
import { AccountsToolbarSection } from "@/features/accounts/components/accounts-toolbar-section";
import { PaymentsListSection } from "@/features/accounts/components/payments-list-section";
import {
  type FeeSummary,
  type ListResponse,
  type PaymentRow,
} from "@/features/accounts/components/accounts-page-helpers";
import {
  dayKeyToFromIso,
  dayKeyToToIso,
  indianFyBounds,
  thisMonthBounds,
  type PeriodPreset,
} from "@/features/accounts/lib/period";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";

export function AccountsPage({ user }: { user: PublicUser }) {
  const can = (action: string) =>
    user.permissions.includes(`accounts.${action}`);
  const canExport = can("view") && user.permissions.includes("reports.view");
  const canImport = can("upload") || user.roles.includes("admin");
  const canUploadReceipt =
    user.permissions.includes("cases.upload") ||
    user.permissions.includes("accounts.edit") ||
    user.permissions.includes("accounts.upload");
  const searchParams = useSearchParams();
  const router = useRouter();
  const caseUnitId = searchParams.get("caseUnitId") ?? "";
  const clientUnitId = searchParams.get("clientUnitId") ?? "";

  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({
    paid: 0,
    pending: 0,
    void: 0,
    netCollected: 0,
    entryCount: 0,
  });
  const [fee, setFee] = useState<FeeSummary | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [status, setStatus] = useState(
    searchParams.get("status") === "pending" ||
      searchParams.get("status") === "paid"
      ? (searchParams.get("status") as string)
      : "all"
  );
  const [purpose, setPurpose] = useState("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [period, setPeriod] = useState<PeriodPreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [clientNames, setClientNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [voiding, setVoiding] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    if (!clientUnitId) return;
    const named = rows.find(
      (r) => r.clientUnitId === clientUnitId && r.clientName
    );
    const name = named?.clientName;
    if (!name) return;
    setClientNames((prev) =>
      prev[clientUnitId] === name ? prev : { ...prev, [clientUnitId]: name }
    );
  }, [rows, clientUnitId]);

  useEffect(() => {
    if (searchParams.get("new") !== "1" || !can("create")) return;
    queueMicrotask(() => {
      setFormOpen(true);
      const next = new URLSearchParams(searchParams.toString());
      next.delete("new");
      const qs = next.toString();
      router.replace(qs ? `/accounts?${qs}` : "/accounts", { scroll: false });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const customRangeReady =
    period !== "custom" || (Boolean(customFrom) && Boolean(customTo));
  const customRangeInvalid =
    period === "custom" &&
    Boolean(customFrom) &&
    Boolean(customTo) &&
    customFrom > customTo;

  const dateRange = useMemo(() => {
    if (period === "month") return thisMonthBounds();
    if (period === "fy") return indianFyBounds();
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

  const activeClientId = clientUnitId;
  const clientPickerValue = clientUnitId
    ? {
        unitId: clientUnitId,
        name: clientNames[clientUnitId] ?? clientUnitId,
      }
    : null;

  const filterParams = useCallback(() => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (purpose !== "all") params.set("purpose", purpose);
    if (caseUnitId) params.set("caseUnitId", caseUnitId);
    if (activeClientId) params.set("clientUnitId", activeClientId);
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (dateRange.from) params.set("from", dateRange.from);
    if (dateRange.to) params.set("to", dateRange.to);
    return params;
  }, [
    status,
    purpose,
    caseUnitId,
    activeClientId,
    debouncedSearch,
    dateRange.from,
    dateRange.to,
  ]);

  const load = useCallback(async () => {
    if (period === "custom" && (!customFrom || !customTo || customFrom > customTo)) {
      setLoading(false);
      setRows([]);
      setTotal(0);
      setSummary({
        paid: 0,
        pending: 0,
        void: 0,
        netCollected: 0,
        entryCount: 0,
      });
      return;
    }
    setLoading(true);
    const params = filterParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    const { ok, data } = await apiFetch<ListResponse>(
      `/api/accounts?${params.toString()}`
    );
    setLoading(false);
    if (!ok) {
      toast.error(
        getErrorMessage(
          data as Record<string, unknown>,
          "Failed to load cash entries"
        )
      );
      return;
    }
    const res = data as unknown as ListResponse;
    setRows(res.data ?? []);
    setTotal(res.meta?.total ?? 0);
    setSummary(
      res.summary ?? {
        paid: 0,
        pending: 0,
        void: 0,
        netCollected: 0,
        entryCount: 0,
      }
    );
    setFee(res.fee ?? null);
  }, [page, filterParams, period, customFrom, customTo]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  function setContextQuery(next: {
    clientUnitId?: string | null;
    caseUnitId?: string | null;
  }) {
    const params = new URLSearchParams();
    const client = next.clientUnitId === undefined ? clientUnitId : next.clientUnitId;
    const caseId = next.caseUnitId === undefined ? caseUnitId : next.caseUnitId;
    if (client) params.set("clientUnitId", client);
    if (caseId) params.set("caseUnitId", caseId);
    const qs = params.toString();
    router.replace(qs ? `/accounts?${qs}` : "/accounts", { scroll: false });
    setPage(1);
  }

  function clearAllFilters() {
    setStatus("all");
    setPurpose("all");
    setSearch("");
    setPeriod("all");
    setCustomFrom("");
    setCustomTo("");
    setContextQuery({ clientUnitId: null, caseUnitId: null });
  }

  const hasActiveFilters =
    status !== "all" ||
    purpose !== "all" ||
    Boolean(search.trim()) ||
    period !== "all" ||
    Boolean(caseUnitId) ||
    Boolean(activeClientId);

  async function exportAuditPack() {
    setExporting(true);
    const params = filterParams();
    params.set("type", "accounts");
    const result = await apiDownload(
      `/api/exports?${params.toString()}`,
      "accounts-audit.xlsx"
    );
    setExporting(false);
    if (!result.ok) toast.error(result.error ?? "Export failed");
    else toast.success("Audit pack downloaded");
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  return (
    <section className="space-y-4">
      <PageHeader
        title="Accounts"
        description="Cash register for advances, fees, and actuals. Voided entries stay for audit."
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
                      void exportAuditPack();
                    }}
                  >
                    <Download className="size-4" />
                    {exporting ? "Exporting…" : "Export audit pack"}
                  </DropdownMenuItem>
                ) : null}
                {canImport ? (
                  <DropdownMenuItem onSelect={() => setImportOpen(true)}>
                    <Upload className="size-4" />
                    Import CSV
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem asChild>
                  <a href="/samples/payments.sample.csv" download>
                    <FileSpreadsheet className="size-4" />
                    Download CSV sample
                  </a>
                </DropdownMenuItem>
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
                <span className="sm:hidden">Record</span>
                <span className="hidden sm:inline">Record entry</span>
              </Button>
            ) : null}
          </>
        }
      />

      <AccountsFiltersSection
        period={period}
        status={status}
        customFrom={customFrom}
        customTo={customTo}
        customRangeReady={customRangeReady}
        customRangeInvalid={customRangeInvalid}
        caseUnitId={caseUnitId}
        activeClientId={activeClientId}
        clientNames={clientNames}
        fee={fee}
        hasActiveFilters={hasActiveFilters}
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
        onClearCase={() => setContextQuery({ caseUnitId: null })}
        onClearClient={() => setContextQuery({ clientUnitId: null })}
        onClearAllFilters={clearAllFilters}
      />

      <AccountsSummaryCards
        summary={summary}
        status={status}
        onStatusChange={(s) => {
          setPage(1);
          setStatus(s);
        }}
      />

      <AccountsToolbarSection
        purpose={purpose}
        search={search}
        clientPickerValue={clientPickerValue}
        canExport={canExport}
        exporting={exporting}
        onPurposeChange={(v) => {
          setPage(1);
          setPurpose(v);
        }}
        onSearchChange={(v) => {
          setPage(1);
          setSearch(v);
        }}
        onClientChange={(c) => {
          if (c) {
            setClientNames((prev) => ({ ...prev, [c.unitId]: c.name }));
          }
          setContextQuery({
            clientUnitId: c?.unitId ?? null,
          });
        }}
        onExport={() => void exportAuditPack()}
      />

      <PaymentsListSection
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
        onEdit={(p) => {
          setEditing(p);
          setFormOpen(true);
        }}
        onVoid={setVoiding}
      />

      <PaymentFormDialog
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setEditing(null);
        }}
        defaultClientUnitId={activeClientId || undefined}
        defaultCaseUnitId={caseUnitId || undefined}
        payment={editing}
        onSaved={load}
      />

      <PaymentDetailDrawer
        open={Boolean(detailId)}
        onOpenChange={(v) => !v && setDetailId(null)}
        unitId={detailId}
        canEdit={can("edit")}
        canUploadReceipt={canUploadReceipt}
        onEdit={(p) => {
          setDetailId(null);
          setEditing(p as PaymentRow);
          setFormOpen(true);
        }}
        onVoid={(id) => {
          setDetailId(null);
          setVoiding(id);
        }}
        onFilterClient={(id) => {
          setDetailId(null);
          setContextQuery({ clientUnitId: id });
        }}
        onChanged={load}
      />

      {voiding ? (
        <VoidPaymentDialog
          open={Boolean(voiding)}
          onOpenChange={(v) => !v && setVoiding(null)}
          unitId={voiding}
          onVoided={() => {
            void load();
            if (detailId === voiding) setDetailId(null);
          }}
        />
      ) : null}

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import cash entries"
        endpoint="/api/accounts/import"
        sampleHref="/samples/payments.sample.csv"
        columnsHint="Required: clientUnitId, amount, type (advance/partial/full/consultation/court_fee/stamp/copying/travel/clerkage/other). Optional: caseUnitId, status (pending/paid), paidOn, notes (required for other)."
        onImported={load}
      />
    </section>
  );
}
