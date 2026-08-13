import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requireStaffUser } from "@/lib/api/guard";
import { hasPermission } from "@/lib/rbac";
import { isModuleEnabled } from "@meiyon/config";
import { prisma } from "@meiyon/db";
import { istDayBounds, istDateKey } from "@/lib/utils/ist";
import { displayMobile } from "@/lib/auth/mobile";
import { toAppointmentSummary } from "@/features/appointments/server/serialize";
import { toOfficeTaskSummary } from "@/features/tasks/server/serialize";
import { effectiveHearingAdvocate } from "@/lib/hearings/court-key";

const DIARY_LIMIT = 100;

function toTen(mobile: string): string {
  const d = mobile.replace(/\D/g, "");
  return d.length === 12 && d.startsWith("91") ? d.slice(2) : d.slice(-10);
}

function mobileMatchKeys(mobile: string): string[] {
  const ten = toTen(mobile);
  if (!ten || ten.length < 10) return [];
  return [...new Set([mobile, ten, `91${ten}`, displayMobile(mobile)])];
}

export const GET = apiHandler(async (request) => {
  const { user, response } = await requireStaffUser(request);
  if (!user) return response;

  const [canCases, canAppointments, canTasks] = await Promise.all([
    isModuleEnabled("cases")
      ? hasPermission(user, "cases", "view")
      : Promise.resolve(false),
    isModuleEnabled("appointments")
      ? hasPermission(user, "appointments", "view")
      : Promise.resolve(false),
    isModuleEnabled("tasks")
      ? hasPermission(user, "tasks", "view")
      : Promise.resolve(false),
  ]);

  if (!canCases && !canAppointments && !canTasks) {
    return jsonFail("FORBIDDEN", "You don’t have access. Ask admin.", 403);
  }

  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const advocateParam = url.searchParams.get("advocateMobile");
  const dateKey = dateParam || istDateKey(new Date());
  const { start, end } = istDayBounds(dateKey);

  const isOfficeAdmin =
    user.roles.includes("admin") || user.roles.includes("sub_admin");

  const advocateKeys = advocateParam
    ? mobileMatchKeys(advocateParam)
    : null;
  // When filtering by advocate, pull a larger day window then filter in memory
  // (avoids unbounded case.findMany for that advocate).
  const hearingTake =
    advocateKeys && advocateKeys.length > 0
      ? Math.min(DIARY_LIMIT * 4, 400)
      : DIARY_LIMIT + 1;

  const hearingsPromise = !canCases
    ? Promise.resolve([])
    : advocateParam && (!advocateKeys || advocateKeys.length === 0)
      ? Promise.resolve([])
      : prisma.hearing.findMany({
          where: {
            officeId: user.officeId,
            hearingDate: { gte: start, lte: end },
            isAdjourned: false,
          },
          orderBy: { hearingDate: "asc" },
          take: hearingTake,
        });

  const appointmentsPromise =
    !canAppointments
      ? Promise.resolve([])
      : advocateParam && (!advocateKeys || advocateKeys.length === 0)
        ? Promise.resolve([])
        : prisma.appointment.findMany({
            where: {
              officeId: user.officeId,
              scheduledAt: { gte: start, lte: end },
              status: "scheduled",
              ...(advocateKeys && advocateKeys.length
                ? { advocateMobile: { in: advocateKeys } }
                : {}),
            },
            orderBy: { scheduledAt: "asc" },
            take: DIARY_LIMIT,
          });

  const tasksPromise = canTasks
    ? prisma.officeTask.findMany({
        where: {
          officeId: user.officeId,
          status: "open",
          ...(isOfficeAdmin ? {} : { assigneeUnitId: user.unitId }),
          OR: [
            { workDate: { gte: start, lte: end } },
            { dueDate: { gte: start, lte: end } },
          ],
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
        take: DIARY_LIMIT,
      })
    : Promise.resolve([]);

  const [hearingsRaw, appointmentsRaw, tasksRaw] = await Promise.all([
    hearingsPromise,
    appointmentsPromise,
    tasksPromise,
  ]);

  const caseUnitIdsForLookup = [
    ...new Set([
      ...hearingsRaw.map((h) => h.caseUnitId),
      ...appointmentsRaw
        .map((a) => a.caseUnitId)
        .filter(Boolean) as string[],
      ...tasksRaw.map((t) => t.caseUnitId).filter(Boolean) as string[],
    ]),
  ];

  const assigneeUnitIds = [
    ...new Set(tasksRaw.map((t) => t.assigneeUnitId).filter(Boolean) as string[]),
  ];

  const [cases, assigneesEarly] = await Promise.all([
    caseUnitIdsForLookup.length
      ? prisma.case.findMany({
          where: { officeId: user.officeId, unitId: { in: caseUnitIdsForLookup } },
          select: {
            unitId: true,
            caseNumber: true,
            status: true,
            stage: true,
            clientUnitId: true,
            courtName: true,
            primaryAdvocateMobile: true,
          },
        })
      : Promise.resolve([]),
    assigneeUnitIds.length
      ? prisma.user.findMany({
          where: { unitId: { in: assigneeUnitIds } },
          select: { unitId: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const caseMap = new Map(cases.map((c) => [c.unitId, c]));
  const advocateKeySet =
    advocateKeys && advocateKeys.length
      ? new Set(advocateKeys.map((k) => toTen(k)).filter(Boolean))
      : null;

  let pageHearings = hearingsRaw;
  if (advocateKeySet) {
    pageHearings = hearingsRaw.filter((h) => {
      const cse = caseMap.get(h.caseUnitId);
      const mob = effectiveHearingAdvocate({
        primaryAdvocateMobile: cse?.primaryAdvocateMobile,
      });
      if (!mob) return false;
      return advocateKeySet.has(toTen(mob));
    });
  }

  const truncated = pageHearings.length > DIARY_LIMIT;
  pageHearings = truncated ? pageHearings.slice(0, DIARY_LIMIT) : pageHearings;

  const clientUnitIds = [
    ...new Set([
      ...cases.map((c) => c.clientUnitId),
      ...appointmentsRaw
        .map((a) => a.clientUnitId)
        .filter(Boolean) as string[],
    ]),
  ];

  const advocateMobiles = [
    ...new Set(
      [
        ...cases.map((c) => c.primaryAdvocateMobile),
        ...appointmentsRaw.map((a) => a.advocateMobile),
      ].filter(Boolean) as string[]
    ),
  ];

  const [clients, advocates] = await Promise.all([
    clientUnitIds.length
      ? prisma.client.findMany({
          where: { unitId: { in: clientUnitIds } },
          select: { unitId: true, name: true },
        })
      : Promise.resolve([]),
    advocateMobiles.length
      ? prisma.user.findMany({
          where: {
            OR: advocateMobiles.flatMap((m) => {
              const ten = toTen(m);
              return [{ mobile: m }, { mobile: ten }, { mobile: `91${ten}` }];
            }),
          },
          select: { mobile: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const clientMap = new Map(clients.map((c) => [c.unitId, c]));
  const advName = new Map<string, string>();
  for (const a of advocates) {
    const ten = toTen(a.mobile);
    if (a.name) {
      advName.set(a.mobile, a.name);
      advName.set(ten, a.name);
      advName.set(`91${ten}`, a.name);
    }
  }

  const assigneeMap = new Map(assigneesEarly.map((a) => [a.unitId, a.name]));

  const items = pageHearings
    .map((h) => {
      const cse = caseMap.get(h.caseUnitId);
      const client = cse ? clientMap.get(cse.clientUnitId) : null;
      const mob = effectiveHearingAdvocate({
        primaryAdvocateMobile: cse?.primaryAdvocateMobile,
      });
      return {
        hearingUnitId: h.unitId,
        hearingDate: h.hearingDate.toISOString(),
        purpose: h.purpose,
        notes: h.notes,
        smsSentAt: h.smsSentAt?.toISOString() ?? null,
        caseUnitId: h.caseUnitId,
        caseNumber: cse?.caseNumber ?? null,
        caseStatus: cse?.status ?? null,
        stage: cse?.stage ?? null,
        clientName: client?.name ?? null,
        clientUnitId: client?.unitId ?? null,
        courtName: cse?.courtName ?? null,
        primaryAdvocateMobile: mob ? displayMobile(mob) : null,
        advocateName: mob
          ? advName.get(mob) ?? advName.get(toTen(mob)) ?? null
          : null,
      };
    })
    .sort((a, b) => {
      const courtA = (a.courtName || "Court TBD").toLocaleLowerCase("en");
      const courtB = (b.courtName || "Court TBD").toLocaleLowerCase("en");
      if (courtA !== courtB) return courtA.localeCompare(courtB);
      const caseA = (a.caseNumber || a.caseUnitId).toLocaleLowerCase("en");
      const caseB = (b.caseNumber || b.caseUnitId).toLocaleLowerCase("en");
      if (caseA !== caseB) return caseA.localeCompare(caseB);
      return a.hearingDate.localeCompare(b.hearingDate);
    });

  const appointments = appointmentsRaw.map((a) => {
    const mob = a.advocateMobile;
    return toAppointmentSummary(a, {
      clientName: a.clientUnitId
        ? clientMap.get(a.clientUnitId)?.name ?? null
        : null,
      advocateName: mob
        ? advName.get(mob) ?? advName.get(toTen(mob)) ?? null
        : null,
    });
  });

  const tasks = tasksRaw.map((t) =>
    toOfficeTaskSummary(t, {
      assigneeName: t.assigneeUnitId
        ? assigneeMap.get(t.assigneeUnitId) ?? null
        : null,
      caseNumber: t.caseUnitId
        ? caseMap.get(t.caseUnitId)?.caseNumber ?? null
        : null,
    })
  );

  return jsonOk({
    date: dateKey,
    items,
    appointments,
    tasks,
    meta: { truncated, limit: DIARY_LIMIT },
  });
});
