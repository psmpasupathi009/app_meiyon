"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  CalendarClock,
  CalendarDays,
  CircleDollarSign,
  Scale,
  Users,
} from "lucide-react";
import type { PublicUser } from "@/lib/auth/session";
import { isModuleEnabled } from "@meiyon/config";
import { apiFetch } from "@/lib/api/client";
import { PersonChip } from "@/shared/components/user/person-chip";
import { personDisplayName, personFirstName } from "@/shared/lib/person";
import { summarizeBusyToday } from "@/features/availability/lib/busy-labels";
import { WelcomeHero } from "@/features/home/components/welcome-hero";
import { WelcomeStatsSection } from "@/features/home/components/welcome-stats-section";
import { WelcomeTimelineSection } from "@/features/home/components/welcome-timeline-section";
import { WelcomeOfficePresence } from "@/features/home/components/welcome-office-presence";
import { WelcomePersonalAttendance } from "@/features/home/components/welcome-personal-attendance";
import {
  type AttentionItem,
  type DashboardSummary,
  type DayKindFilter,
  type MetricItem,
  type OfficePresenceData,
  type TimelineRow,
  formatHearingTime,
  rupee,
  tenDigits,
} from "@/features/home/components/welcome-helpers";

type WelcomeOverviewProps = {
  user: PublicUser | null;
  /** Preloaded on the server to avoid a client round-trip on first paint. */
  initialSummary?: DashboardSummary | null;
};

export function WelcomeOverview({
  user,
  initialSummary = null,
}: WelcomeOverviewProps) {
  const [summary, setSummary] = useState<DashboardSummary | null>(
    initialSummary
  );
  const [loading, setLoading] = useState(!initialSummary);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [advocateFilter, setAdvocateFilter] = useState<string>("all");
  const [dayFilter, setDayFilter] = useState<DayKindFilter>("all");
  const perms = useMemo(
    () => new Set(user?.permissions ?? []),
    [user?.permissions]
  );

  const can = (perm: string) => perms.has(perm);
  const moduleOn = (m: Parameters<typeof isModuleEnabled>[0]) =>
    isModuleEnabled(m);
  const isAdmin =
    summary?.isOfficeAdmin ||
    user?.roles.includes("admin") ||
    user?.roles.includes("sub_admin");

  const myMobile = tenDigits(user?.mobile);

  useEffect(() => {
    if (!user || initialSummary) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      const res = await apiFetch<{ summary: DashboardSummary } & { error?: string; message?: string }>(
        "/api/dashboard/summary"
      );
      if (!cancelled) {
        if (res.ok && res.data && typeof res.data === "object" && "summary" in res.data) {
          setSummary((res.data as { summary: DashboardSummary }).summary);
        } else {
          setSummary(null);
          const payload = res.data as { error?: string; message?: string } | null;
          setLoadError(
            (typeof payload?.error === "string" && payload.error) ||
              (typeof payload?.message === "string" && payload.message) ||
              "Couldn’t load dashboard. Try again."
          );
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, initialSummary]);

  const firstName = personFirstName({ name: user?.name, fallback: "" });
  const todayHearings = summary?.cases?.todayHearings ?? [];

  const officePresence = useMemo((): OfficePresenceData => {
    const roster =
      summary?.adminBoard?.staff ?? summary?.adminBoard?.advocates ?? [];
    const counts = summary?.adminBoard?.counts;

    const statusRank = {
      absent: 0,
      on_leave: 1,
      out: 2,
      in: 3,
      unknown: 4,
    } as const;

    const rows: OfficePresenceData["rows"] = roster.map((a) => {
      const status =
        a.status ??
        (a.checkedOut ? "out" : a.checkedIn ? "in" : "absent");
      const busyLabel =
        status === "on_leave"
          ? null
          : summarizeBusyToday(a.busyToday ?? []);
      return {
        key: a.unitId,
        name: personDisplayName({
          name: a.name,
          mobile: a.mobile,
          unitId: a.unitId,
        }),
        mobile: a.mobile,
        photoUrl: a.photoUrl,
        showAttendance: true,
        status,
        busyLabel,
      };
    });

    rows.sort((a, b) => {
      const rank = statusRank[a.status] - statusRank[b.status];
      if (rank !== 0) return rank;
      return a.name.localeCompare(b.name);
    });

    const presenceStats = counts
      ? {
          absent: counts.absent,
          present: counts.present,
          out: counts.out,
          onLeave: counts.onLeave,
        }
      : {
          absent: rows.filter((a) => a.status === "absent").length,
          present: rows.filter((a) => a.status === "in").length,
          out: rows.filter((a) => a.status === "out").length,
          onLeave: rows.filter((a) => a.status === "on_leave").length,
        };

    const busyPeople = rows.filter((a) => a.busyLabel);

    return { rows, presenceStats, busyPeople };
  }, [summary?.adminBoard]);

  const timelineRows = useMemo(() => {
    const rows: TimelineRow[] = [];

    if (moduleOn("appointments") && can("appointments.view")) {
      for (const a of summary?.appointments?.todayList ?? []) {
        rows.push({
          key: `appt-${a.unitId}`,
          kind: "appointment",
          sortAt: new Date(a.scheduledAt).getTime(),
          timeLabel: a.timeLabel,
          title: a.title,
          href: `/appointments?q=${encodeURIComponent(a.unitId)}`,
          client: a.clientName ?? "No client",
          advocate:
            a.advocateName || a.advocateMobile ? (
              <PersonChip
                name={a.advocateName}
                photoUrl={a.advocatePhotoUrl}
                mobile={a.advocateMobile}
                unitId={a.advocateUnitId}
              />
            ) : (
              <span className="text-amber-700 dark:text-amber-400">Unassigned</span>
            ),
          advocateLabel:
            a.advocateName?.trim() ||
            (a.advocateMobile ? `+91 ${a.advocateMobile}` : "Unassigned"),
          detail: [
            a.mode,
            `${a.durationMin} min`,
            a.location,
          ]
            .filter(Boolean)
            .join(" · "),
          refId: a.unitId,
          advocateMobile: a.advocateMobile,
        });
      }
    }

    if (moduleOn("cases") && can("cases.view")) {
      for (const h of todayHearings) {
        rows.push({
          key: `hearing-${h.caseUnitId}`,
          kind: "hearing",
          sortAt: h.nextHearingAt
            ? new Date(h.nextHearingAt).getTime()
            : Number.MAX_SAFE_INTEGER,
          timeLabel: formatHearingTime(h.nextHearingAt),
          title: h.clientName,
          href: `/cases/${h.caseUnitId}`,
          client: h.clientName,
          advocate: h.advocateName ?? h.advocateMobile ?? "—",
          advocateLabel: h.advocateName ?? h.advocateMobile ?? "—",
          detail:
            [h.courtName, h.district, h.caseType].filter(Boolean).join(" · ") ||
            "Court not set",
          refId: h.caseUnitId,
          advocateMobile: h.advocateMobile ?? null,
        });
      }
    }

    rows.sort((a, b) => a.sortAt - b.sortAt);

    return rows.filter((row) => {
      if (dayFilter === "appointments" && row.kind !== "appointment") {
        return false;
      }
      if (dayFilter === "hearings" && row.kind !== "hearing") return false;

      if (!isAdmin && myMobile) {
        const adv = tenDigits(row.advocateMobile);
        if (adv && adv !== myMobile) return false;
        if (!adv && row.kind === "appointment") return false;
      }

      if (advocateFilter === "all") return true;
      if (advocateFilter === "unassigned") return !row.advocateMobile;
      return tenDigits(row.advocateMobile) === tenDigits(advocateFilter);
    });
    // can/moduleOn are stable enough for this render; summary drives data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    summary?.appointments?.todayList,
    todayHearings,
    dayFilter,
    advocateFilter,
    isAdmin,
    myMobile,
    user?.permissions,
  ]);

  const attention: AttentionItem[] =
    summary?.attention && summary.attention.length > 0
      ? summary.attention
      : [];

  // Fallback if older summary payloads omit attention
  if (attention.length === 0) {
    if (
      moduleOn("cases") &&
      can("cases.view") &&
      (summary?.cases?.missingCourtNumber ?? 0) > 0
    ) {
      attention.push({
        label: "Cases missing court number",
        value: String(summary!.cases!.missingCourtNumber),
        href: "/cases?missingCourtNumber=1",
        cta: "Open",
        tone: "warning",
      });
    }
    if (
      moduleOn("accounts") &&
      can("accounts.view") &&
      (summary?.accounts?.pendingCount ?? 0) > 0
    ) {
      attention.push({
        label: "Pending payments",
        value: `${summary!.accounts!.pendingCount} · ${rupee(summary!.accounts!.pendingAmount)}`,
        href: "/accounts",
        cta: "Review",
        tone: "danger",
      });
    }
    if (
      moduleOn("hrms") &&
      can("hrms.approve_leave") &&
      (summary?.hrms?.pendingLeaveApprovals ?? 0) > 0
    ) {
      attention.push({
        label: "Leave approvals waiting",
        value: String(summary!.hrms!.pendingLeaveApprovals),
        href: "/hrms?section=leave",
        cta: "Approve",
        tone: "info",
      });
    }
    if (
      moduleOn("appointments") &&
      can("appointments.view") &&
      (summary?.appointments?.todayList.filter((a) => !a.advocateMobile).length ??
        0) > 0
    ) {
      attention.push({
        label: "Appointments without advocate",
        value: String(
          summary!.appointments!.todayList.filter((a) => !a.advocateMobile)
            .length
        ),
        href: "/appointments?hearing=today",
        cta: "Assign",
        tone: "warning",
      });
    }
  }

  const metrics: MetricItem[] = [];

  if (moduleOn("cases") && can("cases.view") && summary?.cases) {
    metrics.push({
      label: "My cases",
      value: String(summary.cases.open),
      hint: `${summary.cases.pending} pre-filing · ${summary.cases.listed} active`,
      href: "/cases",
      icon: Scale,
    });
    metrics.push({
      label: "Hearings this week",
      value: String(summary.cases.weekHearings),
      hint: `${todayHearings.length} today`,
      href: "/diary",
      icon: CalendarDays,
    });
  }
  if (
    moduleOn("appointments") &&
    can("appointments.view") &&
    summary?.appointments
  ) {
    metrics.push({
      label: "Appointments today",
      value: String(summary.appointments.today),
      hint: `${summary.appointments.week} this week`,
      href: "/appointments?hearing=today",
      icon: CalendarClock,
    });
  }
  if (moduleOn("clients") && can("clients.view") && summary?.clients) {
    metrics.push({
      label: "Clients",
      value: String(summary.clients.total),
      href: "/clients",
      icon: Briefcase,
    });
  }
  if (moduleOn("employees") && can("employees.view") && summary?.employees) {
    metrics.push({
      label: isAdmin ? "Advocates" : "Active staff",
      value: String(
        isAdmin
          ? (summary.employees.advocates ?? summary.employees.active)
          : summary.employees.active
      ),
      hint: isAdmin
        ? `${summary.employees.active} staff active`
        : undefined,
      href: "/employees",
      icon: Users,
    });
  }
  if (moduleOn("accounts") && can("accounts.view") && summary?.accounts) {
    metrics.push({
      label: "Paid this month",
      value: rupee(summary.accounts.paidThisMonth),
      hint:
        summary.accounts.pendingCount > 0
          ? `${summary.accounts.pendingCount} pending`
          : undefined,
      href: "/accounts",
      icon: CircleDollarSign,
    });
  }

  const canSeeTimeline =
    (moduleOn("appointments") && can("appointments.view")) ||
    (moduleOn("cases") && can("cases.view"));

  return (
    <section className="space-y-6">
      <WelcomeHero
        firstName={firstName}
        isAdmin={Boolean(isAdmin)}
        canBookAppointment={
          moduleOn("appointments") && can("appointments.create")
        }
        canCreateClient={moduleOn("clients") && can("clients.create")}
        canRegisterCase={moduleOn("cases") && can("cases.create")}
        canAddPayment={moduleOn("accounts") && can("accounts.create")}
      />

      {loadError ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-navy"
        >
          <p className="font-medium">Dashboard couldn’t load</p>
          <p className="mt-1 text-muted-foreground">{loadError}</p>
          <button
            type="button"
            className="mt-2 text-sm font-medium text-brand underline-offset-2 hover:underline"
            onClick={() => {
              setLoading(true);
              setLoadError(null);
              void (async () => {
                const res = await apiFetch<{ summary: DashboardSummary }>(
                  "/api/dashboard/summary"
                );
                if (
                  res.ok &&
                  res.data &&
                  typeof res.data === "object" &&
                  "summary" in res.data
                ) {
                  setSummary(
                    (res.data as { summary: DashboardSummary }).summary
                  );
                } else {
                  const payload = res.data as {
                    error?: string;
                    message?: string;
                  } | null;
                  setLoadError(
                    (typeof payload?.error === "string" && payload.error) ||
                      "Couldn’t load dashboard. Try again."
                  );
                }
                setLoading(false);
              })();
            }}
          >
            Retry
          </button>
        </div>
      ) : null}

      <WelcomeStatsSection
        loading={loading}
        metrics={metrics}
        attention={attention}
      />

      {canSeeTimeline ? (
        <WelcomeTimelineSection
          isAdmin={Boolean(isAdmin)}
          loading={loading}
          timelineRows={timelineRows}
          dayFilter={dayFilter}
          advocateFilter={advocateFilter}
          canViewAppointments={
            moduleOn("appointments") && can("appointments.view")
          }
          canViewCases={moduleOn("cases") && can("cases.view")}
          canCreateAppointment={can("appointments.create")}
          onDayFilterChange={setDayFilter}
          onClearAdvocate={() => setAdvocateFilter("all")}
        />
      ) : null}

      {isAdmin && !loading ? (
        <WelcomeOfficePresence
          officePresence={officePresence}
          officeHoliday={summary?.adminBoard?.officeHoliday}
        />
      ) : null}

      {moduleOn("hrms") && can("hrms.own_attendance") && summary?.hrms ? (
        <WelcomePersonalAttendance hrms={summary.hrms} />
      ) : null}
    </section>
  );
}
