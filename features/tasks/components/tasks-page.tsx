"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  Download,
  MoreHorizontal,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import { PageHeader } from "@/shared/components/data/page-header";
import { DataToolbar } from "@/shared/components/data/data-toolbar";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { UnitIdBadge } from "@/shared/components/data/unit-id-badge";
import { FilterChipGroup } from "@/shared/components/data/filter-chip-group";
import { ImportDialog } from "@/shared/components/data/import-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DatePicker } from "@/shared/components/forms/date-picker";
import { apiFetch, apiDownload, getErrorMessage } from "@/lib/api/client";
import type { PublicUser } from "@/lib/auth/session";
import type { OfficeTaskSummary } from "@/features/tasks/server/serialize";
import { TaskFormDialog } from "@/features/tasks/components/task-form-dialog";
import { FinishTaskDialog } from "@/features/tasks/components/finish-task-dialog";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { istDateKey, istDisplayDate } from "@/lib/utils/ist";
import {
  OFFICE_TASK_KIND_OPTIONS,
  OFFICE_TASK_STATUS_OPTIONS,
} from "@/lib/validations/tasks.schema";
import { cn } from "@/lib/utils/cn";
type ListResponse = {
  data: OfficeTaskSummary[];
  meta: { page: number; pageSize: number; total: number };
};

type StatusFilter = "open" | "done" | "all";
type ViewMode = "allotment" | "finishing";

function kindLabel(kind: string) {
  return OFFICE_TASK_KIND_OPTIONS.find((k) => k.value === kind)?.label ?? kind;
}

function statusVariant(status: string): "default" | "success" | "muted" | "warning" {
  if (status === "done") return "success";
  if (status === "cancelled") return "muted";
  return "warning";
}

export function TasksPage({ user }: { user: PublicUser }) {
  const can = (action: string) => user.permissions.includes(`tasks.${action}`);
  const canExport = user.permissions.includes("reports.view");
  const todayKey = istDateKey();
  const searchParams = useSearchParams();
  const dueFilter = searchParams.get("due");
  const attentionMode = dueFilter === "overdue" || dueFilter === "today";

  const [view, setView] = useState<ViewMode>(
    attentionMode ? "finishing" : "allotment"
  );
  // When deep-linked from Attention, show all kinds (use finishing chip layout loosely)
  const [workDate, setWorkDate] = useState(todayKey);
  const [status, setStatus] = useState<StatusFilter>(
    attentionMode || searchParams.get("status") === "open"
      ? "open"
      : searchParams.get("status") === "done"
        ? "done"
        : searchParams.get("status") === "all"
          ? "all"
          : "open"
  );
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [due, setDue] = useState<"overdue" | "today" | null>(
    dueFilter === "overdue" || dueFilter === "today" ? dueFilter : null
  );
  const debouncedSearch = useDebouncedValue(search, 300);
  const [rows, setRows] = useState<OfficeTaskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<OfficeTaskSummary | null>(null);
  const [finishing, setFinishing] = useState<OfficeTaskSummary | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: "1",
      pageSize: "50",
    });
    const globalSearch = Boolean(debouncedSearch) && status === "all" && !due;
    if (due) {
      params.set("due", due);
      if (status !== "all") params.set("status", status);
    } else if (globalSearch) {
      // Deep-link / unit-id search — don't pin to work day or allotment kind
    } else {
      params.set("workDate", workDate);
      if (view === "allotment") {
        params.set("kind", "allotment");
      }
      if (status !== "all") params.set("status", status);
    }
    if (debouncedSearch) params.set("q", debouncedSearch);

    const { ok, data } = await apiFetch<ListResponse>(
      `/api/tasks?${params.toString()}`
    );
    setLoading(false);
    if (!ok) {
      toast.error(
        getErrorMessage(data as Record<string, unknown>, "Failed to load tasks")
      );
      return;
    }
    setRows((data as unknown as ListResponse).data ?? []);
  }, [workDate, view, status, debouncedSearch, due]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  // Finishing report: today's done tasks with notes (any kind)
  const [doneRows, setDoneRows] = useState<OfficeTaskSummary[]>([]);
  const loadDone = useCallback(async () => {
    if (view !== "finishing") return;
    const params = new URLSearchParams({
      page: "1",
      pageSize: "50",
      workDate,
      status: "done",
    });
    const { ok, data } = await apiFetch<ListResponse>(
      `/api/tasks?${params.toString()}`
    );
    if (!ok) return;
    setDoneRows((data as unknown as ListResponse).data ?? []);
  }, [view, workDate]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadDone();
    });
  }, [loadDone]);

  const openRows = useMemo(
    () => rows.filter((r) => r.status === "open"),
    [rows]
  );

  async function cancelTask(task: OfficeTaskSummary) {
    setBusyId(task.unitId);
    const res = await apiFetch(`/api/tasks/${task.unitId}`, {
      method: "PATCH",
      json: { status: "cancelled" },
    });
    setBusyId(null);
    if (!res.ok) {
      toast.error(
        getErrorMessage(
          res.data as Record<string, unknown>,
          "Failed to cancel task"
        )
      );
      return;
    }
    toast.success("Task cancelled");
    void load();
    void loadDone();
  }

  function refresh() {
    void load();
    void loadDone();
  }

  const isToday = workDate === todayKey;
  const showEmpty = !loading && rows.length === 0;

  return (
    <section className="space-y-5">
      <PageHeader
        title="Office tasks"
        description="Morning allotment and evening finishing for the office work day."
        actions={
          <>
            {canExport ? (
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  const params = new URLSearchParams({ type: "tasks" });
                  if (due) {
                    params.set("due", due);
                  } else {
                    params.set("workDate", workDate);
                    if (view === "allotment") params.set("kind", "allotment");
                  }
                  if (status !== "all") params.set("status", status);
                  if (debouncedSearch) params.set("q", debouncedSearch);
                  const result = await apiDownload(
                    `/api/exports?${params.toString()}`,
                    "tasks.xlsx"
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
                Allot work
              </Button>
            ) : null}
          </>
        }
      />

      <div className="rounded-2xl border border-border/80 bg-card p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <FilterChipGroup
            aria-label="View"
            value={view}
            onChange={(v) => {
              setDue(null);
              setView(v);
              setStatus("open");
            }}
            options={[
              { id: "allotment", label: "Morning allotment" },
              { id: "finishing", label: "Evening finishing" },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDue(null);
                setWorkDate(todayKey);
              }}
              className={cn(
                "shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors",
                isToday && !due
                  ? "bg-brand text-brand-foreground shadow-sm"
                  : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-navy"
              )}
            >
              Today
            </button>
            <div className="min-w-0 flex-1 sm:w-44">
              <DatePicker
                value={workDate}
                onChange={(d) => {
                  setDue(null);
                  setWorkDate(d);
                }}
              />
            </div>
          </div>
        </div>
        <p className="mt-3 border-t border-border/60 pt-3 text-sm text-muted-foreground">
          {due === "overdue"
            ? "Open tasks past due"
            : due === "today"
              ? "Open tasks due today"
              : `Work day · ${istDisplayDate(new Date(`${workDate}T12:00:00+05:30`))}`}
          {!loading ? (
            <span>
              {" "}
              · {rows.length} task{rows.length === 1 ? "" : "s"}
              {!due && view === "allotment" ? " (allotment)" : ""}
            </span>
          ) : null}
          {due ? (
            <button
              type="button"
              className="ml-2 text-navy underline underline-offset-2"
              onClick={() => setDue(null)}
            >
              Clear due filter
            </button>
          ) : null}
        </p>
      </div>

      <DataToolbar
        search={
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, notes, case…"
            className="w-full"
          />
        }
        filters={
          <FilterChipGroup
            aria-label="Status"
            size="sm"
            value={status}
            onChange={setStatus}
            options={[
              { id: "open", label: "Open" },
              { id: "done", label: "Done" },
              { id: "all", label: "All" },
            ]}
          />
        }
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl border border-border/60 bg-muted/40"
            />
          ))}
        </div>
      ) : showEmpty ? (
        <EmptyState
          title={
            view === "allotment"
              ? "No allotment for this day"
              : "No open tasks for this day"
          }
          description={
            view === "allotment"
              ? "Create morning allotment tasks for today’s work."
              : "Open tasks will appear here for evening finishing."
          }
          action={
            can("create") ? (
              <Button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                Allot work
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((task) => (
            <li
              key={task.unitId}
              className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-navy">{task.title}</h3>
                    <Badge variant={statusVariant(task.status)}>
                      {OFFICE_TASK_STATUS_OPTIONS.find(
                        (s) => s.value === task.status
                      )?.label ?? task.status}
                    </Badge>
                    <Badge variant="muted">{kindLabel(task.kind)}</Badge>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <UnitIdBadge value={task.unitId} />
                    {task.assigneeName || task.assigneeUnitId ? (
                      <span>
                        {task.assigneeName || task.assigneeUnitId}
                      </span>
                    ) : (
                      <span>Unassigned</span>
                    )}
                    {task.caseUnitId ? (
                      <span>{task.caseNumber || task.caseUnitId}</span>
                    ) : null}
                  </div>
                  {task.notes ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {task.notes}
                    </p>
                  ) : null}
                  {task.status === "done" && task.finishNote ? (
                    <p className="mt-2 rounded-xl bg-muted/50 px-3 py-2 text-sm text-navy">
                      <span className="font-medium">Finish: </span>
                      {task.finishNote}
                    </p>
                  ) : null}
                </div>

                {can("edit") ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 shrink-0"
                        disabled={busyId === task.unitId}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {task.status === "open" ? (
                        <DropdownMenuItem onClick={() => setFinishing(task)}>
                          <Check className="size-4" />
                          Mark done
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem
                        onClick={() => {
                          setEditing(task);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                        Edit
                      </DropdownMenuItem>
                      {task.status === "open" ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => void cancelTask(task)}
                          >
                            <X className="size-4" />
                            Cancel
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>

              {view === "finishing" &&
              task.status === "open" &&
              can("edit") ? (
                <div className="mt-3 border-t border-border/60 pt-3">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setFinishing(task)}
                  >
                    <Check className="size-4" />
                    Finish with note
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {view === "finishing" ? (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-2 border-b border-border/70 pb-2">
            <h2 className="text-sm font-semibold tracking-wide text-navy uppercase">
              Finishing report
            </h2>
            <span className="text-xs text-muted-foreground">
              {doneRows.length} done
            </span>
          </div>
          {doneRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Done tasks with finishing notes will list here for this work day.
            </p>
          ) : (
            <ul className="space-y-2">
              {doneRows.map((task) => (
                <li
                  key={`done-${task.unitId}`}
                  className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3"
                >
                  <p className="font-medium text-navy">{task.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {task.assigneeName || task.assigneeUnitId || "Unassigned"}
                    {task.caseNumber || task.caseUnitId
                      ? ` · ${task.caseNumber || task.caseUnitId}`
                      : ""}
                  </p>
                  {task.finishNote ? (
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {task.finishNote}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-sm text-muted-foreground italic">
                      No finishing note
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {!loading && view === "allotment" && openRows.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {openRows.length} open allotment
          {openRows.length === 1 ? "" : "s"} for this day.
        </p>
      ) : null}

      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editing}
        defaultWorkDate={workDate}
        defaultKind={view === "allotment" ? "allotment" : "general"}
        onSaved={refresh}
      />

      <FinishTaskDialog
        open={Boolean(finishing)}
        onOpenChange={(open) => {
          if (!open) setFinishing(null);
        }}
        task={finishing}
        onSaved={refresh}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import work allotment"
        endpoint="/api/tasks/import"
        sampleHref="/samples/tasks.sample.csv"
        columnsHint={`Required: title, workDate (YYYY-MM-DD). Optional: assigneeUnitId, caseUnitId, kind (default allotment). Prefill workDate as ${workDate} for today’s board.`}
        onImported={refresh}
      />
    </section>
  );
}
