import type { Prisma } from "@prisma/client";
import { apiHandler, jsonFail, jsonOk, jsonOkList, parsePagination } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { nextUnitId } from "@/lib/ids";
import { writeAudit, pickAuditFields } from "@/lib/audit";
import { createOfficeTaskSchema } from "@/lib/validations/tasks.schema";
import { toOfficeTaskSummary } from "@/features/tasks/server/serialize";
import { containsInsensitive } from "@/lib/db/search";
import { istDateKey, istDayBounds } from "@/lib/utils/ist";
import { notifyUser, scheduleNotify } from "@/lib/notifications/notify";

async function resolveAssignee(
  assigneeUnitId: string | undefined | null,
  officeId: string
) {
  if (!assigneeUnitId) {
    return {
      assigneeUnitId: undefined as string | undefined,
      assigneeId: undefined as string | undefined,
    };
  }
  const person = await prisma.user.findFirst({
    where: { unitId: assigneeUnitId, officeId },
    select: { id: true, unitId: true, name: true },
  });
  if (!person) return null;
  return { assigneeUnitId: person.unitId, assigneeId: person.id, name: person.name };
}

async function enrichTasks(rows: Awaited<ReturnType<typeof prisma.officeTask.findMany>>) {
  const assigneeUnitIds = [
    ...new Set(rows.map((r) => r.assigneeUnitId).filter(Boolean) as string[]),
  ];
  const caseUnitIds = [
    ...new Set(rows.map((r) => r.caseUnitId).filter(Boolean) as string[]),
  ];

  const [assignees, cases] = await Promise.all([
    assigneeUnitIds.length
      ? prisma.user.findMany({
          where: { unitId: { in: assigneeUnitIds } },
          select: { unitId: true, name: true },
        })
      : Promise.resolve([]),
    caseUnitIds.length
      ? prisma.case.findMany({
          where: { unitId: { in: caseUnitIds } },
          select: { unitId: true, caseNumber: true },
        })
      : Promise.resolve([]),
  ]);

  const nameMap = new Map(assignees.map((a) => [a.unitId, a.name]));
  const caseMap = new Map(cases.map((c) => [c.unitId, c.caseNumber]));

  return rows.map((r) =>
    toOfficeTaskSummary(r, {
      assigneeName: r.assigneeUnitId
        ? nameMap.get(r.assigneeUnitId) ?? null
        : null,
      caseNumber: r.caseUnitId ? caseMap.get(r.caseUnitId) ?? null : null,
    })
  );
}

export const GET = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "tasks", "view");
  if (!user) return response;

  const { searchParams } = new URL(request.url);
  const { page, pageSize, skip } = parsePagination(searchParams);
  const q = searchParams.get("q")?.trim() ?? "";
  const status = searchParams.get("status")?.trim();
  const kind = searchParams.get("kind")?.trim();
  const workDate = searchParams.get("workDate")?.trim();
  const assigneeUnitId = searchParams.get("assigneeUnitId")?.trim();
  const due = searchParams.get("due")?.trim();

  const todayKey = istDateKey();
  const { start: todayStart, end: todayEnd } = istDayBounds(todayKey);
  const and: Prisma.OfficeTaskWhereInput[] = [];
  if (due === "overdue") {
    and.push({
      OR: [
        { dueDate: { lt: todayStart } },
        { AND: [{ dueDate: null }, { workDate: { lt: todayStart } }] },
      ],
    });
  } else if (due === "today") {
    and.push({
      OR: [
        { dueDate: { gte: todayStart, lte: todayEnd } },
        { workDate: { gte: todayStart, lte: todayEnd } },
      ],
    });
  }
  if (q) {
    and.push({
      OR: [
        { title: containsInsensitive(q) },
        { notes: containsInsensitive(q) },
        { finishNote: containsInsensitive(q) },
        { unitId: containsInsensitive(q) },
        { caseUnitId: containsInsensitive(q) },
        { assigneeUnitId: containsInsensitive(q) },
      ],
    });
  }

  const where: Prisma.OfficeTaskWhereInput = {
    officeId: user.officeId,
    ...(status ? { status } : due ? { status: "open" } : {}),
    ...(kind ? { kind } : {}),
    ...(assigneeUnitId ? { assigneeUnitId } : {}),
    ...(workDate && !due
      ? (() => {
          const { start, end } = istDayBounds(workDate);
          return { workDate: { gte: start, lte: end } };
        })()
      : {}),
    ...(and.length ? { AND: and } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.officeTask.findMany({
      where,
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
    }),
    prisma.officeTask.count({ where }),
  ]);

  return jsonOkList(await enrichTasks(rows), { page, pageSize, total });
});

export const POST = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "tasks", "create");
  if (!user) return response;

  const raw = await request.json();
  const parsed = createOfficeTaskSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonFail(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid request",
      400,
      parsed.error.issues
    );
  }
  const input = parsed.data;

  let caseUnitId: string | undefined;
  if (input.caseUnitId) {
    const caseItem = await prisma.case.findFirst({ where: { unitId: input.caseUnitId, officeId: user.officeId },
      select: { unitId: true },
    });
    if (!caseItem) return jsonFail("VALIDATION", "Case not found", 400);
    caseUnitId = caseItem.unitId;
  }

  const assignee = await resolveAssignee(input.assigneeUnitId || null, user.officeId);
  if (input.assigneeUnitId && !assignee) {
    return jsonFail("VALIDATION", "Assignee not found", 400);
  }

  const status = input.status ?? "open";
  const unitId = await nextUnitId("officeTask", user);
  const created = await prisma.officeTask.create({
    data: {
      officeId: user.officeId,
      officeUnitId: user.officeUnitId,
      unitId,
      title: input.title,
      kind: input.kind ?? "general",
      status,
      dueDate: input.dueDate ?? undefined,
      workDate: input.workDate ?? undefined,
      assigneeUnitId: assignee?.assigneeUnitId,
      assigneeId: assignee?.assigneeId,
      caseUnitId,
      notes: input.notes || undefined,
      finishNote: input.finishNote || undefined,
      completedAt: status === "done" ? new Date() : undefined,
      createdById: user.id,
    },
  });

  await writeAudit({
    officeId: user.officeId,
    actorUnitId: user.unitId,
    action: "task.create",
    entity: "OfficeTask",
    entityUnitId: created.unitId,
    meta: {
      after: pickAuditFields(created as Record<string, unknown>, [
        "title",
        "kind",
        "status",
        "dueDate",
        "workDate",
        "assigneeUnitId",
        "caseUnitId",
        "notes",
        "finishNote",
      ] as const),
    },
  });

  if (assignee?.assigneeId && assignee.assigneeId !== user.id) {
    scheduleNotify(async () => {
      await notifyUser({
        officeId: user.officeId,
        officeUnitId: user.officeUnitId,
        userId: assignee.assigneeId!,
        userUnitId: assignee.assigneeUnitId!,
        type: "task_assigned",
        title: `Task assigned: ${created.title}`,
        body: created.notes ?? null,
        href: `/tasks?q=${encodeURIComponent(created.unitId)}&status=all`,
        meta: { taskUnitId: created.unitId },
      });
    });
  }

  if (status === "done" && created.createdById) {
    scheduleNotify(async () => {
      const creator = await prisma.user.findUnique({
        where: { id: created.createdById! },
        select: { id: true, unitId: true },
      });
      if (!creator || creator.id === user.id) return;
      await notifyUser({
        officeId: user.officeId,
        officeUnitId: user.officeUnitId,
        userId: creator.id,
        userUnitId: creator.unitId,
        type: "task_done",
        title: `Task done: ${created.title}`,
        href: `/tasks?q=${encodeURIComponent(created.unitId)}&status=all`,
        meta: { taskUnitId: created.unitId },
      });
    });
  }

  const [summary] = await enrichTasks([created]);
  return jsonOk({ task: summary }, 201);
});
