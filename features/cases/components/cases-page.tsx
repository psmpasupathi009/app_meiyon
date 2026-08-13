"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/shared/components/data/page-header";
import { DataToolbar } from "@/shared/components/data/data-toolbar";
import { PaginationBar } from "@/shared/components/data/pagination-bar";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { UnitIdBadge } from "@/shared/components/data/unit-id-badge";
import { ImportDialog } from "@/shared/components/data/import-dialog";
import { MoreHorizontal, LayoutList, Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch, apiDownload, getErrorMessage } from "@/lib/api/client";
import type { PublicUser } from "@/lib/auth/session";
import { isClientOnlyUser } from "@/lib/auth/client-portal";
import type { CaseSummary } from "@/features/cases/server/serialize";
import { CaseFormDialog } from "@/features/cases/components/case-form-dialog";
import { CasesBoard } from "@/features/cases/components/cases-board";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { cn } from "@/lib/utils/cn";
import { CASE_TYPES } from "@meiyon/config";

type CaseRow = CaseSummary & { clientName: string | null };
type ListResponse = {
  data: CaseRow[];
  meta: { page: number; pageSize: number; total: number };
};

type QuickFilter =
  | "all"
  | "today"
  | "week"
  | "missingCourt"
  | "battaDue"
  | "filingDefect";

type CasesView = "list" | "board";

const VIEW_STORAGE_KEY = "meiyon.cases.view";
const BOARD_PAGE_SIZE = 200;

function readStoredView(): CasesView {
  if (typeof window === "undefined") return "list";
  try {
    const v = window.localStorage.getItem(VIEW_STORAGE_KEY);
    return v === "board" ? "board" : "list";
  } catch {
    return "list";
  }
}

export function CasesPage({ user }: { user: PublicUser }) {
  const can = (action: string) => user.permissions.includes(`cases.${action}`);
  const canExport = user.permissions.includes("reports.view");
  const clientPortal = isClientOnlyUser(user.roles);
  const searchParams = useSearchParams();
  const router = useRouter();
  const clientUnitId = searchParams.get("clientUnitId") ?? "";

  const initialQuick: QuickFilter =
    searchParams.get("hearing") === "today"
      ? "today"
      : searchParams.get("hearing") === "week"
        ? "week"
        : searchParams.get("missingCourtNumber") === "1"
          ? "missingCourt"
          : searchParams.get("battaDue") === "1" ||
              searchParams.get("battaDue") === "true"
            ? "battaDue"
            : searchParams.get("status") === "filing_defect"
              ? "filingDefect"
              : "all";

  const [rows, setRows] = useState<CaseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [status, setStatus] = useState<string>(
    searchParams.get("status") && searchParams.get("status") !== "filing_defect"
      ? (searchParams.get("status") as string)
      : "all"
  );
  const [caseType, setCaseType] = useState<string>(
    searchParams.get("caseType")?.trim() || "all"
  );
  const [quick, setQuick] = useState<QuickFilter>(initialQuick);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<CasesView>("list");
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [hearingsImportOpen, setHearingsImportOpen] = useState(false);
  const [defaultClient, setDefaultClient] = useState<{
    unitId: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    if (searchParams.get("new") !== "1" || !can("create")) return;
    queueMicrotask(() => {
      setFormOpen(true);
      const next = new URLSearchParams();
      if (clientUnitId) next.set("clientUnitId", clientUnitId);
      const qs = next.toString();
      router.replace(qs ? `/cases?${qs}` : "/cases", { scroll: false });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once from query
  }, []);

  useEffect(() => {
    if (!clientUnitId) {
      setDefaultClient(null);
      return;
    }
    const fromRows = rows.find((r) => r.clientUnitId === clientUnitId);
    if (fromRows?.clientName) {
      setDefaultClient({ unitId: clientUnitId, name: fromRows.clientName });
      return;
    }
    let cancelled = false;
    void (async () => {
      const { ok, data } = await apiFetch<{
        client: { name: string; unitId: string };
      }>(`/api/clients/${clientUnitId}`);
      if (cancelled || !ok) return;
      const body = data as { client?: { name?: string; unitId?: string } };
      if (body.client?.name && body.client?.unitId) {
        setDefaultClient({
          unitId: body.client.unitId,
          name: body.client.name,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientUnitId, rows]);

  useEffect(() => {
    if (clientPortal) {
      setView("list");
      return;
    }
    queueMicrotask(() => {
      setView(readStoredView());
    });
  }, [clientPortal]);

  function setCasesView(next: CasesView) {
    if (clientPortal) return;
    setView(next);
    setPage(1);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    const isBoard = !clientPortal && view === "board";
    const params = new URLSearchParams({
      page: String(isBoard ? 1 : page),
      pageSize: String(isBoard ? BOARD_PAGE_SIZE : pageSize),
    });
    if (isBoard) {
      params.set("view", "board");
    }
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (quick === "filingDefect") {
      params.set("status", "filing_defect");
    } else if (status !== "all") {
      params.set("status", status);
    }
    if (caseType !== "all") params.set("caseType", caseType);
    if (clientUnitId) params.set("clientUnitId", clientUnitId);
    if (quick === "today") params.set("hearing", "today");
    if (quick === "week") params.set("hearing", "week");
    if (quick === "missingCourt") params.set("missingCourtNumber", "1");
    if (quick === "battaDue") params.set("battaDue", "1");

    const { ok, data } = await apiFetch<ListResponse>(
      `/api/cases?${params.toString()}`
    );
    setLoading(false);
    if (!ok) {
      toast.error(
        getErrorMessage(data as Record<string, unknown>, "Failed to load cases")
      );
      return;
    }
    setRows((data as unknown as ListResponse).data ?? []);
    setTotal((data as unknown as ListResponse).meta?.total ?? 0);
  }, [
    page,
    debouncedSearch,
    status,
    caseType,
    clientUnitId,
    quick,
    view,
    clientPortal,
  ]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const chips: { id: QuickFilter; label: string }[] = clientPortal
    ? [
        { id: "all", label: "All cases" },
        { id: "today", label: "Hearing today" },
        { id: "week", label: "This week" },
      ]
    : [
        { id: "all", label: "All cases" },
        { id: "today", label: "Hearing today" },
        { id: "week", label: "This week" },
        { id: "missingCourt", label: "No court number" },
        { id: "battaDue", label: "Batta due" },
        { id: "filingDefect", label: "Filing defect" },
      ];

  return (
    <section>
      <PageHeader
        title="Cases"
        description={
          clientPortal
            ? "Your matters — status, court, and hearing dates."
            : "Office-shared cause list — search by CSE id, court number, or client."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!clientPortal ? (
              <div className="inline-flex w-auto rounded-lg border border-border/80 bg-muted/40 p-0.5 sm:w-auto!">
                <button
                  type="button"
                  onClick={() => setCasesView("list")}
                  className={cn(
                    "inline-flex w-auto! items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    view === "list"
                      ? "bg-card text-navy shadow-sm"
                      : "text-muted-foreground hover:text-navy"
                  )}
                >
                  <LayoutList className="size-3.5" />
                  List
                </button>
                <button
                  type="button"
                  onClick={() => setCasesView("board")}
                  className={cn(
                    "inline-flex w-auto! items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    view === "board"
                      ? "bg-card text-navy shadow-sm"
                      : "text-muted-foreground hover:text-navy"
                  )}
                >
                  <Columns3 className="size-3.5" />
                  Board
                </button>
              </div>
            ) : null}
            {can("create") ? (
              <Button type="button" onClick={() => setFormOpen(true)}>
                Register case
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setPage(1);
              setQuick(c.id);
              if (c.id === "filingDefect") setStatus("all");
            }}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
              quick === c.id
                ? "bg-brand text-brand-foreground"
                : "bg-muted text-muted-foreground hover:text-navy"
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <DataToolbar
        search={
          <Input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Search CSE / court no / client…"
            className="w-full"
          />
        }
        filters={
          <Select
            value={caseType}
            onValueChange={(v) => {
              setPage(1);
              setCaseType(v);
            }}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Case type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {CASE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        actions={
          !clientPortal && (canExport || can("upload") || can("edit")) ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" className="gap-2">
                <MoreHorizontal className="size-4" />
                Import / export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {canExport ? (
                <DropdownMenuItem
                  onSelect={async () => {
                    const params = new URLSearchParams({ type: "cases" });
                    if (debouncedSearch) params.set("q", debouncedSearch);
                    if (quick === "filingDefect") {
                      params.set("status", "filing_defect");
                    } else if (status !== "all") {
                      params.set("status", status);
                    }
                    if (caseType !== "all") params.set("caseType", caseType);
                    if (clientUnitId) params.set("clientUnitId", clientUnitId);
                    if (quick === "today") params.set("hearing", "today");
                    if (quick === "week") params.set("hearing", "week");
                    if (quick === "missingCourt") {
                      params.set("missingCourtNumber", "1");
                    }
                    if (quick === "battaDue") params.set("battaDue", "1");
                    const result = await apiDownload(
                      `/api/exports?${params.toString()}`,
                      "cases.xlsx"
                    );
                    if (!result.ok) toast.error(result.error ?? "Export failed");
                  }}
                >
                  Export Excel
                </DropdownMenuItem>
              ) : null}
              {can("upload") ? (
                <DropdownMenuItem onSelect={() => setImportOpen(true)}>
                  Import cases
                </DropdownMenuItem>
              ) : null}
              {can("edit") ? (
                <DropdownMenuItem onSelect={() => setHearingsImportOpen(true)}>
                  Import hearings
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
          ) : null
        }
      />

      {!loading && rows.length === 0 ? (
        <EmptyState
          title={
            quick === "today"
              ? "No hearings today"
              : quick === "missingCourt"
                ? "No cases missing court numbers"
                : "No cases yet"
          }
          description={
            clientPortal
              ? "When the office registers a matter for you, it will show here."
              : can("create")
                ? "Register a case for a client — court number can wait until allotted."
                : "Ask admin if you need access to create cases."
          }
          action={
            can("create") && quick === "all" ? (
              <Button type="button" onClick={() => setFormOpen(true)}>
                Register first case
              </Button>
            ) : undefined
          }
        />
      ) : view === "board" ? (
        caseType === "all" ? (
          <EmptyState
            title="Select a case type"
            description="The board shows court status columns for one case type (CC, OS, Bail, …)."
          />
        ) : (
          <CasesBoard
            rows={rows}
            total={total}
            canEdit={can("edit")}
            caseType={caseType}
            loading={loading}
            onCaseUpdated={(next) => {
              setRows((prev) =>
                prev.map((r) =>
                  r.unitId === next.unitId
                    ? { ...r, ...next, clientName: r.clientName }
                    : r
                )
              );
            }}
          />
        )
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden md:table-cell">ID</TableHead>
                <TableHead>Court no.</TableHead>
                {!clientPortal ? (
                  <TableHead className="hidden md:table-cell">Client</TableHead>
                ) : null}
                <TableHead className="hidden lg:table-cell">Court</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Next hearing</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}>
                        <div className="h-8 animate-pulse rounded bg-muted" />
                      </TableCell>
                    </TableRow>
                  ))
                : rows.map((c) => {
                    return (
                    <TableRow key={c.unitId}>
                      <TableCell className="hidden md:table-cell">
                        <UnitIdBadge value={c.unitId} />
                      </TableCell>
                      <TableCell className="font-medium text-navy">
                        <div className="space-y-0.5">
                          {c.caseNumber ?? (
                            <span className="font-normal text-amber-700 dark:text-amber-400">
                              Pending
                            </span>
                          )}
                          {!clientPortal ? (
                            <p className="text-xs font-normal text-muted-foreground md:hidden">
                              {c.clientName ?? c.clientUnitId}
                            </p>
                          ) : null}
                          <div className="md:hidden">
                            <UnitIdBadge value={c.unitId} className="mt-1" />
                          </div>
                        </div>
                      </TableCell>
                      {!clientPortal ? (
                        <TableCell className="hidden md:table-cell">
                          {c.clientName ?? c.clientUnitId}
                        </TableCell>
                      ) : null}
                      <TableCell className="hidden lg:table-cell">
                        {c.courtName ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-navy">
                        {c.stage?.trim() ? (
                          c.stage
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {c.nextHearingAt
                          ? new Date(c.nextHearingAt).toLocaleDateString(
                              "en-IN"
                            )
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild type="button" variant="outline" size="sm">
                          <Link href={`/cases/${c.unitId}`}>Open</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                    );
                  })}
            </TableBody>
          </Table>

          <PaginationBar
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
          />
        </>
      )}

      <CaseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultClient={defaultClient}
        onSaved={(createdUnitId) => {
          void load();
          if (createdUnitId) {
            router.push(`/cases/${createdUnitId}`);
          }
        }}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import cases"
        endpoint="/api/cases/import"
        sampleHref="/samples/cases.sample.csv"
        columnsHint="Required: clientUnitId (from Clients). Optional: unitId, caseNumber, cnr, courtName, caseType, status, filingDate, nextHearingAt, agreedFee, primaryAdvocateMobile, notes."
        onImported={load}
      />

      <ImportDialog
        open={hearingsImportOpen}
        onOpenChange={setHearingsImportOpen}
        title="Import hearings"
        endpoint="/api/hearings/import"
        sampleHref="/samples/hearings.sample.csv"
        columnsHint="Required: caseUnitId, hearingDate (YYYY-MM-DD IST). Optional: purpose, notes. Client SMS is automatic the day before each hearing; tomorrow’s dates also send on import if the nightly job already ran."
        onImported={load}
      />
    </section>
  );
}
