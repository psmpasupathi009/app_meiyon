"use client";

import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Briefcase,
  Calendar,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  FileText,
  Gavel,
  History,
  IndianRupee,
  Mail,
  Plane,
  Search,
  Shield,
  Sparkles,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/shared/components/data/page-header";
import { FilterChipGroup } from "@/shared/components/data/filter-chip-group";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/shared/components/forms/date-picker";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { Skeleton } from "@/shared/components/feedback/skeleton";
import { UserAvatar } from "@/shared/components/user/user-avatar";
import { apiFetch, getErrorMessage } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import {
  formatIstTime,
  istAddCalendarDays,
  istDateKey,
  istDisplayDate,
} from "@/lib/utils/ist";
import { formatRelativeWhen } from "@/features/notifications/lib/notification-meta";
import {
  ENTITY_OPTIONS,
  actionLabel,
  actionTone,
  entityHref,
  entityIconClass,
  entityLabel,
  type ActionTone,
} from "@/features/activity/lib/action-labels";

type ActivityRow = {
  id: string;
  action: string;
  entity: string;
  entityUnitId: string | null;
  actorUnitId: string | null;
  actorName: string | null;
  meta: unknown;
  createdAt: string;
};

type ActivityListResponse = {
  data: ActivityRow[];
  meta: { limit: number; nextCursor: string | null; hasMore: boolean };
};

type RangePreset = "all" | "today" | "7d" | "30d";

const ENTITY_ICONS: Record<string, LucideIcon> = {
  Client: Users,
  Case: Briefcase,
  User: UserRound,
  Document: FileText,
  CashPayment: IndianRupee,
  Appointment: Calendar,
  OfficeTask: ClipboardList,
  DakEntry: Mail,
  LeaveRequest: Plane,
  OfficeHoliday: CalendarDays,
  Hearing: Gavel,
};

const TONE_DOT: Record<ActionTone, string> = {
  create: "bg-emerald-500 ring-emerald-500/20",
  update: "bg-sky-500 ring-sky-500/20",
  delete: "bg-destructive ring-destructive/20",
  security: "bg-amber-500 ring-amber-500/20",
  neutral: "bg-muted-foreground/50 ring-muted-foreground/10",
};

const TONE_LABEL: Record<ActionTone, string> = {
  create: "Created",
  update: "Updated",
  delete: "Removed",
  security: "Security",
  neutral: "Logged",
};

const ENTITY_CHIPS: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  ...ENTITY_OPTIONS.map((e) => ({ id: e, label: entityLabel(e) })),
];

const RANGE_CHIPS: { id: RangePreset; label: string }[] = [
  { id: "all", label: "Any time" },
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
];

function actorName(row: ActivityRow) {
  if (!row.actorUnitId) return "System";
  return row.actorName?.trim() || row.actorUnitId;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function formatValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string") return v || "—";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function prettyField(field: string) {
  return field
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

function dayHeading(iso: string, todayKey: string, yesterdayKey: string) {
  const key = istDateKey(new Date(iso));
  if (key === todayKey) return "Today";
  if (key === yesterdayKey) return "Yesterday";
  return istDisplayDate(new Date(iso));
}

function changeCount(meta: unknown): number {
  if (!isRecord(meta)) return 0;
  if (isRecord(meta.changes)) return Object.keys(meta.changes).length;
  if (isRecord(meta.after) && !meta.before) return Object.keys(meta.after).length;
  return 0;
}

function DiffRow({
  label,
  from,
  to,
}: {
  label: string;
  from?: unknown;
  to?: unknown;
}) {
  return (
    <li className="grid gap-1.5 rounded-lg bg-background/80 px-3 py-2.5 ring-1 ring-border/50 sm:grid-cols-[7.5rem_1fr] sm:items-start">
      <span className="pt-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {prettyField(label)}
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-[13px] leading-snug">
        <span className="max-w-full truncate rounded-md bg-muted px-2 py-0.5 text-muted-foreground line-through decoration-muted-foreground/35">
          {formatValue(from)}
        </span>
        <span className="text-muted-foreground/70" aria-hidden>
          →
        </span>
        <span className="max-w-full truncate rounded-md bg-navy/8 px-2 py-0.5 font-medium text-navy dark:bg-navy/15">
          {formatValue(to)}
        </span>
      </span>
    </li>
  );
}

function ChangesPanel({ meta }: { meta: unknown }) {
  if (!isRecord(meta)) {
    return (
      <p className="text-sm text-muted-foreground">No field detail recorded.</p>
    );
  }

  const changes = isRecord(meta.changes) ? meta.changes : null;
  const before = isRecord(meta.before) ? meta.before : null;
  const after = isRecord(meta.after) ? meta.after : null;

  if (changes && Object.keys(changes).length > 0) {
    return (
      <ul className="space-y-1.5">
        {Object.entries(changes).map(([field, raw]) => {
          const pair = isRecord(raw) ? raw : null;
          return (
            <DiffRow
              key={field}
              label={field}
              from={pair?.from}
              to={pair?.to}
            />
          );
        })}
      </ul>
    );
  }

  if (after && !before) {
    const entries = Object.entries(after).slice(0, 12);
    return (
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-navy">
          <Sparkles className="size-3.5 text-gold" />
          New record
        </p>
        <dl className="grid gap-1.5 sm:grid-cols-2">
          {entries.map(([k, v]) => (
            <div
              key={k}
              className="rounded-lg bg-background/80 px-3 py-2 ring-1 ring-border/50"
            >
              <dt className="text-[11px] font-medium text-muted-foreground">
                {prettyField(k)}
              </dt>
              <dd className="mt-0.5 truncate text-[13px] text-foreground">
                {formatValue(v)}
              </dd>
            </div>
          ))}
        </dl>
        {Object.keys(after).length > 12 ? (
          <p className="text-[11px] text-muted-foreground">
            +{Object.keys(after).length - 12} more fields
          </p>
        ) : null}
      </div>
    );
  }

  if (before && !after) {
    return (
      <div className="rounded-lg bg-destructive/5 px-3 py-2.5 ring-1 ring-destructive/15">
        <p className="text-xs font-semibold text-destructive">Record removed</p>
        <pre className="mt-2 max-h-40 overflow-auto text-[11px] text-muted-foreground">
          {JSON.stringify(before, null, 2)}
        </pre>
      </div>
    );
  }

  if (before || after) {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-background/80 px-3 py-2.5 ring-1 ring-border/50">
          <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Before
          </p>
          <pre className="max-h-36 overflow-auto text-[11px] text-muted-foreground">
            {JSON.stringify(before ?? {}, null, 2)}
          </pre>
        </div>
        <div className="rounded-lg bg-background/80 px-3 py-2.5 ring-1 ring-border/50">
          <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-navy uppercase">
            After
          </p>
          <pre className="max-h-36 overflow-auto text-[11px] text-muted-foreground">
            {JSON.stringify(after ?? {}, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  const rest = { ...meta };
  delete rest.before;
  delete rest.after;
  delete rest.changes;
  if (Object.keys(rest).length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No field detail recorded.</p>
    );
  }
  return (
    <pre className="max-h-40 overflow-auto rounded-lg bg-background/80 p-3 text-[11px] text-muted-foreground ring-1 ring-border/50">
      {JSON.stringify(rest, null, 2)}
    </pre>
  );
}

function ActivityItem({
  row,
  open,
  isLast,
  onToggle,
}: {
  row: ActivityRow;
  open: boolean;
  isLast: boolean;
  onToggle: () => void;
}) {
  const href = entityHref(row.entity, row.entityUnitId, row.meta);
  const Icon = ENTITY_ICONS[row.entity] ?? History;
  const tone = actionTone(row.action);
  const whenAbs = `${istDisplayDate(new Date(row.createdAt))} · ${formatIstTime(new Date(row.createdAt))}`;
  const diffs = changeCount(row.meta);
  const name = actorName(row);

  return (
    <li className="relative flex gap-3 sm:gap-4">
      {/* Continuous rail */}
      <div className="flex w-10 shrink-0 flex-col items-center sm:w-11">
        <span
            className={cn(
            "relative z-1 mt-3.5 flex size-10 items-center justify-center rounded-xl transition-transform duration-200",
            entityIconClass(row.entity),
            open && "scale-[1.03] shadow-sm"
          )}
          aria-hidden
        >
          {createElement(Icon, { className: "size-4", strokeWidth: 1.75 })}
          <span
            className={cn(
              "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-[3px] ring-card",
              TONE_DOT[tone]
            )}
          />
        </span>
        {!isLast ? (
          <span
            className="mt-1 w-px flex-1 bg-linear-to-b from-border to-border/20"
            aria-hidden
          />
        ) : null}
      </div>

      <div className={cn("min-w-0 flex-1 pb-4", isLast && "pb-2")}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className={cn(
            "group w-full rounded-xl border text-left transition-all duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            open
              ? "border-border/80 bg-muted/30 shadow-sm"
              : "border-transparent bg-transparent hover:border-border/60 hover:bg-muted/20"
          )}
        >
          <div className="flex items-start gap-3 px-3 py-3 sm:px-3.5">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight text-navy">
                  {actionLabel(row.action)}
                </p>
                <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
                  <time
                    dateTime={row.createdAt}
                    title={whenAbs}
                    className="text-[11px] tabular-nums text-muted-foreground"
                  >
                    {formatRelativeWhen(row.createdAt)}
                  </time>
                  <ChevronDown
                    className={cn(
                      "size-4 text-muted-foreground transition-transform duration-200",
                      open && "rotate-180"
                    )}
                  />
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Badge
                  variant="outline"
                  className="h-5 border-border/70 px-1.5 text-[10px] font-medium normal-case"
                >
                  {entityLabel(row.entity)}
                </Badge>
                {row.entityUnitId ? (
                  <span className="rounded-md bg-muted/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {row.entityUnitId}
                  </span>
                ) : null}
                <span className="text-[10px] font-medium tracking-wide text-muted-foreground/80 uppercase">
                  {TONE_LABEL[tone]}
                </span>
                {diffs > 0 ? (
                  <span className="text-[11px] text-muted-foreground">
                    · {diffs} field{diffs === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-2 pt-0.5">
                {row.actorUnitId ? (
                  <UserAvatar
                    name={name}
                    size="sm"
                    className="size-5 text-[9px] ring-0"
                  />
                ) : (
                  <span className="flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Shield className="size-2.5" />
                  </span>
                )}
                <p className="truncate text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/80">{name}</span>
                  <span className="text-border"> · </span>
                  <span className="tabular-nums">
                    {formatIstTime(new Date(row.createdAt))}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </button>

        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
            open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="overflow-hidden">
            <div className="mt-1.5 space-y-3 rounded-xl border border-border/60 bg-muted/15 px-3.5 py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <time
                  dateTime={row.createdAt}
                  className="text-[11px] text-muted-foreground"
                >
                  {whenAbs}
                </time>
                {href ? (
                  <Link
                    href={href}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand underline-offset-2 hover:underline"
                  >
                    Open record
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                ) : null}
              </div>
              <ChangesPanel meta={row.meta} />
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

function DayGroup({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="mb-2">
      <div className="sticky top-0 z-10 -mx-1 mb-3 flex items-center gap-2 bg-background/90 px-1 py-2 backdrop-blur-md">
        <span className="h-px flex-1 bg-border/70" aria-hidden />
        <h2 className="flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1 text-[11px] font-semibold tracking-wide text-navy uppercase shadow-sm">
          {title}
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground normal-case">
            {count}
          </span>
        </h2>
        <span className="h-px flex-1 bg-border/70" aria-hidden />
      </div>
      <ul className="pl-0.5">{children}</ul>
    </section>
  );
}

export function ActivityPage() {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [preset, setPreset] = useState<RangePreset>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [entity, setEntity] = useState<string>("all");
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");

  const todayKey = istDateKey();
  const yesterdayKey = istAddCalendarDays(todayKey, -1);

  const filtersActive = Boolean(
    from || to || (entity && entity !== "all") || q || preset !== "all"
  );

  const applyPreset = useCallback((next: RangePreset) => {
    setPreset(next);
    if (next === "all") {
      setFrom("");
      setTo("");
      return;
    }
    const end = istDateKey();
    setTo(end);
    if (next === "today") setFrom(end);
    else if (next === "7d") setFrom(istAddCalendarDays(end, -6));
    else setFrom(istAddCalendarDays(end, -29));
  }, []);

  const buildQuery = useCallback(
    (cursor?: string | null) => {
      const params = new URLSearchParams();
      params.set("limit", "40");
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (entity && entity !== "all") params.set("entity", entity);
      if (q) params.set("q", q);
      if (cursor) params.set("cursor", cursor);
      return params.toString();
    },
    [from, to, entity, q]
  );

  const load = useCallback(
    async (mode: "replace" | "append", cursor?: string | null) => {
      if (mode === "replace") {
        setLoading(true);
        setError(null);
        setLoadMoreError(null);
        setExpanded({});
      } else {
        setLoadingMore(true);
        setLoadMoreError(null);
      }
      const { ok, data } = await apiFetch(
        `/api/activity?${buildQuery(mode === "append" ? cursor : null)}`
      );
      if (mode === "replace") setLoading(false);
      else setLoadingMore(false);

      if (!ok) {
        const message = getErrorMessage(
          data as Record<string, unknown>,
          "Failed to load activity"
        );
        if (mode === "append") setLoadMoreError(message);
        else setError(message);
        return;
      }
      const body = data as ActivityListResponse;
      setRows((prev) =>
        mode === "append" ? [...prev, ...body.data] : body.data
      );
      setNextCursor(body.meta.nextCursor);
      setHasMore(body.meta.hasMore);
    },
    [buildQuery]
  );

  useEffect(() => {
    void load("replace");
  }, [load]);

  function toggle(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function clearFilters() {
    setPreset("all");
    setFrom("");
    setTo("");
    setEntity("all");
    setQ("");
    setQDraft("");
  }

  const grouped = useMemo(() => {
    const map = new Map<string, ActivityRow[]>();
    for (const row of rows) {
      const key = istDateKey(new Date(row.createdAt));
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [rows]);

  return (
    <section className="w-full">
      <PageHeader
        title="Activity"
        description="A precise audit trail of office work — who changed what, and when."
        actions={
          <div className="flex items-center gap-2">
            {filtersActive ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={clearFilters}
              >
                <X className="size-3.5" />
                Reset
              </Button>
            ) : null}
            {rows.length > 0 ? (
              <Badge
                variant="muted"
                className="h-6 px-2.5 tabular-nums normal-case"
              >
                {rows.length}
                {hasMore ? "+" : ""} logged
              </Badge>
            ) : null}
          </div>
        }
      />

      {/* Filter dock */}
      <div className="mb-6 space-y-3 rounded-2xl border border-border/70 bg-card/80 p-3 shadow-[0_1px_0_rgb(0_0_0/0.02)] sm:p-4">
        <div className="space-y-2">
          <p className="px-0.5 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            When
          </p>
          <FilterChipGroup
            aria-label="Date range"
            size="sm"
            value={preset}
            onChange={applyPreset}
            options={RANGE_CHIPS}
          />
        </div>

        <div className="space-y-2">
          <p className="px-0.5 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            What
          </p>
          <FilterChipGroup
            aria-label="Filter by entity"
            size="sm"
            value={entity}
            onChange={setEntity}
            options={ENTITY_CHIPS}
          />
        </div>

        <div className="grid gap-2 border-t border-border/50 pt-3 sm:grid-cols-[1fr_1fr_minmax(0,1.5fr)]">
          <DatePicker
            value={from}
            onChange={(v) => {
              setFrom(v);
              setPreset("all");
            }}
          />
          <DatePicker
            value={to}
            onChange={(v) => {
              setTo(v);
              setPreset("all");
            }}
          />
          <form
            className="relative"
            onSubmit={(e) => {
              e.preventDefault();
              setQ(qDraft.trim());
            }}
          >
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
              placeholder="Search action, id, person…"
              className="border-border/70 bg-background/60 pl-8 pr-16"
            />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="absolute top-1/2 right-1 h-7 -translate-y-1/2 px-2 text-xs"
            >
              Go
            </Button>
          </form>
        </div>
      </div>

      {/* Feed */}
      <div className="min-h-48">
        {loading ? (
          <div className="space-y-5" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="size-10 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2 pt-1">
                  <Skeleton className="h-4 w-3/5 rounded-md" />
                  <Skeleton className="h-3 w-2/5 rounded-md" />
                  <Skeleton className="h-3 w-1/4 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        ) : error && rows.length === 0 ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-5 py-12 text-center text-sm text-destructive">
            {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50">
            <EmptyState
              compact
              title={filtersActive ? "Nothing matches" : "Quiet so far"}
              description={
                filtersActive
                  ? "Widen the range or clear filters to see more of the trail."
                  : "Creates, edits, imports, and security actions will stream in here."
              }
              action={
                filtersActive ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </Button>
                ) : null
              }
            />
          </div>
        ) : (
          <div>
            {grouped.map(([dayKey, dayRows]) => (
              <DayGroup
                key={dayKey}
                title={dayHeading(dayRows[0]!.createdAt, todayKey, yesterdayKey)}
                count={dayRows.length}
              >
                {dayRows.map((row, idx) => (
                  <ActivityItem
                    key={row.id}
                    row={row}
                    open={Boolean(expanded[row.id])}
                    isLast={idx === dayRows.length - 1}
                    onToggle={() => toggle(row.id)}
                  />
                ))}
              </DayGroup>
            ))}
          </div>
        )}

        {hasMore ? (
          <div className="mt-2 space-y-2 pb-2">
            {loadMoreError ? (
              <p className="text-center text-xs text-destructive">
                {loadMoreError}
              </p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl"
              disabled={loadingMore}
              onClick={() => void load("append", nextCursor)}
            >
              {loadingMore ? "Loading…" : "Load earlier activity"}
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
