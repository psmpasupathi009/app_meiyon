import type { User } from "@prisma/client";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@meiyon/db";
import {
  istDateKey,
  istDayBounds,
  formatIstTime,
  istAddCalendarDays,
} from "@/lib/utils/ist";
import { displayMobile } from "@/lib/auth/mobile";
import { personDisplayName } from "@/shared/lib/person";
import { userPhotoUrl } from "@/lib/auth/user-photo";
import {
  OPEN_CASE_STATUSES,
  PRE_NUMBER_STATUSES,
} from "@meiyon/config";
import { effectiveHearingAdvocate } from "@/lib/hearings/court-key";

function toTen(mobile: string): string {
  const d = mobile.replace(/\D/g, "");
  return d.length === 12 && d.startsWith("91") ? d.slice(2) : d.slice(-10);
}

type AttentionTone = "warning" | "danger" | "info";

type AttentionItem = {
  label: string;
  value: string;
  href: string;
  cta: string;
  tone: AttentionTone;
};

function rupee(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export async function buildDashboardSummary(
  user: Pick<User, "id" | "officeId" | "roles" | "unitId"> & {
    /** When set (e.g. from PublicUser), skips per-check RBAC DB hits. */
    permissions?: string[];
  }
): Promise<Record<string, unknown>> {
  const permSet = user.permissions
    ? new Set(user.permissions)
    : null;
  const can = async (module: string, action: string) => {
    if (permSet) return permSet.has(`${module}.${action}`);
    return hasPermission(user, module, action);
  };

  const isOfficeAdmin =
    user.roles.includes("admin") || user.roles.includes("sub_admin");

  const todayKey = istDateKey();
  const tomorrowKey = istAddCalendarDays(todayKey, 1);
  const { start: todayStart, end: todayEnd } = istDayBounds(todayKey);
  const { start: tomorrowStart, end: tomorrowEnd } = istDayBounds(tomorrowKey);
  const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  // IST calendar month start (not server-local midnight)
  const [yStr, mStr] = todayKey.split("-");
  const monthKey = `${yStr}-${mStr}-01`;
  const { start: startOfMonth } = istDayBounds(monthKey);

  const summary: Record<string, unknown> = {
    todayKey,
    isOfficeAdmin,
  };

  const [
    canCases,
    canClients,
    canEmployees,
    canAccounts,
    canAppointments,
    canTasks,
    canHrmsView,
    canApproveLeave,
    canManageAttendance,
  ] = await Promise.all([
    can("cases", "view"),
    can("clients", "view"),
    can("employees", "view"),
    can("accounts", "view"),
    can("appointments", "view"),
    can("tasks", "view"),
    can("hrms", "view"),
    can("hrms", "approve_leave"),
    can("hrms", "manage_attendance"),
  ]);

  type CasesResult = {
    missingCourtNumber: number;
    battaDue: number;
    filingDefect: number;
    tomorrowHearings: number;
    payload: Record<string, unknown>;
  };

  const casesPromise: Promise<CasesResult | null> = canCases
    ? (async () => {
        const [
          total,
          preNumber,
          active,
          open,
          weekHearings,
          missingCourtNumberCount,
          battaDueCount,
          filingDefectCount,
          tomorrowHearingCount,
          todayCases,
        ] = await Promise.all([
          prisma.case.count(),
          prisma.case.count({
            where: { status: { in: [...PRE_NUMBER_STATUSES] } },
          }),
          prisma.case.count({ where: { status: "active" } }),
          prisma.case.count({
            where: { status: { in: [...OPEN_CASE_STATUSES] } },
          }),
          prisma.case.count({
            where: {
              nextHearingAt: { gte: todayStart, lt: weekEnd },
              status: { in: [...OPEN_CASE_STATUSES] },
            },
          }),
          prisma.case.count({
            where: {
              OR: [{ caseNumber: null }, { caseNumber: "" }],
              status: { in: [...PRE_NUMBER_STATUSES] },
            },
          }),
          prisma.case.count({
            where: {
              battaDue: true,
              status: { in: [...OPEN_CASE_STATUSES] },
            },
          }),
          prisma.case.count({ where: { status: "filing_defect" } }),
          prisma.hearing.count({
            where: {
              hearingDate: { gte: tomorrowStart, lte: tomorrowEnd },
              isAdjourned: false,
            },
          }),
          prisma.hearing.findMany({
            where: {
              hearingDate: { gte: todayStart, lte: todayEnd },
              isAdjourned: false,
            },
            orderBy: { hearingDate: "asc" },
            take: 40,
            select: {
              unitId: true,
              caseUnitId: true,
              hearingDate: true,
            },
          }),
        ]);

        const caseUnitIds = [...new Set(todayCases.map((h) => h.caseUnitId))];
        const casesForToday = caseUnitIds.length
          ? await prisma.case.findMany({
              where: {
                unitId: { in: caseUnitIds },
                status: { in: [...OPEN_CASE_STATUSES] },
              },
              select: {
                unitId: true,
                caseNumber: true,
                courtName: true,
                district: true,
                status: true,
                nextHearingAt: true,
                clientUnitId: true,
                clientId: true,
                primaryAdvocateMobile: true,
                caseType: true,
              },
            })
          : [];
        const caseByUnit = new Map(casesForToday.map((c) => [c.unitId, c]));
        const todayHearingRows = todayCases.filter((h) =>
          caseByUnit.has(h.caseUnitId)
        );

        const clientIds = [
          ...new Set(casesForToday.map((c) => c.clientId)),
        ];
        const advocateMobiles = [
          ...new Set(
            todayHearingRows
              .map((h) => {
                const cse = caseByUnit.get(h.caseUnitId);
                return effectiveHearingAdvocate({
                  primaryAdvocateMobile: cse?.primaryAdvocateMobile,
                });
              })
              .filter(Boolean) as string[]
          ),
        ];

        const [clients, advocates] = await Promise.all([
          clientIds.length
            ? prisma.client.findMany({
                where: { id: { in: clientIds } },
                select: { id: true, unitId: true, name: true, mobile: true },
              })
            : Promise.resolve([]),
          advocateMobiles.length
            ? prisma.user.findMany({
                where: {
                  OR: advocateMobiles.flatMap((m) => {
                    const ten = toTen(m);
                    return [
                      { mobile: m },
                      { mobile: ten },
                      { mobile: `91${ten}` },
                    ];
                  }),
                },
                select: { mobile: true, name: true },
              })
            : Promise.resolve([]),
        ]);

        const clientById = new Map(clients.map((c) => [c.id, c]));
        const advName = new Map<string, string>();
        for (const a of advocates) {
          const ten = toTen(a.mobile);
          if (a.name) {
            advName.set(a.mobile, a.name);
            advName.set(ten, a.name);
            advName.set(`91${ten}`, a.name);
          }
        }

        const todayHearings = todayHearingRows.slice(0, 20).map((h) => {
          const c = caseByUnit.get(h.caseUnitId)!;
          const client = clientById.get(c.clientId);
          const mob = effectiveHearingAdvocate({
            primaryAdvocateMobile: c.primaryAdvocateMobile,
          });
          return {
            caseUnitId: c.unitId,
            caseNumber: c.caseNumber,
            caseType: c.caseType,
            courtName: c.courtName,
            district: c.district,
            status: c.status,
            nextHearingAt: h.hearingDate.toISOString(),
            clientName: client?.name ?? "—",
            clientUnitId: client?.unitId ?? c.clientUnitId,
            clientMobile: client?.mobile ? displayMobile(client.mobile) : null,
            advocateMobile: mob ? displayMobile(mob) : null,
            advocateName: mob
              ? advName.get(mob) ?? advName.get(toTen(mob)) ?? null
              : null,
          };
        });

        return {
          missingCourtNumber: missingCourtNumberCount,
          battaDue: battaDueCount,
          filingDefect: filingDefectCount,
          tomorrowHearings: tomorrowHearingCount,
          payload: {
            total,
            pending: preNumber,
            listed: active,
            open,
            active,
            weekHearings,
            missingCourtNumber: missingCourtNumberCount,
            battaDue: battaDueCount,
            filingDefect: filingDefectCount,
            tomorrowHearings: tomorrowHearingCount,
            todayHearings,
          },
        };
      })()
    : Promise.resolve(null);

  const clientsPromise = canClients
    ? prisma.client.count().then((total) => ({ total }))
    : Promise.resolve(null);

  const employeesPromise = canEmployees
    ? Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({
          where: { isActive: true, roles: { has: "advocate" } },
        }),
      ]).then(([total, active, advocates]) => ({ total, active, advocates }))
    : Promise.resolve(null);

  const accountsPromise = canAccounts
    ? Promise.all([
        prisma.cashPayment.aggregate({
          where: { status: "pending" },
          _sum: { amount: true },
        }),
        prisma.cashPayment.aggregate({
          where: { status: "paid", paidOn: { gte: startOfMonth } },
          _sum: { amount: true },
        }),
        prisma.cashPayment.count({ where: { status: "pending" } }),
      ]).then(([pendingAgg, paidThisMonthAgg, pendingCount]) => ({
        pendingPayments: pendingCount,
        pendingAmount: pendingAgg._sum.amount ?? 0,
        payload: {
          pendingAmount: pendingAgg._sum.amount ?? 0,
          pendingCount,
          paidThisMonth: paidThisMonthAgg._sum.amount ?? 0,
        },
      }))
    : Promise.resolve(null);

  const appointmentsPromise = canAppointments
    ? (async () => {
        const [todayCount, weekCount, todayRows, weekRows] = await Promise.all([
          prisma.appointment.count({
            where: {
              status: "scheduled",
              scheduledAt: { gte: todayStart, lte: todayEnd },
            },
          }),
          prisma.appointment.count({
            where: {
              status: "scheduled",
              scheduledAt: { gte: todayStart, lt: weekEnd },
            },
          }),
          prisma.appointment.findMany({
            where: {
              status: "scheduled",
              scheduledAt: { gte: todayStart, lte: todayEnd },
            },
            orderBy: { scheduledAt: "asc" },
            take: 40,
          }),
          prisma.appointment.findMany({
            where: {
              status: "scheduled",
              scheduledAt: { gte: todayStart, lt: weekEnd },
            },
            orderBy: { scheduledAt: "asc" },
            take: 80,
          }),
        ]);

        const unassignedAppointments = todayRows.filter(
          (a) => !a.advocateMobile
        ).length;

        const allForNames = [...todayRows, ...weekRows];
        const clientUnitIds = [
          ...new Set(
            allForNames.map((a) => a.clientUnitId).filter(Boolean) as string[]
          ),
        ];
        const apptAdvMobiles = [
          ...new Set(
            allForNames.map((a) => a.advocateMobile).filter(Boolean) as string[]
          ),
        ];

        const [apptClients, apptAdvocates] = await Promise.all([
          clientUnitIds.length
            ? prisma.client.findMany({
                where: { unitId: { in: clientUnitIds } },
                select: { unitId: true, name: true, mobile: true },
              })
            : Promise.resolve([]),
          apptAdvMobiles.length
            ? prisma.user.findMany({
                where: {
                  OR: apptAdvMobiles.flatMap((m) => {
                    const ten = toTen(m);
                    return [
                      { mobile: m },
                      { mobile: ten },
                      { mobile: `91${ten}` },
                    ];
                  }),
                },
                select: {
                  mobile: true,
                  name: true,
                  unitId: true,
                  photoKey: true,
                },
              })
            : Promise.resolve([]),
        ]);

        const clientByUnit = new Map(apptClients.map((c) => [c.unitId, c]));
        const advByMobile = new Map<
          string,
          { name: string; unitId: string; photoUrl?: string }
        >();
        for (const a of apptAdvocates) {
          const ten = toTen(a.mobile);
          const info = {
            name: personDisplayName({
              name: a.name,
              mobile: a.mobile,
              unitId: a.unitId,
            }),
            unitId: a.unitId,
            photoUrl: userPhotoUrl(a.unitId, Boolean(a.photoKey)),
          };
          advByMobile.set(a.mobile, info);
          advByMobile.set(ten, info);
          advByMobile.set(`91${ten}`, info);
        }

        function mapAppt(
          a: (typeof todayRows)[number]
        ): Record<string, unknown> {
          const client = a.clientUnitId
            ? clientByUnit.get(a.clientUnitId)
            : undefined;
          const adv = a.advocateMobile
            ? advByMobile.get(a.advocateMobile) ??
              advByMobile.get(toTen(a.advocateMobile))
            : undefined;
          return {
            unitId: a.unitId,
            title: a.title,
            scheduledAt: a.scheduledAt.toISOString(),
            timeLabel: formatIstTime(a.scheduledAt),
            durationMin: a.durationMin,
            mode: a.mode ?? "office",
            location: a.location,
            notes: a.notes,
            status: a.status,
            clientUnitId: a.clientUnitId,
            clientName: client?.name ?? null,
            clientMobile: client?.mobile ? displayMobile(client.mobile) : null,
            advocateMobile: a.advocateMobile
              ? displayMobile(a.advocateMobile)
              : null,
            advocateName: adv?.name ?? null,
            advocateUnitId: adv?.unitId ?? null,
            advocatePhotoUrl: adv?.photoUrl ?? null,
          };
        }

        const byAdvocateMap = new Map<
          string,
          { mobile: string; name: string; today: number; week: number }
        >();

        for (const a of todayRows) {
          const key = a.advocateMobile ? toTen(a.advocateMobile) : "unassigned";
          const name =
            key === "unassigned"
              ? "Unassigned"
              : advByMobile.get(a.advocateMobile!)?.name ??
                advByMobile.get(key)?.name ??
                displayMobile(a.advocateMobile!) ??
                key;
          const cur = byAdvocateMap.get(key) ?? {
            mobile: key === "unassigned" ? "" : key,
            name,
            today: 0,
            week: 0,
          };
          cur.today += 1;
          byAdvocateMap.set(key, cur);
        }
        for (const a of weekRows) {
          const key = a.advocateMobile ? toTen(a.advocateMobile) : "unassigned";
          const name =
            key === "unassigned"
              ? "Unassigned"
              : advByMobile.get(a.advocateMobile!)?.name ??
                advByMobile.get(key)?.name ??
                displayMobile(a.advocateMobile!) ??
                key;
          const cur = byAdvocateMap.get(key) ?? {
            mobile: key === "unassigned" ? "" : key,
            name,
            today: 0,
            week: 0,
          };
          cur.week += 1;
          byAdvocateMap.set(key, cur);
        }

        return {
          unassignedAppointments,
          payload: {
            today: todayCount,
            week: weekCount,
            todayList: todayRows.map(mapAppt),
            weekList: weekRows.slice(0, 25).map(mapAppt),
            byAdvocate: Array.from(byAdvocateMap.values()).sort(
              (a, b) => b.today - a.today || b.week - a.week
            ),
          },
        };
      })()
    : Promise.resolve(null);

  const tasksPromise = canTasks
    ? (async () => {
        const assigneeScope = isOfficeAdmin
          ? {}
          : { assigneeUnitId: user.unitId };
        const [dueToday, overdue] = await Promise.all([
          prisma.officeTask.count({
            where: {
              status: "open",
              ...assigneeScope,
              OR: [
                { dueDate: { gte: todayStart, lte: todayEnd } },
                { workDate: { gte: todayStart, lte: todayEnd } },
              ],
            },
          }),
          prisma.officeTask.count({
            where: {
              status: "open",
              ...assigneeScope,
              OR: [
                { dueDate: { lt: todayStart } },
                {
                  AND: [{ dueDate: null }, { workDate: { lt: todayStart } }],
                },
              ],
            },
          }),
        ]);
        return { tasksDueToday: dueToday, tasksOverdue: overdue };
      })()
    : Promise.resolve(null);

  const hrmsPromise = canHrmsView
    ? (async () => {
        try {
          const [myAttendance, pendingLeaveCount, onLeaveToday, holiday] =
            await Promise.all([
              prisma.attendance.findUnique({
                where: {
                  officeId_userId_date: {
                    officeId: user.officeId,
                    userId: user.id,
                    date: todayKey,
                  },
                },
              }),
              canApproveLeave
                ? prisma.leaveRequest.count({ where: { status: "pending" } })
                : Promise.resolve(null),
              prisma.leaveRequest.findFirst({
                where: {
                  userId: user.id,
                  status: "approved",
                  fromDate: { lte: todayKey },
                  toDate: { gte: todayKey },
                },
                select: { unitId: true },
              }),
              (async () => {
                try {
                  return await (
                    await import("@/features/hrms/server/office-holiday")
                  ).findOfficeHolidayForDate(todayKey);
                } catch {
                  return null;
                }
              })(),
            ]);
          return {
            pendingLeave: pendingLeaveCount ?? 0,
            payload: {
              checkedInToday: Boolean(myAttendance?.checkInAt),
              checkedOutToday: Boolean(myAttendance?.checkOutAt),
              onApprovedLeaveToday: Boolean(onLeaveToday),
              officeHolidayToday: holiday
                ? { title: holiday.title, notes: holiday.notes ?? null }
                : null,
              pendingLeaveApprovals: pendingLeaveCount,
            },
          };
        } catch {
          return null;
        }
      })()
    : Promise.resolve(null);

  const adminBoardPromise =
    isOfficeAdmin && canManageAttendance
      ? (async () => {
          try {
            const { buildPresenceBoard } = await import(
              "@/features/hrms/server/presence"
            );
            const board = await buildPresenceBoard(todayKey);
            return {
              staff: board.people.map((p) => ({
                unitId: p.unitId,
                name: p.displayName,
                mobile: p.mobile,
                photoUrl: p.photoUrl,
                checkedIn: p.status === "in" || p.status === "out",
                checkedOut: p.status === "out",
                status: p.status,
                notes: p.notes,
                busyToday: p.busyToday,
              })),
              counts: board.counts,
              officeHoliday: board.officeHoliday
                ? {
                    title: board.officeHoliday.title,
                    notes: board.officeHoliday.notes,
                  }
                : null,
              advocates: board.people.map((p) => ({
                unitId: p.unitId,
                name: p.displayName,
                mobile: p.mobile,
                photoUrl: p.photoUrl,
                checkedIn: p.status === "in" || p.status === "out",
                checkedOut: p.status === "out",
                status: p.status,
                notes: p.notes,
                busyToday: p.busyToday,
              })),
              checkedInCount: board.counts.present + board.counts.out,
              advocateCount: board.counts.total,
            };
          } catch {
            return null;
          }
        })()
      : Promise.resolve(null);

  const [
    casesResult,
    clientsResult,
    employeesResult,
    accountsResult,
    appointmentsResult,
    tasksResult,
    hrmsResult,
    adminBoardResult,
  ] = await Promise.all([
    casesPromise,
    clientsPromise,
    employeesPromise,
    accountsPromise,
    appointmentsPromise,
    tasksPromise,
    hrmsPromise,
    adminBoardPromise,
  ]);

  let missingCourtNumber = 0;
  let battaDue = 0;
  let filingDefect = 0;
  let tomorrowHearings = 0;
  let pendingPayments = 0;
  let pendingAmount = 0;
  let pendingLeave = 0;
  let unassignedAppointments = 0;
  let tasksDueToday = 0;
  let tasksOverdue = 0;

  if (casesResult) {
    missingCourtNumber = casesResult.missingCourtNumber;
    battaDue = casesResult.battaDue;
    filingDefect = casesResult.filingDefect;
    tomorrowHearings = casesResult.tomorrowHearings;
    summary.cases = casesResult.payload;
  }
  if (clientsResult) summary.clients = clientsResult;
  if (employeesResult) summary.employees = employeesResult;
  if (accountsResult) {
    pendingPayments = accountsResult.pendingPayments;
    pendingAmount = accountsResult.pendingAmount;
    summary.accounts = accountsResult.payload;
  }
  if (appointmentsResult) {
    unassignedAppointments = appointmentsResult.unassignedAppointments;
    summary.appointments = appointmentsResult.payload;
  }
  if (tasksResult) {
    tasksDueToday = tasksResult.tasksDueToday;
    tasksOverdue = tasksResult.tasksOverdue;
  }
  if (hrmsResult) {
    pendingLeave = hrmsResult.pendingLeave;
    summary.hrms = hrmsResult.payload;
  }
  if (adminBoardResult) summary.adminBoard = adminBoardResult;

  const attention: AttentionItem[] = [];
  if (tasksOverdue > 0) {
    attention.push({
      label: "Overdue tasks",
      value: String(tasksOverdue),
      href: "/tasks?due=overdue&status=open",
      cta: "Open",
      tone: "danger",
    });
  }
  if (tasksDueToday > 0) {
    attention.push({
      label: "Tasks due today",
      value: String(tasksDueToday),
      href: "/tasks?due=today&status=open",
      cta: "Open",
      tone: "warning",
    });
  }
  if (pendingPayments > 0) {
    attention.push({
      label: "Pending payments",
      value: `${pendingPayments} · ${rupee(pendingAmount)}`,
      href: "/accounts?status=pending",
      cta: "Review",
      tone: "danger",
    });
  }
  if (battaDue > 0) {
    attention.push({
      label: "Batta due",
      value: String(battaDue),
      href: "/cases?battaDue=1",
      cta: "Open",
      tone: "warning",
    });
  }
  if (filingDefect > 0) {
    attention.push({
      label: "Filing defects",
      value: String(filingDefect),
      href: "/cases?status=filing_defect",
      cta: "Open",
      tone: "warning",
    });
  }
  if (tomorrowHearings > 0) {
    attention.push({
      label: "Tomorrow’s hearings",
      value: String(tomorrowHearings),
      href: `/diary?date=${tomorrowKey}`,
      cta: "Day board",
      tone: "info",
    });
  }
  if (missingCourtNumber > 0) {
    attention.push({
      label: "Cases missing court number",
      value: String(missingCourtNumber),
      href: "/cases?missingCourtNumber=1",
      cta: "Open",
      tone: "warning",
    });
  }
  if (pendingLeave > 0) {
    attention.push({
      label: "Leave approvals waiting",
      value: String(pendingLeave),
      href: "/hrms?section=leave",
      cta: "Approve",
      tone: "info",
    });
  }
  if (unassignedAppointments > 0) {
    attention.push({
      label: "Appointments without advocate",
      value: String(unassignedAppointments),
      href: "/appointments?hearing=today&unassigned=1&status=all",
      cta: "Assign",
      tone: "warning",
    });
  }

  summary.attention = attention;

  return summary;
}
