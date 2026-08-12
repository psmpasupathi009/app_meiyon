"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/shared/components/data/page-header";
import { DataToolbar } from "@/shared/components/data/data-toolbar";
import { PaginationBar } from "@/shared/components/data/pagination-bar";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { UnitIdBadge } from "@/shared/components/data/unit-id-badge";
import { FilterChipGroup } from "@/shared/components/data/filter-chip-group";
import { ImportDialog } from "@/shared/components/data/import-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DatePicker } from "@/shared/components/forms/date-picker";
import { apiFetch, apiDownload, getErrorMessage } from "@/lib/api/client";
import type { PublicUser } from "@/lib/auth/session";
import type { DakSummary } from "@/features/dak/server/serialize";
import { DakFormDialog } from "@/features/dak/components/dak-form-dialog";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { istDateKey, istDisplayDate } from "@/lib/utils/ist";
import {
  DAK_DIRECTION_OPTIONS,
  DAK_MODE_OPTIONS,
} from "@/lib/validations/dak.schema";

type ListResponse = {
  data: DakSummary[];
  meta: { page: number; pageSize: number; total: number };
};

type DirectionFilter = "all" | "in" | "out";

function modeLabel(mode: string | null) {
  if (!mode) return "—";
  return DAK_MODE_OPTIONS.find((m) => m.value === mode)?.label ?? mode;
}

function directionLabel(direction: string) {
  return (
    DAK_DIRECTION_OPTIONS.find((d) => d.value === direction)?.label ?? direction
  );
}

export function DakPage({ user }: { user: PublicUser }) {
  const can = (action: string) => user.permissions.includes(`dak.${action}`);
  const canExport = user.permissions.includes("reports.view");

  const [rows, setRows] = useState<DakSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [dateFilter, setDateFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<DakSummary | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (direction !== "all") params.set("direction", direction);
    if (dateFilter) params.set("date", dateFilter);

    const { ok, data } = await apiFetch<ListResponse>(
      `/api/dak?${params.toString()}`
    );
    setLoading(false);
    if (!ok) {
      toast.error(
        getErrorMessage(data as Record<string, unknown>, "Failed to load dak")
      );
      return;
    }
    setRows((data as unknown as ListResponse).data ?? []);
    setTotal((data as unknown as ListResponse).meta?.total ?? 0);
  }, [page, debouncedSearch, direction, dateFilter]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function handleDelete(entry: DakSummary) {
    if (!confirm(`Delete dak entry “${entry.subject}”?`)) return;
    setBusyId(entry.unitId);
    const res = await apiFetch(`/api/dak/${entry.unitId}`, {
      method: "DELETE",
    });
    setBusyId(null);
    if (!res.ok) {
      toast.error(
        getErrorMessage(
          res.data as Record<string, unknown>,
          "Failed to delete entry"
        )
      );
      return;
    }
    toast.success("Dak entry deleted");
    void load();
  }

  const showEmpty = !loading && rows.length === 0;
  const hasFilters = Boolean(debouncedSearch || dateFilter || direction !== "all");

  return (
    <section>
      <PageHeader
        title="Dak register"
        description="Incoming and outgoing postal / courier book for the office."
        actions={
          <>
            {canExport ? (
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  const params = new URLSearchParams({ type: "dak" });
                  if (direction !== "all") params.set("direction", direction);
                  if (dateFilter) params.set("date", dateFilter);
                  if (debouncedSearch) params.set("q", debouncedSearch);
                  const result = await apiDownload(
                    `/api/exports?${params.toString()}`,
                    "dak.xlsx"
                  );
                  if (!result.ok) toast.error(result.error ?? "Export failed");
                }}
              >
                <Download className="size-4" />
                Export Excel
              </Button>
            ) : null}
            {can("create") ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setImportOpen(true)}
              >
                Import CSV
              </Button>
            ) : null}
            {can("create") ? (
              <Button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="size-4" />
                Add entry
              </Button>
            ) : null}
          </>
        }
      />

      <DataToolbar
        search={
          <Input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Search subject, from/to, tracking…"
            className="w-full"
          />
        }
        filters={
          <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center">
            <FilterChipGroup
              aria-label="Direction"
              value={direction}
              onChange={(v) => {
                setPage(1);
                setDirection(v);
              }}
              options={[
                { id: "all", label: "All" },
                { id: "in", label: "In" },
                { id: "out", label: "Out" },
              ]}
            />
            <div className="flex w-full flex-wrap items-center gap-2">
              {dateFilter ? (
                <>
                  <div className="min-w-0 w-full flex-1 sm:w-44 sm:flex-none">
                    <DatePicker
                      value={dateFilter}
                      onChange={(v) => {
                        setPage(1);
                        setDateFilter(v);
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 w-full shrink-0 sm:w-auto"
                    onClick={() => {
                      setPage(1);
                      setDateFilter("");
                    }}
                  >
                    Clear date
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full shrink-0 sm:w-auto"
                    onClick={() => {
                      setPage(1);
                      setDateFilter(istDateKey());
                    }}
                  >
                    Today
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 w-full shrink-0 sm:w-auto"
                    onClick={() => {
                      setPage(1);
                      setDateFilter(istDateKey());
                    }}
                  >
                    Filter by date
                  </Button>
                </>
              )}
            </div>
          </div>
        }
      />

      {showEmpty ? (
        <EmptyState
          title={hasFilters ? "No dak matches" : "No dak entries yet"}
          description={
            hasFilters
              ? "Try another search, direction, or date."
              : "Add the first postal entry for today’s register."
          }
          action={
            can("create") && !hasFilters ? (
              <Button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                Add first entry
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden md:table-cell">ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead className="hidden sm:table-cell">From / To</TableHead>
                <TableHead className="hidden lg:table-cell">Mode</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && rows.length === 0
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={`sk-${i}`}>
                      <TableCell colSpan={6}>
                        <div className="h-10 animate-pulse rounded-md bg-muted/60" />
                      </TableCell>
                    </TableRow>
                  ))
                : rows.map((row) => (
                    <TableRow key={row.unitId}>
                      <TableCell className="hidden md:table-cell">
                        <UnitIdBadge value={row.unitId} />
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="whitespace-nowrap text-sm font-medium text-navy">
                            {istDisplayDate(new Date(row.entryDate))}
                          </p>
                          <Badge
                            variant={row.direction === "in" ? "default" : "muted"}
                            className="mt-1"
                          >
                            {directionLabel(row.direction)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-medium text-navy">{row.subject}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground sm:hidden">
                            {row.fromTo || "—"}
                            {row.trackingNo ? ` · ${row.trackingNo}` : ""}
                          </p>
                          {row.caseUnitId || row.clientUnitId ? (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {[
                                row.caseNumber || row.caseUnitId,
                                row.clientName || row.clientUnitId,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {row.fromTo || "—"}
                        {row.trackingNo ? (
                          <p className="text-xs text-muted-foreground">
                            {row.trackingNo}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {modeLabel(row.mode)}
                      </TableCell>
                      <TableCell className="text-right">
                        {can("edit") ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-9"
                                disabled={busyId === row.unitId}
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditing(row);
                                  setFormOpen(true);
                                }}
                              >
                                <Pencil className="size-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => void handleDelete(row)}
                              >
                                <Trash2 className="size-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
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

      <DakFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        entry={editing}
        onSaved={load}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import dak register"
        endpoint="/api/dak/import"
        sampleHref="/samples/dak.sample.csv"
        columnsHint="Required: direction (in|out), entryDate (YYYY-MM-DD), subject. Optional: fromTo, caseUnitId, clientUnitId, notes."
        onImported={load}
      />
    </section>
  );
}
