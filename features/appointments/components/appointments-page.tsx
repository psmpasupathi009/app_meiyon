"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Briefcase,
  CalendarPlus,
  Check,
  Download,
  MoreHorizontal,
  Pencil,
  Phone,
  RefreshCw,
  Search,
  Video,
  Building2,
  X,
} from "lucide-react";
import { ImportDialog } from "@/shared/components/data/import-dialog";
import { PageHeader } from "@/shared/components/data/page-header";
import { PaginationBar } from "@/shared/components/data/pagination-bar";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { UnitIdBadge } from "@/shared/components/data/unit-id-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch, apiDownload, getErrorMessage } from "@/lib/api/client";
import type { PublicUser } from "@/lib/auth/session";
import type { AppointmentSummary } from "@/features/appointments/server/serialize";
import type { CaseSummary } from "@/features/cases/server/serialize";
import {
  AppointmentFormDialog,
  type AppointmentFormMode,
} from "@/features/appointments/components/appointment-form-dialog";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { istDateKey, istDayBounds } from "@/lib/utils/ist";
import { cn } from "@/lib/utils/cn";
import { canBookForAnyAdvocate } from "@/lib/appointments/booking-rules";
import { isClientOnlyUser } from "@/lib/auth/client-portal";
import { displayMobile } from "@/lib/auth/mobile";
import { PersonChip } from "@/shared/components/user/person-chip";
import { APPOINTMENT_MODE_OPTIONS } from "@/lib/validations/appointments.schema";
import { AdvocatePicker } from "@/features/employees/components/advocate-picker";

type ListResponse = {
  data: AppointmentSummary[];
  meta: { page: number; pageSize: number; total: number };
};

const STATUS_VARIANT: Record<
  string,
  "default" | "success" | "muted" | "warning"
> = {
  scheduled: "default",
  completed: "success",
  cancelled: "muted",
};

const MODE_META: Record<
  string,
  { label: string; icon: typeof Building2 }
> = {
  office: { label: "Office visit", icon: Building2 },
  call: { label: "Phone call", icon: Phone },
  video: { label: "Video call", icon: Video },
};

type Range = "all" | "today" | "upcoming";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatWeekday(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { weekday: "short" });
}

function formatDayMonth(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function modeLabel(mode: string | null | undefined): string {
  const key = mode ?? "office";
  return (
    MODE_META[key]?.label ??
    APPOINTMENT_MODE_OPTIONS.find((m) => m.value === key)?.label ??
    "Office visit"
  );
}

export function AppointmentsPage({ user }: { user: PublicUser }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const can = (action: string) =>
    user.permissions.includes(`appointments.${action}`);
  const canExport = user.permissions.includes("reports.view");
  const canOpenCase =
    (user.permissions.includes("appointments.edit") ||
      user.permissions.includes("cases.create")) &&
    user.permissions.includes("cases.view") &&
    !isClientOnlyUser(user.roles);
  const clientPortal = isClientOnlyUser(user.roles);
  const bookAny = canBookForAnyAdvocate(user.roles);
  /** Staff-style diary filters (advocate / unassigned) — not for clients. */
  const showOfficeFilters = bookAny && !clientPortal;

  const initialQ = searchParams.get("q") ?? "";
  const initialUnassigned = searchParams.get("unassigned") === "1";
  const initialStatus = searchParams.get("status");

  const [rows, setRows] = useState<AppointmentSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState(initialQ);
  const debouncedSearch = useDebouncedValue(search, 300);
  const [status, setStatus] = useState(
    initialStatus === "all" ||
      initialStatus === "scheduled" ||
      initialStatus === "completed" ||
      initialStatus === "cancelled"
      ? initialStatus
      : initialQ || initialUnassigned
        ? "all"
        : "scheduled"
  );
  const [range, setRange] = useState<Range>(initialQ ? "all" : "today");
  const [unassignedOnly, setUnassignedOnly] = useState(initialUnassigned);
  const [advocateFilter, setAdvocateFilter] = useState("all");
  const [advocateFilterLabel, setAdvocateFilterLabel] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<AppointmentSummary | null>(null);
  const [formMode, setFormMode] = useState<AppointmentFormMode>("create");
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (status !== "all") params.set("status", status);
    if (showOfficeFilters && advocateFilter !== "all") {
      params.set("advocateMobile", advocateFilter);
    } else if (showOfficeFilters && unassignedOnly) {
      params.set("unassigned", "1");
    }

    if (range === "today") {
      const { start, end } = istDayBounds(istDateKey());
      params.set("from", start.toISOString());
      params.set("to", end.toISOString());
    } else if (range === "upcoming") {
      params.set("from", new Date().toISOString());
    }

    const { ok, data } = await apiFetch<ListResponse>(
      `/api/appointments?${params.toString()}`
    );
    setLoading(false);
    if (!ok) {
      toast.error(
        getErrorMessage(
          data as Record<string, unknown>,
          "Failed to load appointments"
        )
      );
      return;
    }
    setRows((data as unknown as ListResponse).data ?? []);
    setTotal((data as unknown as ListResponse).meta?.total ?? 0);
  }, [
    page,
    debouncedSearch,
    status,
    range,
    bookAny,
    showOfficeFilters,
    advocateFilter,
    unassignedOnly,
  ]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const canCreate = user.permissions.includes("appointments.create");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    queueMicrotask(() => {
      if (params.get("new") === "1" && canCreate) {
        setEditing(null);
        setFormMode("create");
        setFormOpen(true);
      }
      if (params.get("hearing") === "today") {
        setRange("today");
      }
      if (params.get("unassigned") === "1") {
        setUnassignedOnly(true);
        setStatus(params.get("status") === "scheduled" ? "scheduled" : "all");
        setRange("today");
        setAdvocateFilter("all");
      }
      const q = params.get("q");
      if (q) {
        setSearch(q);
        setStatus("all");
        setRange("all");
        setUnassignedOnly(false);
      }
    });
  }, [canCreate]);

  function openCreate() {
    setEditing(null);
    setFormMode("create");
    setFormOpen(true);
  }

  function openEdit(a: AppointmentSummary) {
    setEditing(a);
    setFormMode("edit");
    setFormOpen(true);
  }

  function openReschedule(a: AppointmentSummary) {
    setEditing(a);
    setFormMode("reschedule");
    setFormOpen(true);
  }

  async function handleCancel(unitId: string) {
    const okConfirm = window.confirm(
      "Cancel this booking? The slot will open for others."
    );
    if (!okConfirm) return;

    setActionBusy(unitId);
    const { ok, data } = await apiFetch(`/api/appointments/${unitId}`, {
      method: "PATCH",
      json: { status: "cancelled" },
    });
    setActionBusy(null);
    if (!ok) {
      toast.error(
        getErrorMessage(data as Record<string, unknown>, "Failed to cancel")
      );
      return;
    }
    toast.success("Cancelled — that time is free for other bookings");
    void load();
  }

  async function handleComplete(unitId: string) {
    setActionBusy(unitId);
    const { ok, data } = await apiFetch(`/api/appointments/${unitId}`, {
      method: "PATCH",
      json: { status: "completed" },
    });
    setActionBusy(null);
    if (!ok) {
      toast.error(
        getErrorMessage(data as Record<string, unknown>, "Failed to update")
      );
      return;
    }
    toast.success("Marked completed");
    void load();
  }

  async function handleOpenCase(a: AppointmentSummary) {
    if (!a.clientUnitId) {
      toast.error("Link a client before opening a case");
      return;
    }
    const okConfirm = window.confirm(
      "Open an enquiry case from this consultation and link them?"
    );
    if (!okConfirm) return;

    setActionBusy(a.unitId);
    const { ok, data } = await apiFetch<{
      case: CaseSummary;
      appointment: AppointmentSummary;
    }>(`/api/appointments/${a.unitId}/convert-case`, { method: "POST" });
    setActionBusy(null);
    if (!ok) {
      toast.error(
        getErrorMessage(data as Record<string, unknown>, "Failed to open case")
      );
      return;
    }
    const body = data as unknown as { case: CaseSummary };
    toast.success("Case opened");
    void load();
    router.push(`/cases/${body.case.unitId}`);
  }

  const chips: { id: Range; label: string; hint: string }[] = [
    { id: "today", label: "Today", hint: "IST" },
    { id: "upcoming", label: "Upcoming", hint: "Next" },
    { id: "all", label: "All dates", hint: "Archive" },
  ];

  return (
    <section className="space-y-5">
      <PageHeader
        title="Appointments"
        description={
          clientPortal
            ? "Book an office visit or phone call with an advocate."
            : bookAny
              ? "Office diary — book when a client calls, hand off if an advocate is busy."
              : "Your consultation diary — book call-ins or move a slot if you cannot meet."
        }
        actions={
          <>
            {canExport ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 gap-2 px-4"
                onClick={async () => {
                  const params = new URLSearchParams({ type: "appointments" });
                  if (debouncedSearch) params.set("q", debouncedSearch);
                  if (status !== "all") params.set("status", status);
                  if (bookAny && advocateFilter !== "all") {
                    params.set("advocateMobile", advocateFilter);
                  } else if (bookAny && unassignedOnly) {
                    params.set("unassigned", "1");
                  }
                  if (range === "today") {
                    const { start, end } = istDayBounds(istDateKey());
                    params.set("from", start.toISOString());
                    params.set("to", end.toISOString());
                  } else if (range === "upcoming") {
                    params.set("from", new Date().toISOString());
                  }
                  const result = await apiDownload(
                    `/api/exports?${params.toString()}`,
                    "appointments.xlsx"
                  );
                  if (!result.ok) toast.error(result.error ?? "Export failed");
                }}
              >
                <Download className="size-4" />
                Export Excel
              </Button>
            ) : null}
            {can("create") && !clientPortal ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 gap-2 px-4"
                onClick={() => setImportOpen(true)}
              >
                Import CSV
              </Button>
            ) : null}
            {can("create") ? (
              <Button type="button" className="h-11 gap-2 px-4" onClick={openCreate}>
                <CalendarPlus className="size-4" />
                Book appointment
              </Button>
            ) : null}
          </>
        }
      />

      <div className="rounded-2xl border border-border/80 bg-card p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
            {chips.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setPage(1);
                  setRange(c.id);
                }}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 text-left transition-colors",
                  range === c.id
                    ? "bg-brand text-brand-foreground shadow-sm"
                    : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-navy"
                )}
                aria-pressed={range === c.id}
              >
                <span className="block text-sm font-semibold">{c.label}</span>
                <span
                  className={cn(
                    "block text-[11px]",
                    range === c.id ? "text-white/70" : "text-muted-foreground"
                  )}
                >
                  {c.hint}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
            <div className="relative min-w-0 w-full md:w-56">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
                placeholder="Search title, APT id, client…"
                className="h-11 pl-9"
              />
            </div>
            {showOfficeFilters ? (
              <button
                type="button"
                onClick={() => {
                  setPage(1);
                  setUnassignedOnly((v) => {
                    const next = !v;
                    if (next) {
                      setAdvocateFilter("all");
                      setAdvocateFilterLabel(null);
                    }
                    return next;
                  });
                }}
                className={cn(
                  "h-11 w-full shrink-0 rounded-xl px-3.5 text-sm font-semibold transition-colors md:w-auto",
                  unassignedOnly
                    ? "bg-amber-600 text-white shadow-sm"
                    : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-navy"
                )}
                aria-pressed={unassignedOnly}
              >
                Unassigned
              </button>
            ) : null}
            {showOfficeFilters ? (
              <AdvocatePicker
                className="h-11 w-full md:w-48"
                value={advocateFilter === "all" ? null : advocateFilter}
                selectedLabel={
                  advocateFilter === "all" ? null : advocateFilterLabel
                }
                onChange={(a) => {
                  setPage(1);
                  setUnassignedOnly(false);
                  if (!a) {
                    setAdvocateFilter("all");
                    setAdvocateFilterLabel(null);
                    return;
                  }
                  setAdvocateFilter(displayMobile(a.mobile));
                  setAdvocateFilterLabel(a.displayName || a.name || a.mobile);
                }}
                valueBy="mobile"
                placeholder="All advocates"
                clearable
                clearLabel="All advocates"
              />
            ) : null}
            <Select
              value={status}
              onValueChange={(v) => {
                setPage(1);
                setStatus(v);
              }}
            >
              <SelectTrigger className="h-11 w-full md:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-border/60 bg-muted/40"
            />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={
            range === "today" ? "No appointments today" : "No appointments"
          }
          description={
            clientPortal
              ? "Book an office visit or phone call when you need to meet the office."
              : "When a client calls, book a free slot for an advocate."
          }
          action={
            can("create") ? (
              <Button type="button" className="gap-2" onClick={openCreate}>
                <CalendarPlus className="size-4" />
                Book appointment
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ul className="space-y-3">
            {rows.map((a) => {
              const mode = MODE_META[a.mode ?? "office"] ?? MODE_META.office;
              const ModeIcon = mode.icon;
              const scheduled = a.status === "scheduled";
              const busy = actionBusy === a.unitId;

              return (
                <li
                  key={a.unitId}
                  className={cn(
                    "rounded-2xl border border-border/80 bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5",
                    a.status === "cancelled" && "opacity-75"
                  )}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:justify-between">
                    <div className="flex min-w-0 flex-1 gap-3 sm:gap-4">
                      <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-navy/5 px-2 py-3 text-center sm:w-20">
                        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {formatWeekday(a.scheduledAt)}
                        </span>
                        <span className="mt-0.5 text-lg font-semibold tabular-nums text-navy sm:text-xl">
                          {formatTime(a.scheduledAt)}
                        </span>
                        <span className="mt-1 text-[11px] text-muted-foreground">
                          {formatDayMonth(a.scheduledAt)} · {a.durationMin}m
                        </span>
                      </div>

                      <div className="min-w-0 flex-1 space-y-2.5">
                        <div className="flex flex-wrap items-start gap-2">
                          <h3 className="text-base font-semibold text-navy">
                            {a.title}
                          </h3>
                          <Badge variant={STATUS_VARIANT[a.status] ?? "outline"}>
                            {a.status}
                          </Badge>
                          <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
                            <ModeIcon className="size-3" />
                            {modeLabel(a.mode)}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                          <div className="min-w-0">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              Advocate
                            </p>
                            {a.advocateName || a.advocateMobile ? (
                              <PersonChip
                                name={a.advocateName}
                                photoUrl={a.advocatePhotoUrl}
                                mobile={a.advocateMobile}
                                unitId={a.advocateUnitId}
                                className="mt-0.5"
                              />
                            ) : (
                              <span className="text-amber-700 dark:text-amber-400">Unassigned</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              Client
                            </p>
                            <p className="mt-0.5 font-medium text-foreground">
                              {a.clientName ?? a.clientUnitId ?? "Walk-in / TBD"}
                            </p>
                          </div>
                          {a.caseUnitId ? (
                            <div className="min-w-0">
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                Case
                              </p>
                              <Link
                                href={`/cases/${a.caseUnitId}`}
                                className="mt-0.5 inline-block font-medium text-navy underline-offset-2 hover:underline"
                              >
                                {a.caseUnitId}
                              </Link>
                            </div>
                          ) : null}
                          <div className="hidden sm:block">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              Ref
                            </p>
                            <div className="mt-0.5">
                              <UnitIdBadge value={a.unitId} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex w-full shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:flex-col lg:items-stretch xl:flex-row xl:items-center">
                      {canOpenCase && a.clientUnitId && !a.caseUnitId ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 w-full gap-2 sm:flex-1 lg:w-auto lg:flex-none"
                          disabled={busy}
                          onClick={() => void handleOpenCase(a)}
                        >
                          <Briefcase className="size-3.5" />
                          Open case
                        </Button>
                      ) : null}
                      {can("edit") && scheduled ? (
                        <>
                          <Button
                            type="button"
                            className="h-10 w-full gap-2 sm:flex-1 lg:w-auto lg:flex-none"
                            disabled={busy}
                            onClick={() => openReschedule(a)}
                          >
                            <RefreshCw className="size-3.5" />
                            Reschedule
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 w-full gap-2 sm:flex-1 lg:w-auto lg:flex-none"
                            disabled={busy}
                            onClick={() => handleComplete(a.unitId)}
                          >
                            <Check className="size-3.5" />
                            Done
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-10 w-10 shrink-0"
                                disabled={busy}
                                aria-label="More actions"
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => openEdit(a)}>
                                <Pencil className="size-4" />
                                Edit details
                              </DropdownMenuItem>
                              {can("cancel") ? (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => handleCancel(a.unitId)}
                                  >
                                    <X className="size-4" />
                                    Cancel booking
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </>
                      ) : clientPortal && can("cancel") && scheduled ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 w-full gap-2 sm:flex-1 lg:w-auto lg:flex-none"
                          disabled={busy}
                          onClick={() => handleCancel(a.unitId)}
                        >
                          <X className="size-3.5" />
                          Cancel booking
                        </Button>
                      ) : can("edit") ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 gap-2"
                          onClick={() => openEdit(a)}
                        >
                          <Pencil className="size-3.5" />
                          Edit details
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <PaginationBar
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
          />
        </>
      )}

      <AppointmentFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditing(null);
            setFormMode("create");
          }
        }}
        appointment={editing}
        formMode={formMode}
        user={user}
        onSaved={load}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import appointments"
        endpoint="/api/appointments/import"
        sampleHref="/samples/appointments.sample.csv"
        columnsHint="Required: title, scheduledAt (ISO), advocateMobile. Optional: clientUnitId, caseUnitId, durationMin, mode. Slot clash checks are skipped on bulk import."
        onImported={load}
      />
    </section>
  );
}
