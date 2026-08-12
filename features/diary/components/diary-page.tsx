"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarClock,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  MessageSquareWarning,
  Phone,
  Printer,
  Scale,
  Search,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, getErrorMessage } from "@/lib/api/client";
import { PageHeader } from "@/shared/components/data/page-header";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { FilterChipGroup } from "@/shared/components/data/filter-chip-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/shared/components/forms/date-picker";
import { AdvocatePicker } from "@/features/employees/components/advocate-picker";
import { AdjournHearingDialog } from "@/features/cases/components/adjourn-hearing-dialog";
import {
  DiaryHearingCard,
  type DiaryItem,
} from "@/features/diary/components/diary-hearing-card";
import type { AppointmentSummary } from "@/features/appointments/server/serialize";
import type { OfficeTaskSummary } from "@/features/tasks/server/serialize";
import type { PublicUser } from "@/lib/auth/session";
import { displayMobile } from "@/lib/auth/mobile";
import { canBookForAnyAdvocate } from "@/lib/appointments/booking-rules";
import {
  istAddCalendarDays,
  istDateKey,
  istDisplayDate,
  istDisplayWeekday,
} from "@/lib/utils/ist";
import { OFFICE_TASK_KIND_OPTIONS } from "@/lib/validations/tasks.schema";
import { cn } from "@/lib/utils/cn";

type DiaryResponse = {
  date: string;
  items: DiaryItem[];
  appointments?: AppointmentSummary[];
  tasks?: OfficeTaskSummary[];
  meta: { truncated: boolean; limit: number };
};

type TomorrowNotifyItem = {
  hearingUnitId: string;
  hearingDate: string;
  purpose: string | null;
  smsSentAt: string | null;
  caseUnitId: string;
  caseNumber: string | null;
  courtName: string | null;
  clientUnitId: string | null;
  clientName: string | null;
  clientMobile: string | null;
  smsConsent: boolean | null;
};

type TomorrowNotifyResponse = {
  date: string;
  items: TomorrowNotifyItem[];
  summary: {
    total: number;
    smsPending: number;
    smsSent: number;
    withMobile: number;
  };
};

type BoardKind = "all" | "hearings" | "appointments" | "tasks";

function courtLabel(name: string | null) {
  return name?.trim() || "Court TBD";
}

function kindLabel(kind: string) {
  return OFFICE_TASK_KIND_OPTIONS.find((k) => k.value === kind)?.label ?? kind;
}

function appointmentTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function isDateKey(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export function DiaryPage({ user }: { user: PublicUser }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canEdit = user.permissions.includes("cases.edit");
  const canAppointments = user.permissions.includes("appointments.view");
  const canTasks = user.permissions.includes("tasks.view");
  const bookAny = canBookForAnyAdvocate(user.roles);
  const todayKey = istDateKey();

  const dateFromUrl = searchParams.get("date");
  const [date, setDateState] = useState(() =>
    isDateKey(dateFromUrl) ? dateFromUrl : todayKey
  );

  function setDate(next: string | ((prev: string) => string)) {
    setDateState((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      const params = new URLSearchParams(searchParams.toString());
      if (value === todayKey) params.delete("date");
      else params.set("date", value);
      const qs = params.toString();
      router.replace(qs ? `/diary?${qs}` : "/diary", { scroll: false });
      return value;
    });
  }

  useEffect(() => {
    if (isDateKey(dateFromUrl) && dateFromUrl !== date) {
      setDateState(dateFromUrl);
    }
    // Sync when home attention / external links change ?date=
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to URL
  }, [dateFromUrl]);

  const [items, setItems] = useState<DiaryItem[]>([]);
  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);
  const [tasks, setTasks] = useState<OfficeTaskSummary[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<BoardKind>("all");
  const [advocateFilter, setAdvocateFilter] = useState<string | null>(
    bookAny ? null : displayMobile(user.mobile)
  );
  const [advocateFilterLabel, setAdvocateFilterLabel] = useState<string | null>(
    bookAny ? null : user.name ?? displayMobile(user.mobile)
  );
  const [adjourning, setAdjourning] = useState<string | null>(null);
  const tomorrowKey = istAddCalendarDays(todayKey, 1);
  const [tomorrowNotify, setTomorrowNotify] =
    useState<TomorrowNotifyResponse | null>(null);
  const [tomorrowLoading, setTomorrowLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [smsSending, setSmsSending] = useState(false);

  async function reloadTomorrowNotify() {
    const res = await apiFetch<TomorrowNotifyResponse>(
      "/api/diary/tomorrow-notify"
    );
    if (res.ok) setTomorrowNotify(res.data);
  }

  const applyDiary = useCallback((data: DiaryResponse) => {
    setItems(data.items ?? []);
    setAppointments(data.appointments ?? []);
    setTasks(data.tasks ?? []);
    setTruncated(Boolean(data.meta?.truncated));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const params = new URLSearchParams({ date });
      if (advocateFilter) params.set("advocateMobile", advocateFilter);
      const res = await apiFetch<DiaryResponse>(
        `/api/diary?${params.toString()}`
      );
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        toast.error(
          getErrorMessage(
            res.data as Record<string, unknown>,
            "Failed to load day board"
          )
        );
        setItems([]);
        setAppointments([]);
        setTasks([]);
        setTruncated(false);
        return;
      }
      applyDiary(res.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [date, advocateFilter, applyDiary]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setTomorrowLoading(true);
      const res = await apiFetch<TomorrowNotifyResponse>(
        "/api/diary/tomorrow-notify"
      );
      if (cancelled) return;
      setTomorrowLoading(false);
      if (!res.ok) {
        setTomorrowNotify(null);
        return;
      }
      setTomorrowNotify(res.data);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pendingClients = useMemo(() => {
    if (!tomorrowNotify) return [];
    return tomorrowNotify.items.filter((i) => !i.smsSentAt);
  }, [tomorrowNotify]);

  const reload = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ date });
    if (advocateFilter) params.set("advocateMobile", advocateFilter);
    const res = await apiFetch<DiaryResponse>(
      `/api/diary?${params.toString()}`
    );
    setLoading(false);
    if (!res.ok) {
      toast.error(
        getErrorMessage(
          res.data as Record<string, unknown>,
          "Failed to load day board"
        )
      );
      return;
    }
    applyDiary(res.data);
  }, [date, advocateFilter, applyDiary]);

  async function sendTomorrowSms() {
    if (!canEdit || smsSending) return;
    setSmsSending(true);
    const res = await apiFetch<{
      date: string;
      total: number;
      sent: number;
      failed: number;
      skipped: number;
    }>("/api/diary/send-hearing-sms", { method: "POST" });
    setSmsSending(false);
    if (!res.ok) {
      toast.error(
        getErrorMessage(
          res.data as Record<string, unknown>,
          "Failed to send hearing SMS"
        )
      );
      return;
    }
    const { sent, failed, skipped, total } = res.data;
    toast.success(
      `Hearing SMS: ${sent} sent, ${failed} failed, ${skipped} skipped (${total} due)`
    );
    await reloadTomorrowNotify();
    if (date === tomorrowKey) await reload();
  }

  const q = search.trim().toLowerCase();

  const filteredHearings = useMemo(() => {
    if (!q) return items;
    return items.filter((item) => {
      const hay = [
        item.caseNumber,
        item.caseUnitId,
        item.clientName,
        item.courtName,
        item.purpose,
        item.stage,
        item.advocateName,
        item.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, q]);

  const filteredAppointments = useMemo(() => {
    if (!canAppointments) return [];
    if (!q) return appointments;
    return appointments.filter((a) => {
      const hay = [
        a.title,
        a.clientName,
        a.advocateName,
        a.location,
        a.notes,
        a.caseUnitId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [appointments, canAppointments, q]);

  const filteredTasks = useMemo(() => {
    if (!canTasks) return [];
    if (!q) return tasks;
    return tasks.filter((t) => {
      const hay = [
        t.title,
        t.kind,
        t.assigneeName,
        t.caseNumber,
        t.caseUnitId,
        t.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [tasks, canTasks, q]);

  const groups = useMemo(() => {
    const map = new Map<string, DiaryItem[]>();
    for (const item of filteredHearings) {
      const key = courtLabel(item.courtName);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) =>
      a.toLocaleLowerCase("en").localeCompare(b.toLocaleLowerCase("en"))
    );
  }, [filteredHearings]);

  const courtCount = useMemo(
    () => new Set(items.map((i) => courtLabel(i.courtName))).size,
    [items]
  );
  const smsPending = useMemo(
    () => items.filter((i) => !i.smsSentAt).length,
    [items]
  );

  const showHearings = kind === "all" || kind === "hearings";
  const showAppointments =
    (kind === "all" || kind === "appointments") && canAppointments;
  const showTasks = (kind === "all" || kind === "tasks") && canTasks;

  const totalVisible =
    (showHearings ? filteredHearings.length : 0) +
    (showAppointments ? filteredAppointments.length : 0) +
    (showTasks ? filteredTasks.length : 0);

  const printDisabled =
    loading ||
    (items.length === 0 && appointments.length === 0 && tasks.length === 0);

  const isToday = date === todayKey;
  const dateObj = new Date(`${date}T12:00:00+05:30`);
  const weekday = istDisplayWeekday(dateObj);
  const displayDate = istDisplayDate(dateObj);

  const kindChips: { id: BoardKind; label: string }[] = [
    { id: "all", label: "All" },
    { id: "hearings", label: `Hearings (${items.length})` },
    ...(canAppointments
      ? [
          {
            id: "appointments" as const,
            label: `Appointments (${appointments.length})`,
          },
        ]
      : []),
    ...(canTasks
      ? [{ id: "tasks" as const, label: `Tasks (${tasks.length})` }]
      : []),
  ];

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <PageHeader
          title="Day board"
          description="Hearings, appointments, and open tasks for the selected IST day."
          actions={
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2"
              onClick={() => window.print()}
              disabled={printDisabled}
            >
              <Printer className="size-4" />
              Print day
            </Button>
          }
        />
      </div>

      <div className="hidden print:block print:mb-4">
        <h1 className="text-xl font-semibold text-navy">Day board</h1>
        <p className="text-sm text-muted-foreground">
          {weekday}, {displayDate} · Hearings, appointments & tasks
        </p>
      </div>


      {!tomorrowLoading && tomorrowNotify && tomorrowNotify.summary.total > 0 ? (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-3 shadow-sm print:hidden sm:p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <MessageSquareWarning className="size-4 shrink-0 text-amber-800 dark:text-amber-200" />
                <h2 className="text-sm font-semibold text-navy dark:text-amber-50">
                  Tomorrow — inform clients
                </h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {tomorrowNotify.summary.total} hearing
                {tomorrowNotify.summary.total === 1 ? "" : "s"} on{" "}
                {istDisplayDate(
                  new Date(`${tomorrowNotify.date}T12:00:00+05:30`)
                )}
                {" · "}
                {tomorrowNotify.summary.smsPending} SMS not yet sent
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
              {canEdit ? (
                <Button
                  type="button"
                  className="h-10 w-full gap-2 sm:w-auto"
                  disabled={smsSending || tomorrowNotify.summary.smsPending === 0}
                  onClick={() => void sendTomorrowSms()}
                >
                  <Send className="size-4" />
                  {smsSending ? "Sending…" : "Send tomorrow SMS now"}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full sm:w-auto"
                onClick={() => setDate(tomorrowKey)}
              >
                Open tomorrow’s list
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-10 w-full sm:w-auto"
                onClick={() => setPreviewOpen((v) => !v)}
              >
                {previewOpen ? "Hide SMS list" : "Preview tomorrow SMS list"}
              </Button>
            </div>
          </div>

          {pendingClients.length > 0 ? (
            <ul className="mt-3 space-y-2 border-t border-amber-200/70 pt-3 dark:border-amber-900/40">
              {pendingClients.slice(0, previewOpen ? 40 : 5).map((item) => (
                <li
                  key={item.hearingUnitId}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-navy dark:text-amber-50">
                      {item.clientName || "Client"}
                      {item.caseNumber || item.caseUnitId
                        ? ` · ${item.caseNumber || item.caseUnitId}`
                        : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.courtName || "Court TBD"}
                      {item.purpose ? ` · ${item.purpose}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="warning">SMS pending</Badge>
                    {item.clientMobile ? (
                      <a
                        href={`tel:+91${item.clientMobile}`}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-navy"
                      >
                        <Phone className="size-3.5" />
                        {item.clientMobile}
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        No mobile
                      </span>
                    )}
                  </div>
                </li>
              ))}
              {!previewOpen && pendingClients.length > 5 ? (
                <li className="text-xs text-muted-foreground">
                  +{pendingClients.length - 5} more — preview full SMS list
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="mt-3 border-t border-amber-200/70 pt-3 text-sm text-muted-foreground dark:border-amber-900/40">
              All tomorrow’s clients already have SMS marked sent.
            </p>
          )}
        </div>
      ) : null}

      <div className="rounded-2xl border border-border/80 bg-card p-3 shadow-sm print:hidden sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11 shrink-0"
              aria-label="Previous day"
              onClick={() => setDate((d) => istAddCalendarDays(d, -1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <button
              type="button"
              onClick={() => setDate(todayKey)}
              className={cn(
                "shrink-0 rounded-xl px-3.5 py-2 text-left transition-colors",
                isToday
                  ? "bg-brand text-brand-foreground shadow-sm"
                  : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-navy"
              )}
            >
              <span className="block text-sm font-semibold">Today</span>
              <span
                className={cn(
                  "block text-[11px]",
                  isToday ? "text-white/70" : "text-muted-foreground"
                )}
              >
                IST
              </span>
            </button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11 shrink-0"
              aria-label="Next day"
              onClick={() => setDate((d) => istAddCalendarDays(d, 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
            <div className="min-w-0 flex-1 sm:max-w-xs">
              <DatePicker value={date} onChange={setDate} />
            </div>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative min-w-0 w-full md:w-56">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search case, client, court…"
                className="h-11 pl-9"
              />
            </div>
            {bookAny ? (
              <AdvocatePicker
                className="h-11 w-full md:w-52"
                value={advocateFilter}
                selectedLabel={advocateFilterLabel}
                onChange={(a) => {
                  if (!a) {
                    setAdvocateFilter(null);
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
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border/60 pt-3">
          <FilterChipGroup
            value={kind}
            onChange={setKind}
            options={kindChips}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-navy">{weekday}</span>
            <span> · {displayDate}</span>
          </p>
          {!loading ? (
            <>
              <span>
                {items.length} hearing{items.length === 1 ? "" : "s"}
              </span>
              {canAppointments ? (
                <span>
                  {appointments.length} appointment
                  {appointments.length === 1 ? "" : "s"}
                </span>
              ) : null}
              {canTasks ? (
                <span>
                  {tasks.length} task{tasks.length === 1 ? "" : "s"}
                </span>
              ) : null}
              <span>
                {courtCount} court{courtCount === 1 ? "" : "s"}
              </span>
              <span>{smsPending} SMS pending</span>
              {q && totalVisible !== items.length + appointments.length + tasks.length ? (
                <span>
                  Showing {totalVisible} match
                  {totalVisible === 1 ? "" : "es"}
                </span>
              ) : null}
            </>
          ) : (
            <span>Loading…</span>
          )}
        </div>
      </div>

      {truncated ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 print:hidden">
          Showing the first 100 hearings for this day. Narrow by advocate or
          open Cases for the full register.
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3 print:hidden">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-border/60 bg-muted/40"
            />
          ))}
        </div>
      ) : totalVisible === 0 ? (
        <EmptyState
          title={q ? "No matches" : "Nothing on this day"}
          description={
            q
              ? "Try a different search or clear filters."
              : "Pick another date, or add a hearing, appointment, or task."
          }
          action={
            !q ? (
              <Button asChild type="button" variant="outline">
                <Link href="/cases">Open cases</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-8">
          {showHearings && filteredHearings.length > 0 ? (
            <div className="space-y-6">
              <div className="flex items-center gap-2 print:hidden">
                <Scale className="size-4 text-navy" />
                <h2 className="text-base font-semibold text-navy">Hearings</h2>
              </div>
              {groups.map(([court, groupItems]) => (
                <section key={court} className="space-y-3">
                  <div className="flex items-baseline justify-between gap-2 border-b border-border/70 pb-2">
                    <h3 className="text-sm font-semibold tracking-wide text-navy uppercase">
                      {court}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {groupItems.length} matter
                      {groupItems.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <ul className="space-y-3">
                    {groupItems.map((item) => (
                      <DiaryHearingCard
                        key={item.hearingUnitId}
                        item={item}
                        canEdit={canEdit}
                        onAdjourn={() => setAdjourning(item.hearingUnitId)}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : null}

          {showAppointments && filteredAppointments.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b border-border/70 pb-2">
                <CalendarClock className="size-4 text-navy" />
                <h2 className="text-base font-semibold text-navy">
                  Appointments
                </h2>
                <span className="text-xs text-muted-foreground">
                  {filteredAppointments.length}
                </span>
              </div>
              <ul className="space-y-3">
                {filteredAppointments.map((a) => (
                  <li key={a.unitId}>
                    <Card>
                      <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-medium text-navy">{a.title}</p>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {appointmentTime(a.scheduledAt)}
                            {a.clientName ? ` · ${a.clientName}` : ""}
                            {a.advocateName ? ` · ${a.advocateName}` : ""}
                            {a.mode ? ` · ${a.mode}` : ""}
                          </p>
                        </div>
                        <Button asChild type="button" size="sm" variant="outline">
                          <Link href={`/appointments?q=${encodeURIComponent(a.unitId)}`}>
                            Open
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {showTasks && filteredTasks.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b border-border/70 pb-2">
                <CheckSquare className="size-4 text-navy" />
                <h2 className="text-base font-semibold text-navy">Tasks</h2>
                <span className="text-xs text-muted-foreground">
                  {filteredTasks.length} open
                </span>
              </div>
              <ul className="space-y-3">
                {filteredTasks.map((t) => (
                  <li key={t.unitId}>
                    <Card>
                      <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-medium text-navy">{t.title}</p>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {kindLabel(t.kind)}
                            {t.assigneeName ? ` · ${t.assigneeName}` : ""}
                            {t.caseNumber || t.caseUnitId
                              ? ` · ${t.caseNumber || t.caseUnitId}`
                              : ""}
                          </p>
                        </div>
                        <Button asChild type="button" size="sm" variant="outline">
                          <Link href="/tasks">Work allotment</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}

      {adjourning ? (
        <AdjournHearingDialog
          open={Boolean(adjourning)}
          onOpenChange={(open) => {
            if (!open) setAdjourning(null);
          }}
          hearingUnitId={adjourning}
          onSaved={() => {
            void reload();
          }}
        />
      ) : null}
    </div>
  );
}
