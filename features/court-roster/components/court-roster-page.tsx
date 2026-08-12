"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  MoreHorizontal,
  Plus,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import { PageHeader } from "@/shared/components/data/page-header";
import { DataToolbar } from "@/shared/components/data/data-toolbar";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { FilterChipGroup } from "@/shared/components/data/filter-chip-group";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DatePicker } from "@/shared/components/forms/date-picker";
import { apiFetch, getErrorMessage } from "@/lib/api/client";
import type { PublicUser } from "@/lib/auth/session";
import { istDateKey, istDisplayDate, parseIstDateInput } from "@/lib/utils/ist";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import type {
  CourtDutyOverrideLike,
  CourtRosterRow,
  CoverAdvocate,
} from "@/features/court-roster/lib/effective-cover";
import { AssignCoverDialog } from "@/features/court-roster/components/assign-cover-dialog";
import { EditPermanentDialog } from "@/features/court-roster/components/edit-permanent-dialog";
import { courtKey, type DefaultCourt } from "@/lib/hearings/court-key";
import { cn } from "@/lib/utils/cn";

type RosterResponse = {
  date: string;
  courts: CourtRosterRow[];
  activeOverrides: CourtDutyOverrideLike[];
  upcomingOverrides: CourtDutyOverrideLike[];
};

type ViewFilter = "all" | "temporary" | "uncovered";

function formatDay(ymd: string) {
  const d = parseIstDateInput(ymd);
  return d ? istDisplayDate(d) : ymd;
}

function AdvocateList({
  people,
  empty = "None",
}: {
  people: CoverAdvocate[];
  empty?: string;
}) {
  if (people.length === 0) {
    return <span className="text-muted-foreground">{empty}</span>;
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {people.map((p) => (
        <li key={p.unitId} className="flex min-w-0 items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-navy">
            {(p.displayName || "?").slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 truncate text-sm text-foreground">
            {p.displayName}
          </span>
        </li>
      ))}
    </ul>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-card px-3 py-3 sm:px-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-navy">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function CourtRosterPage({ user }: { user: PublicUser }) {
  const canEdit = user.permissions.includes("employees.edit");
  const today = istDateKey();
  const [date, setDate] = useState(today);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [view, setView] = useState<ViewFilter>("all");
  const [rows, setRows] = useState<CourtRosterRow[]>([]);
  const [activeOverrides, setActiveOverrides] = useState<CourtDutyOverrideLike[]>(
    []
  );
  const [upcomingOverrides, setUpcomingOverrides] = useState<
    CourtDutyOverrideLike[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [coverCourt, setCoverCourt] = useState<DefaultCourt | null>(null);
  const [coverOpen, setCoverOpen] = useState(false);
  const [permCourt, setPermCourt] = useState<DefaultCourt | null>(null);
  const [permFollowers, setPermFollowers] = useState<CoverAdvocate[]>([]);
  const [permOpen, setPermOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ date });
    if (debouncedSearch) params.set("q", debouncedSearch);
    const { ok, data } = await apiFetch<RosterResponse>(
      `/api/court-roster?${params}`
    );
    setLoading(false);
    if (!ok) {
      toast.error(
        getErrorMessage(data as Record<string, unknown>, "Failed to load roster")
      );
      return;
    }
    const body = data as RosterResponse;
    setRows(body.courts ?? []);
    setActiveOverrides(body.activeOverrides ?? []);
    setUpcomingOverrides(body.upcomingOverrides ?? []);
  }, [date, debouncedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!permOpen || !permCourt) return;
    const row = rows.find((r) => courtKey(r) === courtKey(permCourt));
    if (row) {
      setPermFollowers(row.permanent);
      return;
    }
    if (!debouncedSearch && !loading) {
      setPermFollowers([]);
      setPermOpen(false);
      setPermCourt(null);
    }
  }, [rows, permOpen, permCourt, debouncedSearch, loading]);

  const filteredRows = useMemo(() => {
    if (view === "temporary") return rows.filter((r) => Boolean(r.activeOverride));
    if (view === "uncovered") {
      return rows.filter((r) => r.covering.length === 0 && !r.activeOverride);
    }
    return rows;
  }, [rows, view]);

  const uncoveredCount = useMemo(
    () => rows.filter((r) => r.covering.length === 0 && !r.activeOverride).length,
    [rows]
  );

  function openCover(row?: CourtRosterRow) {
    if (row) {
      setCoverCourt({
        state: row.state,
        district: row.district,
        city: row.city,
        courtName: row.courtName,
      });
    } else {
      setCoverCourt(null);
    }
    setCoverOpen(true);
  }

  function openPermanent(row: CourtRosterRow) {
    setPermCourt({
      state: row.state,
      district: row.district,
      city: row.city,
      courtName: row.courtName,
    });
    setPermFollowers(row.permanent);
    setPermOpen(true);
  }

  async function endOverride(unitId: string) {
    setBusyId(unitId);
    const { ok, data } = await apiFetch<{
      truncated?: boolean;
      deleted?: boolean;
      toDate?: string;
    }>(`/api/court-roster/overrides/${unitId}`, {
      method: "DELETE",
    });
    setBusyId(null);
    if (!ok) {
      toast.error(
        getErrorMessage(data as Record<string, unknown>, "Failed to end cover")
      );
      return;
    }
    const body = data as { truncated?: boolean; toDate?: string };
    toast.success(
      body.truncated
        ? `Cover ended early (through ${formatDay(body.toDate!)})`
        : "Temporary cover removed"
    );
    void load();
  }

  const overrideCards = [...activeOverrides, ...upcomingOverrides];

  return (
    <section>
      <PageHeader
        title="Court roster"
        description="See who usually follows each court, and who is covering on any day."
        actions={
          canEdit ? (
            <Button type="button" onClick={() => openCover()}>
              <Plus className="size-4" />
              Assign cover
            </Button>
          ) : undefined
        }
      />

      <DataToolbar
        search={
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search court, city, or advocate…"
              className="w-full pl-9"
            />
          </div>
        }
        filters={
          <>
            <div className="w-full sm:w-52">
              <DatePicker value={date} onChange={setDate} />
            </div>
            {date !== today ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDate(today)}
              >
                Today
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <StatCard
          label="Courts on roster"
          value={loading ? "…" : rows.length}
          hint={debouncedSearch ? "Matching search" : "From defaults + covers"}
        />
        <StatCard
          label="Covering today"
          value={loading ? "…" : rows.filter((r) => r.covering.length > 0).length}
          hint={formatDay(date)}
        />
        <StatCard
          label="Temporary covers"
          value={loading ? "…" : activeOverrides.length}
          hint={
            upcomingOverrides.length
              ? `${upcomingOverrides.length} upcoming`
              : "Active on this date"
          }
        />
        <StatCard
          label="Uncovered"
          value={loading ? "…" : uncoveredCount}
          hint="No permanent or cover"
        />
      </div>

      {overrideCards.length > 0 ? (
        <section className="mb-4 rounded-xl border border-border/80 bg-muted/15 p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-navy" />
              <h2 className="text-sm font-semibold text-navy">Temporary covers</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Active and upcoming assignments
            </p>
          </div>
          <ul className="grid gap-2 md:grid-cols-2">
            {overrideCards.map((o) => {
              const active = o.fromDate <= date && o.toDate >= date;
              return (
                <li
                  key={o.unitId}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-card px-3 py-2.5"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-navy">
                        {o.advocateDisplayName ?? o.advocateName ?? o.advocateMobile}
                      </p>
                      <Badge
                        variant={active ? "warning" : "outline"}
                        className="font-normal"
                      >
                        {active ? "Active" : "Upcoming"}
                      </Badge>
                    </div>
                    <p className="truncate text-sm text-foreground">{o.courtName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDay(o.fromDate)} – {formatDay(o.toDate)}
                      {o.reason ? ` · ${o.reason}` : ""}
                    </p>
                  </div>
                  {canEdit ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      disabled={busyId === o.unitId}
                      onClick={() => void endOverride(o.unitId)}
                    >
                      {busyId === o.unitId ? "…" : "End"}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterChipGroup
          aria-label="Roster view"
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { id: "all", label: `All (${rows.length})` },
            { id: "temporary", label: `Temporary (${activeOverrides.length})` },
            { id: "uncovered", label: `Uncovered (${uncoveredCount})` },
          ]}
        />
        <p className="text-xs text-muted-foreground sm:text-sm">
          {loading
            ? "Loading…"
            : `Showing ${filteredRows.length} court${filteredRows.length === 1 ? "" : "s"} for ${formatDay(date)}`}
        </p>
      </div>

      {!loading && filteredRows.length === 0 ? (
        debouncedSearch || view !== "all" ? (
          <EmptyState
            title="No courts match"
            description="Try clearing search or switching the filter chips above."
            action={
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setView("all");
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="No courts on the roster yet"
            description="Add default courts on advocate employees, or assign a temporary cover to start the roster."
            action={
              canEdit ? (
                <Button type="button" onClick={() => openCover()}>
                  <Plus className="size-4" />
                  Assign cover
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <>
          {/* Mobile card list */}
          <div className="space-y-2 md:hidden">
            {loading && rows.length === 0
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={`sk-m-${i}`}
                    className="h-28 animate-pulse rounded-xl border border-border/80 bg-muted/60"
                  />
                ))
              : filteredRows.map((row) => (
                  <div
                    key={row.key}
                    className={cn(
                      "rounded-xl border border-border/80 bg-card p-3.5",
                      row.activeOverride && "border-amber-300/60 bg-amber-500/5",
                      row.covering.length === 0 && "bg-muted/20"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium text-balance text-navy">
                          {row.courtName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {row.city}, {row.district}
                        </p>
                        {row.activeOverride ? (
                          <Badge variant="warning" className="font-normal">
                            Temporary cover
                          </Badge>
                        ) : row.covering.length === 0 ? (
                          <Badge variant="muted" className="font-normal">
                            Uncovered
                          </Badge>
                        ) : null}
                      </div>
                      {canEdit ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 shrink-0"
                              aria-label={`Actions for ${row.courtName}`}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openPermanent(row)}>
                              Edit permanent followers
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openCover(row)}>
                              Assign temporary cover
                            </DropdownMenuItem>
                            {row.activeOverride ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  disabled={busyId === row.activeOverride.unitId}
                                  onClick={() =>
                                    void endOverride(row.activeOverride!.unitId)
                                  }
                                >
                                  End temporary cover
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border/60 pt-3">
                      <div className="min-w-0">
                        <p className="mb-1.5 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          <Users className="size-3" />
                          Permanent
                        </p>
                        <AdvocateList people={row.permanent} empty="No followers" />
                      </div>
                      <div className="min-w-0">
                        <p className="mb-1.5 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          <UserRound className="size-3" />
                          Covering
                        </p>
                        <AdvocateList people={row.covering} empty="Nobody assigned" />
                        {row.activeOverride?.reason ? (
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            {row.activeOverride.reason}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-border/80 bg-card md:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-48">Court</TableHead>
                <TableHead className="min-w-36">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="size-3.5" />
                    Permanent
                  </span>
                </TableHead>
                <TableHead className="min-w-40">
                  <span className="inline-flex items-center gap-1.5">
                    <UserRound className="size-3.5" />
                    Covering
                  </span>
                </TableHead>
                {canEdit ? (
                  <TableHead className="w-12 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && rows.length === 0
                ? Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={`sk-${i}`}>
                      <TableCell colSpan={canEdit ? 4 : 3}>
                        <div className="h-12 animate-pulse rounded-md bg-muted/60" />
                      </TableCell>
                    </TableRow>
                  ))
                : filteredRows.map((row) => (
                    <TableRow
                      key={row.key}
                      className={cn(
                        row.activeOverride && "bg-amber-500/5",
                        row.covering.length === 0 && "bg-muted/20"
                      )}
                    >
                      <TableCell className="align-top">
                        <div className="min-w-0 space-y-1">
                          <p className="font-medium text-balance text-navy">
                            {row.courtName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.city}, {row.district}
                          </p>
                          {row.activeOverride ? (
                            <Badge variant="warning" className="font-normal">
                              Temporary cover
                            </Badge>
                          ) : row.covering.length === 0 ? (
                            <Badge variant="muted" className="font-normal">
                              Uncovered
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <AdvocateList people={row.permanent} empty="No followers" />
                      </TableCell>
                      <TableCell className="align-top">
                        <AdvocateList people={row.covering} empty="Nobody assigned" />
                        {row.activeOverride?.reason ? (
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            {row.activeOverride.reason}
                          </p>
                        ) : null}
                      </TableCell>
                      {canEdit ? (
                        <TableCell className="align-top text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                aria-label={`Actions for ${row.courtName}`}
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openPermanent(row)}>
                                Edit permanent followers
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openCover(row)}>
                                Assign temporary cover
                              </DropdownMenuItem>
                              {row.activeOverride ? (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    disabled={busyId === row.activeOverride.unitId}
                                    onClick={() =>
                                      void endOverride(row.activeOverride!.unitId)
                                    }
                                  >
                                    End temporary cover
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
          </div>
        </>
      )}

      <AssignCoverDialog
        open={coverOpen}
        onOpenChange={setCoverOpen}
        court={coverCourt}
        defaultDate={date}
        onSaved={() => void load()}
      />
      <EditPermanentDialog
        open={permOpen}
        onOpenChange={setPermOpen}
        court={permCourt}
        permanent={permFollowers}
        onSaved={() => void load()}
      />
    </section>
  );
}
